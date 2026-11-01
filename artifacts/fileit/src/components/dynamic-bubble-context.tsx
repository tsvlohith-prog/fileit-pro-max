import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { RecentFilesService } from "@/lib/recent-files-service";

export interface MinimizedFile {
  id: string;
  name: string;
  type: "pdf" | "docx" | "xlsx" | "image" | "text" | "archive" | "audio" | "video" | "other";
  url?: string;
  size?: number;
}

export interface ActiveMedia {
  id: string;
  title: string;
  url: string;
  type: "audio" | "video";
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  isLooping: boolean;
}

export interface ActiveTransfer {
  id: string;
  name: string;
  type: "upload" | "download" | "p2p";
  progress: number; // 0 to 100
  speedMBps?: number;
  bytesTransferred?: number;
  totalBytes?: number;
  etaSeconds?: number;
  status: "active" | "completed" | "error";
  cancel?: () => void;
}

export interface ConnectedPeer {
  id: string;
  name: string;
  deviceType: "mobile" | "desktop" | "tablet";
  connectedAt: number;
  isDirectP2P: boolean;
  roomCode?: string;
}

export interface StagedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  file?: File;
  url?: string;
  addedAt: number;
}

export type IslandTab = "auto" | "rooms" | "connectivity" | "media" | "transfer" | "peer" | "shelf" | "files";

interface DynamicBubbleContextType {
  // Multitasking & File History
  minimizedFiles: MinimizedFile[];
  addMinimizedFile: (file: MinimizedFile) => void;
  removeMinimizedFile: (id: string) => void;
  restoreFile: (id: string) => void;
  splitScreenFile: MinimizedFile | null;
  setSplitScreenFile: (file: MinimizedFile | null) => void;
  activePreviewFile: MinimizedFile | null;
  setActivePreviewFile: (file: MinimizedFile | null) => void;
  recentFiles: MinimizedFile[];
  addRecentFile: (file: MinimizedFile) => void;

  // Background Media & Audio Engine
  activeMedia: ActiveMedia | null;
  playMedia: (media: { id: string; title: string; url: string; type?: "audio" | "video" }) => void;
  pauseMedia: () => void;
  togglePlayPauseMedia: () => void;
  seekMedia: (seconds: number) => void;
  skipMedia: (deltaSeconds: number) => void;
  setMediaPlaybackRate: (rate: number) => void;
  toggleMediaLoop: () => void;
  closeMedia: () => void;

  // Real-time Transfers & Progress Gauge
  activeTransfer: ActiveTransfer | null;
  startTransfer: (transfer: Omit<ActiveTransfer, "status">) => void;
  updateTransferProgress: (id: string, progress: number, speedMBps?: number, etaSeconds?: number) => void;
  completeTransfer: (id: string) => void;
  cancelTransfer: (id?: string) => void;

  // P2P & Live Device Connection Radar
  connectedPeer: ConnectedPeer | null;
  setConnectedPeer: (peer: ConnectedPeer | null) => void;
  disconnectPeer: () => void;

  // Universal Staging Drop Shelf
  stagedFiles: StagedFile[];
  stageFile: (file: File | StagedFile) => void;
  removeStagedFile: (id: string) => void;
  clearStagedFiles: () => void;

  // Island Presentation State
  isIslandExpanded: boolean;
  setIsIslandExpanded: (expanded: boolean) => void;
  islandTab: IslandTab;
  setIslandTab: (tab: IslandTab) => void;
}

const DynamicBubbleContext = createContext<DynamicBubbleContextType | undefined>(undefined);

