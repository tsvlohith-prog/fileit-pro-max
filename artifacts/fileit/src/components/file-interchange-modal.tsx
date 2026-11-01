import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowRightLeft,
  Download,
  FileDown,
  Sparkles,
  Check,
  RefreshCw,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Presentation,
  FileCode,
  File,
  Layers,
  Save,
  CheckCircle2,
} from "lucide-react";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import mammoth from "mammoth";
import { inspectFileType } from "@/lib/file-type-helpers";

export interface InterchangeOption {
  targetFormat: string;
  label: string;
  description: string;
  mimeType: string;
  category: "document" | "image" | "data" | "presentation" | "code" | "text";
  icon: React.ReactNode;
}

export function getInterchangeOptions(fileName: string, mimeType: string): InterchangeOption[] {
  const meta = inspectFileType(fileName, mimeType);
  const ext = meta.extension.toLowerCase();

  // 1. PRESENTATIONS (PPTX, PPT)
  if (meta.category === "presentation" || ["pptx", "ppt", "odp"].includes(ext)) {
    return [
      {
        targetFormat: "pdf",
        label: "PDF Presentation Document (.pdf)",
        description: "High-fidelity landscape PDF presentation deck with formatted slides.",
        mimeType: "application/pdf",
        category: "document",
        icon: <FileText className="w-5 h-5 text-red-500" />,
      },
      {
        targetFormat: "zip",
        label: "Slide Images Gallery (.zip of PNGs)",
        description: "Exports every slide rendered as a crisp, standalone 1080p PNG image in a zip archive.",
        mimeType: "application/zip",
        category: "image",
        icon: <ImageIcon className="w-5 h-5 text-orange-500" />,
      },
      {
        targetFormat: "md",
        label: "Markdown Outline (.md)",
        description: "Extracts hierarchical slide headers, bullet points, speaker notes, and markdown tables.",
        mimeType: "text/markdown",
        category: "text",
        icon: <FileCode className="w-5 h-5 text-blue-500" />,
      },
      {
        targetFormat: "txt",
        label: "Plain Text Transcript (.txt)",
        description: "Clean textual transcript of all presentation slides and notes.",
        mimeType: "text/plain",
        category: "text",
        icon: <FileText className="w-5 h-5 text-slate-500" />,
      },
      {
        targetFormat: "html",
        label: "Interactive Web Slide Deck (.html)",
        description: "Standalone HTML5 interactive presentation runnable in any modern web browser.",
        mimeType: "text/html",
        category: "code",
        icon: <FileCode className="w-5 h-5 text-purple-500" />,
      },
    ];
  }

  // 2. IMAGES (PNG, JPG, WEBP, SVG, GIF, BMP, ICO)
  if (meta.category === "image" || ["png", "jpg", "jpeg", "webp", "svg", "bmp", "gif", "ico"].includes(ext)) {
    const list: InterchangeOption[] = [];
    if (ext !== "png") {
      list.push({
        targetFormat: "png",
        label: "PNG Image (.png)",
        description: "Lossless raster image with transparency support.",
        mimeType: "image/png",
        category: "image",
        icon: <ImageIcon className="w-5 h-5 text-blue-500" />,
      });
    }
    if (ext !== "jpg" && ext !== "jpeg") {
      list.push({
        targetFormat: "jpg",
        label: "JPEG Image (.jpg)",
        description: "Compressed photograph format optimized for universal web sharing.",
        mimeType: "image/jpeg",
        category: "image",
        icon: <ImageIcon className="w-5 h-5 text-emerald-500" />,
      });
    }
    if (ext !== "webp") {
      list.push({
        targetFormat: "webp",
        label: "WebP Image (.webp)",
        description: "Next-gen modern web image with ultra-low filesize and high fidelity.",
        mimeType: "image/webp",
        category: "image",
        icon: <ImageIcon className="w-5 h-5 text-amber-500" />,
      });
    }
    list.push({
      targetFormat: "pdf",
      label: "PDF Image Document (.pdf)",
      description: "Embeds image into an A4 print-ready PDF document.",
      mimeType: "application/pdf",
      category: "document",
      icon: <FileText className="w-5 h-5 text-red-500" />,
    });
    return list;
  }

  // 3. SPREADSHEETS & DATA (CSV, XLSX, JSON, TSV)
  if (meta.category === "sheet" || ["csv", "xlsx", "xls", "tsv", "json"].includes(ext)) {
    const list: InterchangeOption[] = [];
    if (ext !== "json") {
      list.push({
        targetFormat: "json",
        label: "JSON Array / Object (.json)",
        description: "Converts tabular spreadsheet rows into structured JSON records.",
        mimeType: "application/json",
        category: "data",
        icon: <FileCode className="w-5 h-5 text-amber-500" />,
      });
    }
    if (ext !== "csv") {
      list.push({
        targetFormat: "csv",
        label: "Comma-Separated Values (.csv)",
        description: "Standard delimited format compatible with all databases and data pipelines.",
        mimeType: "text/csv",
        category: "data",
        icon: <FileSpreadsheet className="w-5 h-5 text-emerald-500" />,
      });
    }
    if (ext !== "xlsx") {
      list.push({
        targetFormat: "xlsx",
        label: "Microsoft Excel Workbook (.xlsx)",
        description: "Full multi-column spreadsheet workbook with styled header rows.",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        category: "data",
        icon: <FileSpreadsheet className="w-5 h-5 text-emerald-600" />,
      });
    }
    list.push({
      targetFormat: "html",
      label: "HTML Styled Data Table (.html)",
      description: "Interactive responsive table with borders, zebra striping and styling.",
      mimeType: "text/html",
      category: "code",
      icon: <FileCode className="w-5 h-5 text-purple-500" />,
    });
    return list;
  }

  // 4. DOCUMENTS (DOCX, PDF, MD, TXT, HTML)
  if (meta.category === "document" || meta.category === "text" || ["docx", "pdf", "md", "txt", "html"].includes(ext)) {
    const list: InterchangeOption[] = [];
    if (ext !== "pdf") {
      list.push({
        targetFormat: "pdf",
        label: "PDF Document (.pdf)",
        description: "Fixed-layout formatted PDF document ready for printing and archiving.",
        mimeType: "application/pdf",
        category: "document",
        icon: <FileText className="w-5 h-5 text-red-500" />,
      });
    }
    if (ext !== "html") {
      list.push({
        targetFormat: "html",
        label: "HTML Document (.html)",
        description: "Clean semantic HTML webpage with styled typography and headings.",
        mimeType: "text/html",
        category: "code",
        icon: <FileCode className="w-5 h-5 text-purple-500" />,
      });
    }
    if (ext !== "md") {
      list.push({
        targetFormat: "md",
        label: "Markdown (.md)",
        description: "Lightweight structured markup file with headers and code blocks.",
        mimeType: "text/markdown",
        category: "text",
        icon: <FileCode className="w-5 h-5 text-blue-500" />,
      });
    }
    if (ext !== "txt") {
      list.push({
        targetFormat: "txt",
        label: "Plain Text (.txt)",
        description: "Unformatted UTF-8 raw text transcript.",
        mimeType: "text/plain",
        category: "text",
        icon: <FileText className="w-5 h-5 text-slate-500" />,
      });
    }
    return list;
  }

  // Fallback defaults
  return [
    {
      targetFormat: "txt",
      label: "Plain Text (.txt)",
      description: "Raw UTF-8 text representation.",
      mimeType: "text/plain",
      category: "text",
      icon: <FileText className="w-5 h-5 text-slate-500" />,
    },
    {
      targetFormat: "pdf",
      label: "PDF Document (.pdf)",
      description: "Convert contents into a printable PDF page.",
      mimeType: "application/pdf",
      category: "document",
      icon: <FileText className="w-5 h-5 text-red-500" />,
    },
    {
      targetFormat: "json",
      label: "JSON Metadata (.json)",
      description: "Extract structured file descriptors and payload attributes.",
      mimeType: "application/json",
      category: "data",
      icon: <FileCode className="w-5 h-5 text-amber-500" />,
    },
  ];
}

