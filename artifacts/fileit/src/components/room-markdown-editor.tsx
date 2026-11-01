import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  FileText,
  Eye,
  Columns,
  Download,
  FolderPlus,
  Copy,
  Check,
  Bold,
  Italic,
  List,
  Code,
  Heading,
  Loader2,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getRoomToken } from "@/lib/rooms-storage";

interface RoomMarkdownEditorProps {
  roomId: string;
  roomName: string;
  onFileSavedToVault?: () => void;
}

export function RoomMarkdownEditor({ roomId, roomName, onFileSavedToVault }: RoomMarkdownEditorProps) {
  const { toast } = useToast();

  const [title, setTitle] = useState(`${roomName} Scratchpad`);
  const [content, setContent] = useState("");
  const [viewMode, setViewMode] = useState<"split" | "edit" | "preview">("split");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingToVault, setIsSavingToVault] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch document state from room
  useEffect(() => {
    const token = getRoomToken(roomId);
    fetch(`/api/rooms/${roomId}/document`, {
      headers: token ? { "x-room-token": token } : {},
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          if (data.title) setTitle(data.title);
          if (typeof data.content === "string") setContent(data.content);
          if (data.updatedAt) setLastSavedTime(new Date(data.updatedAt).toLocaleTimeString());
        }
      })
      .finally(() => setIsLoading);

    setIsLoading(false);
  }, [roomId]);

  // Debounced Auto-Save
  const saveDocument = useCallback(
    (newTitle: string, newContent: string) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

      saveTimeoutRef.current = setTimeout(async () => {
        setIsSaving(true);
        const token = getRoomToken(roomId);
        try {
          const res = await fetch(`/api/rooms/${roomId}/document`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { "x-room-token": token } : {}),
            },
            body: JSON.stringify({ title: newTitle, content: newContent }),
          });
          if (res.ok) {
            setLastSavedTime(new Date().toLocaleTimeString());
          }
        } catch {
        } finally {
          setIsSaving(false);
        }
      }, 800);
    },
    [roomId]
  );

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    saveDocument(title, newContent);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    saveDocument(newTitle, content);
  };

  const insertMarkdown = (prefix: string, suffix: string = "") => {
    const textarea = document.getElementById("room-doc-textarea") as HTMLTextAreaElement | null;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end);
    const replacement = `${prefix}${selected || "text"}${suffix}`;

    const newContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(newContent);
    saveDocument(title, newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + (selected ? selected.length : 4));
    }, 20);
  };

  const handleExportMarkdown = () => {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9_-]+/g, "-") || "document"}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast({ title: "Exported Markdown Document" });
  };

  const handleSaveToVault = async () => {
    if (!content.trim()) {
      toast({ variant: "destructive", title: "Document Empty", description: "Write some text before saving to vault." });
      return;
    }

    setIsSavingToVault(true);
    try {
      const fileName = `${title.replace(/[^a-zA-Z0-9_-]+/g, "_") || "doc"}.md`;
      const blob = new Blob([content], { type: "text/markdown" });
      const file = new File([blob], fileName, { type: "text/markdown" });

      const formData = new FormData();
      formData.append("file", file);

      const token = getRoomToken(roomId);
      const res = await fetch(`/api/rooms/${roomId}/files`, {
        method: "POST",
        headers: token ? { "x-room-token": token } : {},
        body: formData,
      });

      if (res.ok) {
        toast({
          title: "Saved to Room Vault",
          description: `${fileName} is now accessible in room files.`,
        });
        onFileSavedToVault?.();
      } else {
        throw new Error("Could not save to vault");
      }
    } catch {
      toast({ variant: "destructive", title: "Failed to save document to room vault" });
    } finally {
      setIsSavingToVault(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied to Clipboard" });
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const lineCount = content ? content.split("\n").length : 0;

  // Simple clean markdown parser for instant live preview
  const renderSimpleMarkdown = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      if (line.startsWith("# ")) {
        return (
          <h1 key={idx} className="text-xl sm:text-2xl font-extrabold text-foreground mt-4 mb-2">
            {line.slice(2)}
          </h1>
        );
      }
      if (line.startsWith("## ")) {
        return (
          <h2 key={idx} className="text-lg sm:text-xl font-bold text-foreground mt-3 mb-1.5">
            {line.slice(3)}
          </h2>
        );
      }
      if (line.startsWith("### ")) {
        return (
          <h3 key={idx} className="text-base font-bold text-foreground mt-2 mb-1">
            {line.slice(4)}
          </h3>
        );
      }
      if (line.startsWith("- [ ] ") || line.startsWith("- [x] ")) {
        const checked = line.startsWith("- [x] ");
        return (
          <div key={idx} className="flex items-center gap-2 my-1 text-xs sm:text-sm">
            <input type="checkbox" checked={checked} readOnly className="rounded" />
            <span className={checked ? "line-through text-muted-foreground" : "text-foreground"}>
              {line.slice(6)}
            </span>
          </div>
        );
      }
      if (line.startsWith("- ") || line.startsWith("* ")) {
        return (
          <li key={idx} className="ml-4 list-disc text-xs sm:text-sm text-foreground my-0.5">
            {line.slice(2)}
          </li>
        );
      }
      if (line.startsWith("> ")) {
        return (
          <blockquote key={idx} className="border-l-2 border-primary/50 pl-3 my-2 italic text-xs text-muted-foreground">
            {line.slice(2)}
          </blockquote>
        );
      }
      if (line.startsWith("```")) {
        return (
          <div key={idx} className="bg-slate-900 text-sky-300 font-mono text-[11px] px-3 py-1.5 rounded-lg my-1">
            {line}
          </div>
        );
      }
      if (!line.trim()) {
        return <div key={idx} className="h-2" />;
      }
      return (
        <p key={idx} className="text-xs sm:text-sm text-foreground/90 my-1 leading-relaxed">
          {line}
        </p>
      );
    });
  };

  return (
    <div className="flex flex-col rounded-3xl bg-card/70 backdrop-blur-xl border border-border/80 shadow-sm overflow-hidden h-[540px] sm:h-[600px] relative">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 sm:px-4 bg-secondary/50 border-b border-border/70 z-10">
        {/* Title Input */}
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          placeholder="Document Title"
          className="bg-transparent font-bold text-sm text-foreground focus:outline-none max-w-[200px] sm:max-w-xs truncate"
        />

        {/* Formatting Buttons */}
        <div className="flex items-center gap-1 bg-card px-1.5 py-1 rounded-2xl border border-border/60">
          <button
            type="button"
            onClick={() => insertMarkdown("### ")}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
            title="Heading"
          >
            <Heading className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("**", "**")}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
            title="Bold"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("*", "*")}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
            title="Italic"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("- ")}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
            title="Bullet List"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("```ts\n", "\n```")}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
            title="Code Block"
          >
            <Code className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* View Switcher & Action Deck */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5 bg-card p-1 rounded-xl border border-border/60">
            <button
              type="button"
              onClick={() => setViewMode("edit")}
              className={`p-1 rounded-lg transition-colors ${
                viewMode === "edit" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              title="Edit Only"
            >
              <FileText className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("split")}
              className={`p-1 rounded-lg transition-colors ${
                viewMode === "split" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              title="Split View"
            >
              <Columns className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("preview")}
              className={`p-1 rounded-lg transition-colors ${
                viewMode === "preview" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              title="Preview Only"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
          </div>

          <Button
            size="icon"
            variant="ghost"
            onClick={handleCopy}
            className="h-8 w-8 rounded-xl"
            title="Copy Text"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportMarkdown}
            className="h-8 rounded-xl text-xs font-bold gap-1.5 border-border/80"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export .md</span>
          </Button>

          <Button
            size="sm"
            onClick={handleSaveToVault}
            disabled={isSavingToVault || !content.trim()}
            className="h-8 rounded-xl text-xs font-bold gap-1.5 bg-primary text-primary-foreground"
          >
            {isSavingToVault ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderPlus className="w-3.5 h-3.5" />}
            <span>Save to Room</span>
          </Button>
        </div>
      </div>

      {/* Editor & Preview Workspace Canvas */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/60 overflow-hidden">
        {/* Editor Pane */}
        {(viewMode === "edit" || viewMode === "split") && (
          <div className="h-full flex flex-col p-3 sm:p-4 overflow-hidden bg-card/30">
            <Textarea
              id="room-doc-textarea"
              value={content}
              onChange={handleContentChange}
              placeholder="Start drafting shared notes, checklists, or code..."
              className="flex-1 w-full resize-none bg-transparent border-0 font-mono text-xs sm:text-sm leading-relaxed text-foreground p-0 focus-visible:ring-0 shadow-none"
            />
          </div>
        )}

        {/* Live Preview Pane */}
        {(viewMode === "preview" || viewMode === "split") && (
          <div className="h-full p-4 overflow-y-auto bg-card/50">
            {content.trim() ? (
              <div className="max-w-none text-foreground">{renderSimpleMarkdown(content)}</div>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                Live Markdown preview will appear here.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Status Bar */}
      <div className="px-4 py-2 bg-secondary/40 border-t border-border/60 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
        <div className="flex items-center gap-3">
          <span>{wordCount} words</span>
          <span>·</span>
          <span>{lineCount} lines</span>
          <span>·</span>
          <span>{content.length} chars</span>
        </div>

        <div className="flex items-center gap-2">
          {isSaving ? (
            <span className="flex items-center gap-1 text-primary">
              <Loader2 className="w-3 h-3 animate-spin" /> Saving...
            </span>
          ) : lastSavedTime ? (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> Auto-saved {lastSavedTime}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
