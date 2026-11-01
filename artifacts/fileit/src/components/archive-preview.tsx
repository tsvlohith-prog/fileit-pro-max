import React, { useState, useEffect } from "react";
import JSZip from "jszip";
import {
  FileArchive,
  Folder,
  FolderOpen,
  File,
  FileText,
  FileCode,
  Image as ImageIcon,
  Download,
  Search,
  Eye,
  ChevronRight,
  ChevronDown,
  HardDrive,
  Package,
  Layers,
  Sparkles,
  AlertCircle,
  FileDown,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { formatBytes } from "@/lib/utils";
import { inspectFileType } from "@/lib/file-type-helpers";

interface ArchiveEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  compressedSize?: number;
  date: Date;
  zipObject: JSZip.JSZipObject;
}

export function ArchivePreview({
  url,
  fileName = "Archive.zip",
  className = "",
}: {
  url: string;
  fileName?: string;
  className?: string;
}) {
  const { toast } = useToast();
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<ArchiveEntry | null>(null);
  const [previewContent, setPreviewContent] = useState<{
    type: "text" | "image" | "binary";
    text?: string;
    imageUrl?: string;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function loadZip() {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to download archive: HTTP ${response.status}`);
        }
        const buffer = await response.arrayBuffer();
        const zip = await JSZip.loadAsync(buffer);

        const list: ArchiveEntry[] = [];
        zip.forEach((relativePath, zipObject) => {
          list.push({
            name: relativePath.split("/").filter(Boolean).pop() || relativePath,
            path: relativePath,
            isDir: zipObject.dir || relativePath.endsWith("/"),
            size: (zipObject as any)._data?.uncompressedSize || 0,
            date: zipObject.date || new Date(),
            zipObject,
          });
        });

        // Sort: folders first, then alphabetical
        list.sort((a, b) => {
          if (a.isDir && !b.isDir) return -1;
          if (!a.isDir && b.isDir) return 1;
          return a.path.localeCompare(b.path);
        });

        if (!cancelled) {
          setEntries(list);
          setLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "Failed to inspect archive contents.");
          setLoading(false);
        }
      }
    }

    loadZip();
    return () => {
      cancelled = true;
    };
  }, [url]);

  // Handle selective file preview inside zip
  const handlePreviewEntry = async (entry: ArchiveEntry) => {
    if (entry.isDir) return;
    setSelectedEntry(entry);
    setPreviewLoading(true);
    setPreviewContent(null);

    try {
      const ext = entry.name.split(".").pop()?.toLowerCase() || "";
      if (["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "ico"].includes(ext)) {
        const blob = await entry.zipObject.async("blob");
        const imageUrl = URL.createObjectURL(blob);
        setPreviewContent({ type: "image", imageUrl });
      } else if (
        [
          "txt",
          "md",
          "json",
          "js",
          "ts",
          "tsx",
          "jsx",
          "html",
          "css",
          "py",
          "sql",
          "xml",
          "yaml",
          "yml",
          "env",
          "csv",
        ].includes(ext) ||
        entry.size < 500 * 1024 // If small text
      ) {
        const text = await entry.zipObject.async("string");
        setPreviewContent({ type: "text", text });
      } else {
        setPreviewContent({ type: "binary" });
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Preview Error",
        description: "Could not decode file from archive.",
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  // Download single item extracted from archive
  const handleExtractSingle = async (entry: ArchiveEntry) => {
    try {
      const blob = await entry.zipObject.async("blob");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = entry.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      toast({
        title: "File Extracted",
        description: `Downloaded "${entry.name}" from archive.`,
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Extraction Failed",
      });
    }
  };

  const filteredEntries = entries.filter((e) =>
    e.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalUncompressed = entries.reduce((acc, curr) => acc + curr.size, 0);
  const totalFiles = entries.filter((e) => !e.isDir).length;
  const totalFolders = entries.filter((e) => e.isDir).length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-card rounded-2xl border border-border text-center gap-4 min-h-[300px]">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center animate-pulse border border-amber-500/20">
          <FileArchive className="w-6 h-6" />
        </div>
        <div>
          <p className="font-bold text-foreground text-sm">Inspecting Archive Structure…</p>
          <p className="text-xs text-muted-foreground">Reading directory tree & uncompressed entries</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-card rounded-2xl border border-border text-center gap-3">
        <AlertCircle className="w-8 h-8 text-destructive/80" />
        <h4 className="font-semibold text-foreground text-sm">Archive Inspection Unavailable</h4>
        <p className="text-xs text-muted-foreground max-w-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className={`bg-card rounded-2xl border border-border overflow-hidden flex flex-col ${className}`}>
      {/* Top Archive Header */}
      <div className="p-4 border-b border-border bg-secondary/30 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 shrink-0">
            <FileArchive className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-foreground truncate">{fileName}</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                ARCHIVE
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {totalFiles} files {totalFolders > 0 ? `• ${totalFolders} folders` : ""} • {formatBytes(totalUncompressed)} uncompressed
            </p>
          </div>
        </div>

        {/* Search filter input */}
        <div className="w-full sm:w-64 relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter files in archive…"
            className="h-8 pl-8 text-xs rounded-xl bg-background"
          />
        </div>
      </div>

      {/* Main Split Body: Explorer List + In-Archive Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-border min-h-[380px]">
        {/* Left / Top: File Tree List */}
        <div className={`overflow-y-auto max-h-[480px] p-2 space-y-1 ${selectedEntry ? "lg:col-span-7" : "lg:col-span-12"}`}>
          {filteredEntries.length === 0 ? (
            <div className="text-center p-8 text-xs text-muted-foreground">
              No files found matching "{searchQuery}"
            </div>
          ) : (
            filteredEntries.map((item, idx) => {
              const meta = inspectFileType(item.name);
              const isSelected = selectedEntry?.path === item.path;

              return (
                <div
                  key={idx}
                  onClick={() => handlePreviewEntry(item)}
                  className={`flex items-center justify-between p-2 rounded-xl text-xs transition-all cursor-pointer group ${
                    isSelected
                      ? "bg-amber-500/15 text-foreground font-semibold border border-amber-500/30"
                      : "hover:bg-secondary/60 text-muted-foreground hover:text-foreground border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {item.isDir ? (
                      <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                    ) : meta.category === "image" ? (
                      <ImageIcon className="w-4 h-4 text-sky-500 shrink-0" />
                    ) : meta.category === "code" ? (
                      <FileCode className="w-4 h-4 text-cyan-500 shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}

                    <span className="truncate font-mono text-[11px] select-all" title={item.path}>
                      {item.path}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {!item.isDir && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {formatBytes(item.size)}
                      </span>
                    )}

                    {!item.isDir && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExtractSingle(item);
                        }}
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-md"
                        title="Extract this file"
                      >
                        <Download className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right: In-Archive File Preview Inspector */}
        {selectedEntry && (
          <div className="lg:col-span-5 flex flex-col bg-secondary/10 overflow-hidden max-h-[480px]">
            <div className="p-3 border-b border-border bg-secondary/30 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground truncate">{selectedEntry.name}</p>
                <p className="text-[10px] text-muted-foreground font-mono">
                  {formatBytes(selectedEntry.size)} • Extracted View
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExtractSingle(selectedEntry)}
                  className="h-7 text-xs font-bold gap-1 rounded-lg px-2"
                >
                  <Download className="w-3 h-3" />
                  <span>Extract</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedEntry(null)}
                  className="h-7 w-7 p-0 rounded-lg text-xs"
                >
                  ✕
                </Button>
              </div>
            </div>

            <div className="p-3 overflow-auto flex-1 flex flex-col">
              {previewLoading ? (
                <div className="flex items-center justify-center flex-1 text-xs text-muted-foreground animate-pulse">
                  Extracting file preview…
                </div>
              ) : previewContent?.type === "image" && previewContent.imageUrl ? (
                <div className="flex items-center justify-center flex-1 bg-black/40 rounded-xl p-2">
                  <img
                    src={previewContent.imageUrl}
                    alt={selectedEntry.name}
                    className="max-h-64 object-contain rounded-lg shadow-sm"
                  />
                </div>
              ) : previewContent?.type === "text" && previewContent.text !== undefined ? (
                <pre className="p-3 bg-card border border-border rounded-xl text-[11px] font-mono text-foreground whitespace-pre-wrap overflow-auto max-h-80 leading-relaxed">
                  {previewContent.text}
                </pre>
              ) : (
                <div className="flex flex-col items-center justify-center flex-1 text-center p-6 gap-2 text-muted-foreground">
                  <File className="w-8 h-8 opacity-40" />
                  <p className="text-xs font-medium">Binary / Structured Data</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleExtractSingle(selectedEntry)}
                    className="h-7 text-xs font-bold gap-1 rounded-lg mt-1"
                  >
                    <Download className="w-3 h-3" /> Extract to Disk
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
