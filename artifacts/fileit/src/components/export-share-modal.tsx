import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Share2,
  Copy,
  Check,
  Download,
  Mail,
  Send,
  MessageCircle,
  ExternalLink,
  FileText,
  Sparkles,
  Smartphone,
  Hash,
  Clock,
  ShieldCheck,
} from "lucide-react";
import {
  executeNativeShare,
  generateAppShareUrls,
  isNativeShareSupported,
  fetchFileAsFileObject,
  type SharePayload,
} from "@/lib/export-share-helper";
import { formatBytes } from "@/lib/utils";

export interface ExportShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  shareUrl: string;
  downloadUrl?: string;
  fileBlob?: Blob;
  customNote?: string;
}

export function ExportShareModal({
  isOpen,
  onClose,
  fileName,
  fileSize,
  mimeType,
  shareUrl,
  downloadUrl,
  fileBlob,
  customNote,
}: ExportShareModalProps) {
  const { toast } = useToast();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSlack, setCopiedSlack] = useState(false);
  const [isSharingNative, setIsSharingNative] = useState(false);

  // Ensure absolute URL
  const absoluteShareUrl = shareUrl.startsWith("http")
    ? shareUrl
    : typeof window !== "undefined"
    ? `${window.location.origin}${shareUrl.startsWith("/") ? "" : "/"}${shareUrl}`
    : shareUrl;

  const appUrls = generateAppShareUrls({
    title: `File: ${fileName}`,
    fileName,
    url: absoluteShareUrl,
    customNote,
  });

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(absoluteShareUrl);
      setCopiedLink(true);
      toast({ title: "Link Copied!", description: "Share link ready to paste." });
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      toast({ variant: "destructive", title: "Copy Failed", description: "Could not copy link." });
    }
  };

  const handleCopySlack = async () => {
    try {
      await navigator.clipboard.writeText(appUrls.slackNotice);
      setCopiedSlack(true);
      toast({ title: "Slack Markdown Copied!", description: "Paste directly into Slack or Teams channels." });
      setTimeout(() => setCopiedSlack(false), 2500);
    } catch {
      toast({ variant: "destructive", title: "Copy Failed" });
    }
  };

  const handleNativeShare = async () => {
    setIsSharingNative(true);
    try {
      let fileToAttach: File | undefined;
      if (fileBlob) {
        fileToAttach = new File([fileBlob], fileName, {
          type: mimeType || fileBlob.type || "application/octet-stream",
        });
      } else if (downloadUrl) {
        const fetched = await fetchFileAsFileObject(downloadUrl, fileName, mimeType);
        if (fetched) fileToAttach = fetched;
      }

      const res = await executeNativeShare({
        title: fileName,
        text: customNote ? `${customNote}\n\nShared via Fileit Room: ${fileName}` : `Shared file: ${fileName}`,
        url: absoluteShareUrl,
        file: fileToAttach,
      });

      if (res.success) {
        toast({ title: "Shared Successfully" });
      } else if (res.error && res.error !== "Share dismissed by user") {
        toast({ variant: "destructive", title: "Sharing Notice", description: res.error });
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Sharing Error", description: err?.message || "Could not launch share sheet." });
    } finally {
      setIsSharingNative(false);
    }
  };

  const handleDirectDownload = () => {
    const targetUrl = downloadUrl || absoluteShareUrl;
    const a = document.createElement("a");
    a.href = targetUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast({ title: "Download Started", description: fileName });
  };

  const hasNativeShare = isNativeShareSupported();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md w-[94vw] sm:w-full rounded-3xl p-5 sm:p-6 bg-card border border-border/80 shadow-2xl space-y-4">
        <DialogHeader className="text-left space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                Export & Share Document
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Send directly to common apps or open your device’s native share sheet.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* File Details Capsule */}
        <div className="p-3 rounded-2xl bg-secondary/30 border border-border/60 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-foreground truncate max-w-[220px]" title={fileName}>
                {fileName}
              </p>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                {fileSize ? <span>{formatBytes(fileSize)}</span> : null}
                <span className="inline-block w-1 h-1 rounded-full bg-border" />
                <span className="flex items-center gap-1 text-emerald-500">
                  <ShieldCheck className="w-3 h-3" /> Secure Link
                </span>
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={handleDirectDownload}
            className="h-8 rounded-xl text-xs font-bold gap-1 shrink-0 border-border"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Save</span>
          </Button>
        </div>

        {/* Primary Action: Native OS Share Sheet */}
        <div>
          <Button
            type="button"
            onClick={handleNativeShare}
            disabled={isSharingNative}
            className="w-full h-11 rounded-2xl text-xs font-bold gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/95 hover:to-primary text-primary-foreground shadow-md transition-transform active:scale-[0.98]"
          >
            <Smartphone className="w-4 h-4" />
            <span>{isSharingNative ? "Opening Share Sheet..." : hasNativeShare ? "Share via Device Apps (WhatsApp, Telegram, etc.)" : "Share via Device Sheet"}</span>
          </Button>
          <p className="text-[10px] text-center text-muted-foreground mt-1.5">
            Opens native iOS / Android / macOS share sheet with file attached.
          </p>
        </div>

        {/* Quick Direct App Shortcuts Grid */}
        <div className="space-y-2 pt-1 border-t border-border/60">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Direct App Shortcuts
          </p>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* WhatsApp */}
            <a
              href={appUrls.whatsApp}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-semibold transition-all group"
            >
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                <MessageCircle className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold leading-tight">WhatsApp</p>
                <p className="text-[9px] text-muted-foreground">Send message & link</p>
              </div>
            </a>

            {/* Telegram */}
            <a
              href={appUrls.telegram}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 font-semibold transition-all group"
            >
              <div className="w-7 h-7 rounded-lg bg-sky-500/20 flex items-center justify-center text-sky-400 group-hover:scale-105 transition-transform">
                <Send className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold leading-tight">Telegram</p>
                <p className="text-[9px] text-muted-foreground">Forward to chats</p>
              </div>
            </a>

            {/* Gmail */}
            <a
              href={appUrls.gmail}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-semibold transition-all group"
            >
              <div className="w-7 h-7 rounded-lg bg-rose-500/20 flex items-center justify-center text-rose-400 group-hover:scale-105 transition-transform">
                <Mail className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold leading-tight">Gmail</p>
                <p className="text-[9px] text-muted-foreground">Compose email draft</p>
              </div>
            </a>

            {/* Email Client (Mailto) */}
            <a
              href={appUrls.mailto}
              className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 font-semibold transition-all group"
            >
              <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform">
                <Mail className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold leading-tight">Mail App</p>
                <p className="text-[9px] text-muted-foreground">Outlook / Apple Mail</p>
              </div>
            </a>
          </div>
        </div>

        {/* Link & Markdown Copy Deck */}
        <div className="pt-2 border-t border-border/60 flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCopyLink}
            className="flex-1 h-9 rounded-xl text-xs font-bold gap-1.5 border-border"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedLink ? "Link Copied" : "Copy Direct Link"}</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleCopySlack}
            className="flex-1 h-9 rounded-xl text-xs font-bold gap-1.5 border-border"
            title="Copy Slack/Teams formatted message markdown"
          >
            {copiedSlack ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Hash className="w-3.5 h-3.5 text-amber-400" />}
            <span>{copiedSlack ? "Copied Slack" : "Slack Markdown"}</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
