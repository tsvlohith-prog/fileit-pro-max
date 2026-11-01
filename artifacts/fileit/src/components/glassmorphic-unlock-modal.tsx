import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, KeyRound, Eye, EyeOff, ShieldAlert, Sparkles, ArrowRight, FileText, Folder } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/utils";
import { inspectFileType } from "@/lib/file-type-helpers";

interface GlassmorphicUnlockModalProps {
  title: string;
  subTitle?: string;
  size?: number;
  mimeType?: string;
  isFolder?: boolean;
  isInherited?: boolean;
  onUnlock: (password: string) => Promise<boolean | void>;
  onCancel?: () => void;
}

export function GlassmorphicUnlockModal({
  title,
  subTitle,
  size,
  mimeType,
  isFolder = false,
  isInherited = false,
  onUnlock,
  onCancel,
}: GlassmorphicUnlockModalProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [shake, setShake] = useState(false);

  const fileMeta = !isFolder && mimeType ? inspectFileType(title, mimeType) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setErrorMsg("Please enter a password");
      triggerShake();
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");
    try {
      const result = await onUnlock(password.trim());
      if (result === false) {
        setErrorMsg("Incorrect password. Please try again.");
        triggerShake();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Incorrect password");
      triggerShake();
    } finally {
      setIsSubmitting(false);
    }
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 selection:bg-purple-500/20">
      {/* Blurred Deep Backdrop */}
      <div className="fixed inset-0 bg-background/80 backdrop-blur-2xl transition-all" />

      {/* Ambient Color Orb Glows */}
      <div className="fixed -top-40 -left-40 w-96 h-96 bg-purple-500/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="fixed -bottom-40 -right-40 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl pointer-events-none animate-pulse delay-1000" />

      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{
          opacity: 1,
          scale: 1,
          y: 0,
          x: shake ? [-8, 8, -6, 6, -3, 3, 0] : 0,
        }}
        transition={{
          type: "spring",
          stiffness: 260,
          damping: 24,
          x: { duration: 0.4 },
        }}
        className="w-full max-w-md relative z-10"
      >
        <div className="relative overflow-hidden rounded-3xl border border-white/20 dark:border-white/10 bg-card/75 dark:bg-card/60 backdrop-blur-3xl shadow-2xl p-6 sm:p-8 text-center flex flex-col items-center">
          {/* Subtle Glass Highlight Line */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />

          {/* Animated Glowing Lock Icon */}
          <div className="relative mb-5 group">
            <div className="absolute inset-0 bg-purple-500/30 rounded-2xl blur-xl group-hover:bg-purple-500/50 transition-all" />
            <motion.div
              whileHover={{ scale: 1.05, rotate: 2 }}
              className="relative w-16 h-16 rounded-2xl bg-gradient-to-b from-purple-500/20 to-purple-600/30 border border-purple-500/30 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-lg"
            >
              <Lock className="w-8 h-8" />
            </motion.div>
          </div>

          {/* Title & Badge */}
          <div className="space-y-1.5 mb-5 max-w-full">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <KeyRound className="w-3 h-3" />
              <span>{isInherited ? "Inherited Folder Lock" : "Password Protected"}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate px-2" title={title}>
              {title}
            </h2>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {subTitle || (isFolder ? "Folder contents are encrypted and locked" : "Authentication required to view and download")}
            </p>
          </div>

          {/* Frosted Simulated Preview Snippet */}
          <div className="w-full p-3.5 mb-5 rounded-2xl bg-secondary/40 border border-border/50 backdrop-blur-md flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-xl bg-background/80 flex items-center justify-center text-primary shrink-0 border border-border/50">
              {isFolder ? <Folder className="w-5 h-5 text-purple-500" /> : (fileMeta?.icon || <FileText className="w-5 h-5 text-purple-500" />)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate text-foreground">{title}</p>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                {size !== undefined && <span>{formatBytes(size)}</span>}
                {mimeType && <span>&bull; {mimeType.split("/")[1]?.toUpperCase() || mimeType}</span>}
                <span className="text-purple-600 dark:text-purple-400 font-medium">&bull; Locked</span>
              </div>
            </div>
          </div>

          {/* Password Entry Form */}
          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <div className="space-y-1.5 text-left">
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter access password..."
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMsg) setErrorMsg("");
                  }}
                  autoFocus
                  className="pr-10 h-11 rounded-xl bg-background/50 border-border/80 focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 backdrop-blur-md text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <AnimatePresence>
                {errorMsg && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-xs text-destructive flex items-center gap-1 font-medium pt-1"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                    {errorMsg}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <div className="flex gap-2 pt-1">
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isSubmitting}
                  className="flex-1 rounded-xl h-11"
                >
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                disabled={isSubmitting || !password.trim()}
                className="flex-1 h-11 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold gap-2 shadow-lg shadow-purple-600/20"
              >
                {isSubmitting ? (
                  <span>Verifying...</span>
                ) : (
                  <>
                    <span>Unlock</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
