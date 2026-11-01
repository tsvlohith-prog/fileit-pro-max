import { useState, useEffect, useCallback, useRef } from "react";
import { Layout } from "@/components/layout";
import { useParams, useLocation } from "wouter";
import {
  ShieldCheck,
  Lock,
  Download,
  Trash2,
  Edit2,
  Clock,
  QrCode,
  ArrowLeft,
  FileUp,
  FileCode,
  FileText,
  Eye,
  Check,
  Copy,
  AlertTriangle,
  Flame,
  LogOut,
  Sparkles,
  RefreshCw,
  FolderPlus,
  Palette,
  Layers,
  FileSpreadsheet,
  Image as ImageIcon,
  Archive,
  Music,
  Video as VideoIcon,
  Maximize2,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { FullscreenPreviewModal } from "@/components/fullscreen-preview-modal";
import { RoomCanvas } from "@/components/room-canvas";
import { RoomMarkdownEditor } from "@/components/room-markdown-editor";
import { RoomPdfCollaborator } from "@/components/room-pdf-collaborator";
import { RoomActivityRail } from "@/components/room-activity-rail";
import { ExportShareModal } from "@/components/export-share-modal";
import { inspectFileType } from "@/lib/file-type-helpers";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  getRoomToken,
  saveStoredRoom,
  removeStoredRoom,
  formatTimeRemaining,
  setActiveRoom,
  leaveActiveRoom,
} from "@/lib/rooms-storage";
import { formatBytes } from "@/lib/utils";
import { QRCodeSVG } from "qrcode.react";
import {
  RoomP2PMeshManager,
  type MeshPeer,
  type MeshFlashMessage,
} from "@/lib/room-p2p-mesh";

interface RoomData {
  id: string;
  name: string;
  shareToken: string;
  expiresAt: string;
  createdAt: string;
}

interface RoomFile {
  id: string;
  originalName: string;
  size: number;
  mimeType: string;
  storagePath: string;
  shareToken: string;
  downloadCount: number;
  expiresAt?: string;
  createdAt: string;
}

