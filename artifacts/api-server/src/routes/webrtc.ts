import { Router } from "express";

const router = Router();

// ── Speedtest download dummy chunk (2MB) ───────────────────────────────────
router.get("/webrtc/speedtest", (req, res) => {
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Length", "2097152"); // 2MB
  const chunk = "0".repeat(65536); // 64KB chunk
  for (let i = 0; i < 32; i++) {
    res.write(chunk);
  }
  res.end();
});

interface WebRTCSession {
  code: string;
  offer: any | null;
  answer: any | null;
  initiatorCandidates: any[];
  receiverCandidates: any[];
  createdAt: number;
}

// In-memory store for ephemeral signaling sessions
const sessions = new Map<string, WebRTCSession>();

// Self-cleanup interval: remove sessions older than 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [code, session] of sessions.entries()) {
    if (now - session.createdAt > 5 * 60 * 1000) {
      sessions.delete(code);
    }
  }
}, 60 * 1000);

// Generate random 6-digit code
function generateCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
}

// ── Create a signaling session (Initiator) ──────────────────────────────────
router.post("/webrtc/session", (req, res) => {
  let code = generateCode();
  // Ensure uniqueness
  while (sessions.has(code)) {
    code = generateCode();
  }

  const newSession: WebRTCSession = {
    code,
    offer: null,
    answer: null,
    initiatorCandidates: [],
    receiverCandidates: [],
    createdAt: Date.now(),
  };

  sessions.set(code, newSession);
  res.json({ code });
});

// ── Check if session exists (Receiver) ──────────────────────────────────────
router.get("/webrtc/session/:code", (req, res) => {
  const { code } = req.params;
  const session = sessions.get(code);

  if (!session) {
    res.status(404).json({ error: "Session not found or expired" });
    return;
  }

  res.json({ code: session.code, hasOffer: !!session.offer });
});

// ── Upload Offer (Initiator) ────────────────────────────────────────────────
router.post("/webrtc/session/:code/offer", (req, res) => {
  const { code } = req.params;
  const { offer } = req.body;
  const session = sessions.get(code);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  session.offer = offer;
  res.status(204).send();
});

// ── Get Offer (Receiver) ───────────────────────────────────────────────────
router.get("/webrtc/session/:code/offer", (req, res) => {
  const { code } = req.params;
  const session = sessions.get(code);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (!session.offer) {
    res.status(202).json({ status: "waiting_for_offer" });
    return;
  }

  res.json({ offer: session.offer });
});

// ── Upload Answer (Receiver) ────────────────────────────────────────────────
router.post("/webrtc/session/:code/answer", (req, res) => {
  const { code } = req.params;
  const { answer } = req.body;
  const session = sessions.get(code);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  session.answer = answer;
  res.status(204).send();
});

// ── Get Answer (Initiator) ──────────────────────────────────────────────────
router.get("/webrtc/session/:code/answer", (req, res) => {
  const { code } = req.params;
  const session = sessions.get(code);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (!session.answer) {
    res.status(202).json({ status: "waiting_for_answer" });
    return;
  }

  res.json({ answer: session.answer });
});

// ── Upload ICE Candidates ───────────────────────────────────────────────────
router.post("/webrtc/session/:code/candidates/:peerType", (req, res) => {
  const { code, peerType } = req.params;
  const { candidate } = req.body;
  const session = sessions.get(code);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (peerType === "initiator") {
    session.initiatorCandidates.push(candidate);
  } else if (peerType === "receiver") {
    session.receiverCandidates.push(candidate);
  } else {
    res.status(400).json({ error: "Invalid peer type" });
    return;
  }

  res.status(204).send();
});

// ── Get ICE Candidates ──────────────────────────────────────────────────────
router.get("/webrtc/session/:code/candidates/:peerType", (req, res) => {
  const { code, peerType } = req.params;
  const session = sessions.get(code);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (peerType === "initiator") {
    res.json({ candidates: session.initiatorCandidates });
  } else if (peerType === "receiver") {
    res.json({ candidates: session.receiverCandidates });
  } else {
    res.status(400).json({ error: "Invalid peer type" });
  }
});

// ── Delete Session ─────────────────────────────────────────────────────────
router.delete("/webrtc/session/:code", (req, res) => {
  const { code } = req.params;
  const success = sessions.delete(code);
  res.status(success ? 204 : 404).send();
});

