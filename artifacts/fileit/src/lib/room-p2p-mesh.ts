// P2P WebRTC Mesh Networking Engine for Private Rooms

export interface MeshPeer {
  peerId: string;
  peerName: string;
  deviceType: "desktop" | "mobile" | "tablet";
  connected: boolean;
}

export interface MeshFileTransfer {
  id: string;
  name: string;
  size: number;
  progress: number;
  speed: string;
  direction: "sending" | "receiving";
  peerName: string;
  blobUrl?: string;
}

export interface MeshFlashMessage {
  id: string;
  text: string;
  fromName: string;
  fromPeerId: string;
  timestamp: number;
}

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

const CHUNK_SIZE = 16384; // 16 KB

export function getDeviceDetails() {
  const ua = navigator.userAgent;
  let deviceType: "desktop" | "mobile" | "tablet" = "desktop";
  let os = "Desktop OS";

  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    deviceType = "tablet";
    os = "Tablet OS";
  } else if (/mobile|iphone|ipod|android|blackberry|iemobile/i.test(ua)) {
    deviceType = "mobile";
    os = "Mobile OS";
  } else if (/win/i.test(ua)) {
    os = "Windows 11";
  } else if (/mac|iphone|ipad/i.test(ua)) {
    os = "macOS / iOS";
  } else if (/linux/i.test(ua)) {
    os = "Linux";
  }

  let browser = "Browser";
  if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Safari")) browser = "Safari";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Edge")) browser = "Edge";

  let mac = localStorage.getItem("fileit_device_mac");
  if (!mac) {
    const hex = "0123456789ABCDEF";
    mac = Array.from({ length: 6 }, () => 
      hex[Math.floor(Math.random() * 16)] + hex[Math.floor(Math.random() * 16)]
    ).join(":");
    localStorage.setItem("fileit_device_mac", mac);
  }

  const fingerprint = `FP-${Math.abs(ua.split("").reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0), 0)).toString(16).toUpperCase()}`;

  return {
    deviceType,
    peerName: `${os} (${browser})`,
    macAddress: mac,
    hardwareFingerprint: fingerprint,
    localIp: `192.168.1.${Math.floor(Math.random() * 150 + 10)}`,
  };
}

export class RoomP2PMeshManager {
  private roomId: string;
  public myPeerId: string;
  public myPeerName: string;
  public deviceType: "desktop" | "mobile" | "tablet";

  private peerConnections = new Map<string, RTCPeerConnection>();
  private dataChannels = new Map<string, RTCDataChannel>();
  private activePeers = new Map<string, MeshPeer>();
  
  private incomingFiles = new Map<string, {
    meta: { id: string; name: string; size: number; mimeType: string; fromPeerId: string; fromName: string };
    receivedBytes: number;
    chunks: ArrayBuffer[];
    startTime: number;
  }>();

  private isRunning = false;
  private heartbeatTimer: any = null;
  private signalPollTimer: any = null;

  // Event Callbacks
  public onPeersUpdated?: (peers: MeshPeer[]) => void;
  public onFileTransferProgress?: (transfer: MeshFileTransfer) => void;
  public onFileReceived?: (file: { name: string; size: number; blobUrl: string; fromName: string }) => void;
  public onClipboardSync?: (text: string, fromName: string) => void;
  public onFlashMessage?: (msg: MeshFlashMessage) => void;
  public onCanvasStroke?: (stroke: any) => void;
  public onCanvasClear?: () => void;
  public onPdfAnnotation?: (data: any) => void;
  public onLog?: (log: string) => void;

  constructor(roomId: string, customName?: string) {
    this.roomId = roomId;
    const { deviceType, peerName } = getDeviceDetails();
    this.deviceType = deviceType;
    this.myPeerName = customName || peerName;
    this.myPeerId = `peer_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
  }

  public async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.log(`Joining P2P Mesh for room "${this.roomId}" as ${this.myPeerName}...`);

    try {
      // 1. Join room mesh on signaling server
      const res = await fetch(`/api/webrtc/rooms/${this.roomId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          peerId: this.myPeerId,
          peerName: this.myPeerName,
          deviceType: this.deviceType,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        this.updateActivePeersList(data.peers || []);
      }
    } catch (err) {
      this.log(`Signaling join error: ${err}`);
    }

    // 2. Start heartbeat (every 3 seconds)
    this.heartbeatTimer = setInterval(() => this.heartbeat(), 3000);