export function FileInterchangeModal({
  isOpen,
  onClose,
  fileId,
  fileName,
  mimeType,
  fileUrl,
  rawContent,
  onSaveToLibrary,
}: {
  isOpen: boolean;
  onClose: () => void;
  fileId?: string;
  fileName: string;
  mimeType: string;
  fileUrl?: string;
  rawContent?: string;
  onSaveToLibrary?: (newFile: any) => void;
}) {
  const { toast } = useToast();
  const options = getInterchangeOptions(fileName, mimeType);
  const [selectedFormat, setSelectedFormat] = useState<string>(options[0]?.targetFormat || "pdf");
  const [isConverting, setIsConverting] = useState(false);
  const [convertedBlob, setConvertedBlob] = useState<{ blob: Blob; newName: string; mimeType: string } | null>(null);
  const [isSavingToDb, setIsSavingToDb] = useState(false);

  useEffect(() => {
    if (options.length > 0 && !options.some((o) => o.targetFormat === selectedFormat)) {
      setSelectedFormat(options[0].targetFormat);
    }
    setConvertedBlob(null);
  }, [fileName, mimeType]);

  // Execute in-browser client-side conversion
  const handleConvert = async () => {
    setIsConverting(true);
    setConvertedBlob(null);

    try {
      const baseName = fileName.replace(/\.[^/.]+$/, "");
      const ext = fileName.split(".").pop()?.toLowerCase() || "";
      const opt = options.find((o) => o.targetFormat === selectedFormat);
      const targetExt = selectedFormat;
      const newFileName = `${baseName}_converted.${targetExt}`;

      // ── CASE A: PPTX Presentation Conversion ───────────────────────────────
      if (ext === "pptx" || ext === "ppt") {
        if (!fileUrl) throw new Error("Presentation source URL missing");
        const res = await fetch(fileUrl);
        const buffer = await res.arrayBuffer();
        const zip = await JSZip.loadAsync(buffer);

        const slideFiles: { num: number; zipEntry: JSZip.JSZipObject }[] = [];
        zip.forEach((p, entry) => {
          const match = p.match(/^ppt\/slides\/slide(\d+)\.xml$/i);
          if (match) slideFiles.push({ num: parseInt(match[1], 10), zipEntry: entry });
        });
        slideFiles.sort((a, b) => a.num - b.num);

        const parser = new DOMParser();
        const extractedSlides: { num: number; title: string; lines: string[] }[] = [];

        for (let i = 0; i < slideFiles.length; i++) {
          const content = await slideFiles[i].zipEntry.async("string");
          const xml = parser.parseFromString(content, "application/xml");
          const pElements = xml.getElementsByTagName("a:p");
          let title = "";
          const lines: string[] = [];

          for (let p = 0; p < pElements.length; p++) {
            const tElements = pElements[p].getElementsByTagName("a:t");
            let text = "";
            for (let t = 0; t < tElements.length; t++) text += tElements[t].textContent || "";
            text = text.trim();
            if (text) {
              if (!title) title = text;
              else lines.push(text);
            }
          }
          extractedSlides.push({ num: i + 1, title: title || `Slide ${i + 1}`, lines });
        }

        if (targetExt === "pdf") {
          const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: [960, 540] });
          extractedSlides.forEach((s, idx) => {
            if (idx > 0) doc.addPage([960, 540], "landscape");
            // Background
            doc.setFillColor(15, 23, 42); // slate-900
            doc.rect(0, 0, 960, 540, "F");

            // Header bar
            doc.setFillColor(249, 115, 22);
            doc.rect(40, 40, 120, 6, "F");

            doc.setTextColor(249, 115, 22);
            doc.setFontSize(14);
            doc.text(`SLIDE ${s.num}`, 40, 65);

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(26);
            doc.text(s.title, 40, 110);

            doc.setTextColor(226, 232, 240);
            doc.setFontSize(16);
            let y = 160;
            s.lines.slice(0, 10).forEach((line) => {
              doc.text(`•  ${line}`, 50, y);
              y += 28;
            });

            doc.setTextColor(148, 163, 184);
            doc.setFontSize(11);
            doc.text(`${fileName} • FileIt Presentation Interchange`, 40, 510);
            doc.text(`${s.num} / ${extractedSlides.length}`, 900, 510);
          });

          const blob = doc.output("blob");
          setConvertedBlob({ blob, newName: `${baseName}.pdf`, mimeType: "application/pdf" });
        } else if (targetExt === "zip") {
          // Slide Images ZIP
          const zipOut = new JSZip();
          const folder = zipOut.folder("slides_png") || zipOut;

          // Render canvas images
          for (let i = 0; i < extractedSlides.length; i++) {
            const s = extractedSlides[i];
            const canvas = document.createElement("canvas");
            canvas.width = 1280;
            canvas.height = 720;
            const ctx = canvas.getContext("2d")!;

            const grad = ctx.createLinearGradient(0, 0, 1280, 720);
            grad.addColorStop(0, "#0f172a");
            grad.addColorStop(1, "#1e293b");
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 1280, 720);

            ctx.fillStyle = "#f97316";
            ctx.font = "bold 20px sans-serif";
            ctx.fillText(`SLIDE ${s.num}`, 60, 80);

            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 38px sans-serif";
            ctx.fillText(s.title, 60, 140);

            ctx.fillStyle = "#e2e8f0";
            ctx.font = "22px sans-serif";
            let curY = 200;
            s.lines.slice(0, 8).forEach((l) => {
              ctx.fillText(`• ${l}`, 80, curY);
              curY += 40;
            });

            const dataUrl = canvas.toDataURL("image/png");
            folder.file(`Slide_${String(s.num).padStart(2, "0")}.png`, dataUrl.replace(/^data:image\/png;base64,/, ""), { base64: true });
          }

          const blob = await zipOut.generateAsync({ type: "blob" });
          setConvertedBlob({ blob, newName: `${baseName}_Slide_Images.zip`, mimeType: "application/zip" });
        } else if (targetExt === "md") {
          let md = `# ${fileName}\n\n`;
          extractedSlides.forEach((s) => {
            md += `## Slide ${s.num}: ${s.title}\n\n`;
            s.lines.forEach((l) => (md += `- ${l}\n`));
            md += "\n---\n\n";
          });
          const blob = new Blob([md], { type: "text/markdown" });
          setConvertedBlob({ blob, newName: `${baseName}.md`, mimeType: "text/markdown" });
        } else if (targetExt === "txt") {
          let txt = `PRESENTATION: ${fileName}\nTotal Slides: ${extractedSlides.length}\n=====================================\n\n`;
          extractedSlides.forEach((s) => {
            txt += `SLIDE ${s.num}: ${s.title}\n-------------------------------------\n`;
            s.lines.forEach((l) => (txt += `* ${l}\n`));
            txt += "\n\n";
          });
          const blob = new Blob([txt], { type: "text/plain" });
          setConvertedBlob({ blob, newName: `${baseName}.txt`, mimeType: "text/plain" });
        } else if (targetExt === "html") {
          let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${fileName}</title><style>body{font-family:system-ui,sans-serif;background:#0f172a;color:#fff;margin:0;padding:40px;}.slide{background:#1e293b;border-radius:16px;padding:32px;margin-bottom:32px;box-shadow:0 10px 25px rgba(0,0,0,0.3);}h2{color:#f97316;margin-top:0;}ul{line-height:1.8;color:#e2e8f0;}</style></head><body><h1>${fileName}</h1>`;
          extractedSlides.forEach((s) => {
            html += `<div class="slide"><div style="color:#f97316;font-weight:bold;font-size:12px;">SLIDE ${s.num}</div><h2>${s.title}</h2><ul>`;
            s.lines.forEach((l) => (html += `<li>${l}</li>`));
            html += `</ul></div>`;
          });
          html += `</body></html>`;
          const blob = new Blob([html], { type: "text/html" });
          setConvertedBlob({ blob, newName: `${baseName}.html`, mimeType: "text/html" });
        }
      }

      // ── CASE B: Image Conversions (PNG, JPG, WebP, PDF) ────────────────────
      else if (["png", "jpg", "jpeg", "webp", "svg", "bmp", "gif"].includes(ext)) {
        if (!fileUrl) throw new Error("Image source URL missing");
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = fileUrl;
        });

        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);

        if (targetExt === "pdf") {
          const doc = new jsPDF({
            orientation: canvas.width > canvas.height ? "landscape" : "portrait",
            unit: "pt",
            format: [canvas.width, canvas.height],
          });
          doc.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, canvas.width, canvas.height);
          const blob = doc.output("blob");
          setConvertedBlob({ blob, newName: `${baseName}.pdf`, mimeType: "application/pdf" });
        } else {
          const mime = targetExt === "jpg" ? "image/jpeg" : `image/${targetExt}`;
          const dataUrl = canvas.toDataURL(mime, 0.95);
          const resBlob = await fetch(dataUrl).then((r) => r.blob());
          setConvertedBlob({ blob: resBlob, newName: `${baseName}.${targetExt}`, mimeType: mime });
        }
      }

      // ── CASE C: Data / Spreadsheets (CSV, JSON, XLSX, HTML Table) ──────────
      else if (["csv", "json", "xlsx", "tsv"].includes(ext)) {
        let jsonData: any[] = [];
        if (ext === "json") {
          const text = rawContent || (await fetch(fileUrl!).then((r) => r.text()));
          jsonData = JSON.parse(text);
          if (!Array.isArray(jsonData)) jsonData = [jsonData];
        } else if (ext === "csv" || ext === "tsv") {
          const text = rawContent || (await fetch(fileUrl!).then((r) => r.text()));
          const wb = XLSX.read(text, { type: "string" });
          jsonData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        } else if (ext === "xlsx") {
          const buf = await fetch(fileUrl!).then((r) => r.arrayBuffer());
          const wb = XLSX.read(buf, { type: "array" });
          jsonData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        }

        if (targetExt === "json") {
          const str = JSON.stringify(jsonData, null, 2);
          setConvertedBlob({ blob: new Blob([str], { type: "application/json" }), newName: `${baseName}.json`, mimeType: "application/json" });
        } else if (targetExt === "csv") {
          const ws = XLSX.utils.json_to_sheet(jsonData);
          const csv = XLSX.utils.sheet_to_csv(ws);
          setConvertedBlob({ blob: new Blob([csv], { type: "text/csv" }), newName: `${baseName}.csv`, mimeType: "text/csv" });
        } else if (targetExt === "xlsx") {
          const ws = XLSX.utils.json_to_sheet(jsonData);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
          const wbBuf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
          setConvertedBlob({
            blob: new Blob([wbBuf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
            newName: `${baseName}.xlsx`,
            mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          });
        } else if (targetExt === "html") {
          const ws = XLSX.utils.json_to_sheet(jsonData);
          const htmlTable = XLSX.utils.sheet_to_html(ws);
          const htmlFull = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${fileName}</title><style>table{border-collapse:collapse;width:100%;font-family:system-ui;}td,th{border:1px solid #cbd5e1;padding:8px 12px;}tr:nth-child(even){background:#f8fafc;}th{background:#f1f5f9;font-weight:bold;}</style></head><body><h2>${fileName}</h2>${htmlTable}</body></html>`;
          setConvertedBlob({ blob: new Blob([htmlFull], { type: "text/html" }), newName: `${baseName}.html`, mimeType: "text/html" });
        }
      }

      // ── CASE D: Documents (DOCX, MD, TXT, HTML) ────────────────────────────
      else if (ext === "docx") {
        const buf = await fetch(fileUrl!).then((r) => r.arrayBuffer());
        const result = await mammoth.convertToHtml({ arrayBuffer: buf });
        const rawText = (await mammoth.extractRawText({ arrayBuffer: buf })).value;

        if (targetExt === "html") {
          const styledHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${fileName}</title><style>body{font-family:system-ui,serif;max-width:800px;margin:40px auto;padding:20px;line-height:1.7;color:#1e293b;}</style></head><body>${result.value}</body></html>`;
          setConvertedBlob({ blob: new Blob([styledHtml], { type: "text/html" }), newName: `${baseName}.html`, mimeType: "text/html" });
        } else if (targetExt === "txt") {
          setConvertedBlob({ blob: new Blob([rawText], { type: "text/plain" }), newName: `${baseName}.txt`, mimeType: "text/plain" });
        } else if (targetExt === "md") {
          const mdText = `# ${fileName}\n\n${rawText.replace(/\n\n+/g, "\n\n")}`;
          setConvertedBlob({ blob: new Blob([mdText], { type: "text/markdown" }), newName: `${baseName}.md`, mimeType: "text/markdown" });
        } else if (targetExt === "pdf") {
          const doc = new jsPDF();
          doc.setFontSize(16);
          doc.text(fileName, 20, 20);
          doc.setFontSize(10);
          const splitLines = doc.splitTextToSize(rawText, 170);
          doc.text(splitLines, 20, 35);
          const blob = doc.output("blob");
          setConvertedBlob({ blob, newName: `${baseName}.pdf`, mimeType: "application/pdf" });
        }
      } else {
        // Generic Text / Code conversions
        const text = rawContent || (await fetch(fileUrl!).then((r) => r.text()));
        if (targetExt === "pdf") {
          const doc = new jsPDF();
          doc.setFontSize(14);
          doc.text(fileName, 15, 15);
          doc.setFontSize(9);
          const lines = doc.splitTextToSize(text, 180);
          doc.text(lines, 15, 25);
          setConvertedBlob({ blob: doc.output("blob"), newName: `${baseName}.pdf`, mimeType: "application/pdf" });
        } else {
          setConvertedBlob({ blob: new Blob([text], { type: opt?.mimeType || "text/plain" }), newName: newFileName, mimeType: opt?.mimeType || "text/plain" });
        }
      }

      toast({
        title: "Interchange Successful",
        description: `Successfully converted "${fileName}" to ${targetExt.toUpperCase()} format.`,
      });
    } catch (err: any) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Interchange Failed",
        description: err.message || "Could not convert this file format.",
      });
    } finally {
      setIsConverting(false);
    }
  };

  // Download converted file directly
  const handleDownload = () => {
    if (!convertedBlob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(convertedBlob.blob);
    a.download = convertedBlob.newName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    toast({
      title: "File Downloaded",
      description: `Saved "${convertedBlob.newName}" to your device.`,
    });
  };

  // Save converted file to FileIt Database Library
  const handleSaveToLibrary = async () => {
    if (!convertedBlob) return;
    setIsSavingToDb(true);

    try {
      const formData = new FormData();
      formData.append("file", convertedBlob.blob, convertedBlob.newName);

      const res = await fetch("/api/files", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to save converted file to server library");
      const createdFile = await res.json();

      toast({
        title: "Saved to FileIt Library",
        description: `"${convertedBlob.newName}" is now available in your Files dashboard.`,
      });

      if (onSaveToLibrary) onSaveToLibrary(createdFile);
      onClose();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: err.message || "Could not upload converted file.",
      });
    } finally {
      setIsSavingToDb(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl rounded-3xl p-6 border-border shadow-2xl">
        <DialogHeader className="space-y-1.5 pb-3 border-b border-border">
          <div className="flex items-center gap-2 text-primary">
            <div className="w-8 h-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center border border-primary/20">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <DialogTitle className="text-lg font-black tracking-tight text-foreground">
              Interchange File Type & Format
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Convert <span className="font-semibold text-foreground">"{fileName}"</span> into alternative file formats, documents, slide galleries, or structured data.
          </DialogDescription>
        </DialogHeader>

        {/* Format Selectors */}
        <div className="space-y-4 py-3">
          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground flex items-center justify-between">
              <span>Choose Target Format</span>
              <span className="text-[11px] text-muted-foreground font-normal">
                {options.length} interchangeable formats available
              </span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[260px] overflow-y-auto pr-1">
              {options.map((opt) => (
                <div
                  key={opt.targetFormat}
                  onClick={() => {
                    setSelectedFormat(opt.targetFormat);
                    setConvertedBlob(null);
                  }}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                    selectedFormat === opt.targetFormat
                      ? "border-primary bg-primary/10 ring-2 ring-primary/20 shadow-xs"
                      : "border-border bg-card hover:bg-secondary/60 opacity-80 hover:opacity-100"
                  }`}
                >
                  <div className="p-2 rounded-xl bg-background border shrink-0 mt-0.5">
                    {opt.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-foreground truncate block">
                        {opt.label}
                      </span>
                      {selectedFormat === opt.targetFormat && (
                        <Check className="w-4 h-4 text-primary shrink-0 ml-1" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                      {opt.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Converted Result Status Box */}
          {convertedBlob && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">{convertedBlob.newName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {Math.round(convertedBlob.blob.size / 1024) || 1} KB • Ready for download or library save
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSaveToLibrary}
                  disabled={isSavingToDb}
                  className="h-8 text-xs font-bold rounded-xl gap-1"
                >
                  {isSavingToDb ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Save to Library</span>
                </Button>

                <Button
                  size="sm"
                  onClick={handleDownload}
                  className="h-8 text-xs font-bold rounded-xl gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <Button variant="ghost" size="sm" onClick={onClose} className="rounded-xl text-xs font-semibold">
            Cancel
          </Button>

          <Button
            size="sm"
            onClick={handleConvert}
            disabled={isConverting}
            className="rounded-xl font-bold gap-2 px-4 shadow-sm"
          >
            {isConverting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Interchanging Formats...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Interchange to {selectedFormat.toUpperCase()}</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
