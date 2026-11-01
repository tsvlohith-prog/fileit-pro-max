import { useRoute } from "wouter";
import { useGetFileByToken, getGetFileByTokenQueryKey } from "@workspace/api-client-react";
import { getFileDownloadUrl, getFileUrl } from "@/lib/storage";
import { formatBytes } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Download, AlertCircle, ExternalLink, Copy, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { FileitLogo } from "@/components/brand/FileitLogo";
import { FileitLoader } from "@/components/brand/FileitLoader";
import { GlassmorphicUnlockModal } from "@/components/glassmorphic-unlock-modal";
import { inspectFileType } from "@/lib/file-type-helpers";

export default function SharePage() {
  const [, params] = useRoute("/share/:token");
  const token = params?.token;
  const [copied, setCopied] = useState(false);
  const [unlockedPassword, setUnlockedPassword] = useState<string | null>(null);
  const [unlockedFile, setUnlockedFile] = useState<any | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: initialFile, isLoading, isError } = useGetFileByToken(token || "", {
    query: {
      enabled: !!token,
      queryKey: getGetFileByTokenQueryKey(token || ""),
      retry: false,
    },
  });

  const file = unlockedFile || initialFile;
  const isLocked = Boolean(file && ((file as any).isLocked || ((file as any).isProtected && !file.storagePath)));

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const fileMeta = file ? inspectFileType(file.originalName, file.mimeType) : null;

  const handleUnlock = async (password: string): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await fetch(`/api/files/share/${token}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        return false;
      }

      const data = await res.json();
      if (data.file) {
        setUnlockedFile(data.file);
        setUnlockedPassword(password);
        queryClient.setQueryData(getGetFileByTokenQueryKey(token), data.file);
        toast({ title: "Unlocked successfully", description: "File is now accessible." });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleDownload = () => {
    if (!file || !file.storagePath) return;
    const link = document.createElement("a");
    link.href = getFileDownloadUrl(file.storagePath, unlockedPassword || undefined);
    link.download = file.originalName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleView = () => {
    if (!file || !file.storagePath) return;
    window.open(getFileUrl(file.storagePath, unlockedPassword || undefined), "_blank");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Link copied!" });
    } catch {
      toast({ variant: "destructive", title: "Failed to copy" });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <FileitLoader size="lg" label="Decrypting share link..." sublabel="Direct fast delivery" />
      </div>
    );
  }

  if (isError || !file) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center space-y-4 bg-card p-8 rounded-2xl border border-border shadow-sm"
        >
          <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold">File not found</h1>
          <p className="text-muted-foreground">
            This link may have expired or the file was deleted by the owner.
          </p>
        </motion.div>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background p-4 relative selection:bg-purple-500/20">
        <GlassmorphicUnlockModal
          title={file.originalName}
          size={file.size}
          mimeType={file.mimeType}
          isInherited={(file as any).isInherited}
          subTitle={(file as any).isInherited ? "Protected by parent folder lock" : "Protected by custom file password"}
          onUnlock={handleUnlock}
        />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background p-4 relative selection:bg-primary/20">
      {/* Ambient glow mesh */}
      <div className="fixed inset-0 pointer-events-none glow-mesh opacity-70" />
      <div className="fixed inset-0 pointer-events-none bg-grid-ambient opacity-20" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 22 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-card/80 backdrop-blur-xl border border-border/80 rounded-3xl p-6 md:p-8 shadow-2xl shadow-primary/5 text-center flex flex-col items-center gap-5">
          {/* Top Brand Tag */}
          <div className="flex items-center justify-between w-full pb-2 border-b border-border/40">
            <FileitLogo size="sm" showWordmark={true} />
            <span className="text-[11px] font-mono text-muted-foreground">Secure Delivery</span>
          </div>

          {/* Icon */}
          <motion.div
            initial={{ scale: 0.8, rotate: -6 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="w-16 h-16 rounded-2xl bg-secondary/80 flex items-center justify-center shadow-xs border border-border/60 mt-1"
          >
            {fileMeta?.icon}
          </motion.div>

          {/* File info with Zero-Pill Unboxed Text */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-1.5 w-full"
          >
            <div className="text-[11px] font-mono font-medium text-muted-foreground uppercase tracking-wider">
              {fileMeta?.badgeLabel || "FILE"}
            </div>
            <h1 className="text-xl font-bold break-all leading-snug text-foreground px-2" title={file.originalName}>
              {file.originalName}
            </h1>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-1 flex-wrap">
              <span className="font-semibold text-foreground">{formatBytes(file.size)}</span>
              <span aria-hidden="true">·</span>
              <span>
                {formatDistanceToNow(new Date(file.createdAt), { addSuffix: true })}
              </span>
              {file.downloadCount !== undefined && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{file.downloadCount} {file.downloadCount === 1 ? "download" : "downloads"}</span>
                </>
              )}
            </div>
          </motion.div>

          {/* Primary Action buttons */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="w-full flex flex-col gap-2.5 pt-1"
          >
            <Button
              className="w-full h-12 text-sm font-semibold rounded-xl shadow-sm shadow-primary/25"
              onClick={handleDownload}
            >
              <Download className="w-4 h-4 mr-2" />
              Download Payload ({formatBytes(file.size)})
            </Button>
            {fileMeta?.canPreviewInBrowser && (
              <Button
                variant="outline"
                className="w-full h-10 text-xs font-semibold rounded-xl bg-secondary/30"
                onClick={handleView}
              >
                <ExternalLink className="w-3.5 h-3.5 mr-2" />
                Preview in browser
              </Button>
            )}
          </motion.div>

          {/* Collapsible / Clean QR code & Share row */}
          <div className="w-full pt-2 border-t border-border/40 flex flex-col items-center gap-3">
            <div className="p-2.5 bg-white rounded-2xl shadow-xs border border-border/80">
              <QRCodeSVG
                value={shareUrl}
                size={110}
                level="M"
                includeMargin={false}
              />
            </div>

            <div className="flex items-center gap-2 w-full">
              <button
                type="button"
                onClick={handleCopy}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 px-3 rounded-xl bg-secondary/50 hover:bg-secondary text-foreground transition-all border border-border/40"
              >
                <AnimatePresence mode="wait">
                  {copied ? (
                    <motion.span
                      key="done"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Link copied!
                    </motion.span>
                  ) : (
                    <motion.span
                      key="copy"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex items-center gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copy Link
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
