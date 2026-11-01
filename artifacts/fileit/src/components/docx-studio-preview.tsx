import { useState, useEffect, useMemo, useRef } from "react";
import mammoth from "mammoth";
import {
  FileText,
  Search,
  BookOpen,
  Copy,
  Printer,
  Maximize,
  Minimize,
  Type,
  AlignLeft,
  Clock,
  Hash,
  Download,
  ListTree,
  ChevronRight,
  Check,
  Sparkles,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface DocxStudioPreviewProps {
  url: string;
  fileName: string;
  fileSize?: number;
  className?: string;
}

interface HeadingItem {
  id: string;
  text: string;
  level: number;
}

export function DocxStudioPreview({ url, fileName, fileSize, className = "" }: DocxStudioPreviewProps) {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState("");
  const [rawText, setRawText] = useState("");
  const [headings, setHeadings] = useState<HeadingItem[]>([]);
  const [showOutline, setShowOutline] = useState(false);

  // Typography & Reader customization
  const [fontSize, setFontSize] = useState<"sm" | "md" | "lg">("md");
  const [fontFamily, setFontFamily] = useState<"sans" | "serif" | "mono">("sans");
  const [searchTerm, setSearchTerm] = useState("");
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadDocx() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to load document (${response.statusText})`);
        const arrayBuffer = await response.arrayBuffer();

        const result = await mammoth.convertToHtml({ arrayBuffer });
        if (cancelled) return;

        let parsedHtml = result.value;

        // Extract plain text for word counts
        const textResult = await mammoth.extractRawText({ arrayBuffer });
        const text = textResult.value || "";
        setRawText(text);

        // Inject IDs into headings to allow outline navigation
        const parser = new DOMParser();
        const doc = parser.parseFromString(parsedHtml, "text/html");
        const foundHeadings: HeadingItem[] = [];

        doc.querySelectorAll("h1, h2, h3, h4").forEach((el, index) => {
          const id = `heading-${index}`;
          el.setAttribute("id", id);
          const level = parseInt(el.tagName.replace("H", ""), 10) || 1;
          const headingText = el.textContent?.trim() || `Section ${index + 1}`;
          if (headingText) {
            foundHeadings.push({ id, text: headingText, level });
          }
        });

        setHeadings(foundHeadings);
        setHtmlContent(doc.body.innerHTML);
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "Could not parse Word document.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDocx();
    return () => {
      cancelled = true;
    };
  }, [url]);

  // Statistics calculation
  const stats = useMemo(() => {
    if (!rawText) return { words: 0, characters: 0, readTimeMinutes: 1 };
    const words = rawText.trim().split(/\s+/).filter(Boolean).length;
    const characters = rawText.length;
    const readTimeMinutes = Math.max(1, Math.ceil(words / 200));
    return { words, characters, readTimeMinutes };
  }, [rawText]);

  // Highlighted Search HTML
  const displayHtml = useMemo(() => {
    if (!searchTerm.trim() || !htmlContent) return htmlContent;
    try {
      const term = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(?![^<]*>)(${term})`, "gi");
      return htmlContent.replace(regex, `<mark class="bg-amber-300 dark:bg-amber-600 text-black px-0.5 rounded font-bold">$1</mark>`);
    } catch {
      return htmlContent;
    }
  }, [htmlContent, searchTerm]);

  const handleCopyText = () => {
    if (!rawText) return;
    navigator.clipboard.writeText(rawText);
    setCopied(true);
    toast({
      title: "Text Copied",
      description: `Copied ${stats.words.toLocaleString()} words to clipboard.`,
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>${fileName}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; line-height: 1.6; max-width: 800px; margin: 0 auto; color: #111; }
            h1, h2, h3 { color: #111; }
            table { border-collapse: collapse; width: 100%; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            img { max-width: 100%; height: auto; }
          </style>
        </head>
        <body>
          <h2>${fileName}</h2>
          <hr />
          ${htmlContent}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
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

  const scrollToHeading = (id: string) => {
    const el = contentRef.current?.querySelector(`#${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const fontClass =
    fontFamily === "serif"
      ? "font-serif"
      : fontFamily === "mono"
      ? "font-mono"
      : "font-sans";

  const sizeClass =
    fontSize === "sm"
      ? "text-xs leading-relaxed"
      : fontSize === "lg"
      ? "text-base leading-loose"
      : "text-sm leading-relaxed";

  return (
    <div
      ref={containerRef}
      className={`bg-card rounded-3xl border border-border overflow-hidden flex flex-col shadow-xl transition-all ${className}`}
    >
      {/* ── Top Master Control Toolbar ── */}
      <div className="px-4 py-3 border-b border-border bg-secondary/30 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Document details */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-foreground truncate max-w-[180px] sm:max-w-xs" title={fileName}>
                {fileName}
              </span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
                DOCX
              </span>
            </div>
            {!loading && !error && (
              <p className="text-[10px] text-muted-foreground font-mono">
                {stats.words.toLocaleString()} words • ~{stats.readTimeMinutes} min read
              </p>
            )}
          </div>
        </div>

        {/* Right: Customization & Actions */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* In-Document Search */}
          <div className="relative w-32 sm:w-44">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search text..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 text-xs rounded-xl"
            />
          </div>

          {/* Table of contents toggle */}
          {headings.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowOutline((o) => !o)}
              className={`h-8 px-2.5 text-xs font-bold rounded-xl gap-1.5 shadow-xs ${
                showOutline ? "bg-primary/15 text-primary border-primary/30" : ""
              }`}
              title="Table of Contents Outline"
            >
              <ListTree className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Outline</span>
            </Button>
          )}

          {/* Font styling picker */}
          <div className="flex items-center bg-background border border-border rounded-xl p-0.5 shadow-xs">
            <button
              type="button"
              onClick={() => setFontFamily(fontFamily === "sans" ? "serif" : fontFamily === "serif" ? "mono" : "sans")}
              className="px-2 py-1 text-[10px] font-bold rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title="Change Font Family"
            >
              {fontFamily.toUpperCase()}
            </button>
            <div className="w-px h-3 bg-border" />
            <button
              type="button"
              onClick={() => setFontSize(fontSize === "sm" ? "md" : fontSize === "md" ? "lg" : "sm")}
              className="px-2 py-1 text-[10px] font-bold rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title="Change Font Size"
            >
              <Type className="w-3 h-3 inline mr-0.5" />
              {fontSize.toUpperCase()}
            </button>
          </div>

          {/* Copy Plain Text */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyText}
            disabled={!rawText}
            className="h-8 px-2.5 text-xs font-bold rounded-xl gap-1.5 shadow-xs"
            title="Copy plain document text"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
          </Button>

          {/* Print */}
          <Button
            size="sm"
            variant="outline"
            onClick={handlePrint}
            disabled={!htmlContent}
            className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-foreground shadow-xs hidden sm:flex"
            title="Print Document"
          >
            <Printer className="w-3.5 h-3.5" />
          </Button>

          {/* Fullscreen */}
          <Button
            size="sm"
            variant="ghost"
            onClick={toggleFullscreen}
            className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-foreground"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* ── Document Stage with Outline Sidebar ── */}
      <div className="relative flex-1 bg-muted/40 min-h-[500px] max-h-[75vh] flex overflow-hidden">
        {/* Outline Sidebar */}
        {showOutline && headings.length > 0 && (
          <aside className="w-64 border-r border-border bg-card/95 backdrop-blur-md p-4 overflow-y-auto space-y-2 shrink-0 hidden md:block animate-in slide-in-from-left-4 duration-200">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <ListTree className="w-3.5 h-3.5 text-primary" />
              Document Sections
            </h4>
            <div className="space-y-1 pt-1">
              {headings.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => scrollToHeading(h.id)}
                  className={`w-full text-left text-xs py-1.5 px-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground truncate flex items-center gap-1.5 ${
                    h.level === 1 ? "font-bold text-foreground" : h.level === 2 ? "pl-4" : "pl-6 text-[11px]"
                  }`}
                  title={h.text}
                >
                  <ChevronRight className="w-3 h-3 shrink-0 opacity-50" />
                  <span className="truncate">{h.text}</span>
                </button>
              ))}
            </div>
          </aside>
        )}

        {/* Main Document Reader Paper Sheet */}
        <div ref={contentRef} className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
              <p className="text-xs font-medium">Parsing Word Document Structure...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center max-w-md my-auto">
              <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-foreground">Preview Failed</p>
              <p className="text-xs text-muted-foreground">{error}</p>
              <Button size="sm" asChild className="rounded-xl mt-2">
                <a href={url} download={fileName}>
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Download DOCX Directly
                </a>
              </Button>
            </div>
          ) : (
            <article
              className={`w-full max-w-3xl bg-card border border-border shadow-2xl rounded-2xl p-6 sm:p-12 transition-all ${fontClass} ${sizeClass} text-foreground space-y-4 prose dark:prose-invert prose-headings:font-bold prose-headings:text-foreground prose-a:text-primary prose-table:border-collapse prose-th:border prose-th:border-border prose-th:bg-secondary prose-th:p-2 prose-td:border prose-td:border-border prose-td:p-2 prose-img:rounded-xl prose-img:shadow-md prose-img:mx-auto`}
              dangerouslySetInnerHTML={{ __html: displayHtml }}
            />
          )}
        </div>
      </div>

      {/* ── Bottom Metadata Bar ── */}
      <div className="px-4 py-2 border-t border-border bg-secondary/20 flex items-center justify-between text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2 font-mono">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span>Mammoth High-Fidelity Word Engine</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline">
            {stats.characters.toLocaleString()} chars
          </span>
          <span className="text-border hidden sm:inline">|</span>
          <a
            href={url}
            download={fileName}
            className="flex items-center gap-1 text-primary font-bold hover:underline"
          >
            <Download className="w-3 h-3" />
            <span>Download Original</span>
          </a>
        </div>
      </div>
    </div>
  );
}
