import { useRoute, useLocation } from "wouter";
import {
  useGetFile,
  getGetFileQueryKey,
  useListTextMessages,
  getListTextMessagesQueryKey,
} from "@workspace/api-client-react";
import { getFileDownloadUrl, getFileUrl } from "@/lib/storage";
import { formatBytes } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  Download,
  ExternalLink,
  Copy,
  AlertCircle,
  File as FileIcon,
  ArrowLeft,
  Package,
  HardDrive,
  FileArchive,
  Layers,
  Maximize2,
} from "lucide-react";
import { FaAndroid, FaApple, FaWindows, FaLinux } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { TextMessageCard } from "@/components/text-message-card";
import { FileitLoader } from "@/components/brand/FileitLoader";
import { GlassmorphicUnlockModal } from "@/components/glassmorphic-unlock-modal";
import { PptxPreview } from "@/components/pptx-preview";
import { FileInterchangeModal } from "@/components/file-interchange-modal";
import { ArchivePreview } from "@/components/archive-preview";
import { CodePreview } from "@/components/code-preview";
import { MediaStudioPreview } from "@/components/media-studio-preview";
import { ImageStudioPreview } from "@/components/image-studio-preview";
import { PdfStudioPreview } from "@/components/pdf-studio-preview";
import { DocxStudioPreview } from "@/components/docx-studio-preview";
import { XlsxStudioPreview } from "@/components/xlsx-studio-preview";
import { FullscreenPreviewModal } from "@/components/fullscreen-preview-modal";
import { useState, useEffect } from "react";
import { inspectFileType } from "@/lib/file-type-helpers";
import { ArrowRightLeft } from "lucide-react";
import { useDynamicBubble } from "@/components/dynamic-bubble-context";

function getViewerType(
  mimeType: string,
  fileName: string
): "image" | "pdf" | "video" | "audio" | "text" | "docx" | "xlsx" | "pptx" | "apk" | "archive" | "executable" | "other" {
  const meta = inspectFileType(fileName, mimeType);
  if (meta.category === "apk") return "apk";
  if (meta.category === "archive") return "archive";
  if (meta.category === "executable" || meta.category === "disk_image") return "executable";
  if (meta.category === "image") return "image";
  if (meta.category === "presentation" || fileName.toLowerCase().endsWith(".pptx") || fileName.toLowerCase().endsWith(".ppt")) return "pptx";
  if (meta.category === "document" && (fileName.toLowerCase().endsWith(".pdf") || mimeType === "application/pdf")) return "pdf";
  if (meta.category === "document" && (fileName.toLowerCase().endsWith(".docx") || fileName.toLowerCase().endsWith(".doc"))) return "docx";
  if (meta.category === "sheet") return "xlsx";
  if (meta.category === "video") return "video";
  if (meta.category === "audio") return "audio";
  if (
    meta.category === "code" ||
    meta.category === "text" ||
    fileName.match(/\.(txt|text|log|md|markdown|json|js|jsx|ts|tsx|py|pyw|html|htm|css|scss|sass|less|sql|sh|bash|zsh|bat|cmd|c|cpp|h|hpp|rs|go|java|kt|swift|php|rb|yaml|yml|xml|env|ini|toml|conf|config)$/i) ||
    mimeType.startsWith("text/")
  ) {
    return "text";
  }
  return "other";
}

