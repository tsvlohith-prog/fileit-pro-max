import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Unlock, Eye, EyeOff, ShieldCheck, ShieldAlert, KeyRound, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";

interface PasswordProtectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: string;
  targetName: string;
  type: "file" | "folder";
  isProtected?: boolean;
  isInherited?: boolean;
  hasOwnPassword?: boolean;
  folderName?: string;
  onSuccess?: () => void;
}

export function PasswordProtectDialog({
  isOpen,
  onClose,
  targetId,
  targetName,
  type,
  isProtected = false,
  isInherited = false,
  hasOwnPassword = false,
  folderName,
  onSuccess,
}: PasswordProtectDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Evaluate password strength
  const getStrength = (pass: string) => {
    if (!pass) return { label: "", color: "bg-muted", percent: 0 };
    if (pass.length < 4) return { label: "Too short", color: "bg-destructive", percent: 25 };
    if (pass.length < 8) return { label: "Fair", color: "bg-amber-500", percent: 50 };
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pass);
    const hasNum = /\d/.test(pass);
    if (pass.length >= 8 && (hasSpecial || hasNum)) {
      return { label: "Strong", color: "bg-emerald-500", percent: 100 };
    }
    return { label: "Good", color: "bg-blue-500", percent: 75 };
  };

  const strength = getStrength(password);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      toast({
        variant: "destructive",
        title: "Password required",
        description: "Please enter a password to protect this item.",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Passwords do not match",
        description: "Please confirm your password correctly.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const endpoint = type === "file" ? `/api/files/${targetId}/password` : `/api/folders/${targetId}/password`;
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.trim() }),
      });

      if (!res.ok) {
        throw new Error("Failed to set password");
      }

      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });

      toast({
        title: "Password protection enabled",
        description: `${type === "file" ? "File" : "Folder"} is now securely locked.`,
      });

      setPassword("");
      setConfirmPassword("");
      onSuccess?.();
      onClose();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to set password",
        description: "Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemovePassword = async () => {
    setIsSubmitting(true);
    try {
      const endpoint = type === "file" ? `/api/files/${targetId}/password` : `/api/folders/${targetId}/password`;
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: null }),
      });

      if (!res.ok) {
        throw new Error("Failed to remove password");
      }

      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });

      toast({
        title: "Password lock removed",
        description: `${type === "file" ? "File" : "Folder"} is now unlocked and accessible.`,
      });

      setPassword("");
      setConfirmPassword("");
      onSuccess?.();
      onClose();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to remove password",
        description: "Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md rounded-2xl border-border bg-card shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/20">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                {hasOwnPassword ? "Manage Password Lock" : "Protect with Password"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground line-clamp-1">
                {targetName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Inheritance Notice */}
        {type === "file" && isInherited && (
          <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-700 dark:text-purple-300 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Inheriting Folder Lock: </span>
              This file is currently protected by folder {folderName ? `"${folderName}"` : ""}. Setting a custom password here will create an individual override lock.
            </div>
          </div>
        )}

        {hasOwnPassword && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Directly Locked: </span>
              This {type} has an active custom password lock. You can change it below or remove it completely.
            </div>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="pass-input" className="text-xs font-semibold">
              {hasOwnPassword ? "New Password" : "Password"}
            </Label>
            <div className="relative">
              <Input
                id="pass-input"
                type={showPassword ? "text" : "password"}
                placeholder="Enter secure passcode..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10 rounded-xl"
                autoFocus
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

            {/* Password strength bar */}
            {password.length > 0 && (
              <div className="space-y-1 pt-1">
                <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${strength.percent}%` }}
                    className={`h-full ${strength.color} transition-all`}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                  <span>Strength: {strength.label}</span>
                  <span>Minimum 4 characters</span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-pass-input" className="text-xs font-semibold">
              Confirm Password
            </Label>
            <Input
              id="confirm-pass-input"
              type={showPassword ? "text" : "password"}
              placeholder="Re-enter password to confirm..."
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="rounded-xl"
            />
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            {hasOwnPassword && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleRemovePassword}
                disabled={isSubmitting}
                className="w-full sm:w-auto font-medium rounded-xl gap-1.5 mr-auto"
              >
                <Unlock className="w-4 h-4" />
                Remove Lock
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !password.trim() || password !== confirmPassword}
              className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white gap-1.5 font-semibold"
            >
              <Lock className="w-4 h-4" />
              {hasOwnPassword ? "Update Password" : "Lock Now"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
