import React, { useState, useMemo, useRef } from "react";
import {
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  Image as ImageIcon,
  Archive,
  Music,
  Download,
  Upload,
  RefreshCw,
  FolderPlus,
  Trash2,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useP2PConnection, VaultFile } from "@/components/p2p-connection-context";
import { useToast } from "@/hooks/use-toast";

export function FolderSyncExplorer() {
  const { toast } = useToast();
  const {
    p2pState,
    remoteDeviceName,
    remoteVaultFiles,
    localVaultFiles,
    addLocalFilesToVault,
    removeLocalVaultFile,
    requestRemoteFile,
    syncAllRemoteFiles,
  } = useP2PConnection();

  const [activeSide, setActiveSide] = useState<"remote" | "local">("remote");
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isConnected = p2pState === "connected";

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getFileIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.match(/\.(pdf|docx|txt|rtf)$/)) return <FileText className="w-4 h-4 text-rose-400" />;
    if (lower.match(/\.(png|jpg|jpeg|webp|gif|svg)$/)) return <ImageIcon className="w-4 h-4 text-sky-400" />;
    if (lower.match(/\.(zip|tar|gz|7z)$/)) return <Archive className="w-4 h-4 text-amber-400" />;
    if (lower.match(/\.(mp3|wav|ogg|m4a|flac)$/)) return <Music className="w-4 h-4 text-purple-400" />;
    if (lower.match(/\.(ts|js|tsx|jsx|json|py|html|css)$/)) return <FileCode className="w-4 h-4 text-cyan-400" />;
    return <FileText className="w-4 h-4 text-primary" />;
  };

  // Group files by folder hierarchy
  const activeFiles = activeSide === "remote" ? remoteVaultFiles : localVaultFiles;

  const folderTree = useMemo(() => {
    const tree: Record<string, VaultFile[]> = { "Root Directory": [] };

    activeFiles.forEach((file) => {
      const folder = file.folderPath || "Root Directory";
      if (!tree[folder]) tree[folder] = [];
      tree[folder].push(file);
    });

    return tree;
  }, [activeFiles]);

  const toggleFolder = (folderName: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderName]: !prev[folderName],
    }));
  };

  const handleFolderUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addLocalFilesToVault(Array.from(e.target.files));
    }
  };

  return (
    <div className="flex flex-col rounded-3xl bg-card/60 backdrop-blur-xl border border-border/80 shadow-sm overflow-hidden min-h-[420px]">
      {/* Hidden File / Folder Inputs */}
      <input
        ref={folderInputRef}
        type="file"
        multiple
        {...({ webkitdirectory: "", directory: "" } as any)}
        className="hidden"
        onChange={handleFolderUpload}
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) addLocalFilesToVault(Array.from(e.target.files));
        }}
      />

      {/* Explorer Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 border-b border-border/70 bg-secondary/30">
        <div className="flex items-center gap-1 bg-secondary/80 p-1 rounded-2xl border border-border/60">
          <button
            type="button"
            onClick={() => setActiveSide("remote")}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors ${
              activeSide === "remote"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Folder className="w-3.5 h-3.5 text-emerald-500" />
            <span>{remoteDeviceName}&apos;s Vault</span>
            {remoteVaultFiles.length > 0 && (
              <span className="text-[10px] font-mono px-1 rounded bg-emerald-500/15 text-emerald-500">
                {remoteVaultFiles.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSide("local")}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors ${
              activeSide === "local"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FolderPlus className="w-3.5 h-3.5 text-primary" />
            <span>Local Vault (This Device)</span>
            {localVaultFiles.length > 0 && (
              <span className="text-[10px] font-mono px-1 rounded bg-primary/15 text-primary">
                {localVaultFiles.length}
              </span>
            )}
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {activeSide === "remote" ? (
            <Button
              size="sm"
              onClick={syncAllRemoteFiles}
              disabled={!isConnected || remoteVaultFiles.length === 0}
              className="h-8 rounded-xl text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Sync All Files</span>
            </Button>
          ) : (
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={() => folderInputRef.current?.click()}
                className="h-8 rounded-xl text-xs font-bold gap-1.5 border-border/80"
              >
                <FolderPlus className="w-3.5 h-3.5 text-primary" />
                <span>Share Folder</span>
              </Button>
              <Button
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-8 rounded-xl text-xs font-bold gap-1.5 bg-primary text-primary-foreground"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Add Files</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Folder Directory Content */}
      <div className="flex-1 p-4 sm:p-5 overflow-y-auto max-h-[380px] space-y-4">
        {activeSide === "remote" && !isConnected ? (
          <div className="py-12 text-center space-y-2">
            <Folder className="w-10 h-10 text-muted-foreground/40 mx-auto" />
            <h4 className="text-sm font-bold text-foreground">Device Not Connected</h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Pair your phone using the 1-click QR code on the left to browse and sync its remote folder vault.
            </p>
          </div>
        ) : activeFiles.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <FolderOpen className="w-10 h-10 text-muted-foreground/40 mx-auto" />
            <h4 className="text-sm font-bold text-foreground">
              {activeSide === "remote" ? "Remote Vault is Empty" : "No Files in Local Vault"}
            </h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {activeSide === "remote"
                ? "The paired device hasn't staged any files yet. Ask the peer to add folders."
                : "Drop folders or click 'Share Folder' above to allow your phone to browse and download them."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(folderTree).map(([folderName, files]) => {
              const isExpanded = expandedFolders[folderName] !== false; // Default expanded

              return (
                <div key={folderName} className="rounded-2xl border border-border/70 overflow-hidden bg-card/40">
                  {/* Folder Header */}
                  <div
                    onClick={() => toggleFolder(folderName)}
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-secondary/40 select-none transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                      <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="text-xs font-bold text-foreground truncate">{folderName}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">({files.length} items)</span>
                    </div>

                    <div className="text-[11px] font-mono text-muted-foreground">
                      {formatBytes(files.reduce((acc, f) => acc + (f.size || 0), 0))}
                    </div>
                  </div>

                  {/* Folder File Children */}
                  {isExpanded && (
                    <div className="divide-y divide-border/40 border-t border-border/40 bg-secondary/10">
                      {files.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between px-3 py-2 text-xs hover:bg-secondary/30 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pl-6">
                            {getFileIcon(file.name)}
                            <div className="min-w-0">
                              <span className="text-foreground font-medium truncate block">{file.name}</span>
                              <span className="text-[10px] font-mono text-muted-foreground">
                                {formatBytes(file.size)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {activeSide === "remote" ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => requestRemoteFile(file.id)}
                                className="h-7 px-2 text-[10px] font-bold rounded-lg text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 gap-1"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Get</span>
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeLocalVaultFile(file.id)}
                                className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
