import { MoreVertical, Copy, Trash2, Download, ExternalLink, Eye, FolderInput, Star, Clock, ArrowRightLeft, Minimize2, Columns, Share2, Lock } from "lucide-react";
import { formatBytes } from "@/lib/utils";
import { getFileDownloadUrl, getFileUrl } from "@/lib/storage";
import { formatDistanceToNow } from "date-fns";
import type { FileRecord } from "@workspace/api-client-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { formatTimeRemaining } from "@/lib/rooms-storage";
import { inspectFileType } from "@/lib/file-type-helpers";
import { FileInterchangeModal } from "@/components/file-interchange-modal";
import { useDynamicBubble } from "@/components/dynamic-bubble-context";
import { ExportShareModal } from "@/components/export-share-modal";
import { PasswordProtectDialog } from "@/components/password-protect-dialog";

interface FileCardProps {
  file: FileRecord;
  onDelete?: (id: string) => void;
  onMove?: (id: string) => void;
  showActions?: boolean;
  index?: number;
}

export function FileCard({ file, onDelete, onMove, showActions = true }: FileCardProps) {
  const { addMinimizedFile, setSplitScreenFile } = useDynamicBubble();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const shareUrl = `${window.location.origin}/share/${file.shareToken}`;
  const [isDragging, setIsDragging] = useState(false);
  const [isInterchangeOpen, setIsInterchangeOpen] = useState(false);
  const [isExportShareOpen, setIsExportShareOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const fileMeta = inspectFileType(file.originalName, file.mimeType);

  const isProtected = Boolean(file.password || (file as any).isProtected);
  const isInherited = Boolean((file as any).isInherited);
  const hasOwnPassword = Boolean((file as any).hasPassword || (file.password && !isInherited));

  const handleMinimize = () => {
    addMinimizedFile({
      id: file.id,
      name: file.originalName,
      type: fileMeta.badgeLabel.toLowerCase().includes("pdf") ? "pdf" : fileMeta.badgeLabel.toLowerCase().includes("sheet") ? "xlsx" : fileMeta.badgeLabel.toLowerCase().includes("image") ? "image" : "text",
      url: getFileDownloadUrl(file.storagePath),
      size: file.size,
    });
    toast({ title: "Minimized to Dynamic Island", description: `${file.originalName} added to dynamic bubble.` });
  };

  const handleSplitScreen = () => {
    setSplitScreenFile({
      id: file.id,
      name: file.originalName,
      type: fileMeta.badgeLabel.toLowerCase().includes("pdf") ? "pdf" : fileMeta.badgeLabel.toLowerCase().includes("sheet") ? "xlsx" : fileMeta.badgeLabel.toLowerCase().includes("image") ? "image" : "text",
      url: getFileDownloadUrl(file.storagePath),
      size: file.size,
    });
    setLocation(`/view/${file.id}`);
  };

  const toggleStar = async () => {
    try {
      const res = await fetch(`/api/files/${file.id}/star`, { method: "PUT" });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/files"] });
        queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
        toast({ title: file.isStarred ? "Unstarred" : "Starred", description: file.isStarred ? "File will expire normally." : "File will be kept forever." });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Failed to update file." });
    }
  };
  
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: "Link copied", description: "Share link copied to clipboard." });
    } catch {
      toast({ variant: "destructive", title: "Failed to copy" });
    }
  };

  const handleDownload = async () => {
    try {
      await fetch(`/api/files/${file.id}/download`, { method: "POST" }).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/files/stats"] });
    } catch {}
    const link = document.createElement("a");
    link.href = getFileDownloadUrl(file.storagePath);
    link.download = file.originalName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Download started", description: `Downloading ${file.originalName}` });
  };

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    e.dataTransfer.setData("fileId", file.id);
    e.dataTransfer.setData("fileName", file.originalName);
    e.dataTransfer.effectAllowed = "move";
    const ghost = document.createElement("div");
    ghost.textContent = file.originalName;
    ghost.className =
      "bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold shadow-lg pointer-events-none";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 20);
    setTimeout(() => document.body.removeChild(ghost), 0);
  };

  const handleDragEnd = () => setIsDragging(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10, transition: { duration: 0.2 } }}
      transition={{ duration: 0.2 }}
      draggable={!!onMove}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`group flex items-center justify-between p-3 md:p-4 rounded-xl border bg-card hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 transition-colors gap-3 ${
        onMove ? "cursor-move" : ""
      } ${isDragging ? "border-primary/60 shadow-md shadow-primary/10 opacity-40 scale-[0.99]" : "border-border"}`}
    >
      <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
        <motion.div
          whileHover={{ scale: 1.1, rotate: -4 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
          className="w-10 h-10 md:w-11 md:h-11 shrink-0 rounded-xl bg-secondary/80 flex items-center justify-center border border-border/50 shadow-xs"
        >
          {fileMeta.icon}
        </motion.div>
        <div className="min-w-0 flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-sm font-semibold truncate text-foreground hover:text-primary transition-colors cursor-pointer" title={file.originalName} onClick={() => setLocation(`/view/${file.id}`)}>
              {file.originalName}
            </p>
            <span className="hidden sm:inline text-[10px] font-mono font-medium text-muted-foreground shrink-0">
              {fileMeta.badgeLabel}
            </span>
            {isProtected && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 cursor-pointer ${
                  isInherited
                    ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                    : "bg-purple-600/15 text-purple-700 dark:text-purple-300 border border-purple-600/30"
                }`}
                title={isInherited ? "Protected by folder lock" : "Protected by custom file password"}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPasswordDialogOpen(true);
                }}
              >
                <Lock className="w-3 h-3" />
                <span>{isInherited ? "Folder Lock" : "Locked"}</span>
              </span>
            )}
            {file.isStarred && (
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
            <span className="shrink-0 font-medium">{formatBytes(file.size)}</span>
            <span aria-hidden="true">·</span>
            <span>
              {formatDistanceToNow(new Date(file.createdAt), { addSuffix: true })}
            </span>
            {file.downloadCount !== undefined && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  {file.downloadCount} {file.downloadCount === 1 ? "download" : "downloads"}
                </span>
              </>
            )}
            {file.expiresAt && !file.isStarred && (
              <>
                <span aria-hidden="true">·</span>
                <span className={`inline-flex items-center gap-1 font-medium ${
                  formatTimeRemaining(file.expiresAt).isUrgent ? "text-amber-500 font-semibold" : "text-muted-foreground"
                }`}>
                  <Clock className="w-3 h-3 shrink-0" />
                  {formatTimeRemaining(file.expiresAt).text}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {showActions && (
        <div className="flex items-center gap-1 md:gap-1.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary"
            title="Copy Share Link"
            onClick={copyLink}
          >
            <Copy className="w-3.5 h-3.5" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="hidden sm:inline-flex h-8 px-2.5 text-xs font-medium"
            onClick={() => setLocation(`/view/${file.id}`)}
            title="View file"
          >
            <Eye className="w-3.5 h-3.5 mr-1" />
            View
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="hidden md:inline-flex h-8 px-2.5 text-xs font-medium text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
            onClick={handleMinimize}
            title="Minimize to Dynamic Island"
          >
            <Minimize2 className="w-3.5 h-3.5 mr-1" />
            Minimize
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="hidden md:inline-flex h-8 px-2.5 text-xs font-medium text-purple-500 border-purple-500/30 hover:bg-purple-500/10"
            onClick={handleSplitScreen}
            title="Open in Split Screen"
          >
            <Columns className="w-3.5 h-3.5 mr-1" />
            Split
          </Button>
          <Button variant="outline" size="sm" className="hidden sm:inline-flex h-8 px-2.5 text-xs font-medium" onClick={handleDownload}>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Get
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setLocation(`/view/${file.id}`)}
                className="sm:hidden"
              >
                <Eye className="w-4 h-4 mr-2" />
                View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownload} className="sm:hidden">
                <Download className="w-4 h-4 mr-2" />
                Download
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleMinimize} className="text-amber-500 font-medium">
                <Minimize2 className="w-4 h-4 mr-2" />
                Minimize to Bubble
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSplitScreen} className="text-purple-500 font-medium">
                <Columns className="w-4 h-4 mr-2" />
                Open Split Screen
              </DropdownMenuItem>
              <DropdownMenuItem onClick={copyLink}>
                <Copy className="w-4 h-4 mr-2" />
                Copy Link
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsExportShareOpen(true)} className="text-emerald-500 font-semibold">
                <Share2 className="w-4 h-4 mr-2" />
                Export to Apps (WhatsApp, etc.)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.open(shareUrl, "_blank")}>
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Share Page
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsInterchangeOpen(true)} className="text-primary font-semibold">
                <ArrowRightLeft className="w-4 h-4 mr-2" />
                Interchange Format
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsPasswordDialogOpen(true)} className="text-purple-600 dark:text-purple-400 font-semibold">
                <Lock className="w-4 h-4 mr-2" />
                {hasOwnPassword ? "Manage Password Lock" : isInherited ? "Override Password Lock" : "Set Password Lock"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                const event = new CustomEvent("change-file-expiration", {
                  detail: { fileId: file.id, originalName: file.originalName, currentExpiresAt: file.expiresAt },
                  bubbles: true,
                });
                window.dispatchEvent(event);
              }}>
                <Clock className="w-4 h-4 mr-2" />
                Change Dissolve Timer
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownload} className="hidden sm:flex">
                <Download className="w-4 h-4 mr-2" />
                Download
              </DropdownMenuItem>
              {onMove && (
                <>
                  <DropdownMenuItem onClick={toggleStar}>
                    <Star className={`mr-2 h-4 w-4 ${file.isStarred ? "fill-yellow-400 text-yellow-400" : ""}`} />
                    <span>{file.isStarred ? "Unstar (Allow Expiry)" : "Star (Keep Forever)"}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onMove(file.id)}>
                    <FolderInput className="w-4 h-4 mr-2" />
                    Move to folder
                  </DropdownMenuItem>
                </>
              )}
              {onDelete && (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onDelete(file.id)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete File
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <FileInterchangeModal
        isOpen={isInterchangeOpen}
        onClose={() => setIsInterchangeOpen(false)}
        fileId={file.id}
        fileName={file.originalName}
        mimeType={file.mimeType}
        fileUrl={getFileUrl(file.storagePath)}
        onSaveToLibrary={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/files"] });
          queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
        }}
      />

      <ExportShareModal
        isOpen={isExportShareOpen}
        onClose={() => setIsExportShareOpen(false)}
        fileName={file.originalName}
        fileSize={file.size}
        mimeType={file.mimeType}
        shareUrl={shareUrl}
        downloadUrl={getFileDownloadUrl(file.storagePath)}
        customNote={`Shared file: ${file.originalName}`}
      />

      <PasswordProtectDialog
        isOpen={isPasswordDialogOpen}
        onClose={() => setIsPasswordDialogOpen(false)}
        targetId={file.id}
        targetName={file.originalName}
        type="file"
        isProtected={isProtected}
        isInherited={isInherited}
        hasOwnPassword={hasOwnPassword}
      />
    </motion.div>
  );
}

export function FileCardSkeleton() {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
      <div className="flex items-center gap-4 w-full">
        <div className="w-10 h-10 shrink-0 rounded-lg bg-muted animate-pulse" />
        <div className="flex flex-col gap-2 w-full max-w-[200px]">
          <div className="h-4 bg-muted rounded animate-pulse w-full" />
          <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
        </div>
      </div>
    </div>
  );
}
