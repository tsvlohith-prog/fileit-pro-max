import { Layout } from "@/components/layout";
import {
  useListFiles,
  useDeleteFile,
  useMoveFile,
  useListFolders,
  useCreateFolder,
  useDeleteFolder,
  useListTextMessages,
  useCreateTextMessage,
  useDeleteTextMessage,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { getActiveRoom, leaveActiveRoom } from "@/lib/rooms-storage";
import { FileCard, FileCardSkeleton } from "@/components/file-card";
import { FolderCard } from "@/components/folder-card";
import { FolderShareDialog } from "@/components/folder-share-dialog";
import { TextMessageCard } from "@/components/text-message-card";
import { Dropzone } from "@/components/dropzone";
import { useUpload } from "@/hooks/use-upload";
import { ChangeExpirationDialog } from "@/components/change-expiration-dialog";
import { GoogleDriveModal } from "@/components/google-drive-modal";
import { GlassmorphicUnlockModal } from "@/components/glassmorphic-unlock-modal";
import { motion, AnimatePresence } from "framer-motion";
import { Files, Folder, ArrowLeft, Plus, Trash2, FileCode2, Share2, Lock, Clock, Search, LayoutGrid, List, X, Cloud } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function FilesPage() {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [fileToMove, setFileToMove] = useState<string | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderPassword, setNewFolderPassword] = useState("");
  const [selectedDuration, setSelectedDuration] = useState<string>("259200"); // Default 3 days (in seconds)
  const [newFolderDuration, setNewFolderDuration] = useState<string>("259200"); // Default 3 days (in seconds)
  const [textMessageOpen, setTextMessageOpen] = useState(false);
  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const [textLanguage, setTextLanguage] = useState("plaintext");
  const [textFolderId, setTextFolderId] = useState("");
  const [linkedFileId, setLinkedFileId] = useState("");
  const [folderToShare, setFolderToShare] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "documents" | "images" | "media" | "archives" | "code">("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [googleDriveOpen, setGoogleDriveOpen] = useState(false);
  const [unlockedFolders, setUnlockedFolders] = useState<Record<string, boolean>>({});
  const [folderToUnlock, setFolderToUnlock] = useState<any | null>(null);

  const [, setLocation] = useLocation();
  const [activeRoom, setActiveRoomState] = useState(() => getActiveRoom());

  const { data: files, isLoading } = useListFiles(
    currentFolderId ? { folderId: currentFolderId } : undefined
  );
  const { data: allFiles } = useListFiles();
  const { data: folders } = useListFolders();
  // Include all user folders (both regular and password protected)
  const safeFolders = folders || [];
  
  // Dynamic folders list: includes active validated room so users can drag-and-drop to it
  const displayFolders = useMemo(() => {
    const list = [...(safeFolders || [])];
    if (activeRoom && !list.some((f) => f.id === activeRoom.id)) {
      list.unshift({
        id: activeRoom.id,
        name: activeRoom.name,
        password: "true",
        expiresAt: activeRoom.expiresAt,
        createdAt: activeRoom.joinedAt,
        shareToken: activeRoom.token,
      });
    }
    return list;
  }, [safeFolders, activeRoom]);

  const filteredFiles = useMemo(() => {
    if (!files || !Array.isArray(files)) return [];
    return files.filter((f) => {
      if (searchQuery.trim() && !f.originalName.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (typeFilter !== "all") {
        const name = f.originalName.toLowerCase();
        const mime = f.mimeType?.toLowerCase() || "";
        if (typeFilter === "images") {
          if (!mime.startsWith("image/") && ![".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico"].some((ext) => name.endsWith(ext))) return false;
        } else if (typeFilter === "documents") {
          if (!mime.includes("pdf") && !mime.includes("document") && !mime.includes("sheet") && !mime.includes("text") && ![".pdf", ".docx", ".doc", ".xlsx", ".xls", ".csv", ".txt", ".md", ".pptx"].some((ext) => name.endsWith(ext))) return false;
        } else if (typeFilter === "media") {
          if (!mime.startsWith("video/") && !mime.startsWith("audio/") && ![".mp4", ".mov", ".webm", ".mkv", ".mp3", ".wav", ".ogg", ".m4a", ".flac"].some((ext) => name.endsWith(ext))) return false;
        } else if (typeFilter === "archives") {
          if (!mime.includes("zip") && !mime.includes("tar") && !mime.includes("compressed") && ![".zip", ".tar", ".gz", ".7z", ".rar", ".bz2"].some((ext) => name.endsWith(ext))) return false;
        } else if (typeFilter === "code") {
          if (![".js", ".ts", ".jsx", ".tsx", ".py", ".html", ".css", ".json", ".sql", ".go", ".rs", ".cpp", ".c", ".java"].some((ext) => name.endsWith(ext))) return false;
        }
      }
      return true;
    });
  }, [files, searchQuery, typeFilter]);

  const { data: textMessages } = useListTextMessages(
    currentFolderId ? { folderId: currentFolderId } : undefined,
  );
  const { uploadFile, isUploading, progress } = useUpload();
  const moveFile = useMoveFile();
  const deleteFile = useDeleteFile();
  const createFolder = useCreateFolder();
  const deleteFolder = useDeleteFolder();
  const createTextMessage = useCreateTextMessage();
  const deleteTextMessage = useDeleteTextMessage();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const currentFolder = folders?.find((f) => f.id === currentFolderId);

  // Check active room state periodically/on focus
  useEffect(() => {
    const checkRoom = () => setActiveRoomState(getActiveRoom());
    window.addEventListener("focus", checkRoom);
    return () => window.removeEventListener("focus", checkRoom);
  }, []);

  // Listen for drag-and-drop moves from FileCard onto FolderCard
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { fileId: string; folderId: string };
      if (detail?.fileId && detail?.folderId) {
        handleMoveToFolder(detail.fileId, detail.folderId);
      }
    };
    window.addEventListener("file-drop-to-folder", handler);
    return () => window.removeEventListener("file-drop-to-folder", handler);
  }, []);

  // Listen for external OS files dropped onto FolderCard
  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        files: FileList;
        folderId: string;
        folderName?: string;
      };
      if (detail?.files && detail?.folderId) {
        toast({
          title: "Uploading to folder...",
          description: `Uploading ${detail.files.length} file(s) to "${detail.folderName || "folder"}".`,
        });
        try {
          for (let i = 0; i < detail.files.length; i++) {
            await uploadFile(detail.files[i], detail.folderId);
          }
          queryClient.invalidateQueries({ queryKey: ["/api/files"] });
          queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
          toast({
            title: "Upload Complete",
            description: `Added ${detail.files.length} file(s) to "${detail.folderName || "folder"}".`,
          });
        } catch {
          toast({
            variant: "destructive",
            title: "Upload Failed",
            description: `Could not complete upload to "${detail.folderName || "folder"}".`,
          });
        }
      }
    };
    window.addEventListener("os-files-drop-to-folder", handler);
    return () => window.removeEventListener("os-files-drop-to-folder", handler);
  }, [uploadFile, queryClient, toast]);

  // Sync selectedDuration when entering or leaving a folder
  useEffect(() => {
    if (currentFolderId) {
      setSelectedDuration("folder-default");
    } else {
      setSelectedDuration("259200");
    }
  }, [currentFolderId]);

  const handleMoveToFolder = async (fileId: string, targetFolderId: string) => {
    try {
      await moveFile.mutateAsync({
        id: fileId,
        data: { folderId: targetFolderId === "root" ? null : targetFolderId },
      });
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      toast({ title: "File moved successfully" });
    } catch {
      toast({ variant: "destructive", title: "Failed to move file" });
    }
  };

  const handleFileSelect = async (file: File) => {
    let expiresAt: string | undefined = undefined;
    if (selectedDuration === "folder-default") {
      expiresAt = undefined; // inherit folder timer on backend
    } else if (selectedDuration !== "forever") {
      expiresAt = new Date(Date.now() + parseInt(selectedDuration) * 1000).toISOString();
    }
    await uploadFile(file, currentFolderId || undefined, expiresAt);
    queryClient.invalidateQueries({ queryKey: ["/api/files"] });
  };

  const handleMove = async (targetFolderId: string) => {
    if (!fileToMove) return;
    await handleMoveToFolder(fileToMove, targetFolderId);
    setFileToMove(null);
  };

  const handleDeleteConfirm = async () => {
    if (!fileToDelete) return;
    try {
      await deleteFile.mutateAsync({ id: fileToDelete });
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/files/stats"] });
      toast({ title: "File deleted" });
    } catch {
      toast({ variant: "destructive", title: "Failed to delete" });
    } finally {
      setFileToDelete(null);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      let expiresAt: string | undefined = undefined;
      if (newFolderDuration !== "forever") {
        expiresAt = new Date(Date.now() + parseInt(newFolderDuration) * 1000).toISOString();
      }
      await createFolder.mutateAsync({ data: { 
        name: newFolderName.trim(),
        expiresAt,
        password: newFolderPassword.trim() || undefined,
      } });
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      toast({ title: newFolderPassword.trim() ? "Locked folder created" : "Folder created" });
      setNewFolderName("");
      setNewFolderPassword("");
      setNewFolderDuration("259200");
      setCreateFolderOpen(false);
    } catch {
      toast({ variant: "destructive", title: "Failed to create folder" });
    }
  };

  const resetTextMessageForm = () => {
    setTextTitle("");
    setTextContent("");
    setTextLanguage("plaintext");
    setTextFolderId(currentFolderId || "");
    setLinkedFileId("");
  };

  const openTextMessageDialog = () => {
    resetTextMessageForm();
    setTextMessageOpen(true);
  };

  const handleCreateTextMessage = async () => {
    if (!textContent) return;
    try {
      await createTextMessage.mutateAsync({
        data: {
          content: textContent,
          title: textTitle.trim() || undefined,
          language: textLanguage,
          fileId: linkedFileId || null,
          folderId: textFolderId || null,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["/api/text-messages"] });
      toast({ title: "Text message saved" });
      setTextMessageOpen(false);
      resetTextMessageForm();
    } catch {
      toast({ variant: "destructive", title: "Failed to save text message" });
    }
  };

  const handleDeleteTextMessage = async (id: string) => {
    try {
      await deleteTextMessage.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: ["/api/text-messages"] });
      toast({ title: "Text message deleted" });
    } catch {
      toast({ variant: "destructive", title: "Failed to delete text message" });
    }
  };

  const handleDeleteFolderConfirm = async () => {
    if (!folderToDelete) return;
    try {
      await deleteFolder.mutateAsync({ id: folderToDelete });
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      toast({ title: "Folder deleted" });
      if (folderToDelete === currentFolderId) setCurrentFolderId(null);
    } catch {
      toast({ variant: "destructive", title: "Failed to delete folder" });
    } finally {
      setFolderToDelete(null);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {currentFolderId ? (
              <button
                onClick={() => setCurrentFolderId(null)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            ) : null}
            <div className="flex items-center gap-2">
              {currentFolderId ? (
                <Folder className="w-5 h-5 text-amber-500" />
              ) : (
                <Files className="w-5 h-5 text-primary" />
              )}
              <h1 className="text-2xl font-bold">
                {currentFolder ? currentFolder.name : "My Files"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setGoogleDriveOpen(true)} className="gap-2">
              <Cloud className="w-4 h-4 text-primary" />
              <span className="hidden sm:inline">Google Drive</span>
            </Button>
            {currentFolder && (
              <Button variant="outline" size="sm" onClick={() => setFolderToShare(currentFolder.id)} className="gap-2">
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">Share</span>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={openTextMessageDialog} className="gap-2">
              <FileCode2 className="w-4 h-4" />
              <span className="hidden sm:inline">New text</span>
            </Button>
            {!currentFolderId && (
              <Button variant="outline" size="sm" onClick={() => setCreateFolderOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">New folder</span>
              </Button>
            )}
          </div>
        </div>

        {/* Dissolve Timer Selector */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-card/60 backdrop-blur-md border border-border/80 p-2.5 rounded-2xl shadow-xs">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5 px-2 self-start sm:self-center">
            <Clock className="w-4 h-4 text-primary shrink-0" />
            <span>Auto-Dissolve {currentFolderId ? "override" : "timer"}:</span>
          </span>
          <div className="grid grid-cols-3 sm:flex items-center gap-1 w-full sm:w-auto">
            {[
              ...(currentFolderId ? [{ label: "Inherit", fullLabel: "Folder Timer", value: "folder-default" }] : []),
              { label: "1h", fullLabel: "1 Hour", value: "3600" },
              { label: "12h", fullLabel: "12 Hours", value: "43200" },
              { label: "1d", fullLabel: "1 Day", value: "86400" },
              { label: "3d", fullLabel: "3 Days", value: "259200" },
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

        {/* Dropzone */}
        <Dropzone onFileSelect={handleFileSelect} isUploading={isUploading} progress={progress} />

        {/* Folders (only at root) */}
        {!currentFolderId && displayFolders && displayFolders.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Folders & Rooms
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {displayFolders.map((folder, i) => (
                <FolderCard
                  key={folder.id}
                  folder={folder}
                  onClick={() => {
                    if (activeRoom && folder.id === activeRoom.id) {
                      setLocation(`/rooms/${folder.id}`);
                    } else if (folder.password && !unlockedFolders[folder.id]) {
                      setFolderToUnlock(folder);
                    } else {
                      setCurrentFolderId(folder.id);
                    }
                  }}
                  onDelete={() => {
                    if (activeRoom && folder.id === activeRoom.id) {
                      leaveActiveRoom();
                      setActiveRoomState(null);
                      toast({ title: "Session Closed", description: "Left private room." });
                    } else {
                      setFolderToDelete(folder.id);
                    }
                  }}
                  onShare={() => {
                    if (activeRoom && folder.id === activeRoom.id) {
                      setLocation(`/rooms/${folder.id}`);
                    } else {
                      setFolderToShare(folder.id);
                    }
                  }}
                  fileCount={folder.fileCount}
                  index={i}
                />
              ))}
            </div>
          </section>
        )}

        {/* Files Section with Search, Category Filter, and View Mode Toggle */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-foreground">
                {currentFolderId ? `Files in "${currentFolder?.name}"` : "Stored Payloads"}
              </h2>
              <span className="text-xs text-muted-foreground">
                ({filteredFiles.length}{filteredFiles.length !== (files?.length ?? 0) ? ` of ${files?.length ?? 0}` : ""})
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* View Switcher */}
              <div className="flex items-center p-0.5 rounded-lg bg-secondary/60 border border-border/60">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 rounded-md transition-all ${
                    viewMode === "list" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="List view"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded-md transition-all ${
                    viewMode === "grid" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Grid view"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Search & Category Filter Controls */}
          {Array.isArray(files) && files.length > 0 && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-8 h-9 text-xs bg-card/60 border-border/80 rounded-xl"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Category Segmented Control */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                {[
                  { id: "all", label: "All" },
                  { id: "documents", label: "Docs" },
                  { id: "images", label: "Images" },
                  { id: "media", label: "Media" },
                  { id: "archives", label: "Archives" },
                  { id: "code", label: "Code" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTypeFilter(tab.id as typeof typeFilter)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all whitespace-nowrap ${
                      typeFilter === tab.id
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground bg-secondary/40 hover:bg-secondary/70 border border-border/40"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <FileCardSkeleton key={i} />
              ))}
            </div>
          ) : !Array.isArray(files) || files.length === 0 ? (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-16 text-center gap-3 bg-card/30 rounded-2xl border border-dashed border-border"
              >
                <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center">
                  <Files className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-foreground font-semibold">No files here yet</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  {currentFolderId
                    ? "Drop a file above to add it to this folder."
                    : "Upload a file above or drop one directly onto this workspace."}
                </p>
              </motion.div>
            </AnimatePresence>
          ) : filteredFiles.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground bg-card/30 rounded-2xl border border-border">
              No files matched your search or category filter.
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredFiles.map((file) => (
                <FileCard
                  key={file.id}
                  file={file}
                  onDelete={setFileToDelete}
                  onMove={setFileToMove}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredFiles.map((file) => (
                <FileCard
                  key={file.id}
                  file={file}
                  onDelete={setFileToDelete}
                  onMove={setFileToMove}
                />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <FileCode2 className="w-4 h-4" />
            {currentFolderId ? "Text & code in folder" : "Text & code"}
          </h2>
          {Array.isArray(textMessages) && textMessages.length > 0 ? (
            <div className="space-y-3">
              {textMessages.map((message) => (
                <TextMessageCard key={message.id} message={message} onDelete={handleDeleteTextMessage} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">No text messages here yet.</p>
              <Button variant="link" size="sm" onClick={openTextMessageDialog}>Create one</Button>
            </div>
          )}
        </section>
      </div>

      <FolderShareDialog
        folder={safeFolders?.find((folder) => folder.id === folderToShare) || null}
        open={!!folderToShare}
        onOpenChange={(open) => !open && setFolderToShare(null)}
      />

      {/* Move file dialog */}
      <Dialog open={!!fileToMove} onOpenChange={(open) => !open && setFileToMove(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Move file</DialogTitle>
            <DialogDescription>Select a destination folder.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1 max-h-60 overflow-y-auto py-1">
            <button
              onClick={() => handleMove("root")}
              className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-secondary"
            >
              My Files (no folder)
            </button>
            {activeRoom && (
              <button
                key={activeRoom.id}
                onClick={() => handleMove(activeRoom.id)}
                disabled={activeRoom.id === currentFolderId}
                className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors hover:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-between"
              >
                <div className="flex items-center gap-2 truncate">
                  <Lock className="w-4 h-4 text-purple-500 shrink-0" />
                  <span className="truncate">{activeRoom.name}</span>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/15 uppercase tracking-wide shrink-0">
                  Private Room
                </span>
              </button>
            )}
            {safeFolders?.map((f) => (
              <button
                key={f.id}
                onClick={() => handleMove(f.id)}
                disabled={f.id === currentFolderId}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  f.id === currentFolderId
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:bg-secondary"
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFileToMove(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete file dialog */}
      <Dialog open={!!fileToDelete} onOpenChange={(open) => !open && setFileToDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete file?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete the file.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFileToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete folder dialog */}
      <Dialog open={!!folderToDelete} onOpenChange={(open) => !open && setFolderToDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete folder?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            The folder will be deleted. Files inside will be moved back to My Files.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFolderToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteFolderConfirm}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create folder dialog */}
      <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create new folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="folder-name" className="text-xs font-semibold">Folder Name</Label>
              <Input
                id="folder-name"
                placeholder="Folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="folder-password" className="text-xs font-semibold">Room Password <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="folder-password"
                type="password"
                placeholder="Lock folder with password"
                value={newFolderPassword}
                onChange={(e) => setNewFolderPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              />
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Auto-Dissolve in</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: "1 Hour", value: "3600" },
                  { label: "1 Day", value: "86400" },
                  { label: "3 Days (Default)", value: "259200" },
                  { label: "1 Week", value: "604800" },
                  { label: "Keep Forever", value: "forever" },
                ].map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    size="sm"
                    variant={newFolderDuration === opt.value ? "default" : "outline"}
                    className={`h-9 text-xs justify-start px-2 font-medium ${
                      newFolderDuration === opt.value ? "bg-primary text-primary-foreground font-semibold" : ""
                    }`}
                    onClick={() => setNewFolderDuration(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateFolderOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={textMessageOpen} onOpenChange={setTextMessageOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New text or code</DialogTitle>
            <DialogDescription>
              Whitespace, indentation, symbols, and line breaks are preserved exactly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                placeholder="Title (optional)"
                value={textTitle}
                onChange={(event) => setTextTitle(event.target.value)}
              />
              <select
                value={textLanguage}
                onChange={(event) => setTextLanguage(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                aria-label="Language"
              >
                <option value="plaintext">Plain text</option>
                <option value="c">C</option>
                <option value="cpp">C++</option>
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="python">Python</option>
                <option value="json">JSON</option>
                <option value="html">HTML</option>
                <option value="css">CSS</option>
                <option value="sql">SQL</option>
                <option value="markdown">Markdown</option>
                <option value="bash">Bash</option>
              </select>
            </div>
            <Textarea
              value={textContent}
              onChange={(event) => setTextContent(event.target.value)}
              placeholder="Paste or type your text here..."
              className="min-h-[260px] resize-y font-mono text-sm leading-6"
              spellCheck={false}
              autoFocus
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Folder</span>
                <select
                  value={textFolderId}
                  onChange={(event) => setTextFolderId(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">My Files (no folder)</option>
                  {safeFolders?.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Link to a file <span className="font-normal text-muted-foreground">(optional)</span></span>
                <select
                  value={linkedFileId}
                  onChange={(event) => setLinkedFileId(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">No linked file</option>
                  {allFiles?.map((file) => <option key={file.id} value={file.id}>{file.originalName}</option>)}
                </select>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTextMessageOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateTextMessage} disabled={!textContent || createTextMessage.isPending}>
              {createTextMessage.isPending ? "Saving..." : "Save text"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <ChangeExpirationDialog />
      <GoogleDriveModal
        open={googleDriveOpen}
        onOpenChange={setGoogleDriveOpen}
        onImportFile={(file) => handleFileSelect(file)}
      />

      {folderToUnlock && (
        <GlassmorphicUnlockModal
          title={folderToUnlock.name}
          isFolder={true}
          subTitle={folderToUnlock.fileCount ? `Protected folder with ${folderToUnlock.fileCount} items` : "This folder is protected by a password"}
          onUnlock={async (pass) => {
            try {
              const res = await fetch(`/api/folders/${folderToUnlock.id}/unlock`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password: pass }),
              });
              if (!res.ok) return false;
              setUnlockedFolders((prev) => ({ ...prev, [folderToUnlock.id]: true }));
              setCurrentFolderId(folderToUnlock.id);
              setFolderToUnlock(null);
              toast({ title: "Folder unlocked", description: `Opened "${folderToUnlock.name}"` });
              return true;
            } catch {
              return false;
            }
          }}
          onCancel={() => setFolderToUnlock(null)}
        />
      )}
    </Layout>
  );
}
