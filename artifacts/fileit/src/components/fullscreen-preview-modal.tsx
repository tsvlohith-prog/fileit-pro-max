import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  Maximize2,
  Minimize2,
  Download,
  Share2,
  FileText,
  Music,
  Video as VideoIcon,
  Image as ImageIcon,
  FileSpreadsheet,
  FileCode,
  FileArchive,
  Layers,
  Sparkles,
  ExternalLink,
  Printer,
  Moon,
  Sun,
  Keyboard,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Copy,
  Check,
  Info,
  Columns,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { inspectFileType } from "@/lib/file-type-helpers";
import { formatBytes } from "@/lib/utils";
import { useDynamicBubble } from "@/components/dynamic-bubble-context";
import { ExportShareModal } from "@/components/export-share-modal";

interface FullscreenPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  mimeType?: string;
  size?: number;
  fileSize?: number;
  url: string;
  downloadUrl?: string;
  children?: React.ReactNode;
}

export function FullscreenPreviewModal({
  isOpen,
  onClose,
  fileName,
  mimeType = "",
  size,
  fileSize,
  url,
  downloadUrl,
  children,
}: FullscreenPreviewModalProps) {
  const { toast } = useToast();
  const { addMinimizedFile, splitScreenFile, setSplitScreenFile, addRecentFile, setActivePreviewFile } = useDynamicBubble();
  const [showControls, setShowControls] = useState(true);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [isNightMode, setIsNightMode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [customZoom, setCustomZoom] = useState(100);
  const [isExportShareOpen, setIsExportShareOpen] = useState(false);

  const effectiveSize = size ?? fileSize;
  const effectiveDownloadUrl = downloadUrl ?? url;

  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const meta = inspectFileType(fileName, mimeType);

  useEffect(() => {
    if (isOpen && fileName) {
      const minType = fileName.endsWith(".pdf")
        ? "pdf"
        : fileName.match(/\.(docx|doc)$/)
        ? "docx"
        : fileName.match(/\.(xlsx|xls|csv)$/)
        ? "xlsx"
        : meta.category === "image"
        ? "image"
        : meta.category === "code" || meta.category === "text"
        ? "text"
        : "other";

      const payload = {
        id: fileName + "_" + (size || 0),
        name: fileName,
        type: minType,
        url,
        size,
      };
      addRecentFile(payload);
      setActivePreviewFile(payload);
    }
  }, [isOpen, fileName, url, size]);

  const handleClose = useCallback(() => {
    setActivePreviewFile(null);
    onClose();
  }, [onClose, setActivePreviewFile]);

  // Auto-hide controls after inactivity for true immersion
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setShowControls(false);
      setShowKeyboardHelp(false);
    }, 4500);
  }, []);

  // Keyboard navigation shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input inside preview
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      } else if (e.key === "?" || e.key === "/") {
        e.preventDefault();
        setShowKeyboardHelp((prev) => !prev);
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setIsNightMode((prev) => !prev);
      } else if (e.key === "0") {
        e.preventDefault();
        setCustomZoom(100);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  useEffect(() => {
    if (!isOpen) {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      return;
    }

    resetHideTimer();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [isOpen, resetHideTimer]);

  if (!isOpen) return null;

  const handleShare = () => {
    setIsExportShareOpen(true);
  };

  const handlePrint = () => {
    window.print();
  };

  // Dynamic Theme Aura Glow Color based on file category
  const auraGlowColor =
    meta.category === "image"
      ? "from-cyan-500/10 via-blue-500/5"
      : meta.category === "video" || meta.category === "audio"
      ? "from-purple-500/10 via-pink-500/5"
      : meta.category === "sheet"
      ? "from-emerald-500/10 via-teal-500/5"
      : meta.category === "document" && (fileName.toLowerCase().endsWith(".pdf") || mimeType === "application/pdf")
      ? "from-red-500/10 via-orange-500/5"
      : meta.category === "presentation"
      ? "from-amber-500/10 via-orange-500/5"
      : "from-indigo-500/10 via-primary/5";

  return (
    <div
      className={`fixed inset-0 z-[9999] w-[100dvw] h-[100dvh] bg-background/98 backdrop-blur-3xl flex flex-col select-none overflow-hidden touch-manipulation transition-colors duration-300 ${
        isNightMode ? "dark bg-black/95 text-white" : ""
      }`}
      onMouseMove={resetHideTimer}
      onTouchStart={resetHideTimer}
      onClick={(e) => {
        // Tap background canvas to toggle HUD controls
        if ((e.target as HTMLElement).tagName === "MAIN" || (e.target as HTMLElement).id === "fullscreen-canvas") {
          setShowControls((prev) => !prev);
        }
      }}
    >
      {/* ── Ambient Radial Glow Light in Background ── */}
      <div
        className={`absolute inset-0 bg-gradient-radial ${auraGlowColor} to-transparent pointer-events-none opacity-80 blur-3xl`}
      />

      {/* ── Top Floating Glass Island Titlebar ── */}
      <header
        className={`fixed top-3 sm:top-5 inset-x-3 sm:inset-x-8 z-50 transition-all duration-300 transform ${
          showControls ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-6 pointer-events-none"
        }`}
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="max-w-6xl mx-auto bg-card/90 dark:bg-card/90 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-2xl rounded-2xl sm:rounded-3xl px-3 sm:px-5 py-2 sm:py-3 flex items-center justify-between gap-2.5">
          {/* Left: Document details */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-primary/15 text-primary border border-primary/25 flex items-center justify-center shrink-0 shadow-inner">
              {meta.category === "image" ? (
                <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : meta.category === "video" ? (
                <VideoIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : meta.category === "audio" ? (
                <Music className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : meta.category === "sheet" ? (
                <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : meta.category === "code" || meta.category === "text" ? (
                <FileCode className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : meta.category === "archive" ? (
                <FileArchive className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : (
                <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span
                  className="text-xs sm:text-sm font-black text-foreground truncate max-w-[130px] sm:max-w-md tracking-tight"
                  title={fileName}
                >
                  {fileName}
                </span>
                <span className="px-1.5 py-0.2 rounded-md text-[9px] sm:text-[10px] font-mono font-bold bg-primary/15 text-primary border border-primary/20 shrink-0 uppercase">
                  {meta.extension || "FILE"}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground font-mono flex items-center gap-1.5 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>{size ? `${formatBytes(size)} • ` : ""}Studio Theater Mode</span>
              </p>
            </div>
          </div>

          {/* Right: Quick actions and Exit Fullscreen Button */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Keyboard Shortcuts Hint */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowKeyboardHelp((h) => !h)}
              className="h-8 sm:h-9 w-8 sm:w-9 p-0 rounded-xl text-muted-foreground hover:text-foreground hidden sm:flex"
              title="Keyboard shortcuts (?)"
            >
              <Keyboard className="w-4 h-4" />
            </Button>

            {/* Share / Copy Link Button */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleShare}
              className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl text-xs font-bold gap-1.5 shadow-xs border-border"
              title="Share or Copy Link"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5" />}
              <span className="hidden md:inline">{copiedLink ? "Copied" : "Share"}</span>
            </Button>

            {/* Minimize to Dynamic Bubble */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                addMinimizedFile({
                  id: Math.random().toString(36).substring(2, 9),
                  name: fileName,
                  type: fileName.endsWith(".pdf") ? "pdf" : fileName.match(/\.(docx|doc)$/) ? "docx" : "other",
                  url,
                  size,
                });
                toast({ title: "Minimized to Dynamic Bubble", description: `${fileName} stashed in top dynamic island.` });
                handleClose();
              }}
              className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl text-xs font-bold gap-1.5 shadow-xs border-border"
              title="Minimize to Dynamic Bubble"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Minimize</span>
            </Button>

            {/* Split Screen View */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSplitScreenFile({
                  id: Math.random().toString(36).substring(2, 9),
                  name: fileName,
                  type: fileName.endsWith(".pdf") ? "pdf" : fileName.match(/\.(docx|doc)$/) ? "docx" : "other",
                  url,
                  size,
                });
                toast({ title: "Split-Screen Active", description: `${fileName} opened in split view.` });
              }}
              className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl text-xs font-bold gap-1.5 shadow-xs border-border"
              title="Split-Screen View"
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Split Screen</span>
            </Button>

            {/* Download Button */}
            <Button
              size="sm"
              variant="outline"
              asChild
              className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl text-xs font-bold gap-1.5 shadow-xs border-border"
              title="Download original file"
            >
              <a href={url} download={fileName}>
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download</span>
              </a>
            </Button>

            {/* Main Exit Fullscreen Button */}
            <Button
              size="sm"
              onClick={handleClose}
              className="h-8 sm:h-9 px-3 sm:px-4 rounded-xl text-xs font-black shadow-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:scale-105 active:scale-95 transition-all gap-1.5"
              title="Exit Fullscreen (ESC)"
            >
              <X className="w-4 h-4" />
              <span>Exit</span>
              <kbd className="hidden md:inline-block ml-1 px-1.5 py-0.2 bg-black/25 rounded text-[9px] font-mono font-normal">
                ESC
              </kbd>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Main Stage Canvas Area (Scrollable & Responsive) ── */}
      <main
        id="fullscreen-canvas"
        className="flex-1 w-full h-full overflow-auto flex items-center justify-center p-2 sm:p-6 pt-16 sm:pt-20 pb-16 sm:pb-20 relative z-10"
      >
        <div className={`w-full h-full max-w-7xl mx-auto grid ${splitScreenFile ? "grid-cols-1 md:grid-cols-2 gap-4" : "flex items-center justify-center"}`}>
          <div className="w-full h-full flex items-center justify-center bg-card/60 backdrop-blur-md rounded-2xl border border-border p-2 overflow-auto shadow-sm">
            {children}
          </div>
          {splitScreenFile && (
            <div className="w-full h-full flex flex-col items-center justify-center bg-card/60 backdrop-blur-md rounded-2xl border border-border p-4 relative overflow-auto shadow-sm">
              <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
                <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-xl">Split View: {splitScreenFile.name}</span>
                <Button size="icon" variant="ghost" onClick={() => setSplitScreenFile(null)} className="h-7 w-7 rounded-lg">
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="my-auto w-full h-full flex items-center justify-center pt-8">
                {splitScreenFile.url ? (
                  splitScreenFile.type === "pdf" ? (
                    <iframe src={splitScreenFile.url} className="w-full h-full min-h-[400px] rounded-xl border border-border" title={splitScreenFile.name} />
                  ) : (
                    <div className="text-center space-y-3 p-6">
                      <FileText className="w-12 h-12 text-primary mx-auto" />
                      <p className="text-sm font-bold text-foreground">{splitScreenFile.name}</p>
                      <Button asChild size="sm">
                        <a href={splitScreenFile.url} download={splitScreenFile.name}>Download</a>
                      </Button>
                    </div>
                  )
                ) : (
                  <p className="text-xs text-muted-foreground">Split view file loaded</p>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── Bottom Floating Dock Action Toolbar ── */}
      <footer
        className={`fixed bottom-3 sm:bottom-5 inset-x-4 sm:inset-x-0 z-50 flex justify-center transition-all duration-300 transform pointer-events-none ${
          showControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
        }`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="pointer-events-auto bg-card/90 dark:bg-card/90 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-2xl rounded-2xl sm:rounded-full px-3 sm:px-4 py-1.5 sm:py-2 flex items-center gap-1.5 sm:gap-3">
          {/* Night reading mode toggle */}
          <button
            type="button"
            onClick={() => setIsNightMode((n) => !n)}
            className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
              isNightMode
                ? "bg-amber-500/20 text-amber-500 border border-amber-500/30"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
            title="Toggle Night Theme (N)"
          >
            {isNightMode ? <Sun className="w-3.5 h-3.5 text-amber-500" /> : <Moon className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline text-[11px]">{isNightMode ? "Day Mode" : "Night Mode"}</span>
          </button>

          <div className="w-px h-4 bg-border hidden sm:block" />

          {/* Quick Print Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="p-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors hidden sm:flex items-center gap-1.5"
            title="Print Preview (Ctrl/Cmd + P)"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="text-[11px]">Print</span>
          </button>

          <div className="w-px h-4 bg-border hidden sm:block" />

          {/* Direct File Link Button */}
          <button
            type="button"
            onClick={() => window.open(url, "_blank")}
            className="p-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex items-center gap-1.5"
            title="Open in Native Browser Tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">Native Tab</span>
          </button>

          {/* Quick Dismiss Fullscreen */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-xs font-bold text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1.5"
            title="Exit Fullscreen (ESC)"
          >
            <Minimize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">Close Theater</span>
          </button>
        </div>
      </footer>

      {/* ── Keyboard Shortcuts Guide Overlay Popover ── */}
      {showKeyboardHelp && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-card border border-border shadow-2xl rounded-3xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-primary" />
                Fullscreen Shortcuts
              </h3>
              <button
                type="button"
                onClick={() => setShowKeyboardHelp(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between p-2 rounded-xl bg-secondary/50">
                <span className="text-muted-foreground">Exit Fullscreen</span>
                <kbd className="px-2 py-0.5 rounded bg-background border text-[10px] font-bold">ESC</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-secondary/50">
                <span className="text-muted-foreground">Toggle Night Mode</span>
                <kbd className="px-2 py-0.5 rounded bg-background border text-[10px] font-bold">N</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-secondary/50">
                <span className="text-muted-foreground">Play / Pause Media</span>
                <kbd className="px-2 py-0.5 rounded bg-background border text-[10px] font-bold">Space</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-secondary/50">
                <span className="text-muted-foreground">Rewind / Skip 5s</span>
                <kbd className="px-2 py-0.5 rounded bg-background border text-[10px] font-bold">← / →</kbd>
              </div>
            </div>

            <Button
              size="sm"
              onClick={() => setShowKeyboardHelp(false)}
              className="w-full rounded-xl font-bold text-xs"
            >
              Got it
            </Button>
          </div>
        </div>
      )}

      {/* ── Persistent Floating Mobile Quick-Exit Button (Always accessible on phones) ── */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Exit Fullscreen Mode"
        className={`fixed top-3 right-3 z-50 w-10 h-10 rounded-full bg-black/85 backdrop-blur-md text-white border border-white/20 shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all md:hidden ${
          showControls ? "opacity-0 pointer-events-none" : "opacity-90"
        }`}
      >
        <X className="w-5 h-5" />
      </button>

      {/* Multi-App Export & Share Modal */}
      <ExportShareModal
        isOpen={isExportShareOpen}
        onClose={() => setIsExportShareOpen(false)}
        fileName={fileName}
        fileSize={effectiveSize}
        mimeType={mimeType}
        shareUrl={url}
        downloadUrl={effectiveDownloadUrl}
        customNote={`Viewing shared file: ${fileName}`}
      />
    </div>
  );
}
