import type { FolderRecord } from "@workspace/api-client-react";
import { Check, Copy, Download, ExternalLink, QrCode, Share2 } from "lucide-react";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getAppUrl } from "@/lib/app-url";

interface FolderShareDialogProps {
  folder: FolderRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FolderShareDialog({ folder, open, onOpenChange }: FolderShareDialogProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const shareUrl = folder ? getAppUrl(`/folder-share/${folder.shareToken}`) : "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({ title: "Folder link copied" });
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({ variant: "destructive", title: "Failed to copy link" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            Share {folder?.name}
          </DialogTitle>
          <DialogDescription>
            {folder?.password
              ? "This folder is protected with a password. Visitors must enter the password to view or download files."
              : "Anyone with this link can view and download the folder contents."}
          </DialogDescription>
        </DialogHeader>
        {folder && (
          <div className="space-y-5">
            <div className="flex justify-center rounded-2xl border border-border bg-white p-5">
              <QRCodeSVG value={shareUrl} size={190} level="M" includeMargin />
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 p-2">
              <input
                readOnly
                value={shareUrl}
                className="min-w-0 flex-1 bg-transparent px-2 text-xs text-muted-foreground outline-none"
                aria-label="Folder share link"
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button size="sm" onClick={handleCopy}>
                {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
          </div>
        )}
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Exit QR Code
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.open(shareUrl, "_blank")}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Open page
            </Button>
            <Button variant="outline" asChild>
              <a href={`/api/folders/share/${folder?.shareToken}/download`}>
                <Download className="mr-2 h-4 w-4" />
                ZIP
              </a>
            </Button>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}