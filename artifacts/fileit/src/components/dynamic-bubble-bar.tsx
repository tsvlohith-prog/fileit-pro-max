import React, { useState, useEffect, useRef } from "react";
import { useDynamicBubble, IslandTab } from "@/components/dynamic-bubble-context";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Archive,
  Columns,
  X,
  Maximize2,
  Upload,
  Sparkles,
  Layers,
  Clock,
  Minimize2,
  FileCode,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Repeat,
  Volume2,
  QrCode,
  Share2,
  Download,
  Check,
  Copy,
  Radio,
  Laptop,
  Smartphone,
  Tablet,
  ArrowUpRight,
  ExternalLink,
  ChevronDown,
  Trash2,
  Music,
  Lock,
  ShieldCheck,
  Send,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import JSZip from "jszip";
import {
  getActiveRoom,
  subscribeToActiveRoom,
  getStoredRooms,
  leaveActiveRoom,
  formatTimeRemaining,
  type StoredRoom,
} from "@/lib/rooms-storage";
import { useP2PConnection } from "@/components/p2p-connection-context";

export function DynamicBubbleBar() {
  const {
    // Media
    activeMedia,
    togglePlayPauseMedia,
    seekMedia,
    skipMedia,
    setMediaPlaybackRate,
    toggleMediaLoop,
    closeMedia,

    // Transfers
    activeTransfer,
    cancelTransfer,

    // Peer
    connectedPeer,
    disconnectPeer,

    // Staging
    stagedFiles,
    stageFile,
    removeStagedFile,
    clearStagedFiles,

    // Multitasking
    minimizedFiles,
    recentFiles,
    activePreviewFile,
    setActivePreviewFile,
    restoreFile,
    removeMinimizedFile,
    setSplitScreenFile,
    addMinimizedFile,

    // Island UI
    isIslandExpanded,
    setIsIslandExpanded,
    islandTab,
    setIslandTab,
  } = useDynamicBubble();

  const [isDragOver, setIsDragOver] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [activeQrUrl, setActiveQrUrl] = useState<string>("");
  const [isZipping, setIsZipping] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [fileBeamText, setFileBeamText] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    p2pState,
    remoteDeviceName,
    latency: p2pLatency,
    disconnect: disconnectP2P,
    sendClipboardText,
  } = useP2PConnection();

  const [activeRoom, setActiveRoom] = useState<StoredRoom | null>(() => getActiveRoom());
  const [storedRoomsList, setStoredRoomsList] = useState<StoredRoom[]>(() => getStoredRooms());

  useEffect(() => {
    setActiveRoom(getActiveRoom());
    setStoredRoomsList(getStoredRooms());
    return subscribeToActiveRoom(() => {
      setActiveRoom(getActiveRoom());
      setStoredRoomsList(getStoredRooms());
    });
  }, []);

  // Auto-detect best tab when expanded if 'auto'
  const currentTab: IslandTab =
    islandTab !== "auto"
      ? islandTab
      : activeTransfer
      ? "transfer"
      : activeMedia
      ? "media"
      : (connectedPeer || p2pState === "connected")
      ? "connectivity"
      : activeRoom
      ? "rooms"
      : stagedFiles.length > 0
      ? "shelf"
      : "files";

  // Drag and drop event handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length === 0) return;

    // Check if single audio dropped -> play immediately
    if (dropped.length === 1 && (dropped[0].type.startsWith("audio/") || dropped[0].name.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/i))) {
      const audioUrl = URL.createObjectURL(dropped[0]);
      useDynamicBubble;
      stageFile(dropped[0]);
      setIsIslandExpanded(true);
      setIslandTab("shelf");
      toast({ title: "File Staged in Island", description: `${dropped[0].name} ready for instant sharing or playback.` });
      return;
    }

    dropped.forEach((f) => stageFile(f));
    setIsIslandExpanded(true);
    setIslandTab("shelf");
    toast({
      title: `${dropped.length} File${dropped.length > 1 ? "s" : ""} Staged`,
      description: "Available in Dynamic Island shelf for instant bundle or share.",
    });
  };

  const handleCreateZipBundle = async () => {
    if (stagedFiles.length === 0) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      for (const item of stagedFiles) {
        if (item.file) {
          zip.file(item.name, item.file);
        } else if (item.url) {
          const res = await fetch(item.url);
          const blob = await res.blob();
          zip.file(item.name, blob);
        }
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const zipUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = zipUrl;
      a.download = `bundle-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(zipUrl);
      toast({ title: "ZIP Bundle Downloaded", description: `Packaged ${stagedFiles.length} files successfully.` });
    } catch {
      toast({ variant: "destructive", title: "Failed to create ZIP bundle" });
    } finally {
      setIsZipping(false);
    }
  };

  const handleShareQr = (url: string) => {
    setActiveQrUrl(url);
    setShowQrModal(true);
  };

  const formatSeconds = (sec: number) => {
    if (isNaN(sec) || sec < 0 || !isFinite(sec)) return "00:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getDeviceIcon = (deviceType?: string) => {
    if (deviceType === "mobile") return <Smartphone className="w-4 h-4 text-emerald-400" />;
    if (deviceType === "tablet") return <Tablet className="w-4 h-4 text-emerald-400" />;
    return <Laptop className="w-4 h-4 text-emerald-400" />;
  };

  const getFileCategoryIcon = (type?: string, name?: string) => {
    const lower = (name || "").toLowerCase();
    if (type === "pdf" || lower.endsWith(".pdf")) return <FileText className="w-3.5 h-3.5 text-rose-400" />;
    if (type === "xlsx" || lower.match(/\.(xlsx|xls|csv)$/)) return <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />;
    if (type === "image" || lower.match(/\.(png|jpg|jpeg|gif|webp|svg)$/)) return <ImageIcon className="w-3.5 h-3.5 text-sky-400" />;
    if (type === "archive" || lower.match(/\.(zip|tar|gz|7z)$/)) return <Archive className="w-3.5 h-3.5 text-amber-400" />;
    if (type === "text" || lower.match(/\.(txt|md|js|ts|py|json|html|css|sh)$/)) return <FileCode className="w-3.5 h-3.5 text-cyan-400" />;
    if (type === "audio" || lower.match(/\.(mp3|wav|ogg|m4a|flac)$/)) return <Music className="w-3.5 h-3.5 text-purple-400" />;
    return <FileText className="w-3.5 h-3.5 text-primary" />;
  };

  const totalBadgesCount =
    (activeMedia ? 1 : 0) +
    (activeTransfer ? 1 : 0) +
    (connectedPeer ? 1 : 0) +
    stagedFiles.length +
    minimizedFiles.length;

  return (
    <>
      {/* Hidden file input for staging */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            Array.from(e.target.files).forEach((f) => stageFile(f));
            setIsIslandExpanded(true);
            setIslandTab("shelf");
          }
        }}
      />

      {/* Dynamic Island Root Anchor (Positioned below the top navigation header) */}
      <div
        className="fixed top-[62px] md:top-[72px] left-1/2 -translate-x-1/2 z-[100000] pointer-events-none flex flex-col items-center w-full px-3 max-w-2xl"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <AnimatePresence mode="wait">
          {!isIslandExpanded ? (
            /* ── COMPACT ADAPTIVE PILL ────────────────────────────────── */
            <motion.div
              key="compact-pill"
              layoutId="dynamic-island-shell"
              initial={{ y: -20, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -20, opacity: 0, scale: 0.9 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsIslandExpanded(true)}
              className={`pointer-events-auto cursor-pointer flex items-center justify-between gap-3 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.65)] border backdrop-blur-2xl transition-all duration-200 select-none ${
                isDragOver
                  ? "bg-primary text-primary-foreground border-white/60 scale-105 ring-4 ring-primary/30"
                  : activeTransfer
                  ? "bg-black/95 dark:bg-zinc-950/98 text-white border-primary/50 ring-2 ring-primary/30"
                  : activeMedia
                  ? "bg-black/95 dark:bg-zinc-950/98 text-white border-purple-500/50 ring-2 ring-purple-500/25"
                  : connectedPeer
                  ? "bg-black/95 dark:bg-zinc-950/98 text-white border-emerald-500/40"
                  : activePreviewFile
                  ? "bg-black/95 dark:bg-zinc-950/98 text-white border-white/20"
                  : "bg-black/90 dark:bg-zinc-950/95 text-zinc-100 border-white/15 hover:border-white/30"
              }`}
            >
              {/* Contextual Left Glyph */}
              <div className="flex items-center gap-2 min-w-0">
                {activeTransfer ? (
                  /* Transfer Circular Gauge */
                  <div className="relative w-6 h-6 flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6 -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-zinc-800"
                        strokeWidth="3.5"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="text-primary transition-all duration-300"
                        strokeDasharray={`${activeTransfer.progress}, 100`}
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <span className="absolute text-[8px] font-mono font-bold text-white">
                      {Math.round(activeTransfer.progress)}%
                    </span>
                  </div>
                ) : activeMedia ? (
                  /* Audio Equalizer animation */
                  <div className="flex items-end gap-0.5 h-4 w-4 shrink-0 px-0.5">
                    <span
                      className={`w-0.5 bg-purple-400 rounded-full transition-all duration-200 ${
                        activeMedia.isPlaying ? "animate-[bounce_0.8s_infinite] h-3.5" : "h-1.5"
                      }`}
                    />
                    <span
                      className={`w-0.5 bg-purple-400 rounded-full transition-all duration-200 ${
                        activeMedia.isPlaying ? "animate-[bounce_0.6s_infinite_0.2s] h-4" : "h-3"
                      }`}
                    />
                    <span
                      className={`w-0.5 bg-purple-400 rounded-full transition-all duration-200 ${
                        activeMedia.isPlaying ? "animate-[bounce_0.9s_infinite_0.4s] h-2.5" : "h-1.5"
                      }`}
                    />
                  </div>
                ) : (connectedPeer || p2pState === "connected") ? (
                  /* P2P Live indicator */
                  <div className="relative flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0">
                    <Radio className="w-3.5 h-3.5 animate-pulse" />
                  </div>
                ) : activeRoom ? (
                  /* Active Room indicator */
                  <div className="relative flex items-center justify-center w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 shrink-0">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                ) : activePreviewFile ? (
                  /* Active Document */
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary shrink-0">
                    {getFileCategoryIcon(activePreviewFile.type, activePreviewFile.name)}
                  </div>
                ) : (
                  /* Idle Island */
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-tr from-primary to-indigo-500 text-white shadow-inner shrink-0">
                    <Sparkles className="w-3 h-3 animate-pulse" />
                  </div>
                )}

                {/* Center Informational Text */}
                <div className="flex flex-col text-left max-w-[150px] sm:max-w-[220px]">
                  {activeTransfer ? (
                    <>
                      <span className="text-[11px] font-bold text-white truncate leading-tight">
                        {activeTransfer.name}
                      </span>
                      <span className="text-[9px] font-mono text-primary truncate">
                        {activeTransfer.speedMBps ? `${activeTransfer.speedMBps.toFixed(1)} MB/s · ` : ""}
                        {activeTransfer.etaSeconds ? `${activeTransfer.etaSeconds}s left` : "Transferring..."}
                      </span>
                    </>
                  ) : activeMedia ? (
                    <>
                      <span className="text-[11px] font-bold text-white truncate leading-tight">
                        {activeMedia.title}
                      </span>
                      <span className="text-[9px] font-mono text-purple-400">
                        {formatSeconds(activeMedia.currentTime)} / {formatSeconds(activeMedia.duration)}
                      </span>
                    </>
                  ) : (connectedPeer || p2pState === "connected") ? (
                    <>
                      <span className="text-[11px] font-bold text-white truncate leading-tight flex items-center gap-1">
                        {getDeviceIcon(connectedPeer?.deviceType || "mobile")}
                        <span>{remoteDeviceName || connectedPeer?.name || "Peer Device"}</span>
                      </span>
                      <span className="text-[9px] font-mono text-emerald-400">
                        P2P Linked {p2pLatency ? `· ${p2pLatency}ms` : ""}
                      </span>
                    </>
                  ) : activeRoom ? (
                    <>
                      <span className="text-[11px] font-bold text-white truncate leading-tight flex items-center gap-1">
                        <Lock className="w-3 h-3 text-cyan-400 shrink-0" />
                        <span>{activeRoom.name}</span>
                      </span>
                      <span className="text-[9px] font-mono text-cyan-400 truncate">
                        Room Vault · {formatTimeRemaining(activeRoom.expiresAt).text}
                      </span>
                    </>
                  ) : activePreviewFile ? (
                    <>
                      <span className="text-[11px] font-bold text-white truncate leading-tight">
                        {activePreviewFile.name}
                      </span>
                      <span className="text-[9px] font-mono text-zinc-400">Document Open</span>
                    </>
                  ) : (
                    <>
                      <span className="text-[11px] font-bold text-white tracking-tight leading-tight">
                        Fileit Island
                      </span>
                      <span className="text-[9px] text-zinc-400 truncate">
                        {stagedFiles.length > 0
                          ? `${stagedFiles.length} staged · Drop to share`
                          : "Drop files or click to manage"}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Quick Inline Controls on Pill */}
              <div className="flex items-center gap-1.5 shrink-0 pl-1">
                {activeMedia ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePlayPauseMedia();
                    }}
                    className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-transform active:scale-90"
                    title={activeMedia.isPlaying ? "Pause" : "Play"}
                  >
                    {activeMedia.isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 fill-current ml-0.5" />}
                  </button>
                ) : activeTransfer ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      cancelTransfer();
                    }}
                    className="w-5 h-5 rounded-full text-zinc-400 hover:text-red-400 hover:bg-red-500/20 flex items-center justify-center transition-colors"
                    title="Cancel Transfer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                ) : activePreviewFile ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      addMinimizedFile(activePreviewFile);
                      setActivePreviewFile(null);
                    }}
                    className="w-6 h-6 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 flex items-center justify-center"
                    title="Minimize Document"
                  >
                    <Minimize2 className="w-3 h-3" />
                  </button>
                ) : (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                )}

                {totalBadgesCount > 0 && !activeMedia && !activeTransfer && (
                  <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold rounded-full bg-primary/20 text-primary border border-primary/30">
                    {totalBadgesCount}
                  </span>
                )}
              </div>
            </motion.div>
          ) : (
            /* ── EXPANDED INTERACTIVE HUD ──────────────────────────────── */
            <motion.div
              key="expanded-hud"
              layoutId="dynamic-island-shell"
              initial={{ y: -10, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -10, opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              className="pointer-events-auto bg-black/95 dark:bg-zinc-950/98 text-white border border-white/20 rounded-3xl p-4 shadow-[0_25px_60px_rgba(0,0,0,0.8)] backdrop-blur-3xl w-full max-w-[440px] space-y-3.5 select-none"
            >
              {/* Header Navigation Tabs */}
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                  <button
                    type="button"
                    onClick={() => setIslandTab("rooms")}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                      currentTab === "rooms"
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    <Lock className="w-3 h-3 text-cyan-400" />
                    <span>Rooms</span>
                    {activeRoom ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    ) : storedRoomsList.length > 0 ? (
                      <span className="text-[10px] font-mono px-1 rounded bg-white/10 text-zinc-300">
                        {storedRoomsList.length}
                      </span>
                    ) : null}
                  </button>

                  <button
                    type="button"
                    onClick={() => setIslandTab("connectivity")}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                      currentTab === "connectivity" || currentTab === "peer"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    <Radio className="w-3 h-3 text-emerald-400" />
                    <span>P2P Link</span>
                    {(connectedPeer || p2pState === "connected") && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setIslandTab("shelf")}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                      currentTab === "shelf"
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    <Upload className="w-3 h-3" />
                    <span>Drop Shelf</span>
                    {stagedFiles.length > 0 && (
                      <span className="text-[10px] font-mono px-1 rounded bg-primary/30 text-white">
                        {stagedFiles.length}
                      </span>
                    )}
                  </button>

                  {activeMedia && (
                    <button
                      type="button"
                      onClick={() => setIslandTab("media")}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                        currentTab === "media"
                          ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      <Music className="w-3 h-3" />
                      <span>Audio</span>
                      {activeMedia?.isPlaying && <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIslandTab("files")}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                      currentTab === "files"
                        ? "bg-white/15 text-white border border-white/20"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    <Layers className="w-3 h-3" />
                    <span>Files</span>
                    {minimizedFiles.length > 0 && (
                      <span className="text-[10px] font-mono px-1 rounded bg-white/20 text-white">
                        {minimizedFiles.length}
                      </span>
                    )}
                  </button>
                </div>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setIsIslandExpanded(false)}
                  className="h-7 w-7 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>

              {/* ── TAB CONTENT ─────────────────────────────────────────── */}

              {/* 1. MEDIA TAB */}
              {currentTab === "media" && (
                <div className="space-y-3">
                  {activeMedia ? (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-400 block">
                            Now Playing in Background
                          </span>
                          <h4 className="text-sm font-bold text-white truncate">{activeMedia.title}</h4>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={closeMedia}
                          className="h-7 w-7 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-red-500/20"
                          title="Stop & Dismiss Audio"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      {/* Scrubber Range Bar */}
                      <div className="space-y-1">
                        <input
                          type="range"
                          min="0"
                          max={activeMedia.duration || 100}
                          value={activeMedia.currentTime || 0}
                          onChange={(e) => seekMedia(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                        />
                        <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                          <span>{formatSeconds(activeMedia.currentTime)}</span>
                          <span>{formatSeconds(activeMedia.duration)}</span>
                        </div>
                      </div>

                      {/* Playback Button Deck */}
                      <div className="flex items-center justify-center gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => skipMedia(-10)}
                          className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                          title="Rewind 10s"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={togglePlayPauseMedia}
                          className="w-11 h-11 rounded-2xl bg-purple-500 hover:bg-purple-600 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95"
                          title={activeMedia.isPlaying ? "Pause" : "Play"}
                        >
                          {activeMedia.isPlaying ? (
                            <Pause className="w-5 h-5" />
                          ) : (
                            <Play className="w-5 h-5 fill-current ml-0.5" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => skipMedia(10)}
                          className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                          title="Forward 10s"
                        >
                          <RotateCw className="w-4 h-4" />
                        </button>

                        {/* Speed Toggle */}
                        <button
                          type="button"
                          onClick={() => {
                            const next = activeMedia.playbackRate === 1 ? 1.5 : activeMedia.playbackRate === 1.5 ? 2 : 1;
                            setMediaPlaybackRate(next);
                          }}
                          className="px-2 py-1 rounded-lg text-[10px] font-mono font-bold bg-white/10 hover:bg-white/20 text-zinc-300"
                          title="Playback Speed"
                        >
                          {activeMedia.playbackRate}x
                        </button>

                        {/* Loop Toggle */}
                        <button
                          type="button"
                          onClick={toggleMediaLoop}
                          className={`p-2 rounded-xl transition-colors ${
                            activeMedia.isLooping
                              ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                              : "text-zinc-400 hover:text-white hover:bg-white/10"
                          }`}
                          title="Loop Track"
                        >
                          <Repeat className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="py-6 text-center space-y-2">
                      <Music className="w-8 h-8 text-zinc-600 mx-auto" />
                      <p className="text-xs text-zinc-400">No background audio playing</p>
                      <p className="text-[10px] text-zinc-500">
                        Open any audio/video file to enable persistent background playback across Fileit.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 2. DROP SHELF TAB */}
              {currentTab === "shelf" && (
                <div className="space-y-3">
                  {/* Drop target prompt */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 rounded-2xl border border-dashed border-white/20 hover:border-primary/50 bg-white/5 hover:bg-white/10 cursor-pointer text-center transition-all group"
                  >
                    <Upload className="w-4 h-4 mx-auto mb-1 text-primary group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-semibold text-white block">Drop or Click to Stage Files</span>
                    <span className="text-[10px] text-zinc-400">
                      Creates instant bundles, QR codes, or P2P direct shares
                    </span>
                  </div>

                  {/* Staged files list */}
                  {stagedFiles.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1">
                        <span>Staged Items ({stagedFiles.length})</span>
                        <button
                          type="button"
                          onClick={clearStagedFiles}
                          className="text-[10px] text-red-400 hover:text-red-300"
                        >
                          Clear All
                        </button>
                      </div>

                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {stagedFiles.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between bg-zinc-900/90 border border-white/10 px-2.5 py-1.5 rounded-xl text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {getFileCategoryIcon(item.type, item.name)}
                              <span className="truncate text-zinc-200">{item.name}</span>
                              <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                                {formatBytes(item.size)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {item.url && (
                                <button
                                  type="button"
                                  onClick={() => handleShareQr(item.url!)}
                                  className="p-1 rounded text-zinc-400 hover:text-primary"
                                  title="Share QR"
                                >
                                  <QrCode className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => removeStagedFile(item.id)}
                                className="p-1 rounded text-zinc-400 hover:text-red-400"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Batch Action Buttons */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <Button
                          size="sm"
                          onClick={handleCreateZipBundle}
                          disabled={isZipping}
                          className="h-8 text-xs font-semibold gap-1.5 rounded-xl bg-primary hover:bg-primary/90"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{isZipping ? "Packaging..." : "Download ZIP"}</span>
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setLocation("/rooms");
                            setIsIslandExpanded(false);
                            toast({ title: "Broadcasting Ready", description: "Select a private room to share staged files." });
                          }}
                          className="h-8 text-xs font-semibold gap-1.5 rounded-xl border-white/20 hover:bg-white/10"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>Send to Room</span>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-4 text-center text-xs text-zinc-500">
                      No files staged yet. Drag any file here or click the box above.
                    </div>
                  )}
                </div>
              )}

              {/* 3. MULTITASKING & RECENT FILES TAB */}
              {currentTab === "files" && (
                <div className="space-y-3">
                  {/* Currently Active Preview */}
                  {activePreviewFile && (
                    <div className="p-2.5 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {getFileCategoryIcon(activePreviewFile.type, activePreviewFile.name)}
                        <div className="min-w-0">
                          <span className="text-[10px] font-mono text-primary uppercase font-bold block">
                            Active Preview
                          </span>
                          <span className="text-xs font-bold text-white truncate block">
                            {activePreviewFile.name}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            addMinimizedFile(activePreviewFile);
                            setActivePreviewFile(null);
                          }}
                          className="h-7 px-2 text-[10px] text-zinc-300 hover:text-white hover:bg-white/10 rounded-lg"
                        >
                          Minimize
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSplitScreenFile(activePreviewFile)}
                          className="h-7 px-2 text-[10px] text-purple-400 hover:text-purple-300 hover:bg-purple-500/15 rounded-lg"
                        >
                          Split
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Minimized Files */}
                  {minimizedFiles.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                        <Minimize2 className="w-3 h-3" /> Minimized & Stashed ({minimizedFiles.length})
                      </span>
                      <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                        {minimizedFiles.map((file) => (
                          <div
                            key={file.id}
                            className="flex items-center justify-between bg-zinc-900/90 border border-white/10 px-2.5 py-1.5 rounded-xl text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {getFileCategoryIcon(file.type, file.name)}
                              <span className="truncate text-zinc-200">{file.name}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => restoreFile(file.id)}
                                className="p-1 rounded text-zinc-400 hover:text-white"
                                title="Restore"
                              >
                                <Maximize2 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setSplitScreenFile(file)}
                                className="p-1 rounded text-zinc-400 hover:text-purple-400"
                                title="Split Screen"
                              >
                                <Columns className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeMinimizedFile(file.id)}
                                className="p-1 rounded text-zinc-400 hover:text-red-400"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Files */}
                  {recentFiles.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Recently Viewed ({recentFiles.length})
                      </span>
                      <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                        {recentFiles.slice(0, 5).map((file) => (
                          <div
                            key={file.id}
                            onClick={() => {
                              setActivePreviewFile(file);
                              setIsIslandExpanded(false);
                              if (file.id && !file.id.includes("_") && !file.id.startsWith("blob")) {
                                setLocation(`/view/${file.id}`);
                              }
                            }}
                            className="flex items-center justify-between p-1.5 rounded-lg hover:bg-white/10 cursor-pointer text-xs group"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {getFileCategoryIcon(file.type, file.name)}
                              <span className="truncate text-zinc-300 group-hover:text-white">{file.name}</span>
                            </div>
                            <span className="text-[9px] font-mono text-zinc-500">Open</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {minimizedFiles.length === 0 && recentFiles.length === 0 && !activePreviewFile && (
                    <div className="py-6 text-center text-xs text-zinc-500">
                      No files currently open or stashed.
                    </div>
                  )}
                </div>
              )}

              {/* 4. ROOMS TAB */}
              {currentTab === "rooms" && (
                <div className="space-y-3">
                  {activeRoom ? (
                    <>
                      <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                              <Lock className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400 block">
                                Active Vault
                              </span>
                              <h4 className="text-xs font-bold text-white truncate">{activeRoom.name}</h4>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/20 px-2 py-0.5 rounded-full">
                            {formatTimeRemaining(activeRoom.expiresAt).text}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 pt-1">
                          <Button
                            size="sm"
                            onClick={() => {
                              setLocation(`/rooms/${activeRoom.id}`);
                              setIsIslandExpanded(false);
                            }}
                            className="flex-1 h-8 text-xs font-bold gap-1 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Open Room</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              const inviteUrl = `${window.location.origin}/rooms/${activeRoom.id}?token=${activeRoom.token}`;
                              await navigator.clipboard.writeText(inviteUrl);
                              toast({ title: "Room Invite Link Copied" });
                            }}
                            className="h-8 text-xs font-bold gap-1 rounded-xl border-white/20 text-white hover:bg-white/10"
                            title="Copy Room Invite URL"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>Invite</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              leaveActiveRoom();
                              setActiveRoom(null);
                              toast({ title: "Left Active Room" });
                            }}
                            className="h-8 px-2 text-xs font-bold text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl"
                            title="Leave Room"
                          >
                            Exit
                          </Button>
                        </div>
                      </div>

                      {storedRoomsList.length > 1 && (
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                            Switch Stored Rooms
                          </span>
                          <div className="space-y-1 max-h-24 overflow-y-auto">
                            {storedRoomsList
                              .filter((r) => r.id !== activeRoom.id)
                              .map((r) => (
                                <div
                                  key={r.id}
                                  onClick={() => {
                                    setLocation(`/rooms/${r.id}`);
                                    setIsIslandExpanded(false);
                                  }}
                                  className="flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer text-xs"
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <Lock className="w-3 h-3 text-cyan-400" />
                                    <span className="text-zinc-200 font-medium truncate">{r.name}</span>
                                  </div>
                                  <span className="text-[10px] font-mono text-zinc-400">Switch</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="space-y-3 py-1">
                      <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-center space-y-1">
                        <Lock className="w-6 h-6 text-zinc-500 mx-auto" />
                        <h4 className="text-xs font-bold text-white">No Active Room</h4>
                        <p className="text-[11px] text-zinc-400">
                          Join or create an encrypted 3-day dissolving vault for collaborative whiteboards & files.
                        </p>
                      </div>

                      {storedRoomsList.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                            Saved Rooms on Device
                          </span>
                          <div className="space-y-1 max-h-24 overflow-y-auto">
                            {storedRoomsList.map((r) => (
                              <div
                                key={r.id}
                                onClick={() => {
                                  setLocation(`/rooms/${r.id}`);
                                  setIsIslandExpanded(false);
                                }}
                                className="flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer text-xs"
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Lock className="w-3 h-3 text-cyan-400" />
                                  <span className="text-zinc-200 font-medium truncate">{r.name}</span>
                                </div>
                                <span className="text-[10px] font-mono text-cyan-400">Enter</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <Button
                        size="sm"
                        onClick={() => {
                          setLocation("/rooms");
                          setIsIslandExpanded(false);
                        }}
                        className="w-full h-8 text-xs font-bold gap-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Go to Rooms Hub</span>
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* 5. CONNECTIVITY / P2P TAB */}
              {(currentTab === "connectivity" || currentTab === "peer") && (
                <div className="space-y-3">
                  {(connectedPeer || p2pState === "connected") ? (
                    <>
                      <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                            {getDeviceIcon(connectedPeer?.deviceType || "mobile")}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-white truncate">
                              {remoteDeviceName || connectedPeer?.name || "Peer Device"}
                            </h4>
                            <p className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                              <Radio className="w-3 h-3 animate-pulse" />
                              <span>Direct P2P {p2pLatency ? `· ${p2pLatency}ms` : "Active"}</span>
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (disconnectP2P) disconnectP2P();
                            disconnectPeer();
                          }}
                          className="h-7 text-[10px] text-zinc-400 hover:text-red-400 hover:bg-red-500/20 rounded-lg shrink-0"
                        >
                          Disconnect
                        </Button>
                      </div>

                      {/* Quick Beam Clipboard */}
                      <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                          Instant Beam Text / Link to Phone
                        </span>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={fileBeamText}
                            onChange={(e) => setFileBeamText(e.target.value)}
                            placeholder="Type or paste to beam..."
                            className="flex-1 h-8 rounded-xl bg-black/50 border border-white/15 px-2.5 text-xs text-white focus:outline-none"
                          />
                          <Button
                            size="sm"
                            disabled={!fileBeamText.trim()}
                            onClick={() => {
                              sendClipboardText(fileBeamText.trim());
                              setFileBeamText("");
                              toast({ title: "Beamed to Phone" });
                            }}
                            className="h-8 px-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                          >
                            <Send className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => {
                          setLocation("/connectivity");
                          setIsIslandExpanded(false);
                        }}
                        className="w-full h-8 text-xs font-semibold gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open Full P2P Radar & Folder Sync</span>
                      </Button>
                    </>
                  ) : (
                    <div className="space-y-3 py-1">
                      <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-center space-y-1">
                        <Wifi className="w-6 h-6 text-zinc-500 mx-auto" />
                        <h4 className="text-xs font-bold text-white">No Device Linked</h4>
                        <p className="text-[11px] text-zinc-400">
                          Scan the QR code on your phone to link clipboard, files, and folders directly in browser memory.
                        </p>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => {
                          setLocation("/connectivity");
                          setIsIslandExpanded(false);
                        }}
                        className="w-full h-8 text-xs font-bold gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>Pair Phone via 1-Click QR</span>
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* QR Code Popover Modal */}
      {showQrModal && (
        <div
          className="fixed inset-0 z-[110000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowQrModal(false)}
        >
          <div
            className="bg-card text-card-foreground border border-border p-6 rounded-3xl max-w-sm w-full space-y-4 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold">Scan to Access File</h3>
              <Button size="icon" variant="ghost" onClick={() => setShowQrModal(false)} className="h-7 w-7 rounded-full">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-4 bg-white rounded-2xl inline-block shadow-inner">
              <QRCodeSVG value={activeQrUrl} size={180} level="M" />
            </div>
            <p className="text-xs text-muted-foreground break-all">{activeQrUrl}</p>
            <Button
              className="w-full rounded-xl gap-1.5 text-xs font-bold"
              onClick={async () => {
                await navigator.clipboard.writeText(activeQrUrl);
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2000);
                toast({ title: "Link Copied" });
              }}
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLink ? "Copied" : "Copy Direct URL"}</span>
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
