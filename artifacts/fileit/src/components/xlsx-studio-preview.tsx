import { useState, useEffect, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import {
  Table as TableIcon,
  Search,
  Download,
  FileSpreadsheet,
  Maximize,
  Minimize,
  Copy,
  Check,
  Filter,
  FileJson,
  FileCode,
  Layers,
  Sparkles,
  AlertCircle,
  RefreshCw,
  BarChart2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface XlsxStudioPreviewProps {
  url: string;
  fileName: string;
  fileSize?: number;
  className?: string;
}

export function XlsxStudioPreview({ url, fileName, fileSize, className = "" }: XlsxStudioPreviewProps) {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>("");
  const [sheetData, setSheetData] = useState<any[][]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedCell, setCopiedCell] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadSpreadsheet() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to load spreadsheet (${response.statusText})`);
        const arrayBuffer = await response.arrayBuffer();

        const wb = XLSX.read(arrayBuffer, { type: "array" });
        if (cancelled) return;

        setWorkbook(wb);
        const sheets = wb.SheetNames || [];
        setSheetNames(sheets);

        if (sheets.length > 0) {
          const first = sheets[0];
          setActiveSheet(first);
          const worksheet = wb.Sheets[first];
          const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: "" });
          setSheetData(jsonData);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "Could not parse spreadsheet file.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSpreadsheet();
    return () => {
      cancelled = true;
    };
  }, [url]);

  // Handle Sheet Tab Switch
  const switchSheet = (sheetName: string) => {
    if (!workbook) return;
    setActiveSheet(sheetName);
    const worksheet = workbook.Sheets[sheetName];
    if (worksheet) {
      const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: "" });
      setSheetData(jsonData);
      setSearchTerm("");
    }
  };

  // Header & Rows Separation
  const { headers, rows } = useMemo(() => {
    if (!sheetData || sheetData.length === 0) return { headers: [], rows: [] };
    const maxCols = Math.max(...sheetData.map((r) => r.length), 0);
    const rawHeaders = sheetData[0] || [];

    // Ensure all columns have a header label (Col A, Col B, etc. if blank)
    const normalizedHeaders: string[] = [];
    for (let c = 0; c < maxCols; c++) {
      const val = rawHeaders[c];
      normalizedHeaders.push(val !== undefined && val !== "" ? String(val) : `Column ${String.fromCharCode(65 + (c % 26))}`);
    }

    const dataRows = sheetData.slice(1);
    return { headers: normalizedHeaders, rows: dataRows };
  }, [sheetData]);

  // Filter Rows based on Search
  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    const term = searchTerm.toLowerCase();
    return rows.filter((row) =>
      row.some((cell) => cell !== undefined && cell !== null && String(cell).toLowerCase().includes(term))
    );
  }, [rows, searchTerm]);

  // Numerical Quick Stats
  const columnStats = useMemo(() => {
    let numbersCount = 0;
    let sum = 0;

    filteredRows.forEach((row) => {
      row.forEach((cell) => {
        if (typeof cell === "number" || (!isNaN(Number(cell)) && cell !== "" && cell !== null)) {
          const num = Number(cell);
          if (isFinite(num)) {
            sum += num;
            numbersCount++;
          }
        }
      });
    });

    const average = numbersCount > 0 ? (sum / numbersCount).toFixed(2) : "0";
    return { numbersCount, sum: sum.toLocaleString(), average };
  }, [filteredRows]);

  const handleCopyCell = (val: any, coord: string) => {
    navigator.clipboard.writeText(String(val ?? ""));
    setCopiedCell(coord);
    toast({ title: "Cell Copied", description: String(val ?? "") });
    setTimeout(() => setCopiedCell(null), 1500);
  };

  const handleExportJson = () => {
    if (!workbook || !activeSheet) return;
    const worksheet = workbook.Sheets[activeSheet];
    const json = XLSX.utils.sheet_to_json(worksheet);
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${fileName.replace(/\.[^/.]+$/, "")}_${activeSheet}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast({ title: "Exported to JSON", description: `Saved ${activeSheet} as JSON.` });
  };

  const handleExportCsv = () => {
    if (!workbook || !activeSheet) return;
    const worksheet = workbook.Sheets[activeSheet];
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${fileName.replace(/\.[^/.]+$/, "")}_${activeSheet}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast({ title: "Exported to CSV", description: `Saved ${activeSheet} as CSV.` });
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

  return (
    <div
      ref={containerRef}
      className={`bg-card rounded-3xl border border-border overflow-hidden flex flex-col shadow-xl transition-all ${className}`}
    >
      {/* ── Top Master Control Toolbar ── */}
      <div className="px-4 py-3 border-b border-border bg-secondary/30 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Document details */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-foreground truncate max-w-[180px] sm:max-w-xs" title={fileName}>
                {fileName}
              </span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                XLSX
              </span>
            </div>
            {!loading && !error && (
              <p className="text-[10px] text-muted-foreground font-mono">
                {rows.length.toLocaleString()} rows • {headers.length} columns {searchTerm && `• ${filteredRows.length} matches`}
              </p>
            )}
          </div>
        </div>

        {/* Right: Search & Action Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="relative w-36 sm:w-48">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search table..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 text-xs rounded-xl"
            />
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCsv}
            className="h-8 px-2.5 text-xs font-bold rounded-xl gap-1.5 shadow-xs"
            title="Export active sheet to CSV"
          >
            <FileCode className="w-3.5 h-3.5 text-emerald-500" />
            <span className="hidden sm:inline">CSV</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportJson}
            className="h-8 px-2.5 text-xs font-bold rounded-xl gap-1.5 shadow-xs"
            title="Export active sheet to JSON"
          >
            <FileJson className="w-3.5 h-3.5 text-blue-500" />
            <span className="hidden sm:inline">JSON</span>
          </Button>

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

      {/* ── Spreadsheet Grid Stage ── */}
      <div className="relative flex-1 bg-muted/40 min-h-[480px] max-h-[70vh] overflow-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
            <p className="text-xs font-medium">Parsing Spreadsheet Workbook...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center max-w-md mx-auto my-auto">
            <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-foreground">Spreadsheet Preview Failed</p>
            <p className="text-xs text-muted-foreground">{error}</p>
            <Button size="sm" asChild className="rounded-xl mt-2">
              <a href={url} download={fileName}>
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Download Spreadsheet Directly
              </a>
            </Button>
          </div>
        ) : headers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
            <TableIcon className="w-10 h-10 opacity-40" />
            <p className="text-xs font-medium">This sheet is empty.</p>
          </div>
        ) : (
          <div className="min-w-full inline-block align-middle">
            <table className="w-full border-collapse text-left text-xs">
              {/* Sticky Table Header */}
              <thead className="sticky top-0 z-10 bg-secondary border-b border-border shadow-xs">
                <tr>
                  <th className="w-12 py-2 px-3 text-center font-mono font-bold text-muted-foreground border-r border-border/60 bg-secondary/80">
                    #
                  </th>
                  {headers.map((header, idx) => (
                    <th
                      key={idx}
                      className="py-2 px-3 font-bold text-foreground whitespace-nowrap border-r border-border/40 font-mono tracking-tight"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-border/60 bg-card">
                {filteredRows.slice(0, 500).map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-muted/60 transition-colors group">
                    <td className="py-1.5 px-3 text-center font-mono text-[10px] text-muted-foreground border-r border-border/60 bg-secondary/30 select-none">
                      {rIdx + 1}
                    </td>
                    {headers.map((_, cIdx) => {
                      const val = row[cIdx];
                      const coord = `${rIdx}-${cIdx}`;
                      const isCopied = copiedCell === coord;
                      return (
                        <td
                          key={cIdx}
                          onClick={() => handleCopyCell(val, coord)}
                          className="py-1.5 px-3 whitespace-nowrap text-foreground/90 border-r border-border/30 cursor-pointer font-mono text-[11px] group-hover:text-foreground transition-colors relative"
                          title="Click to copy cell value"
                        >
                          {val !== undefined && val !== null ? String(val) : ""}
                          {isCopied && (
                            <span className="absolute right-1 top-1 bg-emerald-500 text-white text-[9px] px-1 rounded font-sans">
                              Copied
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredRows.length > 500 && (
              <div className="py-3 px-4 text-center text-xs text-muted-foreground bg-secondary/40 border-t border-border">
                Showing first 500 of {filteredRows.length.toLocaleString()} rows. Use search above to filter.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom Multi-Sheet Tab Selector ── */}
      <div className="px-4 py-2 border-t border-border bg-secondary/30 flex items-center justify-between gap-3 overflow-x-auto scrollbar-none">
        {/* Worksheets list */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1 mr-1">
            <Layers className="w-3 h-3 text-emerald-500" />
            Sheets:
          </span>
          {sheetNames.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => switchSheet(name)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 ${
                activeSheet === name
                  ? "bg-emerald-500 text-white shadow-xs"
                  : "bg-background border border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {name}
            </button>
          ))}
        </div>

        {/* Download direct link */}
        <div className="flex items-center gap-3 shrink-0 text-[11px] text-muted-foreground">
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