    // 3. Start signal polling (every 1.5 seconds)
    this.signalPollTimer = setInterval(() => this.pollSignals(), 1500);
  }

  public async stop() {
    this.isRunning = false;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.signalPollTimer) clearInterval(this.signalPollTimer);

    // Close all channels & connections
    this.dataChannels.forEach((dc) => {
      try { dc.close(); } catch {}
    });
    this.dataChannels.clear();

    this.peerConnections.forEach((pc) => {
      try { pc.close(); } catch {}
    });
    this.peerConnections.clear();
    this.activePeers.clear();

    try {
      await fetch(`/api/webrtc/rooms/${this.roomId}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peerId: this.myPeerId }),
      });
    } catch {}

    this.notifyPeersChanged();
  }

  private log(msg: string) {
    if (this.onLog) this.onLog(msg);
  }

  private notifyPeersChanged() {
    if (this.onPeersUpdated) {
      this.onPeersUpdated(Array.from(this.activePeers.values()));
    }
  }

  private async heartbeat() {
    if (!this.isRunning) return;
    try {
      const res = await fetch(`/api/webrtc/rooms/${this.roomId}/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          peerId: this.myPeerId,
          peerName: this.myPeerName,
          deviceType: this.deviceType,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        this.updateActivePeersList(data.peers || []);
      }
    } catch {}
  }

  private updateActivePeersList(serverPeers: any[]) {
    const currentIds = new Set(serverPeers.map((p) => p.peerId));

    // Remove stale peers
    for (const [id] of this.activePeers.entries()) {
      if (!currentIds.has(id)) {
        this.cleanupPeer(id);
      }
    }

    // Add or update peers
    serverPeers.forEach((p) => {
      if (p.peerId === this.myPeerId) return;

      const existing = this.activePeers.get(p.peerId);
      const isDcOpen = this.dataChannels.get(p.peerId)?.readyState === "open";

      this.activePeers.set(p.peerId, {
        peerId: p.peerId,
        peerName: p.peerName,
        deviceType: p.deviceType,
        connected: isDcOpen,
      });

      // If we don't have a peer connection yet, establish one
      if (!this.peerConnections.has(p.peerId)) {
        this.setupPeerConnection(p.peerId, p.peerName);
      }
    });

    this.notifyPeersChanged();
  }

  private setupPeerConnection(targetPeerId: string, targetPeerName: string) {
    this.log(`Configuring WebRTC connection with peer: ${targetPeerName}...`);
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.peerConnections.set(targetPeerId, pc);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal(targetPeerId, "candidate", event.candidate);
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      this.log(`P2P Connection with ${targetPeerName}: ${state}`);
      if (state === "disconnected" || state === "failed" || state === "closed") {
        this.cleanupPeer(targetPeerId);
      }
    };

    // Deterministic Initiator Rule:
    // If my ID is smaller, I initiate the Offer and create the Data Channel
    const isInitiator = this.myPeerId < targetPeerId;

    if (isInitiator) {
      const dc = pc.createDataChannel("fileit-room-mesh", { ordered: true });
      this.setupDataChannel(targetPeerId, dc);

      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          this.sendSignal(targetPeerId, "offer", pc.localDescription);
        })
        .catch((err) => this.log(`Error creating offer: ${err}`));
    } else {
      pc.ondatachannel = (event) => {
        this.setupDataChannel(targetPeerId, event.channel);
      };
    }
  }

  private setupDataChannel(peerId: string, dc: RTCDataChannel) {
    this.dataChannels.set(peerId, dc);
    dc.binaryType = "arraybuffer";

    dc.onopen = () => {
      const peer = this.activePeers.get(peerId);
      if (peer) peer.connected = true;
      this.notifyPeersChanged();
      this.log(`🚀 High-speed Direct P2P Channel OPEN with ${peer?.peerName || peerId}!`);
    };

    dc.onclose = () => {
      const peer = this.activePeers.get(peerId);
      if (peer) peer.connected = false;
      this.notifyPeersChanged();
      this.log(`P2P Channel closed with ${peer?.peerName || peerId}`);
    };

    dc.onmessage = (event) => {
      if (typeof event.data === "string") {
        try {
          const msg = JSON.parse(event.data);
          this.handleTextMessage(peerId, msg);
        } catch (e) {
          console.error("Invalid JSON message", e);
        }
      } else if (event.data instanceof ArrayBuffer) {
        this.handleBinaryChunk(peerId, event.data);
      }
    };
  }

  private handleTextMessage(peerId: string, msg: any) {
    if (msg.type === "clipboard-sync") {
      this.log(`📋 Received synced clipboard from ${msg.fromName}`);
      if (this.onClipboardSync) {
        this.onClipboardSync(msg.text, msg.fromName);
      }
    } else if (msg.type === "flash-msg") {
      if (this.onFlashMessage) {
        this.onFlashMessage({
          id: msg.id || Math.random().toString(),
          text: msg.text,
          fromName: msg.fromName,
          fromPeerId: peerId,
          timestamp: msg.timestamp || Date.now(),
        });
      }
    } else if (msg.type === "canvas-stroke") {
      if (this.onCanvasStroke && msg.stroke) {
        this.onCanvasStroke(msg.stroke);
      }
    } else if (msg.type === "canvas-clear") {
      if (this.onCanvasClear) {
        this.onCanvasClear();
      }
    } else if (msg.type === "pdf-annotation") {
      if (this.onPdfAnnotation && msg.payload) {
        this.onPdfAnnotation(msg.payload);
      }
    } else if (msg.type === "file-start") {
      this.incomingFiles.set(msg.id, {
        meta: msg,
        receivedBytes: 0,
        chunks: [],
        startTime: Date.now(),
      });
      this.log(`📥 Incoming direct P2P stream: "${msg.name}" (${(msg.size / (1024 * 1024)).toFixed(2)} MB) from ${msg.fromName}`);
    } else if (msg.type === "file-end") {
      const fileData = this.incomingFiles.get(msg.id);
      if (fileData) {
        const blob = new Blob(fileData.chunks, { type: fileData.meta.mimeType || "application/octet-stream" });
        const blobUrl = URL.createObjectURL(blob);

        if (this.onFileReceived) {
          this.onFileReceived({
            name: fileData.meta.name,
            size: fileData.meta.size,
            blobUrl,
            fromName: fileData.meta.fromName,
          });
        }

        if (this.onFileTransferProgress) {
          this.onFileTransferProgress({
            id: msg.id,
            name: fileData.meta.name,
            size: fileData.meta.size,
            progress: 100,
            speed: "Complete",
            direction: "receiving",
            peerName: fileData.meta.fromName,
            blobUrl,
          });
        }

        this.incomingFiles.delete(msg.id);
        this.log(`✅ File "${fileData.meta.name}" fully assembled directly in browser RAM!`);
      }
    }
  }

  private handleBinaryChunk(peerId: string, buffer: ArrayBuffer) {
    // Look up current active receiving file
    for (const [fileId, fileData] of this.incomingFiles.entries()) {
      if (fileData.meta.fromPeerId === peerId) {
        fileData.chunks.push(buffer);
        fileData.receivedBytes += buffer.byteLength;

        const progress = Math.min(100, Math.round((fileData.receivedBytes / fileData.meta.size) * 100));
        const elapsedSec = (Date.now() - fileData.startTime) / 1000;
        const speedMb = elapsedSec > 0 ? (fileData.receivedBytes / (1024 * 1024 * elapsedSec)).toFixed(2) + " MB/s" : "Calculating...";

        if (this.onFileTransferProgress) {
          this.onFileTransferProgress({
            id: fileId,
            name: fileData.meta.name,
            size: fileData.meta.size,
            progress,
            speed: speedMb,
            direction: "receiving",
            peerName: fileData.meta.fromName,
          });
        }
        break;
      }
    }
  }

  private async sendSignal(toPeerId: string, type: "offer" | "answer" | "candidate", payload: any) {
    try {
      await fetch(`/api/webrtc/rooms/${this.roomId}/signal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromPeerId: this.myPeerId,
          toPeerId,
          type,
          payload,
        }),
      });
    } catch {}
  }

  private async pollSignals() {
    if (!this.isRunning) return;
    try {
      const res = await fetch(`/api/webrtc/rooms/${this.roomId}/signals/${this.myPeerId}`);
      if (!res.ok) return;

      const data = await res.json();
      const signals: any[] = data.signals || [];

      for (const sig of signals) {
        const { fromPeerId, type, payload } = sig;
        let pc = this.peerConnections.get(fromPeerId);

        if (!pc && type === "offer") {
          const peer = this.activePeers.get(fromPeerId);
          this.setupPeerConnection(fromPeerId, peer?.peerName || fromPeerId);
          pc = this.peerConnections.get(fromPeerId);
        }

        if (!pc) continue;

        if (type === "offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(payload));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          this.sendSignal(fromPeerId, "answer", pc.localDescription);
        } else if (type === "answer") {
          await pc.setRemoteDescription(new RTCSessionDescription(payload));
        } else if (type === "candidate") {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(payload));
          } catch {}
        }
      }
    } catch {}
  }

  private cleanupPeer(peerId: string) {
    const dc = this.dataChannels.get(peerId);
    if (dc) {
      try { dc.close(); } catch {}
      this.dataChannels.delete(peerId);
    }

    const pc = this.peerConnections.get(peerId);
    if (pc) {
      try { pc.close(); } catch {}
      this.peerConnections.delete(peerId);
    }

    this.activePeers.delete(peerId);
    this.notifyPeersChanged();
  }

  // ── Public Broadcasting Methods ──────────────────────────────────────────

  public broadcastClipboard(text: string) {
    const msg = JSON.stringify({
      type: "clipboard-sync",
      text,
      fromName: this.myPeerName,
      timestamp: Date.now(),
    });

    let sentCount = 0;
    this.dataChannels.forEach((dc) => {
      if (dc.readyState === "open") {
        dc.send(msg);
        sentCount++;
      }
    });

    this.log(`📋 Broadcast clipboard snippet to ${sentCount} active P2P peers.`);
    return sentCount;
  }

  public broadcastFlashMessage(text: string) {
    const msgObj: MeshFlashMessage = {
      id: Math.random().toString(36).substring(2, 9),
      text,
      fromName: this.myPeerName,
      fromPeerId: this.myPeerId,
      timestamp: Date.now(),
    };

    const msg = JSON.stringify({
      type: "flash-msg",
      ...msgObj,
    });

    let sentCount = 0;
    this.dataChannels.forEach((dc) => {
      if (dc.readyState === "open") {
        dc.send(msg);
        sentCount++;
      }
    });

    return msgObj;
  }

  public broadcastCanvasStroke(stroke: any) {
    const msg = JSON.stringify({
      type: "canvas-stroke",
      stroke,
      fromPeerId: this.myPeerId,
    });
    this.dataChannels.forEach((dc) => {
      if (dc.readyState === "open") {
        try { dc.send(msg); } catch {}
      }
    });
  }

  public broadcastCanvasClear() {
    const msg = JSON.stringify({
      type: "canvas-clear",
      fromPeerId: this.myPeerId,
    });
    this.dataChannels.forEach((dc) => {
      if (dc.readyState === "open") {
        try { dc.send(msg); } catch {}
      }
    });
  }

  public broadcastPdfAnnotation(payload: any) {
    const msg = JSON.stringify({
      type: "pdf-annotation",
      payload,
      fromPeerId: this.myPeerId,
      fromName: this.myPeerName,
      timestamp: Date.now(),
    });
    this.dataChannels.forEach((dc) => {
      if (dc.readyState === "open") {
        try { dc.send(msg); } catch {}
      }
    });
  }

  public async broadcastFile(file: File, onProgress?: (progress: number, speed: string) => void) {
    const openChannels: RTCDataChannel[] = [];
    this.dataChannels.forEach((dc) => {
      if (dc.readyState === "open") openChannels.push(dc);
    });

    if (openChannels.length === 0) {
      throw new Error("No direct peer connected. Connect a second device on Wi-Fi to stream.");
    }

    const fileId = `file_${Math.random().toString(36).substring(2, 9)}`;
    const metaMsg = JSON.stringify({
      type: "file-start",
      id: fileId,
      name: file.name,
      size: file.size,
      mimeType: file.type,
      fromPeerId: this.myPeerId,
      fromName: this.myPeerName,
    });

    // Send file-start metadata to all peers
    openChannels.forEach((dc) => dc.send(metaMsg));

    let offset = 0;
    const startTime = Date.now();

    return new Promise<void>((resolve, reject) => {
      const fileReader = new FileReader();

      fileReader.onload = (e) => {
        if (!e.target?.result) return;
        const buffer = e.target.result as ArrayBuffer;

        openChannels.forEach((dc) => {
          if (dc.readyState === "open") {
            dc.send(buffer);
          }
        });

        offset += buffer.byteLength;
        const progress = Math.min(100, Math.round((offset / file.size) * 100));
        const elapsedSec = (Date.now() - startTime) / 1000;
        const speedMb = elapsedSec > 0 ? (offset / (1024 * 1024 * elapsedSec)).toFixed(2) + " MB/s" : "Calculating...";

        if (onProgress) onProgress(progress, speedMb);
        if (this.onFileTransferProgress) {
          this.onFileTransferProgress({
            id: fileId,
            name: file.name,
            size: file.size,
            progress,
            speed: speedMb,
            direction: "sending",
            peerName: `${openChannels.length} Devices`,
          });
        }

        if (offset < file.size) {
          readNextChunk();
        } else {
          // File completed
          const endMsg = JSON.stringify({ type: "file-end", id: fileId });
          openChannels.forEach((dc) => {
            if (dc.readyState === "open") dc.send(endMsg);
          });
          this.log(`🎉 Finished streaming "${file.name}" to ${openChannels.length} devices via P2P!`);
          resolve();
        }
      };

      fileReader.onerror = (err) => reject(err);

      const readNextChunk = () => {
        const slice = file.slice(offset, offset + CHUNK_SIZE);
        fileReader.readAsArrayBuffer(slice);
      };

      readNextChunk();
    });
  }

  public getConnectedPeerCount(): number {
    let count = 0;
    this.dataChannels.forEach((dc) => {
      if (dc.readyState === "open") count++;
    });
    return count;
  }
}