function FilePreview({
  publicUrl,
  mimeType,
  fileName,
  size,
  shareUrl,
  onDownload,
}: {
  publicUrl: string;
  mimeType: string;
  fileName: string;
  size?: number;
  shareUrl?: string;
  onDownload?: () => void;
}) {
  const type = getViewerType(mimeType, fileName);
  const meta = inspectFileType(fileName, mimeType);

  switch (type) {
    case "image":
      return (
        <ImageStudioPreview
          url={publicUrl}
          fileName={fileName}
          size={size}
        />
      );
    case "pdf":
      return (
        <PdfStudioPreview
          url={publicUrl}
          fileName={fileName}
          fileSize={size}
          shareUrl={shareUrl}
        />
      );
    case "video":
      return (
        <MediaStudioPreview
          url={publicUrl}
          fileName={fileName}
          type="video"
        />
      );
    case "audio":
      return (
        <MediaStudioPreview
          url={publicUrl}
          fileName={fileName}
          type="audio"
        />
      );
    case "text":
      return <CodePreview url={publicUrl} fileName={fileName} />;
    case "docx":
      return (
        <DocxStudioPreview
          url={publicUrl}
          fileName={fileName}
          fileSize={size}
        />
      );
    case "xlsx":
      return (
        <XlsxStudioPreview
          url={publicUrl}
          fileName={fileName}
          fileSize={size}
        />
      );
    case "pptx":
      return <PptxPreview url={publicUrl} fileName={fileName} />;
    case "archive":
      return <ArchivePreview url={publicUrl} fileName={fileName} />;
    case "apk":
      return (
        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center p-8 md:p-12 bg-card rounded-3xl border border-border text-center gap-4 shadow-xs max-w-2xl mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center shadow-md shadow-emerald-500/10">
              <FaAndroid className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 uppercase tracking-wide">
                Android Package (APK)
              </span>
              <h3 className="text-lg font-bold text-foreground break-all">{fileName}</h3>
              <p className="text-xs text-muted-foreground max-w-md">
                Native Android package. You can transfer directly or inspect the package contents below.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button size="sm" className="rounded-xl font-semibold gap-2" onClick={onDownload}>
                <Download className="w-4 h-4" />
                Download APK {size ? `(${formatBytes(size)})` : ""}
              </Button>
            </div>
          </div>
          <ArchivePreview url={publicUrl} fileName={fileName} />
        </div>
      );
    case "executable":
      return (
        <div className="flex flex-col items-center justify-center p-12 md:p-16 bg-card rounded-3xl border border-border text-center gap-6 shadow-xs max-w-2xl mx-auto">
          <div className="w-20 h-20 rounded-3xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-500 flex items-center justify-center shadow-md shadow-indigo-500/10">
            {meta.icon}
          </div>
          <div className="space-y-2">
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 uppercase tracking-wide">
              {meta.badgeLabel}
            </span>
            <h3 className="text-xl font-bold text-foreground break-all">{fileName}</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Raw binary installer or disk image payload. Download directly to disk to mount or execute.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" className="rounded-xl font-semibold gap-2" onClick={onDownload}>
              <Download className="w-4 h-4" />
              Download Binary {size ? `(${formatBytes(size)})` : ""}
            </Button>
          </div>
        </div>
      );
    default:
      return (
        <div className="flex flex-col items-center justify-center p-16 bg-card rounded-2xl border border-border text-center gap-4 max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center border border-border text-muted-foreground">
            {meta.icon}
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-foreground break-all">{fileName}</h3>
            <p className="text-sm text-muted-foreground">This file format is ready for download and local execution.</p>
          </div>
          <Button size="lg" className="rounded-xl font-semibold gap-2 mt-2" onClick={onDownload}>
            <Download className="w-4 h-4" />
            Download File {size ? `(${formatBytes(size)})` : ""}
          </Button>
        </div>
      );
  }
}

function TextPreview({ url }: { url: string }) {
  const [content, setContent] = useState<string>("Loading…");
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch(url)
      .then((r) => r.text())
      .then((t) => setContent(t))
      .catch(() => setError(true));
  }, [url]);
  if (error) {
    return (
      <div className="p-12 bg-card rounded-2xl border border-border text-center text-muted-foreground">
        Could not load text preview.
      </div>
    );
  }
  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/50">
        <span className="text-xs font-mono text-muted-foreground">Text preview</span>
      </div>
      <pre className="p-4 overflow-auto max-h-[70vh] text-sm font-mono text-foreground whitespace-pre-wrap">
        {content}
      </pre>
    </div>
  );
}

