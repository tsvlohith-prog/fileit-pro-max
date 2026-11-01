import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useDynamicBubble } from "@/components/dynamic-bubble-context";

export interface SyncedClipboardItem {
  id: string;
  type: "text" | "link" | "image";
  content: string;
  timestamp: number;
  sourceDevice: string;
  hash: string;
}

export interface VaultFile {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  fileRef?: File;
  folderPath?: string;
}

export interface ReceivedItem {
  id: string;
  type: "text" | "file";
  name?: string;
  text?: string;
  blobUrl?: string;
  size?: number;
  timestamp: string;
}

export type P2PState = "idle" | "creating" | "waiting_for_peer" | "connecting" | "connected" | "disconnected";

interface P2PConnectionContextType {
  p2pState: P2PState;
  connectionRole: "initiator" | "receiver" | null;
  sessionCode: string;
  enteredCode: string;
  setEnteredCode: (code: string) => void;
  remoteDeviceName: string;
  latency: number | null;
  logs: string[];
  addLog: (msg: string) => void;

  startAsInitiator: () => Promise<string>;
  startAsReceiver: (codeToJoin?: string) => Promise<boolean>;
  disconnect: () => void;
  sendDataChannelMessage: (msg: any) => boolean;

  syncedClipboard: SyncedClipboardItem[];
  sendClipboardText: (text: string) => void;
  clearClipboard: () => void;

  remoteVaultFiles: VaultFile[];
  localVaultFiles: VaultFile[];
  setLocalVaultFiles: React.Dispatch<React.SetStateAction<VaultFile[]>>;
  addLocalFilesToVault: (files: File[], folderPath?: string) => void;
  removeLocalVaultFile: (id: string) => void;
  requestRemoteFile: (fileId: string) => void;
  syncAllRemoteFiles: () => void;

  sendFilesDirect: (files: File[]) => Promise<void>;
  isTransferring: boolean;
  transferProgress: number;
  transferSpeed: number;
  receivedItems: ReceivedItem[];
  clearReceivedItems: () => void;
}

const P2PConnectionContext = createContext<P2PConnectionContextType | undefined>(undefined);

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
  ],
  iceCandidatePoolSize: 10,
};

function getDeviceName(): string {
  if (typeof navigator === "undefined") return "Device";
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "Android Phone";
  if (/iPad|iPhone|iPod/.test(ua)) return "iPhone / iPad";
  if (/Macintosh|Mac OS X/.test(ua)) return "MacBook";
  if (/Windows/.test(ua)) return "Windows PC";
  if (/Linux/.test(ua)) return "Linux PC";
  return "Connected Device";
}

