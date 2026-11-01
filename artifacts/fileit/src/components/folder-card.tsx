import { Folder, Share2, Trash2, Lock, Clock, KeyRound } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { FolderRecord } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { formatTimeRemaining } from "@/lib/rooms-storage";
import { PasswordProtectDialog } from "@/components/password-protect-dialog";

interface FolderCardProps {
  folder: FolderRecord;
  onClick: () => void;
  onDelete: () => void;
  onShare: () => void;
  fileCount?: number;
  index?: number;
}

export function FolderCard({ folder, onClick, onDelete, onShare, fileCount, index = 0 }: FolderCardProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const fileId = e.dataTransfer.getData("fileId");
    if (fileId) {
      // Dispatch custom event to move existing file into this folder/room
      const event = new CustomEvent("file-drop-to-folder", {
        detail: { fileId, folderId: folder.id, folderName: folder.name },
        bubbles: true,
      });
      e.currentTarget.dispatchEvent(event);
      return;
    }

    // Handle dropping OS files directly onto this folder card
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const event = new CustomEvent("os-files-drop-to-folder", {
        detail: { files: e.dataTransfer.files, folderId: folder.id, folderName: folder.name },
        bubbles: true,
      });
      e.currentTarget.dispatchEvent(event);
    }
  };

  const timeRemaining = formatTimeRemaining(folder.expiresAt || undefined);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ duration: 0.25, delay: index * 0.05, ease: "easeOut" }}
      whileHover={{ y: -2 }}
      onClick={onClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`group relative flex items-center gap-3 p-4 rounded-xl border bg-card cursor-pointer transition-all ${
        isDragOver
          ? folder.password
            ? "border-purple-500 border-dashed ring-2 ring-purple-500/30 bg-purple-500/10 scale-[1.02]"
            : "border-primary border-dashed ring-2 ring-primary/30 bg-primary/10 scale-[1.02]"
          : "border-border hover:border-primary/40 hover:shadow-md hover:shadow-primary/5"
      }`}
    >
      <div className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center transition-colors ${
        folder.password 
          ? "bg-purple-500/10 text-purple-600 dark:text-purple-400" 
          : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
      }`}>
        {folder.password ? <Lock className="w-5 h-5" /> : <Folder className="w-5 h-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold truncate text-foreground" title={folder.name}>
            {folder.name}
          </p>
          {folder.password && (
            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
              Protected
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
          <span>
            {fileCount !== undefined ? (
              <>
                {fileCount} {fileCount === 1 ? "item" : "items"}
              </>
            ) : (
              <span>Folder</span>
            )}
          </span>
          <span>&bull;</span>
          <span>{formatDistanceToNow(new Date(folder.createdAt), { addSuffix: true })}</span>
          {folder.expiresAt && (
            <>
              <span>&bull;</span>
              <span className={`inline-flex items-center gap-1 font-medium ${
                timeRemaining.isUrgent ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
              }`}>
                <Clock className="w-3 h-3" />
                {timeRemaining.text}
              </span>
            </>
          )}
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsPasswordDialogOpen(true);
        }}
        className={`p-2 rounded-lg transition-all ${
          folder.password 
            ? "text-purple-600 dark:text-purple-400 bg-purple-500/10 hover:bg-purple-500/20" 
            : "text-muted-foreground hover:text-purple-600 hover:bg-purple-500/10"
        }`}
        aria-label="Manage Password Lock"
        title={folder.password ? "Manage Password Lock" : "Protect Folder with Password"}
      >
        <Lock className="w-4 h-4" />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          const event = new CustomEvent("change-folder-expiration", {
            detail: { folderId: folder.id, name: folder.name, currentExpiresAt: folder.expiresAt },
            bubbles: true,
          });
          window.dispatchEvent(event);
        }}
        className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
        aria-label="Change Expiration"
        title="Change Dissolve Timer"
      >
        <Clock className="w-4 h-4" />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onShare();
        }}
        className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
        aria-label="Share folder"
        title="Share folder"
      >
        <Share2 className="w-4 h-4" />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
        aria-label="Delete folder"
        title="Delete folder"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      <PasswordProtectDialog
        isOpen={isPasswordDialogOpen}
        onClose={() => setIsPasswordDialogOpen(false)}
        targetId={folder.id}
        targetName={folder.name}
        type="folder"
        isProtected={Boolean(folder.password || (folder as any).isProtected)}
        hasOwnPassword={Boolean(folder.password || (folder as any).hasPassword)}
      />
    </motion.div>
  );
}
