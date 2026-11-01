import { Layout } from "@/components/layout";
import { Dropzone } from "@/components/dropzone";
import { useUpload } from "@/hooks/use-upload";
import { useGetFileStats, useListFiles } from "@workspace/api-client-react";
import { FileCard, FileCardSkeleton } from "@/components/file-card";
import { formatBytes } from "@/lib/utils";
import { Link } from "wouter";
import { HardDrive, Files, Copy, CheckCircle2, Clock, Zap, Lock } from "lucide-react";
import { useState, useEffect } from "react";
import { ChangeExpirationDialog } from "@/components/change-expiration-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";

function AnimatedCount({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === 0) {
      setDisplay(0);
      return;
    }
    let start = 0;
    const step = Math.ceil(value / 30);
    const timer = setInterval(() => {
      start = Math.min(start + step, value);
      setDisplay(start);
      if (start >= value) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [value]);
  return <>{display}</>;
}

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { ease: "easeOut" as const, duration: 0.4 } },
};

export default function Home() {
  const { uploadFile, isUploading, progress } = useUpload();
  const { data: stats, isLoading: statsLoading } = useGetFileStats();
  const { data: files, isLoading: filesLoading } = useListFiles();
  const [sharedFile, setSharedFile] = useState<{ name: string; token: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<string>("259200"); // Default 3 days (in seconds)
  const { toast } = useToast();

  const shareUrl = sharedFile ? `${window.location.origin}/share/${sharedFile.token}` : "";

  const getExpiresAtDate = (seconds: string) => {
    if (seconds === "forever") return undefined;
    return new Date(Date.now() + parseInt(seconds) * 1000).toISOString();
  };

  const handleFileSelect = async (file: File) => {
    try {
      const expiresAt = getExpiresAtDate(selectedDuration);
      const result = await uploadFile(file, undefined, expiresAt);
      setSharedFile({ name: result.originalName, token: result.shareToken });
    } catch {
      // error handled in hook
    }
  };

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Link copied to clipboard!" });
    } catch {
      toast({ variant: "destructive", title: "Failed to copy" });
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-12">
        {/* Hero */}
        <motion.section
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-6 pt-2 md:pt-4"
        >
          <motion.div variants={itemVariants} className="text-center space-y-3">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground">
              Instant, Ephemeral <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-primary via-primary/80 to-indigo-500 bg-clip-text text-transparent">
                File Sharing
              </span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              No registration. No tracking. Drop any payload, set an auto-destruct timer, and distribute with a private link.
            </p>
          </motion.div>

          {/* Core Feature Strip - Zero Pill Plain Typography */}
          <motion.div
            variants={itemVariants}
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground pt-1"
          >
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <Zap className="w-3.5 h-3.5 text-primary" /> Zero Registration
            </span>
            <span aria-hidden="true" className="text-border">·</span>
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <Clock className="w-3.5 h-3.5 text-primary" /> Auto-Dissolving
            </span>
            <span aria-hidden="true" className="text-border">·</span>
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <Lock className="w-3.5 h-3.5 text-primary" /> Private Links
            </span>
            <span aria-hidden="true" className="text-border">·</span>
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <HardDrive className="w-3.5 h-3.5 text-primary" /> Auto-ZIP Bundling
            </span>
          </motion.div>

          {/* Staging & Upload Deck */}
          <motion.div variants={itemVariants} className="max-w-2xl mx-auto mt-6 space-y-4">
            {/* Expiration Segmented Control */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-card/60 backdrop-blur-md border border-border/80 p-2.5 rounded-2xl shadow-xs">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5 px-2 self-start sm:self-center">
                <Clock className="w-4 h-4 text-primary shrink-0" />
                <span>Auto-Dissolve:</span>
              </span>
              <div className="grid grid-cols-3 sm:flex items-center gap-1 w-full sm:w-auto">
                {[
                  { label: "1h", fullLabel: "1 Hour", value: "3600" },
                  { label: "12h", fullLabel: "12 Hours", value: "43200" },
                  { label: "1d", fullLabel: "1 Day", value: "86400" },
                  { label: "3d (Default)", fullLabel: "3 Days", value: "259200" },
                  { label: "1w", fullLabel: "1 Week", value: "604800" },
                  { label: "Forever", fullLabel: "Keep Forever", value: "forever" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`h-7 sm:h-8 text-xs font-medium rounded-lg px-2 sm:px-2.5 transition-all text-center ${
                      selectedDuration === opt.value
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                    }`}
                    onClick={() => setSelectedDuration(opt.value)}
                    title={opt.fullLabel}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <Dropzone
              onFileSelect={handleFileSelect}
              isUploading={isUploading}
              progress={progress}
            />
          </motion.div>
        </motion.section>

        {/* Metric Command Deck */}
        <motion.section
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto pt-2"
        >
          {[
            {
              icon: <Files className="w-5 h-5" />,
              label: "Files Shared Through Hub",
              value: statsLoading ? "—" : <AnimatedCount value={stats?.totalFiles ?? 0} />,
              detail: "Self-prunes upon expiry",
            },
            {
              icon: <HardDrive className="w-5 h-5" />,
              label: "Active Stored Volume",
              value: statsLoading ? "—" : formatBytes(stats?.totalSize ?? 0),
              detail: "Distributed edge storage",
            },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              variants={itemVariants}
              className="flex items-start gap-4 p-5 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/70 hover:border-border transition-colors shadow-xs"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                {stat.icon}
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-foreground tracking-tight">{stat.value}</p>
                <p className="text-xs font-medium text-foreground">{stat.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{stat.detail}</p>
              </div>
            </motion.div>
          ))}
        </motion.section>

        {/* Recent uploads */}
        {!filesLoading && Array.isArray(files) && files.length > 0 && (
          <motion.section
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="max-w-2xl mx-auto space-y-3 pt-2"
          >
            <motion.div variants={itemVariants} className="flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span>Recent Uploads</span>
              </h2>
              <Link
                href="/files"
                className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
              >
                Open Hub →
              </Link>
            </motion.div>
            <motion.div variants={itemVariants} className="space-y-2">
              {files.slice(0, 5).map((file) => (
                <FileCard key={file.id} file={file} showActions={true} />
              ))}
            </motion.div>
          </motion.section>
        )}

        {filesLoading && (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <FileCardSkeleton key={i} />
            ))}
          </div>
        )}
      </div>

      {/* Share dialog */}
      <Dialog open={!!sharedFile} onOpenChange={(open) => !open && setSharedFile(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>File ready to share!</DialogTitle>
            <DialogDescription>
              Share this link with anyone — no account required to download.
            </DialogDescription>
          </DialogHeader>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-5 py-2"
          >
            <div className="p-3 bg-white rounded-2xl shadow-sm border border-border">
              <QRCodeSVG value={shareUrl} size={160} />
            </div>

            <p className="text-sm text-muted-foreground text-center">
              Scan the QR code or copy the link below
            </p>

            <div className="w-full flex items-center gap-2">
              <Input
                readOnly
                value={shareUrl}
                className="flex-1 font-mono text-xs bg-secondary/50"
              />
              <Button
                onClick={copyShareLink}
                variant={copied ? "default" : "outline"}
                className="shrink-0 transition-all"
              >
                <AnimatePresence mode="wait">
                  {copied ? (
                    <motion.span
                      key="check"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      className="flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Copied
                    </motion.span>
                  ) : (
                    <motion.span
                      key="copy"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      className="flex items-center gap-1"
                    >
                      <Copy className="w-4 h-4" /> Copy
                    </motion.span>
                  )}
                </AnimatePresence>
              </Button>
            </div>

            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1" onClick={() => setSharedFile(null)}>
                Exit QR Code
              </Button>
              <Button variant="secondary" className="flex-1" onClick={() => setSharedFile(null)}>
                Done
              </Button>
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>
      
      <ChangeExpirationDialog />
    </Layout>
  );
}