// ── Multi-Peer Room Mesh Signaling ──────────────────────────────────────────

interface RoomPeer {
  peerId: string;
  peerName: string;
  deviceType: "desktop" | "mobile" | "tablet";
  lastSeen: number;
}

interface PeerSignal {
  fromPeerId: string;
  toPeerId: string;
  type: "offer" | "answer" | "candidate";
  payload: any;
  timestamp: number;
}

// Map<roomId, Map<peerId, RoomPeer>>
const roomPeers = new Map<string, Map<string, RoomPeer>>();
// Map<peerId, PeerSignal[]>
const queuedSignals = new Map<string, PeerSignal[]>();

// Self-cleanup for stale room peers (inactive > 25 seconds)
setInterval(() => {
  const now = Date.now();
  for (const [roomId, peers] of roomPeers.entries()) {
    for (const [peerId, peer] of peers.entries()) {
      if (now - peer.lastSeen > 25 * 1000) {
        peers.delete(peerId);
        queuedSignals.delete(peerId);
      }
    }
    if (peers.size === 0) {
      roomPeers.delete(roomId);
    }
  }
}, 10 * 1000);

// Join or register in a room mesh
router.post("/webrtc/rooms/:roomId/join", (req, res) => {
  const { roomId } = req.params;
  const { peerId, peerName, deviceType } = req.body;

  if (!peerId) {
    res.status(400).json({ error: "peerId is required" });
    return;
  }

  if (!roomPeers.has(roomId)) {
    roomPeers.set(roomId, new Map());
  }

  const peers = roomPeers.get(roomId)!;
  peers.set(peerId, {
    peerId,
    peerName: peerName || "Anonymous Device",
    deviceType: deviceType || "desktop",
    lastSeen: Date.now(),
  });

  const activePeers = Array.from(peers.values()).filter((p) => p.peerId !== peerId);
  res.json({ success: true, peers: activePeers });
});

// Heartbeat & peer list update
router.post("/webrtc/rooms/:roomId/heartbeat", (req, res) => {
  const { roomId } = req.params;
  const { peerId, peerName, deviceType } = req.body;

  if (!peerId) {
    res.status(400).json({ error: "peerId is required" });
    return;
  }

  if (!roomPeers.has(roomId)) {
    roomPeers.set(roomId, new Map());
  }

  const peers = roomPeers.get(roomId)!;
  const existing = peers.get(peerId);
  peers.set(peerId, {
    peerId,
    peerName: peerName || existing?.peerName || "Anonymous Device",
    deviceType: deviceType || existing?.deviceType || "desktop",
    lastSeen: Date.now(),
  });

  const activePeers = Array.from(peers.values()).filter((p) => p.peerId !== peerId);
  res.json({ peers: activePeers });
});

// Send a signaling message to a target peer
router.post("/webrtc/rooms/:roomId/signal", (req, res) => {
  const { roomId } = req.params;
  const { fromPeerId, toPeerId, type, payload } = req.body;

  if (!fromPeerId || !toPeerId || !type || !payload) {
    res.status(400).json({ error: "fromPeerId, toPeerId, type, and payload are required" });
    return;
  }

  const peers = roomPeers.get(roomId);
  if (!peers || !peers.has(toPeerId)) {
    res.status(404).json({ error: "Target peer not in room" });
    return;
  }

  if (!queuedSignals.has(toPeerId)) {
    queuedSignals.set(toPeerId, []);
  }

  queuedSignals.get(toPeerId)!.push({
    fromPeerId,
    toPeerId,
    type,
    payload,
    timestamp: Date.now(),
  });

  res.status(204).send();
});

// Poll for queued signals for a peer
router.get("/webrtc/rooms/:roomId/signals/:peerId", (req, res) => {
  const { peerId } = req.params;
  const signals = queuedSignals.get(peerId) || [];
  queuedSignals.set(peerId, []); // Drain the queue
  res.json({ signals });
});

// Leave a room mesh
router.post("/webrtc/rooms/:roomId/leave", (req, res) => {
  const { roomId } = req.params;
  const { peerId } = req.body;

  if (roomPeers.has(roomId)) {
    roomPeers.get(roomId)!.delete(peerId);
  }
  queuedSignals.delete(peerId);
  res.status(204).send();
});

export default router;