export function P2PConnectionProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const { setConnectedPeer, startTransfer, updateTransferProgress, completeTransfer } = useDynamicBubble();

  const [p2pState, setP2PState] = useState<P2PState>("idle");
  const [connectionRole, setConnectionRole] = useState<"initiator" | "receiver" | null>(null);
  const [sessionCode, setSessionCode] = useState<string>("");
  const [enteredCode, setEnteredCode] = useState<string>("");
  const [remoteDeviceName, setRemoteDeviceName] = useState<string>("Paired Device");
  const [latency, setLatency] = useState<number | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const [syncedClipboard, setSyncedClipboard] = useState<SyncedClipboardItem[]>([]);
  const [remoteVaultFiles, setRemoteVaultFiles] = useState<VaultFile[]>([]);
  const [localVaultFiles, setLocalVaultFiles] = useState<VaultFile[]>([]);
  const [receivedItems, setReceivedItems] = useState<ReceivedItem[]>([]);

  const [isTransferring, setIsTransferring] = useState(false);
  const [transferProgress, setTransferProgress] = useState(0);
  const [transferSpeed, setTransferSpeed] = useState(0);

  // WebRTC Native References (Persistent Singletons across navigation!)
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const pollingIntervalRef = useRef<number | null>(null);
  const candidatePollingRef = useRef<number | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);

  // Chunk Reception Buffers
  const incomingChunksRef = useRef<Map<string, { chunks: ArrayBuffer[]; receivedBytes: number; meta: any }>>(new Map());

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev.slice(-30), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  // Update Dynamic Island on connection changes
  useEffect(() => {
    if (p2pState === "connected") {
      setConnectedPeer({
        id: sessionCode || "p2p-session",
        name: remoteDeviceName || "Paired Device",
        deviceType: /phone|android|iphone/i.test(remoteDeviceName) ? "mobile" : "desktop",
        connectedAt: Date.now(),
        isDirectP2P: true,
        roomCode: sessionCode,
      });
    } else {
      setConnectedPeer(null);
    }
  }, [p2pState, sessionCode, remoteDeviceName, setConnectedPeer]);

  // Safe DataChannel Send
  const sendDataChannelMessage = useCallback((msgObj: any): boolean => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === "open") {
      try {
        dataChannelRef.current.send(JSON.stringify(msgObj));
        return true;
      } catch (err) {
        console.error("DataChannel send failed:", err);
      }
    }
    return false;
  }, []);

  // ── Setup DataChannel & Message Handlers ─────────────────────────────────────
  const setupDataChannelEvents = useCallback((channel: RTCDataChannel) => {
    channel.binaryType = "arraybuffer";

    channel.onopen = () => {
      setP2PState("connected");
      addLog("P2P DataChannel established! (Persistent across navigation)");
      toast({
        title: "Devices Linked Successfully",
        description: "Clipboard Sync and Bi-Directional Folder Access are now active.",
      });

      // Send Handshake with local vault file manifest
      sendDataChannelMessage({
        type: "HANDSHAKE",
        deviceName: getDeviceName(),
        vaultFiles: localVaultFiles.map(({ fileRef, ...meta }) => meta),
      });

      // Start 4-second Keep-Alive Heartbeat loop
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = window.setInterval(() => {
        if (channel.readyState === "open") {
          channel.send(JSON.stringify({ type: "PING", t: Date.now() }));
        }
      }, 4000);
    };

    channel.onclose = () => {
      setP2PState("disconnected");
      addLog("DataChannel closed.");
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };

    channel.onerror = (err) => {
      console.warn("DataChannel error:", err);
      addLog("DataChannel error encountered.");
    };

    channel.onmessage = (event) => {
      // 1. Binary ArrayBuffer chunk received
      if (typeof event.data !== "string") {
        const buffer = event.data as ArrayBuffer;
        const headerView = new Uint8Array(buffer, 0, 16);
        const headerStr = new TextDecoder().decode(headerView).trim();
        const payload = buffer.slice(16);

        const transfer = incomingChunksRef.current.get(headerStr);
        if (transfer) {
          transfer.chunks.push(payload);
          transfer.receivedBytes += payload.byteLength;
          const prog = Math.min(100, Math.round((transfer.receivedBytes / transfer.meta.fileSize) * 100));
          setTransferProgress(prog);
          updateTransferProgress(transfer.meta.fileId, prog, 8.5);

          if (transfer.receivedBytes >= transfer.meta.fileSize) {
            // File completed
            const blob = new Blob(transfer.chunks, { type: transfer.meta.mimeType || "application/octet-stream" });
            const blobUrl = URL.createObjectURL(blob);
            setReceivedItems((prev) => [
              {
                id: transfer.meta.fileId,
                type: "file",
                name: transfer.meta.fileName,
                blobUrl,
                size: transfer.meta.fileSize,
                timestamp: new Date().toLocaleTimeString(),
              },
              ...prev,
            ]);
            completeTransfer(transfer.meta.fileId);
            incomingChunksRef.current.delete(headerStr);
            setIsTransferring(false);
            setTransferProgress(0);
            toast({
              title: "File Received via P2P",
              description: `${transfer.meta.fileName} received directly into memory.`,
            });
          }
        }
        return;
      }

      // 2. JSON control / manifest messages
      try {
        const msg = JSON.parse(event.data);

        // Heartbeat Ping / Pong
        if (msg.type === "PING") {
          sendDataChannelMessage({ type: "PONG", t: msg.t });
          return;
        }
        if (msg.type === "PONG") {
          const rtt = Math.max(1, Date.now() - msg.t);
          setLatency(rtt);
          return;
        }

        // Handshake
        if (msg.type === "HANDSHAKE") {
          setRemoteDeviceName(msg.deviceName || "Paired Device");
          if (Array.isArray(msg.vaultFiles)) {
            setRemoteVaultFiles(msg.vaultFiles);
          }
          addLog(`Paired with ${msg.deviceName}`);
          return;
        }

        // Remote Vault Manifest Update
        if (msg.type === "VAULT_MANIFEST") {
          if (Array.isArray(msg.files)) {
            setRemoteVaultFiles(msg.files);
            addLog(`Updated remote folder manifest: ${msg.files.length} items`);
          }
          return;
        }

        // Clipboard Sync Item Received
        if (msg.type === "CLIPBOARD_SYNC") {
          setSyncedClipboard((prev) => {
            if (prev.some((item) => item.hash === msg.item.hash)) return prev;
            return [msg.item, ...prev];
          });
          toast({
            title: "Clipboard Synced from Phone",
            description: msg.item.content.length > 50 ? msg.item.content.slice(0, 50) + "..." : msg.item.content,
          });
          return;
        }

        // Remote File Transfer Start
        if (msg.type === "FILE_START") {
          incomingChunksRef.current.set(msg.fileId, {
            chunks: [],
            receivedBytes: 0,
            meta: msg,
          });
          setIsTransferring(true);
          setTransferProgress(0);
          startTransfer({
            id: msg.fileId,
            name: msg.fileName,
            type: "p2p",
            progress: 0,
            speedMBps: 8.5,
          });
          return;
        }

        // Request File from this device
        if (msg.type === "REQUEST_FILE") {
          const target = localVaultFiles.find((f) => f.id === msg.fileId);
          if (target && target.fileRef) {
            addLog(`Fulfilling remote request for ${target.name}`);
            sendFilesDirect([target.fileRef]);
          }
          return;
        }
      } catch (err) {
        console.warn("Failed to parse DataChannel message:", err);
      }
    };
  }, [addLog, toast, localVaultFiles, sendDataChannelMessage, startTransfer, updateTransferProgress, completeTransfer]);

  // Clean Disconnect (Only when explicitly called or tab closed!)
  const disconnect = useCallback(() => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    if (candidatePollingRef.current) clearInterval(candidatePollingRef.current);
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);

    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    setP2PState("idle");
    setSessionCode("");
    setConnectionRole(null);
    setRemoteDeviceName("Paired Device");
    setLatency(null);
    setRemoteVaultFiles([]);
    addLog("Disconnected session.");
    toast({ title: "Session Disconnected" });
  }, [addLog, toast]);

  // ── INITIATOR FLOW (Creates session and QR) ──────────────────────────────────
  const startAsInitiator = useCallback(async (): Promise<string> => {
    try {
      disconnect();
      setP2PState("creating");
      addLog("Creating WebRTC session...");

      const res = await fetch("/api/webrtc/session", { method: "POST" });
      if (!res.ok) throw new Error("Could not create signaling session");
      const { code } = await res.json();
      setSessionCode(code);
      setConnectionRole("initiator");

      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;

      // ICE candidates
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          try {
            await fetch(`/api/webrtc/session/${code}/candidates/initiator`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ candidate: event.candidate }),
            });
          } catch {}
        }
      };

      // Create DataChannel
      const dc = pc.createDataChannel("fileit-data", { ordered: true });
      dataChannelRef.current = dc;
      setupDataChannelEvents(dc);

      // Create Offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await fetch(`/api/webrtc/session/${code}/offer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer }),
      });

      setP2PState("waiting_for_peer");
      addLog(`Session ${code} ready. Waiting for peer...`);

      // Poll for Answer
      const pollInterval = window.setInterval(async () => {
        try {
          const ansRes = await fetch(`/api/webrtc/session/${code}/answer`);
          if (ansRes.status === 200) {
            const { answer } = await ansRes.json();
            clearInterval(pollInterval);
            pollingIntervalRef.current = null;

            if (pc.signalingState !== "closed" && !pc.currentRemoteDescription) {
              await pc.setRemoteDescription(new RTCSessionDescription(answer));
              setP2PState("connecting");
              addLog("Peer answered! Negotiating connection...");

              // Fetch receiver ICE candidates
              const candRes = await fetch(`/api/webrtc/session/${code}/candidates/receiver`);
              if (candRes.ok) {
                const { candidates } = await candRes.json();
                for (const c of candidates) {
                  try {
                    await pc.addIceCandidate(new RTCIceCandidate(c));
                  } catch {}
                }
              }
            }
          }
        } catch {}
      }, 1500);
      pollingIntervalRef.current = pollInterval;

      return code;
    } catch (err: any) {
      setP2PState("idle");
      addLog(`Failed to create session: ${err?.message || err}`);
      toast({ variant: "destructive", title: "Signaling Failed", description: "Could not create peer session." });
      throw err;
    }
  }, [disconnect, addLog, setupDataChannelEvents, toast]);

  // ── RECEIVER FLOW (Scans QR or enters code) ─────────────────────────────────
  const startAsReceiver = useCallback(async (codeToJoin?: string): Promise<boolean> => {
    const code = (codeToJoin || enteredCode).trim();
    if (!code) {
      toast({ variant: "destructive", title: "Invalid Code", description: "Please enter or scan a valid session code." });
      return false;
    }

    try {
      disconnect();
      setP2PState("connecting");
      setSessionCode(code);
      setConnectionRole("receiver");
      addLog(`Connecting to session ${code}...`);

      const sessionRes = await fetch(`/api/webrtc/session/${code}`);
      if (!sessionRes.ok) {
        throw new Error("Session not found or expired");
      }

      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;

      pc.ondatachannel = (event) => {
        dataChannelRef.current = event.channel;
        setupDataChannelEvents(event.channel);
      };

      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          try {
            await fetch(`/api/webrtc/session/${code}/candidates/receiver`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ candidate: event.candidate }),
            });
          } catch {}
        }
      };

      // Poll for offer if not ready
      let offer: any = null;
      let attempts = 0;
      while (!offer && attempts < 15) {
        const offRes = await fetch(`/api/webrtc/session/${code}/offer`);
        if (offRes.status === 200) {
          const data = await offRes.json();
          offer = data.offer;
          break;
        }
        await new Promise((r) => setTimeout(r, 1000));
        attempts++;
      }

      if (!offer) {
        throw new Error("Host offer timed out");
      }

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await fetch(`/api/webrtc/session/${code}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer }),
      });

      // Fetch initiator candidates
      const candRes = await fetch(`/api/webrtc/session/${code}/candidates/initiator`);
      if (candRes.ok) {
        const { candidates } = await candRes.json();
        for (const c of candidates) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          } catch {}
        }
      }

      addLog("Answer sent! Connecting direct stream...");
      return true;
    } catch (err: any) {
      setP2PState("idle");
      addLog(`Join error: ${err?.message || err}`);
      toast({ variant: "destructive", title: "Connection Failed", description: err?.message || "Could not link to host." });
      return false;
    }
  }, [enteredCode, disconnect, addLog, setupDataChannelEvents, toast]);

  // ── Clipboard Sync ─────────────────────────────────────────────────────────
  const sendClipboardText = useCallback((text: string) => {
    if (!text.trim()) return;
    const item: SyncedClipboardItem = {
      id: Math.random().toString(36).substring(2, 9),
      type: /^https?:\/\//i.test(text.trim()) ? "link" : "text",
      content: text.trim(),
      timestamp: Date.now(),
      sourceDevice: getDeviceName(),
      hash: btoa(text.trim().slice(0, 32)),
    };

    setSyncedClipboard((prev) => [item, ...prev]);
    sendDataChannelMessage({ type: "CLIPBOARD_SYNC", item });
    toast({ title: "Sent to Connected Device", description: "Clipboard item broadcasted." });
  }, [sendDataChannelMessage, toast]);

  const clearClipboard = useCallback(() => {
    setSyncedClipboard([]);
  }, []);

  // ── Vault Management & Bi-Directional Folder Sync ───────────────────────────
  const addLocalFilesToVault = useCallback((files: File[], folderPath?: string) => {
    const newItems: VaultFile[] = files.map((f) => ({
      id: `vault_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: f.name,
      size: f.size,
      type: f.type || "application/octet-stream",
      lastModified: f.lastModified || Date.now(),
      fileRef: f,
      folderPath: folderPath || (f as any).webkitRelativePath ? (f as any).webkitRelativePath.split("/").slice(0, -1).join("/") : "",
    }));

    setLocalVaultFiles((prev) => {
      const merged = [...newItems, ...prev];
      // Broadcast updated manifest to peer
      sendDataChannelMessage({
        type: "VAULT_MANIFEST",
        files: merged.map(({ fileRef, ...meta }) => meta),
      });
      return merged;
    });

    toast({
      title: `${files.length} Item${files.length > 1 ? "s" : ""} Added to Local Vault`,
      description: "Manifest automatically synchronized to paired device.",
    });
  }, [sendDataChannelMessage, toast]);

  const removeLocalVaultFile = useCallback((id: string) => {
    setLocalVaultFiles((prev) => {
      const filtered = prev.filter((f) => f.id !== id);
      sendDataChannelMessage({
        type: "VAULT_MANIFEST",
        files: filtered.map(({ fileRef, ...meta }) => meta),
      });
      return filtered;
    });
  }, [sendDataChannelMessage]);

  const requestRemoteFile = useCallback((fileId: string) => {
    sendDataChannelMessage({ type: "REQUEST_FILE", fileId });
    toast({ title: "Requesting File from Peer", description: "Stream starting via direct DataChannel..." });
  }, [sendDataChannelMessage, toast]);

  const syncAllRemoteFiles = useCallback(() => {
    if (remoteVaultFiles.length === 0) return;
    toast({ title: "Syncing Remote Folder", description: `Requesting ${remoteVaultFiles.length} files...` });
    remoteVaultFiles.forEach((file, idx) => {
      setTimeout(() => requestRemoteFile(file.id), idx * 400);
    });
  }, [remoteVaultFiles, requestRemoteFile, toast]);

  // ── Send Files Direct in Chunks (64KB ArrayBuffer) ──────────────────────────
  const sendFilesDirect = useCallback(async (files: File[]) => {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== "open") {
      toast({ variant: "destructive", title: "No Device Linked", description: "Pair a device to beam files." });
      return;
    }

    const channel = dataChannelRef.current;
    setIsTransferring(true);

    for (const file of files) {
      const fileId = Math.random().toString(36).substring(2, 9);
      const chunkSize = 16384; // 16KB per chunk for maximum WebRTC buffer safety

      sendDataChannelMessage({
        type: "FILE_START",
        fileId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });

      startTransfer({
        id: fileId,
        name: file.name,
        type: "p2p",
        progress: 0,
        speedMBps: 9.2,
      });

      const buffer = await file.arrayBuffer();
      let offset = 0;
      const headerBytes = new TextEncoder().encode(fileId.padEnd(16, " "));

      while (offset < buffer.byteLength) {
        // Handle bufferedAmount flow control to avoid WebRTC buffer overflow
        if (channel.bufferedAmount > 256 * 1024) {
          await new Promise((res) => setTimeout(res, 25));
        }

        const chunkData = buffer.slice(offset, offset + chunkSize);
        const packet = new Uint8Array(16 + chunkData.byteLength);
        packet.set(headerBytes, 0);
        packet.set(new Uint8Array(chunkData), 16);

        channel.send(packet.buffer);
        offset += chunkSize;

        const prog = Math.min(100, Math.round((offset / buffer.byteLength) * 100));
        setTransferProgress(prog);
        updateTransferProgress(fileId, prog, 9.2);
      }

      completeTransfer(fileId);
    }

    setIsTransferring(false);
    setTransferProgress(0);
    toast({ title: "Transfer Complete", description: "All files streamed to peer." });
  }, [sendDataChannelMessage, startTransfer, updateTransferProgress, completeTransfer, toast]);

  const clearReceivedItems = useCallback(() => {
    setReceivedItems([]);
  }, []);

  return (
    <P2PConnectionContext.Provider
      value={{
        p2pState,
        connectionRole,
        sessionCode,
        enteredCode,
        setEnteredCode,
        remoteDeviceName,
        latency,
        logs,
        addLog,

        startAsInitiator,
        startAsReceiver,
        disconnect,
        sendDataChannelMessage,

        syncedClipboard,
        sendClipboardText,
        clearClipboard,

        remoteVaultFiles,
        localVaultFiles,
        setLocalVaultFiles,
        addLocalFilesToVault,
        removeLocalVaultFile,
        requestRemoteFile,
        syncAllRemoteFiles,

        sendFilesDirect,
        isTransferring,
        transferProgress,
        transferSpeed,
        receivedItems,
        clearReceivedItems,
      }}
    >
      {children}
    </P2PConnectionContext.Provider>
  );
}

export function useP2PConnection() {
  const context = useContext(P2PConnectionContext);
  if (!context) {
    throw new Error("useP2PConnection must be used within a P2PConnectionProvider");
  }
  return context;
}
