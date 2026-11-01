import React, { useState, useEffect, useMemo } from "react";
import {
  FileCode,
  Copy,
  Check,
  Search,
  WrapText,
  Type,
  FileText,
  Code2,
  Sparkles,
  Download,
  Terminal,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { inspectFileType } from "@/lib/file-type-helpers";

export function CodePreview({
  url,
  fileUrl,
  content: directContent,
  fileName = "code.txt",
  className = "",
}: {
  url?: string;
  fileUrl?: string;
  content?: string;
  fileName?: string;
  className?: string;
}) {
  const { toast } = useToast();
  const [content, setContent] = useState<string>(directContent || "");
  const [loading, setLoading] = useState(!directContent);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [wordWrap, setWordWrap] = useState(true);
  const [fontSize, setFontSize] = useState<"sm" | "base" | "lg">("sm");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"rendered" | "code">(
    fileName.toLowerCase().endsWith(".md") ? "rendered" : "code"
  );
  const [isFullscreen, setIsFullscreen] = useState(false);

  const meta = inspectFileType(fileName);
  const isMarkdown = fileName.toLowerCase().endsWith(".md");
  const isJson = fileName.toLowerCase().endsWith(".json");
  const targetUrl = url || fileUrl;

  const fetchContent = () => {
    if (directContent !== undefined) {
      setContent(directContent);
      setLoading(false);
      setError(false);
      return;
    }

    if (!targetUrl) {
      setLoading(false);
      setError(true);
      return;
    }

    setLoading(true);
    setError(false);
    fetch(targetUrl)
      .then((r) => {
        if (!r.ok) throw new Error("HTTP error " + r.status);
        return r.text();
      })
      .then((t) => {
        setContent(t);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchContent();
  }, [targetUrl, directContent]);

  const lines = useMemo(() => content.split("\n"), [content]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    toast({ title: "Code Copied", description: "Copied code contents to clipboard." });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(content);
      setContent(JSON.stringify(parsed, null, 2));
      toast({ title: "JSON Formatted", description: "Applied 2-space pretty formatting." });
    } catch {
      toast({ variant: "destructive", title: "Invalid JSON format" });
    }
  };

  // Simple clean markdown parser for in-browser rendering
  const renderSimpleMarkdown = (md: string) => {
    const mdLines = md.split("\n");
    return (
      <div className="space-y-3 prose dark:prose-invert max-w-none text-foreground font-sans leading-relaxed">
        {mdLines.map((line, idx) => {
          if (line.startsWith("# ")) {
            return (
              <h1 key={idx} className="text-2xl font-black border-b border-border pb-2 pt-2 text-foreground">
                {line.replace("# ", "")}
              </h1>
            );
          }
          if (line.startsWith("## ")) {
            return (
              <h2 key={idx} className="text-xl font-bold border-b border-border/60 pb-1.5 pt-2 text-foreground">
                {line.replace("## ", "")}
              </h2>
            );
          }
          if (line.startsWith("### ")) {
            return (
              <h3 key={idx} className="text-base font-bold pt-1 text-foreground">
                {line.replace("### ", "")}
              </h3>
            );
          }
          if (line.startsWith("- ") || line.startsWith("* ")) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                <p className="text-sm text-foreground/90">{line.replace(/^[-*]\s+/, "")}</p>
              </div>
            );
          }
          if (line.startsWith("> ")) {
            return (
              <blockquote
                key={idx}
                className="pl-3 border-l-4 border-primary/50 text-muted-foreground text-sm italic my-2"
              >
                {line.replace("> ", "")}
              </blockquote>
            );
          }
          if (line.trim() === "---" || line.trim() === "***") {
            return <hr key={idx} className="border-border my-4" />;
          }
          if (!line.trim()) {
            return <div key={idx} className="h-1" />;
          }
          return (
            <p key={idx} className="text-sm text-foreground leading-relaxed">
              {line}
            </p>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-card rounded-2xl border border-border text-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center animate-pulse">
          <FileCode className="w-5 h-5" />
        </div>
        <p className="text-xs text-muted-foreground font-mono">Loading code buffer…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-card rounded-2xl border border-border text-center space-y-3 max-w-md mx-auto">
        <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <FileCode className="w-5 h-5" />
        </div>
        <p className="text-sm font-semibold text-foreground">Could not preview text content</p>
        <p className="text-xs text-muted-foreground font-mono">The file may still be downloading or encrypting.</p>
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={fetchContent}>
            Retry Preview
          </Button>
          {targetUrl && (
            <Button size="sm" asChild>
              <a href={targetUrl} download={fileName}>
                Download File
              </a>
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-card rounded-2xl border border-border overflow-hidden flex flex-col shadow-xs ${
        isFullscreen ? "fixed inset-0 z-50 rounded-none bg-background h-screen" : "w-full"
      } ${className}`}
    >
      {/* Top Code Toolbar */}
      <div className="px-4 py-2.5 border-b border-border bg-secondary/30 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center border border-cyan-500/20 shrink-0">
            <Terminal className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-foreground truncate">{fileName}</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                {meta.extension}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">
              {lines.length} lines • {content.length} characters
            </span>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Markdown Switcher */}
          {isMarkdown && (
            <div className="flex items-center bg-background rounded-lg border border-border p-0.5">
              <button
                type="button"
                onClick={() => setActiveTab("rendered")}
                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                  activeTab === "rendered"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Rendered
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("code")}
                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                  activeTab === "code"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Raw Code
              </button>
            </div>
          )}

          {/* Pretty Format JSON */}
          {isJson && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleFormatJson}
              className="h-7 text-[11px] font-bold rounded-lg px-2 gap-1"
            >
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Pretty JSON</span>
            </Button>
          )}

          {/* Word Wrap Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setWordWrap(!wordWrap)}
            className={`h-7 px-2 text-[11px] font-medium rounded-lg gap-1 ${
              wordWrap ? "bg-secondary text-foreground" : "text-muted-foreground"
            }`}
            title="Toggle Word Wrap"
          >
            <WrapText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Wrap</span>
          </Button>

          {/* Copy Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="h-7 text-[11px] font-bold rounded-lg px-2 gap-1"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </Button>

          {/* Fullscreen Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="h-7 w-7 p-0 rounded-lg"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      {isMarkdown && activeTab === "rendered" ? (
        <div className="p-6 overflow-auto max-h-[70vh] bg-card">
          {renderSimpleMarkdown(content)}
        </div>
      ) : (
        <div className="flex-1 overflow-auto max-h-[70vh] flex text-xs font-mono bg-slate-950 text-slate-100 divide-x divide-slate-800">
          {/* Line Numbers Column */}
          <div className="py-4 px-3 select-none text-right text-slate-600 bg-slate-950/80 font-mono text-[11px] shrink-0">
            {lines.map((_, i) => (
              <div key={i} className="leading-6">
                {i + 1}
              </div>
            ))}
          </div>

          {/* Code Text Content */}
          <pre
            className={`p-4 flex-1 overflow-x-auto text-slate-200 font-mono leading-6 ${
              wordWrap ? "whitespace-pre-wrap break-all" : "whitespace-pre"
            } ${fontSize === "sm" ? "text-[12px]" : fontSize === "lg" ? "text-[14px]" : "text-[13px]"}`}
          >
            {content}
          </pre>
        </div>
      )}
    </div>
  );
}
