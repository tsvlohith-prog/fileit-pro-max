import { useState, useRef } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Maximize,
  Minimize,
  Download,
  Printer,
  Moon,
  Sun,
  FileText,
  ExternalLink,
  Type,
  PenTool,
  Trash2,
  Stamp,
  CheckCircle2,
  Sparkles,
  Share2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ExportShareModal } from "@/components/export-share-modal";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface PdfStudioPreviewProps {
  url: string;
  fileName: string;
  fileSize?: number;
  className?: string;
  shareUrl?: string;
}

interface PdfAnnotation {
  id: string;
  type: "text" | "highlight" | "stamp";
  x: number; // percentages (0 - 100)
  y: number;
  text: string;
  color: string;
  fontSize: number;
}

export function PdfStudioPreview({ url, fileName, fileSize, className = "", shareUrl }: PdfStudioPreviewProps) {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const paperRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fitMode, setFitMode] = useState<"auto" | "page" | "width">("auto");

  // PDF Engine Annotation State
  const [activeTool, setActiveTool] = useState<"view" | "text" | "highlight" | "stamp">("view");
  const [annotations, setAnnotations] = useState<PdfAnnotation[]>([]);
  const [highlightColor, setHighlightColor] = useState<string>("rgba(234, 179, 8, 0.35)"); // Yellow default
  const [stampText, setStampText] = useState<string>("APPROVED");
  const [newTextContent, setNewTextContent] = useState<string>("New Annotation Text");

  // Export & Share State
  const [isExportShareOpen, setIsExportShareOpen] = useState(false);
  const [isPreparingShare, setIsPreparingShare] = useState(false);
  const [exportBlob, setExportBlob] = useState<Blob | undefined>(undefined);

  const handleZoom = (delta: number) => {
    setZoom((prev) => Math.min(250, Math.max(50, prev + delta)));
  };

  const handleRotate = (deg: number) => {
    setRotation((prev) => (prev + deg + 360) % 360);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handlePrint = () => {
    if (iframeRef.current) {
      try {
        iframeRef.current.contentWindow?.print();
      } catch {
        window.open(url, "_blank")?.print();
      }
    } else {
      window.open(url, "_blank");
    }
  };

  const handlePaperClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === "view") return;
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    const x = Math.max(3, Math.min(97, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(3, Math.min(97, ((e.clientY - rect.top) / rect.height) * 100));

    const newAnno: PdfAnnotation = {
      id: Math.random().toString(36).substring(2, 9),
      type: activeTool === "text" ? "text" : activeTool === "highlight" ? "highlight" : "stamp",
      x,
      y,
      text: activeTool === "text" ? newTextContent : activeTool === "stamp" ? stampText : "Highlighted region",
      color: activeTool === "highlight" ? highlightColor : activeTool === "stamp" ? "#ef4444" : "#2563eb",
      fontSize: 13,
    };

    setAnnotations((prev) => [...prev, newAnno]);
    toast({
      title: `Added ${activeTool} annotation`,
      description: "Click any annotation item to remove it.",
    });
  };

  const handleExportShare = async () => {
    setIsPreparingShare(true);
    try {
      if (annotations.length > 0 && paperRef.current) {
        const canvas = await html2canvas(paperRef.current, {
          scale: 2,
          useCORS: true,
          backgroundColor: isDarkMode ? "#090d16" : "#ffffff",
        });
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF({
          orientation: canvas.width > canvas.height ? "landscape" : "portrait",
          unit: "px",
          format: [canvas.width, canvas.height],
        });
        pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
        const pdfBlob = pdf.output("blob");
        setExportBlob(pdfBlob);
      } else {
        setExportBlob(undefined);
      }
      setIsExportShareOpen(true);
    } catch {
      setIsExportShareOpen(true);
    } finally {
      setIsPreparingShare(false);
    }
  };

  const handleDownloadAnnotated = async () => {
    if (annotations.length === 0 || !paperRef.current) {
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    try {
      toast({ title: "Generating PDF...", description: "Flattening annotations" });
      const canvas = await html2canvas(paperRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: isDarkMode ? "#090d16" : "#ffffff",
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? "landscape" : "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      const base = fileName.replace(/\.pdf$/i, "");
      pdf.save(`${base}_reviewed.pdf`);
      toast({ title: "Downloaded Annotated PDF" });
    } catch {
      toast({ variant: "destructive", title: "Download failed" });
    }
  };

  const removeAnnotation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    toast({ title: "Annotation removed" });
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      ref={containerRef}
      className={`bg-card rounded-3xl border border-border overflow-hidden flex flex-col shadow-xl transition-all ${className}`}
    >
      {/* ── Top Master Control & PDF Engine Toolbar ── */}
      <div className="px-4 py-3 border-b border-border bg-secondary/30 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Document metadata */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-foreground truncate max-w-[160px] sm:max-w-xs" title={fileName}>
                {fileName}
              </span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 shrink-0">
                PDF Studio
              </span>
            </div>
            {fileSize && (
              <p className="text-[10px] text-muted-foreground font-mono">
                {formatFileSize(fileSize)} • Zoom {zoom}% {annotations.length > 0 && `• ${annotations.length} annotation(s)`}
              </p>
            )}
          </div>
        </div>

        {/* Center: PDF Engine Tools (Add Text, Highlight, Stamp) */}
        <div className="flex items-center bg-background border border-border rounded-xl p-0.5 shadow-xs gap-1">
          <Button
            size="sm"
            variant={activeTool === "view" ? "default" : "ghost"}
            onClick={() => setActiveTool("view")}
            className="h-7 px-2.5 text-[11px] font-semibold rounded-lg gap-1"
            title="View & Navigate"
          >
            <Maximize className="w-3 h-3" /> View
          </Button>
          <Button
            size="sm"
            variant={activeTool === "text" ? "default" : "ghost"}
            onClick={() => setActiveTool("text")}
            className="h-7 px-2.5 text-[11px] font-semibold rounded-lg gap-1"
            title="Click to add text box"
          >
            <Type className="w-3 h-3" /> Add Text
          </Button>
          <Button
            size="sm"
            variant={activeTool === "highlight" ? "default" : "ghost"}
            onClick={() => setActiveTool("highlight")}
            className="h-7 px-2.5 text-[11px] font-semibold rounded-lg gap-1"
            title="Click to highlight text region"
          >
            <PenTool className="w-3 h-3" /> Highlight
          </Button>
          <Button
            size="sm"
            variant={activeTool === "stamp" ? "default" : "ghost"}
            onClick={() => setActiveTool("stamp")}
            className="h-7 px-2.5 text-[11px] font-semibold rounded-lg gap-1"
            title="Add Approval Stamp"
          >
            <Stamp className="w-3 h-3" /> Stamp
          </Button>
        </div>

        {/* Right: Studio Action Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Zoom controls */}
          <div className="flex items-center bg-background border border-border rounded-xl p-0.5 shadow-xs">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleZoom(-15)}
              disabled={zoom <= 50}
              className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </Button>
            <button
              type="button"
              onClick={() => setZoom(100)}
              className="px-2 text-[11px] font-mono font-bold text-foreground hover:text-primary transition-colors"
              title="Reset Zoom"
            >
              {zoom}%
            </button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleZoom(15)}
              disabled={zoom >= 250}
              className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Rotation */}
          <div className="flex items-center bg-background border border-border rounded-xl p-0.5 shadow-xs">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleRotate(-90)}
              className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground"
              title="Rotate Left 90°"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleRotate(90)}
              className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground"
              title="Rotate Right 90°"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Export & Share Multi-App */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportShare}
            disabled={isPreparingShare}
            className="h-8 px-2.5 text-xs font-bold rounded-xl gap-1.5 shadow-xs text-primary border-primary/30 hover:bg-primary/10"
            title="Export & Share to WhatsApp, Telegram, Slack, etc."
          >
            {isPreparingShare ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Export & Share</span>
          </Button>

          {/* Reading Night Theme Invert */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsDarkMode((d) => !d)}
            className={`h-8 px-2.5 text-xs font-bold rounded-xl gap-1.5 shadow-xs ${
              isDarkMode ? "bg-amber-500/10 text-amber-500 border-amber-500/30" : ""
            }`}
            title="Toggle Night Reading Mode"
          >
            {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-500" /> : <Moon className="w-3.5 h-3.5" />}
          </Button>

          {/* Print */}
          <Button
            size="sm"
            variant="outline"
            onClick={handlePrint}
            className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-foreground shadow-xs hidden sm:flex"
            title="Print Document"
          >
            <Printer className="w-3.5 h-3.5" />
          </Button>

          {/* Open in external tab */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open(url, "_blank")}
            className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-foreground shadow-xs"
            title="Open in Full Tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>

          {/* Fullscreen */}
          <Button
            size="sm"
            variant="ghost"
            onClick={toggleFullscreen}
            className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-foreground"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Preview"}
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* ── Secondary Engine Configuration Subbar (when editing active) ── */}
      {activeTool !== "view" && (
        <div className="px-4 py-2 bg-primary/5 border-b border-border/60 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-primary capitalize flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> PDF Engine Mode: {activeTool}
            </span>
            <span className="text-muted-foreground hidden sm:inline">
              (Click anywhere on the document below to place)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {activeTool === "text" && (
              <Input
                value={newTextContent}
                onChange={(e) => setNewTextContent(e.target.value)}
                placeholder="Text content..."
                className="h-7 text-xs w-48 bg-background"
              />
            )}
            {activeTool === "highlight" && (
              <div className="flex items-center gap-1">
                {[
                  { label: "Yellow", val: "rgba(234, 179, 8, 0.4)" },
                  { label: "Green", val: "rgba(34, 197, 94, 0.4)" },
                  { label: "Pink", val: "rgba(236, 72, 153, 0.4)" },
                  { label: "Blue", val: "rgba(59, 130, 246, 0.4)" },
                ].map((c) => (
                  <button
                    key={c.label}
                    onClick={() => setHighlightColor(c.val)}
                    className={`w-5 h-5 rounded-full border border-border ${
                      highlightColor === c.val ? "ring-2 ring-primary ring-offset-1" : ""
                    }`}
                    style={{ backgroundColor: c.val }}
                    title={c.label}
                  />
                ))}
              </div>
            )}
            {activeTool === "stamp" && (
              <select
                value={stampText}
                onChange={(e) => setStampText(e.target.value)}
                className="h-7 text-xs bg-background border border-border rounded-lg px-2"
              >
                <option value="APPROVED">APPROVED</option>
                <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                <option value="REVIEWED">REVIEWED</option>
                <option value="SIGNED">SIGNED</option>
                <option value="REJECTED">REJECTED</option>
              </select>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setActiveTool("view")}
              className="h-7 text-xs px-2"
            >
              Done Editing
            </Button>
          </div>
        </div>
      )}

      {/* ── Document Viewport & Canvas Stage with Annotation Overlay ── */}
      <div
        ref={viewportRef}
        className="relative flex-1 bg-muted/40 min-h-[520px] max-h-[78vh] overflow-auto flex items-center justify-center p-4"
      >
        <div
          ref={paperRef}
          className="transition-all duration-200 origin-center shadow-2xl rounded-2xl overflow-hidden bg-white border border-border relative"
          style={{
            transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
            filter: isDarkMode ? "invert(0.92) hue-rotate(180deg) contrast(1.1)" : "none",
            width: fitMode === "width" ? "100%" : "min(100%, 920px)",
            height: fitMode === "page" ? "650px" : "min(70vh, 780px)",
          }}
        >
          <iframe
            ref={iframeRef}
            src={`${url}#toolbar=0&navpanes=0`}
            title={fileName}
            className={`w-full h-full border-none ${
              activeTool !== "view" ? "pointer-events-none" : "pointer-events-auto"
            }`}
          />

          {/* Interactive Annotation Capture Layer */}
          <div
            onClick={handlePaperClick}
            className={`absolute inset-0 z-20 ${
              activeTool !== "view" ? "cursor-crosshair pointer-events-auto" : "pointer-events-none"
            }`}
            title={activeTool !== "view" ? "Click to place annotation" : undefined}
          />

          {/* ── Render User Annotations Overlay ── */}
          {annotations.map((anno) => (
            <div
              key={anno.id}
              onClick={(e) => removeAnnotation(anno.id, e)}
              className="absolute z-30 cursor-pointer group transition-transform hover:scale-105"
              style={{
                left: `${anno.x}%`,
                top: `${anno.y}%`,
                transform: "translate(-50%, -50%)",
              }}
              title="Click to remove annotation"
            >
              {anno.type === "text" && (
                <div className="px-3 py-1.5 rounded-lg bg-background/95 backdrop-blur-sm border-2 border-primary shadow-lg text-foreground text-xs font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  <span>{anno.text}</span>
                  <Trash2 className="w-3 h-3 text-destructive opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                </div>
              )}
              {anno.type === "highlight" && (
                <div
                  className="px-4 py-2 rounded-md border border-amber-500/50 shadow-sm font-semibold text-xs text-foreground/80 flex items-center gap-1"
                  style={{ backgroundColor: anno.color }}
                >
                  <span>{anno.text}</span>
                  <Trash2 className="w-3 h-3 text-destructive opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                </div>
              )}
              {anno.type === "stamp" && (
                <div className="px-3 py-1 rounded-xl bg-red-500/90 text-white font-extrabold text-[11px] tracking-wider uppercase border-2 border-white shadow-xl rotate-[-6deg] flex items-center gap-1">
                  <span>{anno.text}</span>
                  <Trash2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom Quick Status Footer ── */}
      <div className="px-4 py-2 border-t border-border bg-secondary/20 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2 font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Interactive PDF Engine Active {annotations.length > 0 && `(${annotations.length} edits)`}</span>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {annotations.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setAnnotations([])}
                className="text-destructive hover:underline font-medium"
              >
                Clear All Edits
              </button>
              <button
                type="button"
                onClick={handleDownloadAnnotated}
                className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                <span>Save Annotated PDF</span>
              </button>
              <span className="text-border">|</span>
            </>
          )}
          <button
            type="button"
            onClick={handleExportShare}
            className="text-primary font-bold hover:underline flex items-center gap-1"
          >
            <Share2 className="w-3 h-3" />
            <span>Export & Share</span>
          </button>
          <span className="text-border">|</span>
          <button
            type="button"
            onClick={() => setFitMode(fitMode === "width" ? "auto" : "width")}
            className="hover:text-foreground transition-colors font-medium"
          >
            Fit {fitMode === "width" ? "Normal" : "Width"}
          </button>
          <span className="text-border">|</span>
          <a
            href={url}
            download={fileName}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium"
          >
            <Download className="w-3 h-3" />
            <span>Original</span>
          </a>
        </div>
      </div>

      {/* Export & Multi-App Share Dialog */}
      <ExportShareModal
        isOpen={isExportShareOpen}
        onClose={() => setIsExportShareOpen(false)}
        fileName={annotations.length > 0 ? `${fileName.replace(/\.pdf$/i, "")}_reviewed.pdf` : fileName}
        fileSize={fileSize}
        mimeType="application/pdf"
        shareUrl={shareUrl || (typeof window !== "undefined" ? window.location.href : url)}
        downloadUrl={url}
        fileBlob={exportBlob}
      />
    </div>
  );
}