export default function RoomViewPage() {
  const params = useParams<{ id: string }>();
  const roomId = params.id;
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [isSubmittingPass, setIsSubmittingPass] = useState(false);

  const [room, setRoom] = useState<RoomData | null>(null);
  const [files, setFiles] = useState<RoomFile[]>([]);
  const [auditEvents, setAuditEvents] = useState<Array<{ id: string; text: string; time: string }>>([
    { id: "init", text: "Room session initialized", time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
  ]);

  // Workspace View Mode: Whiteboard vs Markdown Doc vs Shared PDF vs Vault Files
  const [workspaceMode, setWorkspaceMode] = useState<"canvas" | "doc" | "pdf" | "files">("canvas");
  const pdfFilesCount = files.filter((f) => f.mimeType === "application/pdf" || f.originalName.toLowerCase().endsWith(".pdf")).length;

  // Room Modals
  const [showQrModal, setShowQrModal] = useState(false);
  const [showBurnConfirmModal, setShowBurnConfirmModal] = useState(false);
  const [previewFile, setPreviewFile] = useState<RoomFile | null>(null);
  const [isFullscreenPreviewOpen, setIsFullscreenPreviewOpen] = useState(false);
  const [shareModalFile, setShareModalFile] = useState<RoomFile | null>(null);

  // Edit / Rename File state
  const [editingFile, setEditingFile] = useState<RoomFile | null>(null);
  const [newFileName, setNewFileName] = useState("");

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── P2P Wi-Fi Mesh Network State ──────────────────────────────────────────
  const [meshPeers, setMeshPeers] = useState<MeshPeer[]>([]);
  const [flashMessages, setFlashMessages] = useState<MeshFlashMessage[]>([]);
  const meshManagerRef = useRef<RoomP2PMeshManager | null>(null);

  const addAuditEvent = useCallback((text: string) => {
    setAuditEvents((prev) => [
      { id: Math.random().toString(36).substring(2, 9), text, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
      ...prev.slice(0, 30),
    ]);
  }, []);

  // Fetch Room Vault
  const fetchRoomData = useCallback(async (tokenOrPass?: string, isPassword = false) => {
    if (!roomId) return;
    setIsLoading(true);

    const activeToken = tokenOrPass || getRoomToken(roomId);
    const headers: Record<string, string> = {};

    if (isPassword && tokenOrPass) {
      headers["x-room-password"] = tokenOrPass;
    } else if (activeToken) {
      headers["x-room-token"] = activeToken;
    }

    try {
      const res = await fetch(`/api/rooms/${roomId}`, { headers });
      if (!res.ok) {
        setIsUnlocked(false);
        setIsLoading(false);
        return;
      }

      const data = await res.json();
      setRoom(data.room);
      setFiles(data.files || []);
      setIsUnlocked(true);

      saveStoredRoom({
        id: data.room.id,
        name: data.room.name,
        token: data.room.shareToken,
        expiresAt: data.room.expiresAt,
        joinedAt: new Date().toISOString(),
      });
      setActiveRoom(data.room.id);
    } catch {
      setIsUnlocked(false);
    } finally {
      setIsLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    fetchRoomData();
  }, [fetchRoomData]);

  // ── Initialize Room P2P WebRTC Mesh Network ──────────────────────────────
  useEffect(() => {
    if (!isUnlocked || !roomId) return;

    const manager = new RoomP2PMeshManager(roomId);
    meshManagerRef.current = manager;

    manager.onPeersUpdated = (peers) => {
      setMeshPeers(peers);
      addAuditEvent(`Mesh updated: ${peers.length + 1} participant(s) in room`);
    };

    manager.onFlashMessage = (msg) => {
      setFlashMessages((prev) => [msg, ...prev].slice(0, 50));
    };

    manager.start();

    return () => {
      manager.stop();
      meshManagerRef.current = null;
    };
  }, [isUnlocked, roomId, addAuditEvent]);

  const handleSendFlash = (text: string) => {
    if (!meshManagerRef.current) return;
    const msgObj = meshManagerRef.current.broadcastFlashMessage(text);
    setFlashMessages((prev) => [msgObj, ...prev].slice(0, 50));
  };

  // Handle Manual Password Unlock
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockPassword.trim()) return;

    setIsSubmittingPass(true);
    try {
      const res = await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, password: unlockPassword.trim() }),
      });

      if (!res.ok) {
        toast({ variant: "destructive", title: "Incorrect Password", description: "Access key was not recognized." });
        return;
      }

      const data = await res.json();
      saveStoredRoom({
        id: data.id,
        name: data.name,
        token: data.token,
        expiresAt: data.expiresAt,
        joinedAt: new Date().toISOString(),
      });
      setActiveRoom(data.id);
      setIsUnlocked(true);
      fetchRoomData(data.token);
    } catch {
      toast({ variant: "destructive", title: "Authentication Failed" });
    } finally {
      setIsSubmittingPass(false);
    }
  };

  // Upload Files to Room Vault
  const handleUploadFiles = async (fileList: FileList | File[]) => {
    if (!room || !fileList || fileList.length === 0) return;
    setIsUploading(true);

    const filesArray = Array.from(fileList);
    for (const file of filesArray) {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(`/api/rooms/${roomId}/files`, {
          method: "POST",
          headers: { "x-room-token": room.shareToken },
          body: formData,
        });

        if (res.ok) {
          addAuditEvent(`Uploaded: ${file.name}`);
        }
      } catch {}
    }

    setIsUploading(false);
    toast({ title: "Files Stored in Vault", description: `Added ${filesArray.length} items to room.` });
    fetchRoomData();
  };

  // Rename File
  const handleRenameFile = async () => {
    if (!editingFile || !newFileName.trim() || !room) return;
    try {
      const res = await fetch(`/api/rooms/${roomId}/files/${editingFile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-room-token": room.shareToken },
        body: JSON.stringify({ originalName: newFileName.trim() }),
      });
      if (res.ok) {
        toast({ title: "File Renamed" });
        setEditingFile(null);
        fetchRoomData();
      }
    } catch {
      toast({ variant: "destructive", title: "Rename Failed" });
    }
  };

  // Delete File
  const handleDeleteFile = async (fileId: string, fileName: string) => {
    if (!room) return;
    try {
      const res = await fetch(`/api/rooms/${roomId}/files/${fileId}`, {
        method: "DELETE",
        headers: { "x-room-token": room.shareToken },
      });
      if (res.ok) {
        toast({ title: "File Deleted" });
        addAuditEvent(`Removed file: ${fileName}`);
        fetchRoomData();
      }
    } catch {
      toast({ variant: "destructive", title: "Delete Failed" });
    }
  };

  // Dissolve (Burn) Room
  const handleDissolveRoom = async () => {
    if (!room) return;
    try {
      const res = await fetch(`/api/rooms/${roomId}`, {
        method: "DELETE",
        headers: { "x-room-token": room.shareToken },
      });
      if (res.ok) {
        removeStoredRoom(room.id);
        leaveActiveRoom();
        toast({ title: "Room Dissolved", description: "All room files and state permanently purged." });
        setLocation("/rooms");
      }
    } catch {
      toast({ variant: "destructive", title: "Dissolve Failed" });
    }
  };

  // 1-Click Download Entire Room as ZIP
  const handleDownloadAllZip = () => {
    if (!room) return;
    window.location.href = `/api/rooms/${roomId}/download?token=${room.shareToken}`;
  };

  const getFileCategoryIcon = (mimeType: string, name: string) => {
    const meta = inspectFileType(name, mimeType);
    if (meta.isPdf) return <FileText className="w-4 h-4 text-rose-400" />;
    if (meta.isImage) return <ImageIcon className="w-4 h-4 text-sky-400" />;
    if (meta.isXlsx) return <FileSpreadsheet className="w-4 h-4 text-emerald-400" />;
    if (meta.isArchive) return <Archive className="w-4 h-4 text-amber-400" />;
    if (meta.isAudio) return <Music className="w-4 h-4 text-purple-400" />;
    if (meta.isVideo) return <VideoIcon className="w-4 h-4 text-indigo-400" />;
    if (meta.isCode) return <FileCode className="w-4 h-4 text-cyan-400" />;
    return <FileText className="w-4 h-4 text-primary" />;
  };

  // Locked Screen
  if (!isLoading && !isUnlocked) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 max-w-md">
          <div className="bg-card text-card-foreground border border-border p-6 sm:p-8 rounded-3xl shadow-xl space-y-6 text-center">
            <div className="w-16 h-16 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary shadow-inner">
              <Lock className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-extrabold text-foreground">Password Protected Vault</h2>
              <p className="text-xs text-muted-foreground">
                Enter the secret room passphrase to unlock files and live collaboration.
              </p>
            </div>

            <form onSubmit={handleUnlock} className="space-y-4">
              <Input
                type="password"
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                placeholder="Room Password..."
                className="h-11 rounded-2xl text-center text-sm"
              />
              <Button
                type="submit"
                disabled={isSubmittingPass || !unlockPassword.trim()}
                className="w-full h-11 rounded-2xl text-xs font-bold bg-primary text-primary-foreground"
              >
                {isSubmittingPass ? "Verifying..." : "Unlock Room"}
              </Button>
            </form>
          </div>
        </div>
      </Layout>
    );
  }

  const roomQrUrl = typeof window !== "undefined" && room
    ? `${window.location.origin}/rooms/${room.id}?token=${room.shareToken}`
    : "";

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 md:py-8 max-w-7xl space-y-6">
        {/* Top Header Strip */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/80 pb-4">
          <div className="flex items-center gap-3">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setLocation("/rooms")}
              className="h-9 w-9 rounded-2xl text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                  {room?.name || "Private Room"}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                  3-DAY DISSOLVING VAULT
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                {room ? `Auto-dissolves ${formatTimeRemaining(room.expiresAt).text}` : "Ephemeral room"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowQrModal(true)}
              className="h-8 rounded-xl text-xs font-bold gap-1.5 border-border/80"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Invite QR</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadAllZip}
              disabled={files.length === 0}
              className="h-8 rounded-xl text-xs font-bold gap-1.5 border-border/80"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download ZIP</span>
            </Button>
          </div>
        </div>

        {/* Unified Split Workspace: Main Tool Stage (70%) vs Activity Rail (30%) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Stage (lg: 8 cols) */}
          <div className="lg:col-span-8 space-y-4 min-w-0 max-w-full">
            {/* Stage Mode Switcher */}
            <div className="flex items-center justify-between bg-card/60 p-1.5 rounded-2xl border border-border/80 max-w-full overflow-hidden">
              <div className="flex items-center gap-1 w-full overflow-x-auto no-scrollbar min-w-0 py-0.5">
                <button
                  type="button"
                  onClick={() => setWorkspaceMode("canvas")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors shrink-0 ${
                    workspaceMode === "canvas"
                      ? "bg-card text-foreground shadow-xs border border-border/60"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Palette className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span className="truncate">Whiteboard</span>
                </button>

                <button
                  type="button"
                  onClick={() => setWorkspaceMode("doc")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors shrink-0 ${
                    workspaceMode === "doc"
                      ? "bg-card text-foreground shadow-xs border border-border/60"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">Collaborative Doc</span>
                </button>

                <button
                  type="button"
                  onClick={() => setWorkspaceMode("pdf")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors shrink-0 ${
                    workspaceMode === "pdf"
                      ? "bg-card text-foreground shadow-xs border border-border/60"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="truncate">Shared PDF ({pdfFilesCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setWorkspaceMode("files")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors shrink-0 ${
                    workspaceMode === "files"
                      ? "bg-card text-foreground shadow-xs border border-border/60"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">Room Vault Files ({files.length})</span>
                </button>
              </div>
            </div>

            {/* Stage Mode 1: Collaborative Canvas Whiteboard */}
            {workspaceMode === "canvas" && (
              <RoomCanvas
                roomId={roomId!}
                roomName={room?.name || "Room"}
                meshManager={meshManagerRef.current}
                onFileSavedToVault={() => {
                  fetchRoomData();
                  addAuditEvent("Saved whiteboard snapshot to vault");
                }}
              />
            )}

            {/* Stage Mode 2: Collaborative Markdown Document */}
            {workspaceMode === "doc" && (
              <RoomMarkdownEditor
                roomId={roomId!}
                roomName={room?.name || "Room"}
                onFileSavedToVault={() => {
                  fetchRoomData();
                  addAuditEvent("Saved markdown document to vault");
                }}
              />
            )}

            {/* Stage Mode 3: Collaborative PDF Annotation & Review */}
            {workspaceMode === "pdf" && (
              <RoomPdfCollaborator
                roomId={roomId!}
                roomName={room?.name || "Room"}
                vaultFiles={files}
                meshManager={meshManagerRef.current}
                onUploadNewPdf={handleUploadFiles}
                onFileSavedToVault={() => {
                  fetchRoomData();
                  addAuditEvent("Saved annotated PDF to room vault");
                }}
              />
            )}

            {/* Stage Mode 4: Room Vault Files Grid */}
            {workspaceMode === "files" && (
              <div className="rounded-3xl bg-card/70 backdrop-blur-xl border border-border/80 p-5 space-y-4">
                {/* Upload Deck */}
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Room Storage Vault</h3>
                    <p className="text-xs text-muted-foreground">
                      Shared files encrypted and auto-dissolving with the room.
                    </p>
                  </div>
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => e.target.files && handleUploadFiles(e.target.files)}
                    />
                    <Button
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="h-8 rounded-xl text-xs font-bold gap-1.5 bg-primary text-primary-foreground"
                    >
                      <FileUp className="w-3.5 h-3.5" />
                      <span>{isUploading ? "Uploading..." : "Add Files"}</span>
                    </Button>
                  </div>
                </div>

                {/* Files Grid */}
                {files.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    No files stored in this vault yet. Drag files here or use the Whiteboard to save sketches.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
                    {files.map((file) => (
                      <div
                        key={file.id}
                        className="p-3 rounded-2xl bg-secondary/30 border border-border/60 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {getFileCategoryIcon(file.mimeType, file.originalName)}
                          <div className="min-w-0">
                            <span className="font-semibold text-foreground truncate block">
                              {file.originalName}
                            </span>
                            <span className="text-[10px] font-mono text-muted-foreground">
                              {formatBytes(file.size)} · {file.downloadCount} downloads
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setPreviewFile(file);
                              setIsFullscreenPreviewOpen(true);
                            }}
                            className="h-7 w-7 rounded-lg"
                            title="Preview File"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          {(file.mimeType === "application/pdf" || file.originalName.toLowerCase().endsWith(".pdf")) && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setWorkspaceMode("pdf")}
                              className="h-7 w-7 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                              title="Open in Shared PDF Review"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <a
                            href={`/api/files/${file.id}/download?token=${file.shareToken}`}
                            download={file.originalName}
                            className="h-7 w-7 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
                            title="Download"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setShareModalFile(file)}
                            className="h-7 w-7 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10"
                            title="Export & Share to Apps"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditingFile(file);
                              setNewFileName(file.originalName);
                            }}
                            className="h-7 w-7 rounded-lg"
                            title="Rename"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDeleteFile(file.id, file.originalName)}
                            className="h-7 w-7 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Activity Rail (lg: 4 cols) */}
          <div className="lg:col-span-4">
            <RoomActivityRail
              roomId={roomId!}
              roomName={room?.name || "Room"}
              timeRemaining={room ? formatTimeRemaining(room.expiresAt).text : ""}
              peers={meshPeers}
              flashMessages={flashMessages}
              onSendFlash={handleSendFlash}
              onDissolveRoom={() => setShowBurnConfirmModal(true)}
              auditEvents={auditEvents}
            />
          </div>
        </div>
      </div>

      {/* QR Invite Modal */}
      {showQrModal && (
        <div
          className="fixed inset-0 z-[120000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowQrModal(false)}
        >
          <div
            className="bg-card text-card-foreground border border-border p-6 rounded-3xl max-w-sm w-full space-y-4 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold">Invite Members to Room</h3>
            <div className="p-3 bg-white rounded-2xl inline-block shadow-inner">
              <QRCodeSVG value={roomQrUrl} size={180} level="M" />
            </div>
            <p className="text-xs text-muted-foreground">
              Scan with phone camera to auto-join this private vault.
            </p>
            <Button
              className="w-full rounded-2xl text-xs font-bold gap-1.5"
              onClick={async () => {
                await navigator.clipboard.writeText(roomQrUrl);
                toast({ title: "Invite Link Copied" });
              }}
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Invite URL</span>
            </Button>
          </div>
        </div>
      )}

      {/* Burn Room Confirmation Dialog */}
      <Dialog open={showBurnConfirmModal} onOpenChange={setShowBurnConfirmModal}>
        <DialogContent className="rounded-3xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-500">
              <Flame className="w-5 h-5" />
              <span>Burn & Dissolve Room</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure? This will instantly destroy all shared files, whiteboard sketches, and documents for all participants with zero possibility of recovery.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowBurnConfirmModal(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleDissolveRoom}
              className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold"
            >
              Confirm Self-Destruct
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename File Dialog */}
      <Dialog open={!!editingFile} onOpenChange={(open) => !open && setEditingFile(null)}>
        <DialogContent className="rounded-3xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Rename File</DialogTitle>
          </DialogHeader>
          <Input
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            className="rounded-xl text-xs"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setEditingFile(null)} className="rounded-xl">
              Cancel
            </Button>
            <Button size="sm" onClick={handleRenameFile} className="rounded-xl font-bold">
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fullscreen File Preview Modal */}
      {previewFile && (
        <FullscreenPreviewModal
          isOpen={isFullscreenPreviewOpen}
          onClose={() => {
            setIsFullscreenPreviewOpen(false);
            setPreviewFile(null);
          }}
          url={`/api/files/${previewFile.id}/download?token=${previewFile.shareToken}`}
          fileName={previewFile.originalName}
          fileSize={previewFile.size}
          mimeType={previewFile.mimeType}
          downloadUrl={`/api/files/${previewFile.id}/download?token=${previewFile.shareToken}`}
        />
      )}

      {/* Export & Multi-App Share Dialog */}
      {shareModalFile && (
        <ExportShareModal
          isOpen={!!shareModalFile}
          onClose={() => setShareModalFile(null)}
          fileName={shareModalFile.originalName}
          fileSize={shareModalFile.size}
          mimeType={shareModalFile.mimeType}
          shareUrl={`/api/files/${shareModalFile.id}/download?token=${shareModalFile.shareToken}`}
          downloadUrl={`/api/files/${shareModalFile.id}/download?token=${shareModalFile.shareToken}`}
          customNote={`Shared file from room "${room?.name || "Fileit Room"}"`}
        />
      )}
    </Layout>
  );
}
