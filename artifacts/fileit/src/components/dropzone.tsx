import { useState, useCallback, useEffect } from "react";
import { UploadCloud, ClipboardCheck, Sparkles, FolderArchive } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import JSZip from "jszip";
import { FileitLoader } from "@/components/brand/FileitLoader";
import { useDynamicBubble } from "@/components/dynamic-bubble-context";

interface DropzoneProps {
  onFileSelect: (file: File) => void;
  isUploading?: boolean;
  progress?: number;
}

export function Dropzone({ onFileSelect, isUploading, progress = 0 }: DropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const { startTransfer, updateTransferProgress, completeTransfer } = useDynamicBubble();

  useEffect(() => {
    if (isUploading) {
      startTransfer({
        id: "active-upload",
        name: "Uploading Payload",
        type: "upload",
        progress: progress || 15,
        speedMBps: 4.2,
        etaSeconds: 3,
      });
      updateTransferProgress("active-upload", progress || 15, 4.2, Math.max(1, Math.round((100 - progress) / 25)));
    } else if (progress >= 100) {
      completeTransfer("active-upload");
    }
  }, [isUploading, progress, startTransfer, updateTransferProgress, completeTransfer]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const processFiles = useCallback(
    async (filesList: FileList | File[]) => {
      if (!filesList || filesList.length === 0) return;

      if (filesList.length === 1) {
        onFileSelect(filesList[0]);
      } else {
        setIsZipping(true);
        try {
          const zip = new JSZip();
          for (let i = 0; i < filesList.length; i++) {
            const file = filesList[i];
            zip.file(file.name, file);
          }
          const zipBlob = await zip.generateAsync({ type: "blob" });
          const zipFile = new File([zipBlob], `archive-${Date.now()}.zip`, {
            type: "application/zip",
          });
          onFileSelect(zipFile);
        } catch (err) {
          console.error("Failed to create zip:", err);
        } finally {
          setIsZipping(false);
        }
      }
    },
    [onFileSelect]
  );

  // Global clipboard paste support (Ctrl+V / Cmd+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (isUploading || isZipping) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      const pastedFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) pastedFiles.push(file);
        }
      }

      if (pastedFiles.length > 0) {
        processFiles(pastedFiles);
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [isUploading, isZipping, processFiles]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);
      processFiles(e.dataTransfer.files);
    },
    [processFiles]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        processFiles(e.target.files);
      }
    },
    [processFiles]
  );

  return (
    <motion.div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      animate={
        isDragActive
          ? { scale: 1.02, borderColor: "hsl(var(--primary))" }
          : { scale: 1 }
      }
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={cn(
        "relative group flex flex-col items-center justify-center w-full min-h-[320px] rounded-3xl p-8 md:p-12 text-center transition-all duration-300 bg-card/60 backdrop-blur-md overflow-hidden",
        "border-2 border-dashed",
        isDragActive
          ? "border-primary bg-primary/5 shadow-2xl shadow-primary/10 ring-4 ring-primary/10"
          : "border-border hover:border-primary/40 hover:bg-card/90 shadow-sm",
        (isUploading || isZipping) && "pointer-events-none"
      )}
    >
      {/* Laser line top highlight */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent pointer-events-none" />

      <input
        type="file"
        multiple
        onChange={handleFileInput}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        disabled={isUploading || isZipping}
      />

      <AnimatePresence mode="wait">
        {isZipping ? (
          <motion.div
            key="zipping"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center gap-5"
          >
            <FileitLoader
              size="lg"
              label="Bundling archive..."
              sublabel="Compressing multi-file batch before dispatch"
            />
          </motion.div>
        ) : isUploading ? (
          <motion.div
            key="uploading"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center gap-5"
          >
            <div className="relative w-28 h-28 flex items-center justify-center">
              {/* Radial glow */}
              <div className="absolute inset-0 rounded-full bg-primary/15 blur-xl animate-pulse" />

              <svg className="w-28 h-28 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(var(--border))" strokeWidth="5" />
                <motion.circle
                  cx="40" cy="40" r="34"
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 34}
                  animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - progress / 100) }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.span
                  className="text-xl font-black text-foreground tracking-tight"
                  key={progress}
                  initial={{ scale: 1.1 }}
                  animate={{ scale: 1 }}
                >
                  {progress}%
                </motion.span>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">uploading</span>
              </div>
            </div>
            <div className="space-y-1 text-center">
              <p className="font-bold text-lg text-foreground tracking-tight">
                {progress < 50 ? "Transferring payload..." : progress < 90 ? "Encrypting & Storing..." : "Finalizing share link..."}
              </p>
              <p className="text-xs text-muted-foreground">Streaming data securely to edge node</p>
            </div>
            <div className="w-64 h-1.5 bg-muted rounded-full overflow-hidden p-0.5 border border-border/40">
              <motion.div
                className="h-full bg-primary rounded-full shadow-sm"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-col items-center gap-4 max-w-md mx-auto"
          >
            <motion.div
              animate={isDragActive ? { scale: 1.15, rotate: -4 } : { scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
              className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 border shadow-xs",
                isDragActive
                  ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                  : "bg-secondary/70 text-foreground border-border/80 group-hover:border-primary/50 group-hover:bg-primary/10 group-hover:text-primary"
              )}
            >
              <UploadCloud className="w-8 h-8" />
            </motion.div>

            <div className="space-y-1.5">
              <h3 className="font-bold text-xl text-foreground tracking-tight">
                {isDragActive ? "Release to stage & upload" : "Drop files to share instantly"}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Drag and drop files here, browse from device, or paste directly with{" "}
                <kbd className="px-1.5 py-0.5 text-xs font-mono rounded-md bg-secondary text-foreground border border-border">
                  ⌘V
                </kbd>
              </p>
            </div>

            {/* Zero-Pill Unboxed Metadata Separators */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
              <span>Any Format</span>
              <span aria-hidden="true">·</span>
              <span>APK, ZIP, Media, Docs</span>
              <span aria-hidden="true">·</span>
              <span>Batch auto-bundles to ZIP</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
