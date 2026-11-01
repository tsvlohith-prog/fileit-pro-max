import React, { useState, useEffect, useRef } from "react";
import JSZip from "jszip";
import { jsPDF } from "jspdf";
import {
  Presentation,
  ChevronLeft,
  ChevronRight,
  Grid,
  Layout as LayoutIcon,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  FileText,
  Download,
  Image as ImageIcon,
  Sparkles,
  AlertCircle,
  FileDown,
  Layers,
  ZoomIn,
  RefreshCw,
  Share2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export interface PptxSlide {
  slideNumber: number;
  title: string;
  subtitles?: string[];
  paragraphs: string[];
  tables?: string[][][];
  images?: string[]; // Object URLs of embedded images
  notes?: string;
  rawText?: string;
  imageDataUrl?: string; // Rendered 16:9 canvas preview
}

export function PptxPreview({
  url,
  fileName = "Presentation.pptx",
  className = "",
  onInterchange,
}: {
  url: string;
  fileName?: string;
  className?: string;
  onInterchange?: (fileData: { name: string; text?: string; slides?: PptxSlide[] }) => void;
}) {
  const { toast } = useToast();
  const [slides, setSlides] = useState<PptxSlide[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"deck" | "gallery" | "outline">("deck");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedGallerySlide, setSelectedGallerySlide] = useState<number | null>(null);

  // Hidden canvas reference for high-res slide image rendering
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Helper to render a slide onto an HTML5 Canvas and get a data URL
  const renderSlideToCanvas = (slide: PptxSlide, width = 1280, height = 720): string => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    // 1. Background Gradient (Sleek Slate / Dark Indigo Theme)
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#0f172a");
    bgGrad.addColorStop(0.5, "#1e293b");
    bgGrad.addColorStop(1, "#090d16");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Decorative geometric accents
    ctx.save();
    ctx.strokeStyle = "rgba(249, 115, 22, 0.15)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(width - 80, 80, 160, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(249, 115, 22, 0.08)";
    ctx.beginPath();
    ctx.arc(width - 80, 80, 100, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Subtle header bar
    ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
    ctx.fillRect(40, 40, width - 80, 60);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.strokeRect(40, 40, width - 80, 60);

    // Header Badge: SLIDE X
    ctx.fillStyle = "#f97316";
    ctx.font = "bold 18px 'Inter', sans-serif";
    ctx.fillText(`SLIDE ${slide.slideNumber}`, 64, 78);

    // File name watermark
    ctx.fillStyle = "rgba(148, 163, 184, 0.7)";
    ctx.font = "14px 'Inter', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(fileName, width - 64, 76);
    ctx.textAlign = "left";

    // 2. Slide Title
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 38px 'Inter', sans-serif";
    const titleLines = wrapText(ctx, slide.title || `Slide ${slide.slideNumber}`, width - 140);
    let currentY = 160;
    for (let i = 0; i < Math.min(titleLines.length, 2); i++) {
      ctx.fillText(titleLines[i], 64, currentY);
      currentY += 46;
    }

    // Divider under title
    ctx.fillStyle = "#f97316";
    ctx.fillRect(64, currentY + 4, 120, 4);
    currentY += 40;

    // 3. Bullet points / Paragraphs
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "20px 'Inter', sans-serif";

    if (slide.paragraphs.length > 0) {
      const maxParagraphs = Math.min(slide.paragraphs.length, 6);
      for (let pIdx = 0; pIdx < maxParagraphs; pIdx++) {
        if (currentY > height - 100) break;
        const text = slide.paragraphs[pIdx];

        // Bullet indicator dot
        ctx.fillStyle = "#f97316";
        ctx.beginPath();
        ctx.arc(74, currentY - 7, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#e2e8f0";
        const wrapped = wrapText(ctx, text, width - 180);
        for (let w = 0; w < Math.min(wrapped.length, 2); w++) {
          ctx.fillText(wrapped[w], 94, currentY);
          currentY += 30;
        }
        currentY += 12;
      }
    } else if (slide.tables && slide.tables.length > 0) {
      // Simple table preview
      ctx.fillStyle = "#cbd5e1";
      ctx.font = "16px monospace";
      const table = slide.tables[0];
      for (let r = 0; r < Math.min(table.length, 5); r++) {
        const rowText = table[r].join("  |  ");
        ctx.fillText(rowText, 64, currentY);
        currentY += 28;
      }
    }

    // 4. Footer info
    ctx.fillStyle = "rgba(148, 163, 184, 0.6)";
    ctx.font = "14px 'Inter', sans-serif";
    ctx.fillText("FileIt Presentation Gallery", 64, height - 36);

    ctx.textAlign = "right";
    ctx.fillText(`${slide.slideNumber}`, width - 64, height - 36);

    return canvas.toDataURL("image/png");
  };

  // Text wrapper helper for canvas
  function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = words[0] || "";

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = ctx.measureText(currentLine + " " + word).width;
      if (width < maxWidth) {
        currentLine += " " + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  }

  // Load and parse PPTX archive
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function loadPptx() {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to download presentation: HTTP ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);

        // Find slides
        const slideFiles: { name: string; num: number; zipEntry: JSZip.JSZipObject }[] = [];
        zip.forEach((relativePath, zipEntry) => {
          const match = relativePath.match(/^ppt\/slides\/slide(\d+)\.xml$/i);
          if (match) {
            slideFiles.push({
              name: relativePath,
              num: parseInt(match[1], 10),
              zipEntry,
            });
          }
        });

        if (slideFiles.length === 0) {
          throw new Error("No PowerPoint XML slides found in this presentation file.");
        }

        slideFiles.sort((a, b) => a.num - b.num);

        const parser = new DOMParser();
        const extractedSlides: PptxSlide[] = [];

        for (let i = 0; i < slideFiles.length; i++) {
          const item = slideFiles[i];
          const xmlContent = await item.zipEntry.async("string");
          const xmlDoc = parser.parseFromString(xmlContent, "application/xml");

          // Extract text
          const shapeElements = xmlDoc.getElementsByTagName("p:sp");
          let slideTitle = "";
          const paragraphs: string[] = [];
          const tables: string[][][] = [];

          for (let s = 0; s < shapeElements.length; s++) {
            const shape = shapeElements[s];
            const pElements = shape.getElementsByTagName("a:p");

            for (let p = 0; p < pElements.length; p++) {
              const pElem = pElements[p];
              const tElements = pElem.getElementsByTagName("a:t");
              let pText = "";
              for (let t = 0; t < tElements.length; t++) {
                pText += tElements[t].textContent || "";
              }
              const trimmed = pText.trim();
              if (trimmed) {
                const ph = shape.getElementsByTagName("p:ph")[0];
                const phType = ph ? ph.getAttribute("type") : null;

                if (!slideTitle && (phType === "title" || phType === "ctrTitle" || paragraphs.length === 0)) {
                  slideTitle = trimmed;
                } else {
                  paragraphs.push(trimmed);
                }
              }
            }
          }

          // Tables
          const tableElements = xmlDoc.getElementsByTagName("a:tbl");
          for (let t = 0; t < tableElements.length; t++) {
            const tbl = tableElements[t];
            const rows: string[][] = [];
            const rowElements = tbl.getElementsByTagName("a:tr");
            for (let r = 0; r < rowElements.length; r++) {
              const rowElem = rowElements[r];
              const cells: string[] = [];
              const cellElements = rowElem.getElementsByTagName("a:tc");
              for (let c = 0; c < cellElements.length; c++) {
                const cellElem = cellElements[c];
                const tElements = cellElem.getElementsByTagName("a:t");
                let cellText = "";
                for (let ct = 0; ct < tElements.length; ct++) {
                  cellText += tElements[ct].textContent || "";
                }
                cells.push(cellText.trim());
              }
              if (cells.length > 0) rows.push(cells);
            }
            if (rows.length > 0) tables.push(rows);
          }

          // Speaker Notes
          let notesText = "";
          const notesEntry = zip.file(`ppt/notesSlides/notesSlide${item.num}.xml`);
          if (notesEntry) {
            try {
              const notesXml = await notesEntry.async("string");
              const notesDoc = parser.parseFromString(notesXml, "application/xml");
              const notesTElems = notesDoc.getElementsByTagName("a:t");
              const nTexts: string[] = [];
              for (let nt = 0; nt < notesTElems.length; nt++) {
                const nTxt = notesTElems[nt].textContent?.trim();
                if (nTxt && !nTxt.match(/^\d+$/)) nTexts.push(nTxt);
              }
              notesText = nTexts.join(" ");
            } catch {
              // Ignore notes parse errors
            }
          }

          if (!slideTitle && paragraphs.length > 0) {
            slideTitle = paragraphs.shift() || `Slide ${i + 1}`;
          } else if (!slideTitle) {
            slideTitle = `Slide ${i + 1}`;
          }

          const currentSlideObj: PptxSlide = {
            slideNumber: i + 1,
            title: slideTitle,
            paragraphs,
            tables: tables.length > 0 ? tables : undefined,
            notes: notesText || undefined,
            rawText: [slideTitle, ...paragraphs].join("\n"),
          };

          // Render canvas image preview
          currentSlideObj.imageDataUrl = renderSlideToCanvas(currentSlideObj);
          extractedSlides.push(currentSlideObj);
        }

        if (!cancelled) {
          setSlides(extractedSlides);
          setLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "Failed to load PowerPoint preview.");
          setLoading(false);
        }
      }
    }

    loadPptx();
    return () => {
      cancelled = true;
    };
  }, [url]);

  // Keyboard Navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (viewMode !== "deck") return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === "Space") {
        if (e.key === "Space" && (e.target as HTMLElement)?.tagName === "BUTTON") return;
        setCurrentSlideIndex((prev) => Math.min(prev + 1, slides.length - 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        setCurrentSlideIndex((prev) => Math.max(prev - 1, 0));
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [slides.length, viewMode]);

  const handleCopySlideText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download Single Slide as PNG image
  const handleDownloadSlideImage = (slide: PptxSlide) => {
    if (!slide.imageDataUrl) return;
    const a = document.createElement("a");
    a.href = slide.imageDataUrl;
    a.download = `${fileName.replace(/\.[^/.]+$/, "")}_Slide_${slide.slideNumber}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast({
      title: "Slide Image Saved",
      description: `Downloaded Slide ${slide.slideNumber} as high-res PNG image.`,
    });
  };

  // Download All Slides as ZIP of PNG images
  const handleDownloadAllImagesZip = async () => {
    if (slides.length === 0) return;
    setIsExporting(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder("slides_gallery") || zip;

      slides.forEach((slide) => {
        if (slide.imageDataUrl) {
          const base64Data = slide.imageDataUrl.replace(/^data:image\/png;base64,/, "");
          folder.file(`Slide_${String(slide.slideNumber).padStart(2, "0")}_${slide.title.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 20)}.png`, base64Data, { base64: true });
        }
      });

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(zipBlob);
      a.download = `${fileName.replace(/\.[^/.]+$/, "")}_Slide_Gallery_PNG.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      toast({
        title: "Slide Gallery Downloaded",
        description: `Exported ${slides.length} slides as an image archive (.zip).`,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: err.message || "Could not package slide gallery.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Export Presentation to PDF
  const handleExportToPdf = async () => {
    if (slides.length === 0) return;
    setIsExporting(true);
    try {
      // Create landscape 16:9 PDF
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: [960, 540], // 16:9 ratio
      });

      slides.forEach((slide, idx) => {
        if (idx > 0) doc.addPage([960, 540], "landscape");
        if (slide.imageDataUrl) {
          doc.addImage(slide.imageDataUrl, "PNG", 0, 0, 960, 540);
        }
      });

      doc.save(`${fileName.replace(/\.[^/.]+$/, "")}.pdf`);

      toast({
        title: "PDF Presentation Exported",
        description: `Converted ${slides.length} slides into a PDF document.`,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "PDF Export Failed",
        description: err.message || "Failed to generate PDF.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Export Presentation to Markdown Outline
  const handleExportToMarkdown = () => {
    if (slides.length === 0) return;
    let md = `# ${fileName}\n\n*Converted from PowerPoint Presentation (${slides.length} slides)*\n\n---\n\n`;

    slides.forEach((s) => {
      md += `## Slide ${s.slideNumber}: ${s.title}\n\n`;
      if (s.paragraphs && s.paragraphs.length > 0) {
        s.paragraphs.forEach((p) => {
          md += `- ${p}\n`;
        });
        md += "\n";
      }
      if (s.tables && s.tables.length > 0) {
        s.tables.forEach((t) => {
          t.forEach((row) => {
            md += `| ${row.join(" | ")} |\n`;
          });
          md += "\n";
        });
      }
      if (s.notes) {
        md += `> **Speaker Notes:** ${s.notes}\n\n`;
      }
      md += "---\n\n";
    });

    const blob = new Blob([md], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${fileName.replace(/\.[^/.]+$/, "")}_Outline.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    toast({
      title: "Markdown Outline Exported",
      description: "Saved structured presentation outline.",
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-card rounded-2xl border border-border text-center gap-4 min-h-[340px]">
        <div className="w-14 h-14 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center animate-pulse border border-orange-500/20">
          <Presentation className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <p className="font-bold text-foreground text-base">Rendering PowerPoint Presentation…</p>
          <p className="text-xs text-muted-foreground">Extracting slides, outlines & rendering high-res preview gallery</p>
        </div>
      </div>
    );
  }

  if (error || slides.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-card rounded-2xl border border-border text-center gap-3 min-h-[250px]">
        <AlertCircle className="w-10 h-10 text-destructive/80" />
        <h4 className="font-semibold text-foreground">PowerPoint Preview Unavailable</h4>
        <p className="text-xs text-muted-foreground max-w-md">
          {error || "Could not parse presentation slides. You can download the file to view in Microsoft PowerPoint or Keynote."}
        </p>
      </div>
    );
  }

  const currentSlide = slides[currentSlideIndex] || slides[0];

  return (
    <div
      className={`bg-card rounded-2xl border border-border overflow-hidden flex flex-col shadow-xs ${
        isFullscreen ? "fixed inset-0 z-50 rounded-none bg-background h-screen" : "w-full"
      } ${className}`}
    >
      {/* Top Presentation Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/40 gap-2 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-orange-500/15 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0 border border-orange-500/20 shadow-xs">
            <Presentation className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground truncate block max-w-[180px] sm:max-w-xs md:max-w-sm">
                {fileName}
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                PPTX
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground">
              {slides.length} {slides.length === 1 ? "Slide" : "Slides"} • Lightweight Viewer & Gallery
            </span>
          </div>
        </div>

        {/* View Modes & Export Toolbar */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          {/* Mode Switcher */}
          <div className="flex items-center bg-background rounded-xl border border-border p-0.5 shadow-xs">
            <button
              type="button"
              onClick={() => setViewMode("deck")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === "deck"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Interactive Slide Deck"
            >
              <LayoutIcon className="w-3.5 h-3.5" />
              <span>Deck</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("gallery")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === "gallery"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Image Preview Gallery"
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Gallery</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("outline")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === "outline"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Text Outline View"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Outline</span>
            </button>
          </div>

          {/* Quick Action: Download Image / PDF */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownloadSlideImage(currentSlide)}
            className="h-8 text-xs font-semibold rounded-xl px-2.5 gap-1.5 hidden sm:flex"
            title="Download active slide as PNG image"
          >
            <ImageIcon className="w-3.5 h-3.5 text-orange-500" />
            <span>Slide PNG</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportToPdf}
            disabled={isExporting}
            className="h-8 text-xs font-semibold rounded-xl px-2.5 gap-1.5"
            title="Convert PPTX to PDF document"
          >
            <FileDown className="w-3.5 h-3.5 text-red-500" />
            <span className="hidden md:inline">To PDF</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="h-8 w-8 p-0 rounded-xl"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Presentation"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* VIEW 1: INTERACTIVE DECK MODE */}
      {viewMode === "deck" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Main Stage */}
          <div className="flex-1 p-4 sm:p-6 md:p-8 flex items-center justify-center bg-slate-950/20 dark:bg-black/40 overflow-auto min-h-[380px] md:min-h-[460px]">
            <div className="w-full max-w-4xl aspect-[16/9] bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 text-white border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 md:p-12 flex flex-col justify-between relative overflow-hidden transition-all select-text">
              {/* Visual accents */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

              {/* Slide Content Header */}
              <div className="space-y-4 relative z-10 overflow-auto">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-bold border border-orange-500/30">
                      SLIDE {currentSlide.slideNumber} OF {slides.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleCopySlideText(currentSlide.rawText || "")}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1 bg-white/5 hover:bg-white/10 px-2 py-1 rounded-lg transition-colors"
                      title="Copy Slide Text"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span className="text-[11px]">{copied ? "Copied" : "Copy"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadSlideImage(currentSlide)}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1 bg-white/5 hover:bg-white/10 px-2 py-1 rounded-lg transition-colors"
                      title="Save Slide as Image"
                    >
                      <Download className="w-3 h-3" />
                      <span className="text-[11px]">Save Image</span>
                    </button>
                  </div>
                </div>

                {/* Slide Title */}
                <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
                  {currentSlide.title}
                </h2>

                {/* Paragraphs and points */}
                {currentSlide.paragraphs.length > 0 && (
                  <div className="space-y-3 pt-2">
                    {currentSlide.paragraphs.map((p, pIdx) => (
                      <div key={pIdx} className="flex items-start gap-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-orange-500 mt-2 shrink-0 shadow-sm shadow-orange-500/50" />
                        <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-normal">{p}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tables if present */}
                {currentSlide.tables && currentSlide.tables.map((table, tIdx) => (
                  <div key={tIdx} className="overflow-x-auto my-3 border border-white/15 rounded-xl bg-white/5 backdrop-blur-sm">
                    <table className="w-full text-xs text-left">
                      <tbody>
                        {table.map((row, rIdx) => (
                          <tr key={rIdx} className="border-b border-white/10 last:border-0">
                            {row.map((cell, cIdx) => (
                              <td key={cIdx} className="p-2.5 border-r border-white/10 last:border-0 font-medium text-slate-200">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}

                {/* Speaker Notes */}
                {currentSlide.notes && (
                  <div className="mt-4 p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-xs text-slate-300">
                    <span className="font-bold text-orange-400 mr-1.5 uppercase tracking-wide text-[10px]">Speaker Notes:</span>
                    {currentSlide.notes}
                  </div>
                )}
              </div>

              {/* Slide Stage Footer */}
              <div className="flex items-center justify-between text-xs text-slate-400 pt-4 border-t border-white/10 mt-6 relative z-10">
                <span className="truncate max-w-xs">{fileName}</span>
                <span className="font-mono font-semibold text-slate-300">
                  {currentSlideIndex + 1} / {slides.length}
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Deck Navigation & Thumbnails */}
          <div className="p-3 bg-secondary/30 border-t border-border flex items-center justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={currentSlideIndex === 0}
              onClick={() => setCurrentSlideIndex((prev) => Math.max(prev - 1, 0))}
              className="rounded-xl h-8 px-3 gap-1.5 font-bold"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Previous</span>
            </Button>

            {/* Thumbnail Strip */}
            <div className="flex items-center gap-2 overflow-x-auto py-1 px-2 max-w-[65vw]">
              {slides.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentSlideIndex(idx)}
                  className={`w-16 sm:w-24 aspect-[16/9] rounded-lg border text-left p-1 shrink-0 flex flex-col justify-between transition-all cursor-pointer relative overflow-hidden group ${
                    currentSlideIndex === idx
                      ? "border-orange-500 bg-orange-500/15 ring-2 ring-orange-500/40 font-bold"
                      : "border-border bg-card hover:bg-secondary/80 opacity-75 hover:opacity-100"
                  }`}
                >
                  {s.imageDataUrl ? (
                    <img src={s.imageDataUrl} alt={`Slide ${s.slideNumber}`} className="w-full h-full object-cover rounded" />
                  ) : (
                    <>
                      <span className="text-[9px] font-mono text-muted-foreground block truncate">#{s.slideNumber}</span>
                      <span className="text-[9px] text-foreground truncate block leading-tight">{s.title}</span>
                    </>
                  )}
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              disabled={currentSlideIndex === slides.length - 1}
              onClick={() => setCurrentSlideIndex((prev) => Math.min(prev + 1, slides.length - 1))}
              className="rounded-xl h-8 px-3 gap-1.5 font-bold"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* VIEW 2: PREVIEW GALLERY OF SLIDE IMAGES */}
      {viewMode === "gallery" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Gallery Toolbar */}
          <div className="px-5 py-3 bg-secondary/20 border-b border-border flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground">Slide Image Gallery</span>
              <span className="text-xs text-muted-foreground">({slides.length} Rendered Slides)</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleDownloadAllImagesZip}
                disabled={isExporting}
                className="h-8 text-xs font-bold rounded-xl gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-primary" />
                <span>Download All Images (ZIP)</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportToPdf}
                disabled={isExporting}
                className="h-8 text-xs font-bold rounded-xl gap-1.5"
              >
                <FileDown className="w-3.5 h-3.5 text-red-500" />
                <span>Export PDF</span>
              </Button>
            </div>
          </div>

          {/* Gallery Grid */}
          <div className="p-4 sm:p-6 overflow-auto max-h-[70vh] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-muted/20">
            {slides.map((s, idx) => (
              <div
                key={idx}
                className="bg-card border border-border rounded-2xl overflow-hidden hover:border-orange-500/80 hover:shadow-lg transition-all group flex flex-col justify-between"
              >
                {/* Slide Card Image */}
                <div
                  className="aspect-[16/9] relative bg-slate-900 overflow-hidden cursor-pointer"
                  onClick={() => setSelectedGallerySlide(idx)}
                >
                  {s.imageDataUrl ? (
                    <img
                      src={s.imageDataUrl}
                      alt={`Slide ${s.slideNumber}: ${s.title}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">
                      No Image Preview
                    </div>
                  )}

                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 text-xs font-bold rounded-lg gap-1 shadow-md"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedGallerySlide(idx);
                      }}
                    >
                      <ZoomIn className="w-3.5 h-3.5" /> Zoom
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 text-xs font-bold rounded-lg gap-1 shadow-md bg-orange-600 hover:bg-orange-700 text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentSlideIndex(idx);
                        setViewMode("deck");
                      }}
                    >
                      <LayoutIcon className="w-3.5 h-3.5" /> Deck
                    </Button>
                  </div>

                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-white text-[10px] font-mono font-bold">
                    #{s.slideNumber}
                  </span>
                </div>

                {/* Card Meta & Actions */}
                <div className="p-3.5 flex items-center justify-between gap-2 border-t border-border bg-card">
                  <div className="min-w-0">
                    <h4 className="font-bold text-xs text-foreground truncate">{s.title}</h4>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {s.paragraphs.length} items {s.tables ? "• Table" : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDownloadSlideImage(s)}
                    className="h-7 w-7 p-0 rounded-lg shrink-0"
                    title="Download Slide PNG"
                  >
                    <Download className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 3: OUTLINE & TEXT SUMMARY */}
      {viewMode === "outline" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="px-5 py-3 bg-secondary/20 border-b border-border flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground">Structured Presentation Outline</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportToMarkdown}
                className="h-8 text-xs font-bold rounded-xl gap-1.5"
              >
                <FileText className="w-3.5 h-3.5 text-primary" />
                <span>Export as Markdown (.md)</span>
              </Button>
            </div>
          </div>

          <div className="p-6 overflow-auto max-h-[70vh] space-y-6 bg-card divide-y divide-border">
            {slides.map((s, idx) => (
              <div key={idx} className="pt-5 first:pt-0 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                      Slide {s.slideNumber}
                    </span>
                    <h3 className="font-extrabold text-base text-foreground">{s.title}</h3>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopySlideText(s.rawText || "")}
                      className="h-7 text-xs rounded-lg px-2.5"
                    >
                      <Copy className="w-3 h-3 mr-1" /> Copy
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCurrentSlideIndex(idx);
                        setViewMode("deck");
                      }}
                      className="h-7 text-xs rounded-lg px-2.5"
                    >
                      View in Deck →
                    </Button>
                  </div>
                </div>

                {s.paragraphs.length > 0 && (
                  <ul className="list-disc list-inside space-y-1.5 pl-2 text-sm text-muted-foreground">
                    {s.paragraphs.map((p, pIdx) => (
                      <li key={pIdx} className="leading-relaxed">
                        <span className="text-foreground">{p}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {s.tables && s.tables.map((tbl, tIdx) => (
                  <div key={tIdx} className="my-2 border rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <tbody>
                        {tbl.map((r, rI) => (
                          <tr key={rI} className="border-b last:border-0 bg-muted/20">
                            {r.map((c, cI) => (
                              <td key={cI} className="p-2 border-r last:border-0 font-medium">
                                {c}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}

                {s.notes && (
                  <p className="text-xs text-muted-foreground italic pl-3 border-l-2 border-orange-500/50">
                    <span className="font-semibold not-italic text-foreground">Speaker Notes: </span>
                    {s.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox Modal for Gallery Slide Zoom */}
      {selectedGallerySlide !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8"
          onClick={() => setSelectedGallerySlide(null)}
        >
          <div
            className="max-w-5xl w-full bg-card border border-border rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-secondary/40">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">
                  Slide {slides[selectedGallerySlide].slideNumber}: {slides[selectedGallerySlide].title}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDownloadSlideImage(slides[selectedGallerySlide])}
                  className="h-8 text-xs font-bold gap-1 rounded-xl"
                >
                  <Download className="w-3.5 h-3.5" /> Save PNG
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedGallerySlide(null)}
                  className="h-8 w-8 p-0 rounded-xl"
                >
                  ✕
                </Button>
              </div>
            </div>

            <div className="p-4 sm:p-6 bg-slate-950 flex items-center justify-center">
              {slides[selectedGallerySlide].imageDataUrl && (
                <img
                  src={slides[selectedGallerySlide].imageDataUrl}
                  alt={`Slide ${slides[selectedGallerySlide].slideNumber}`}
                  className="max-h-[70vh] w-auto object-contain rounded-xl shadow-2xl"
                />
              )}
            </div>

            <div className="p-4 border-t border-border flex items-center justify-between bg-card">
              <Button
                size="sm"
                variant="outline"
                disabled={selectedGallerySlide === 0}
                onClick={() => setSelectedGallerySlide((prev) => Math.max((prev || 0) - 1, 0))}
                className="rounded-xl h-8"
              >
                ← Previous
              </Button>
              <span className="text-xs text-muted-foreground font-mono">
                {selectedGallerySlide + 1} of {slides.length}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={selectedGallerySlide === slides.length - 1}
                onClick={() => setSelectedGallerySlide((prev) => Math.min((prev || 0) + 1, slides.length - 1))}
                className="rounded-xl h-8"
              >
                Next →
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