export function DynamicBubbleProvider({ children }: { children: React.ReactNode }) {
  // Multitasking States
  const [minimizedFiles, setMinimizedFiles] = useState<MinimizedFile[]>([]);
  const [splitScreenFile, setSplitScreenFile] = useState<MinimizedFile | null>(null);
  const [activePreviewFile, setActivePreviewFile] = useState<MinimizedFile | null>(null);
  const [recentFiles, setRecentFiles] = useState<MinimizedFile[]>([]);

  // Island Presentation States
  const [isIslandExpanded, setIsIslandExpanded] = useState<boolean>(false);
  const [islandTab, setIslandTab] = useState<IslandTab>("auto");

  // Background Audio Engine
  const [activeMedia, setActiveMedia] = useState<ActiveMedia | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Transfers Engine
  const [activeTransfer, setActiveTransfer] = useState<ActiveTransfer | null>(null);

  // Peer Connection State
  const [connectedPeer, setConnectedPeer] = useState<ConnectedPeer | null>(null);

  // Universal Drop Shelf
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);

  // Load Recent Files from Service
  useEffect(() => {
    const loaded = RecentFilesService.getRecentFiles();
    setRecentFiles(loaded);
  }, []);

  // Background Audio Element setup & events
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      setActiveMedia((prev) => (prev ? { ...prev, currentTime: audio.currentTime } : null));
    };

    const handleLoadedMetadata = () => {
      setActiveMedia((prev) => (prev ? { ...prev, duration: audio.duration || 0 } : null));
    };

    const handlePlay = () => {
      setActiveMedia((prev) => (prev ? { ...prev, isPlaying: true } : null));
    };

    const handlePause = () => {
      setActiveMedia((prev) => (prev ? { ...prev, isPlaying: false } : null));
    };

    const handleEnded = () => {
      if (audio.loop) return;
      setActiveMedia((prev) => (prev ? { ...prev, isPlaying: false, currentTime: 0 } : null));
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.src = "";
    };
  }, []);

  // Media Action Handlers
  const playMedia = useCallback(
    (media: { id: string; title: string; url: string; type?: "audio" | "video" }) => {
      const audio = audioRef.current;
      if (!audio) return;

      if (activeMedia?.id === media.id && audio.src === media.url) {
        audio.play().catch(() => {});
        return;
      }

      audio.src = media.url;
      audio.currentTime = 0;
      audio.playbackRate = 1;
      audio.loop = false;
      audio.play().catch(() => {});

      setActiveMedia({
        id: media.id,
        title: media.title,
        url: media.url,
        type: media.type || "audio",
        isPlaying: true,
        currentTime: 0,
        duration: 0,
        playbackRate: 1,
        isLooping: false,
      });
    },
    [activeMedia]
  );

  const pauseMedia = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const togglePlayPauseMedia = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, []);

  const seekMedia = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const clamped = Math.max(0, Math.min(seconds, audio.duration || 0));
    audio.currentTime = clamped;
    setActiveMedia((prev) => (prev ? { ...prev, currentTime: clamped } : null));
  }, []);

  const skipMedia = useCallback((deltaSeconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const target = Math.max(0, Math.min(audio.currentTime + deltaSeconds, audio.duration || 0));
    audio.currentTime = target;
    setActiveMedia((prev) => (prev ? { ...prev, currentTime: target } : null));
  }, []);

  const setMediaPlaybackRate = useCallback((rate: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = rate;
    setActiveMedia((prev) => (prev ? { ...prev, playbackRate: rate } : null));
  }, []);

  const toggleMediaLoop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.loop = !audio.loop;
    setActiveMedia((prev) => (prev ? { ...prev, isLooping: audio.loop } : null));
  }, []);

  const closeMedia = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = "";
    }
    setActiveMedia(null);
  }, []);

  // Transfer Handlers
  const startTransfer = useCallback((transfer: Omit<ActiveTransfer, "status">) => {
    setActiveTransfer({
      ...transfer,
      status: "active",
    });
  }, []);

  const updateTransferProgress = useCallback(
    (id: string, progress: number, speedMBps?: number, etaSeconds?: number) => {
      setActiveTransfer((prev) => {
        if (!prev || prev.id !== id) return prev;
        return {
          ...prev,
          progress: Math.min(100, Math.max(0, progress)),
          speedMBps: speedMBps !== undefined ? speedMBps : prev.speedMBps,
          etaSeconds: etaSeconds !== undefined ? etaSeconds : prev.etaSeconds,
        };
      });
    },
    []
  );

  const completeTransfer = useCallback((id: string) => {
    setActiveTransfer((prev) => {
      if (!prev || prev.id !== id) return prev;
      return { ...prev, progress: 100, status: "completed" };
    });
    // Auto-clear after 3 seconds of showing completed
    setTimeout(() => {
      setActiveTransfer((curr) => (curr?.id === id ? null : curr));
    }, 3000);
  }, []);

  const cancelTransfer = useCallback((id?: string) => {
    setActiveTransfer((prev) => {
      if (prev && (!id || prev.id === id)) {
        prev.cancel?.();
        return null;
      }
      return prev;
    });
  }, []);

  // Peer Handlers
  const disconnectPeer = useCallback(() => {
    setConnectedPeer(null);
  }, []);

  // Staging Shelf Handlers
  const stageFile = useCallback((fileOrStaged: File | StagedFile) => {
    if ("size" in fileOrStaged && "addedAt" in fileOrStaged) {
      setStagedFiles((prev) => [...prev, fileOrStaged as StagedFile]);
      return;
    }

    const file = fileOrStaged as File;
    const newStaged: StagedFile = {
      id: Math.random().toString(36).substring(2, 9),
      name: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
      file,
      url: URL.createObjectURL(file),
      addedAt: Date.now(),
    };
    setStagedFiles((prev) => [newStaged, ...prev]);
  }, []);

  const removeStagedFile = useCallback((id: string) => {
    setStagedFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.url?.startsWith("blob:")) {
        URL.revokeObjectURL(target.url);
      }
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const clearStagedFiles = useCallback(() => {
    setStagedFiles((prev) => {
      prev.forEach((f) => {
        if (f.url?.startsWith("blob:")) URL.revokeObjectURL(f.url);
      });
      return [];
    });
  }, []);

  // Multitasking Handlers (Backward compatible)
  const addMinimizedFile = useCallback((file: MinimizedFile) => {
    setMinimizedFiles((prev) => {
      if (prev.some((f) => f.id === file.id)) return prev;
      return [...prev, file];
    });
    addRecentFile(file);
  }, []);

  const addRecentFile = useCallback((file: MinimizedFile) => {
    const updated = RecentFilesService.saveRecentFile(file);
    setRecentFiles(updated);
  }, []);

  const removeMinimizedFile = useCallback((id: string) => {
    setMinimizedFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const restoreFile = useCallback(
    (id: string) => {
      const found = minimizedFiles.find((f) => f.id === id) || recentFiles.find((f) => f.id === id);
      if (found) {
        setActivePreviewFile(found);
        removeMinimizedFile(id);
        addRecentFile(found);
      }
    },
    [minimizedFiles, recentFiles, addRecentFile, removeMinimizedFile]
  );

  return (
    <DynamicBubbleContext.Provider
      value={{
        minimizedFiles,
        addMinimizedFile,
        removeMinimizedFile,
        restoreFile,
        splitScreenFile,
        setSplitScreenFile,
        activePreviewFile,
        setActivePreviewFile,
        recentFiles,
        addRecentFile,

        activeMedia,
        playMedia,
        pauseMedia,
        togglePlayPauseMedia,
        seekMedia,
        skipMedia,
        setMediaPlaybackRate,
        toggleMediaLoop,
        closeMedia,

        activeTransfer,
        startTransfer,
        updateTransferProgress,
        completeTransfer,
        cancelTransfer,

        connectedPeer,
        setConnectedPeer,
        disconnectPeer,

        stagedFiles,
        stageFile,
        removeStagedFile,
        clearStagedFiles,

        isIslandExpanded,
        setIsIslandExpanded,
        islandTab,
        setIslandTab,
      }}
    >
      {children}
    </DynamicBubbleContext.Provider>
  );
}

export function useDynamicBubble() {
  const context = useContext(DynamicBubbleContext);
  if (!context) {
    throw new Error("useDynamicBubble must be used within a DynamicBubbleProvider");
  }
  return context;
}
