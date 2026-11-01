import React, { useState, useRef } from "react";
import {
  UploadCloud,
  Send,
  Copy,
  Check,
  Download,
  Trash2,
  FileText,
  Sparkles,
  ArrowDownToLine,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useP2PConnection } from "@/components/p2p-connection-context";
import { useToast } from "@/hooks/use-toast";

export function P2PFileBeam() {
  const { toast } = useToast();
  const {
    p2pState,
    remoteDeviceName,
    sendFilesDirect,
    isTransferring,
    transferProgress,
    transferSpeed,
    syncedClipboard,
    sendClipboardText,
    clearClipboard,
    receivedItems,
    clearReceivedItems,
  } = useP2PConnection();

  const [clipboardInput, setClipboardInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isConnected = p2pState === "connected";

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!isConnected) {
      toast({ variant: "destructive", title: "Device Not Linked", description: "Pair a device to beam files." });
      return;
    }
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      sendFilesDirect(files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      sendFilesDirect(Array.from(e.target.files));
    }
  };

  const handleSendClipboard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clipboardInput.trim()) return;
    sendClipboardText(clipboardInput.trim());
    setClipboardInput("");
  };

  const handleCopyClipboardItem = async (content: string, id: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Copied to Clipboard" });
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div className="space-y-6">
      {/* 1. Direct Beam Drop Target */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          if (!isConnected) {
            toast({ variant: "destructive", title: "Device Not Linked", description: "Pair a device to beam files." });
            return;
          }
          fileInputRef.current?.click();
        }}
        className={`relative flex flex-col items-center justify-center p-8 rounded-3xl border-2 border-dashed transition-all duration-200 cursor-pointer text-center select-none ${
          isDragOver
            ? "border-emerald-500 bg-emerald-500/10 scale-[1.01]"
            : "border-border/80 hover:border-primary/50 bg-card/40 hover:bg-card/70"
        }`}
      >
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />

        <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-3">
          <UploadCloud className="w-6 h-6 text-primary" />
        </div>

        <h4 className="text-sm font-bold text-foreground mb-1">
          {isConnected ? `Drop Files to Beam directly to ${remoteDeviceName}` : "Direct WebRTC File Beam"}
        </h4>
        <p className="text-xs text-muted-foreground max-w-sm">
          {isConnected
            ? "Files stream directly through the encrypted memory buffer with zero cloud storage."
            : "Pair your phone to enable zero-upload streaming between devices."}
        </p>

        {/* Live Transfer Progress Bar */}
        {isTransferring && (
          <div className="w-full max-w-xs mt-4 space-y-1.5">
            <div className="flex justify-between text-[11px] font-mono text-foreground font-semibold">
              <span>Streaming Payload</span>
              <span>{transferProgress}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-200 rounded-full"
                style={{ width: `${transferProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. Real-Time Clipboard Conduit */}
      <div className="p-5 rounded-3xl bg-card/60 backdrop-blur-xl border border-border/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h4 className="text-sm font-bold text-foreground">Real-Time Clipboard Conduit</h4>
            <p className="text-xs text-muted-foreground">
              Send links or text directly to your phone&apos;s clipboard
            </p>
          </div>
          {syncedClipboard.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={clearClipboard}
              className="h-7 text-[10px] text-muted-foreground hover:text-foreground"
            >
              Clear History
            </Button>
          )}
        </div>

        <form onSubmit={handleSendClipboard} className="flex gap-2">
          <Input
            value={clipboardInput}
            onChange={(e) => setClipboardInput(e.target.value)}
            placeholder={isConnected ? "Paste URL or text to beam to phone..." : "Pair phone first to send clipboard"}
            disabled={!isConnected}
            className="h-10 rounded-xl text-xs"
          />
          <Button
            type="submit"
            disabled={!isConnected || !clipboardInput.trim()}
            className="h-10 rounded-xl px-4 text-xs font-bold gap-1.5 bg-primary text-primary-foreground shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </Button>
        </form>

        {syncedClipboard.length > 0 && (
          <div className="space-y-2 pt-1 max-h-40 overflow-y-auto">
            {syncedClipboard.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-secondary/40 border border-border/60 text-xs gap-3"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-mono text-muted-foreground block">
                    {item.sourceDevice} · {new Date(item.timestamp).toLocaleTimeString()}
                  </span>
                  <p className="text-foreground truncate font-mono text-[11px]">{item.content}</p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleCopyClipboardItem(item.content, item.id)}
                  className="h-7 w-7 rounded-lg shrink-0"
                >
                  {copiedId === item.id ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Received Items via P2P */}
      {receivedItems.length > 0 && (
        <div className="p-5 rounded-3xl bg-card/60 backdrop-blur-xl border border-border/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-foreground">Received from Peer ({receivedItems.length})</h4>
            <Button
              size="sm"
              variant="ghost"
              onClick={clearReceivedItems}
              className="h-7 text-[10px] text-muted-foreground hover:text-foreground"
            >
              Clear
            </Button>
          </div>

          <div className="space-y-2 max-h-44 overflow-y-auto">
            {receivedItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-secondary/40 border border-border/60 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-foreground font-medium truncate block">{item.name || "Received Item"}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {formatBytes(item.size)} · {item.timestamp}
                    </span>
                  </div>
                </div>

                {item.blobUrl && (
                  <a
                    href={item.blobUrl}
                    download={item.name || "downloaded-file"}
                    className="h-7 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold flex items-center gap-1 shrink-0"
                  >
                    <Download className="w-3 h-3" />
                    <span>Save</span>
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