function DocxPreview({ url }: { url: string }) {
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(url).then((r) => r.arrayBuffer()),
      import("mammoth"),
    ])
      .then(([buffer, mammoth]) => mammoth.convertToHtml({ arrayBuffer: buffer }))
      .then((result) => {
        if (!cancelled) {
          setHtml(result.value);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (loading) {
    return (
      <div className="p-12 bg-card rounded-2xl border border-border text-center text-muted-foreground">
        Loading Word preview…
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-12 bg-card rounded-2xl border border-border text-center text-muted-foreground">
        Could not load Word preview.
      </div>
    );
  }
  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/50">
        <span className="text-xs font-mono text-muted-foreground">Word preview</span>
      </div>
      <div
        className="p-6 overflow-auto max-h-[70vh] prose dark:prose-invert prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

function XlsxPreview({ url }: { url: string }) {
  const [rows, setRows] = useState<unknown[][]>([]);
  const [sheetName, setSheetName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(url).then((r) => r.arrayBuffer()),
      import("xlsx"),
    ])
      .then(([buffer, XLSX]) => {
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheet = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheet];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
        if (!cancelled) {
          setSheetName(firstSheet);
          setRows(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (loading) {
    return (
      <div className="p-12 bg-card rounded-2xl border border-border text-center text-muted-foreground">
        Loading Excel preview…
      </div>
    );
  }
  if (error || rows.length === 0) {
    return (
      <div className="p-12 bg-card rounded-2xl border border-border text-center text-muted-foreground">
        Could not load Excel preview.
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/50">
        <span className="text-xs font-mono text-muted-foreground">
          Excel preview: {sheetName}
        </span>
      </div>
      <div className="overflow-auto max-h-[70vh]">
        <table className="w-full text-sm text-left">
          <thead className="bg-secondary/50 text-muted-foreground font-semibold sticky top-0">
            <tr>
              {rows[0]?.map((cell, i) => (
                <th key={i} className="px-3 py-2 border-b border-border whitespace-nowrap">
                  {String(cell ?? "")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(1).map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-border last:border-0">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-3 py-2 whitespace-nowrap">
                    {String(cell ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ViewPage() {
  const [, params] = useRoute("/view/:id");
  const fileId = params?.id;
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const [unlockedFile, setUnlockedFile] = useState<any | null>(null);
  const [unlockedPassword, setUnlockedPassword] = useState<string | null>(null);

  const { data: initialFile, isLoading, isError } = useGetFile(fileId || "", {
    query: {
      enabled: !!fileId,
      queryKey: getGetFileQueryKey(fileId || ""),
      retry: false,
    },
  });

  const file = unlockedFile || initialFile;
  const isLocked = Boolean(file && ((file as any).isLocked || ((file as any).isProtected && !file.storagePath)));

  const [isInterchangeOpen, setIsInterchangeOpen] = useState(false);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const { addRecentFile, setActivePreviewFile } = useDynamicBubble();

  const publicUrl = file && file.storagePath ? getFileUrl(file.storagePath, unlockedPassword || undefined) : "";
  const shareUrl = file ? `${window.location.origin}/share/${file.shareToken}` : "";

  const handleUnlock = async (password: string): Promise<boolean> => {
    if (!fileId) return false;
    try {
      const res = await fetch(`/api/files/${fileId}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.file) {
        setUnlockedFile(data.file);
        setUnlockedPassword(password);
        queryClient.setQueryData(getGetFileQueryKey(fileId), data.file);
        toast({ title: "Unlocked successfully", description: "File is now accessible." });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    if (file && publicUrl) {
      const type = getViewerType(file.mimeType, file.originalName);
      const minType =
        type === "pdf"
          ? "pdf"
          : type === "docx"
          ? "docx"
          : type === "xlsx"
          ? "xlsx"
          : type === "image"
          ? "image"
          : type === "text"
          ? "text"
          : type === "archive"
          ? "archive"
          : "other";
      const payload = {
        id: file.id,
        name: file.originalName,
        type: minType,
        url: publicUrl,
        size: file.size,
      };
      addRecentFile(payload);
      setActivePreviewFile(payload);
    }
  }, [file?.id, publicUrl]);
  const { data: linkedMessages } = useListTextMessages(file ? { fileId: file.id } : undefined, {
    query: {
      enabled: !!file && !isLocked,
      queryKey: getListTextMessagesQueryKey(file ? { fileId: file.id } : undefined),
    },
  });

  const handleDownload = () => {
    if (!file || !file.storagePath) return;
    const link = document.createElement("a");
    link.href = getFileDownloadUrl(file.storagePath, unlockedPassword || undefined);
    link.download = file.originalName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: "Share link copied!" });
    } catch {
      toast({ variant: "destructive", title: "Failed to copy" });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <FileitLoader size="lg" label="Retrieving file..." sublabel="Securing encrypted stream" />
      </div>
    );
  }

  if (isError || !file) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full text-center space-y-4 bg-card p-8 rounded-2xl border border-border">
          <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold">File not found</h1>
          <Button variant="outline" onClick={() => navigate("/files")}>
            Back to My Files
          </Button>
        </div>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4 relative selection:bg-purple-500/20">
        <GlassmorphicUnlockModal
          title={file.originalName}
          size={file.size}
          mimeType={file.mimeType}
          isInherited={(file as any).isInherited}
          subTitle={(file as any).isInherited ? "Protected by parent folder lock" : "Protected by custom file password"}
          onUnlock={handleUnlock}
          onCancel={() => navigate("/files")}
        />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 h-14 flex items-center gap-3 max-w-5xl">
          <button
            onClick={() => navigate("/files")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate text-sm">{file.originalName}</p>
            <p className="text-xs text-muted-foreground">
              {formatBytes(file.size)} &bull;{" "}
              {formatDistanceToNow(new Date(file.createdAt), { addSuffix: true })}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFullscreenOpen(true)}
              className="font-bold border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary gap-1.5 shadow-xs"
              title="Open in Fullscreen App Mode"
            >
              <Maximize2 className="w-4 h-4" />
              <span className="hidden sm:inline">Fullscreen</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsInterchangeOpen(true)}
              className="font-bold border-border hover:bg-secondary text-foreground gap-1.5 hidden md:inline-flex"
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>Interchange Format</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopyLink} className="hidden sm:inline-flex">
              <Copy className="w-4 h-4 mr-2" />
              Copy link
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.open(shareUrl, "_blank")} className="hidden sm:inline-flex">
              <ExternalLink className="w-4 h-4 mr-2" />
              Share
            </Button>
            <Button size="sm" onClick={handleDownload}>
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <FilePreview
          publicUrl={publicUrl}
          mimeType={file.mimeType}
          fileName={file.originalName}
          size={file.size}
          shareUrl={shareUrl}
          onDownload={handleDownload}
        />
        {linkedMessages && linkedMessages.length > 0 && (
          <section className="mt-8 space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Text & code messages
            </h2>
            <div className="space-y-3">
              {linkedMessages.map((message) => (
                <TextMessageCard key={message.id} message={message} showDelete={false} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ── Universal Fullscreen App Studio Modal ── */}
      {file && (
        <FullscreenPreviewModal
          isOpen={isFullscreenOpen}
          onClose={() => setIsFullscreenOpen(false)}
          fileName={file.originalName}
          mimeType={file.mimeType}
          size={file.size}
          url={publicUrl}
        >
          <div className="w-full h-full flex items-center justify-center p-2">
            <FilePreview
              publicUrl={publicUrl}
              mimeType={file.mimeType}
              fileName={file.originalName}
              size={file.size}
              shareUrl={shareUrl}
              onDownload={handleDownload}
            />
          </div>
        </FullscreenPreviewModal>
      )}

      {file && (
        <FileInterchangeModal
          isOpen={isInterchangeOpen}
          onClose={() => setIsInterchangeOpen(false)}
          fileId={file.id}
          fileName={file.originalName}
          mimeType={file.mimeType}
          fileUrl={publicUrl}
          onSaveToLibrary={() => {
            toast({ title: "Saved to Library", description: "Successfully saved converted file to your files." });
          }}
        />
      )}
    </div>
  );
}
