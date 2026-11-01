import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  FileText,
  Highlighter,
  MessageSquare,
  Stamp,
  PenTool,
  Eraser,
  Download,
  FolderPlus,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Sun,
  Moon,
  Upload,
  X,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Trash2,
  Sparkles,
  Radio,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getRoomToken } from "@/lib/rooms-storage";
import { RoomP2PMeshManager } from "@/lib/room-p2p-mesh";
import { ExportShareModal } from "@/components/export-share-modal";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export interface LivePdfAnnotation {
  id: string;
  type: "highlight" | "note" | "stamp" | "draw";
  x: number; // 0 - 100 percentage
  y: number; // 0 - 100 percentage
  width?: number; // 0 - 100 percentage
  height?: number; // 0 - 100 percentage
  color: string;
  text?: string;
  authorName: string;
  timestamp: number;
  points?: Array<{ x: number; y: number }>;
}

interface RoomFile {
  id: string;
  originalName: string;
  size: number;
  mimeType: string;
  shareToken: string;
  createdAt: string;
}

interface RoomPdfCollaboratorProps {
  roomId: string;
  roomName: string;
  vaultFiles: RoomFile[];
  meshManager?: RoomP2PMeshManager | null;
  onFileSavedToVault?: () => void;
  onUploadNewPdf: (files: FileList | File[]) => Promise<void>;
}

const HIGHLIGHT_COLORS = [
  "rgba(250, 204, 21, 0.4)", // Yellow
  "rgba(52, 211, 153, 0.4)",  // Emerald
  "rgba(244, 63, 94, 0.4)",   // Rose
  "rgba(56, 189, 248, 0.4)",  // Sky Blue
  "rgba(168, 85, 247, 0.4)",  // Purple
];

const PRESET_STAMPS = [
  { label: "APPROVED", color: "#10b981", border: "border-emerald-500", text: "text-emerald-400" },
  { label: "NEEDS REVISION", color: "#f43f5e", border: "border-rose-500", text: "text-rose-400" },
  { label: "CONFIDENTIAL", color: "#f59e0b", border: "border-amber-500", text: "text-amber-400" },
  { label: "DRAFT", color: "#38bdf8", border: "border-sky-500", text: "text-sky-400" },
];

export function RoomPdfCollaborator({
  roomId,
  roomName,
  vaultFiles,
  meshManager,
  onFileSavedToVault,
  onUploadNewPdf,
}: RoomPdfCollaboratorProps) {
  const { toast } = useToast();

  // Filter available PDF files from vault
  const pdfFiles = vaultFiles.filter(
    (f) => f.mimeType === "application/pdf" || f.originalName.toLowerCase().endsWith(".pdf")
  );

  const [selectedFileId, setSelectedFileId] = useState<string>(pdfFiles[0]?.id || "");
  const activePdf = pdfFiles.find((f) => f.id === selectedFileId) || pdfFiles[0] || null;

  // Viewport Settings
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Annotation Tools: view | highlight | note | stamp | draw | eraser
  const [tool, setTool] = useState<"view" | "highlight" | "note" | "stamp" | "draw" | "eraser">("view");
  const [highlightColor, setHighlightColor] = useState(HIGHLIGHT_COLORS[0]);
  const [selectedStamp, setSelectedStamp] = useState(PRESET_STAMPS[0].label);
  const [newNoteText, setNewNoteText] = useState("");
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

  // Annotations List
  const [annotations, setAnnotations] = useState<LivePdfAnnotation[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentDrawPoints, setCurrentDrawPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [isSavingToVault, setIsSavingToVault] = useState(false);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [isExportShareOpen, setIsExportShareOpen] = useState(false);
  const [exportShareBlob, setExportShareBlob] = useState<Blob | undefined>(undefined);
  const [isPreparingShare, setIsPreparingShare] = useState(false);

  const pdfContainerRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync selected file when vault updates
  useEffect(() => {
    if (!selectedFileId && pdfFiles.length > 0) {
      setSelectedFileId(pdfFiles[0].id);
    }
  }, [pdfFiles, selectedFileId]);

  // Load Saved Annotations from Server for active PDF
  useEffect(() => {
    if (!activePdf) return;
    setIsLoadingPdf(true);

    const token = getRoomToken(roomId);
    fetch(`/api/rooms/${roomId}/pdf-annotations/${activePdf.id}`, {
      headers: token ? { "x-room-token": token } : {},
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.annotations) {
          try {
            const loaded = JSON.parse(data.annotations);
            if (Array.isArray(loaded)) setAnnotations(loaded);
            else setAnnotations([]);
          } catch {
            setAnnotations([]);
          }
        } else {
          setAnnotations([]);
        }
      })
      .catch(() => setAnnotations([]))
      .finally(() => setIsLoadingPdf(false));
  }, [roomId, activePdf?.id]);

  // Save Annotations Snapshot to Server (Debounced)
  const saveAnnotationsToServer = useCallback(
    (fileId: string, list: LivePdfAnnotation[]) => {
      const token = getRoomToken(roomId);
      fetch(`/api/rooms/${roomId}/pdf-annotations/${fileId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "x-room-token": token } : {}),
        },
        body: JSON.stringify({ annotations: JSON.stringify(list) }),
      }).catch(() => {});
    },
    [roomId]
  );

  // Listen to incoming P2P Mesh Annotations from Roommates!
  useEffect(() => {
    if (!meshManager) return;

    meshManager.onPdfAnnotation = (payload: any) => {
      if (!payload || payload.fileId !== activePdf?.id) return;

      if (payload.action === "upsert" && payload.annotation) {
        setAnnotations((prev) => {
          const idx = prev.findIndex((a) => a.id === payload.annotation.id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = payload.annotation;
            return copy;
          }
          return [...prev, payload.annotation];
        });
        toast({
          title: `Annotation from ${payload.fromName || "Peer"}`,
          description: payload.annotation.type === "note" ? `"${payload.annotation.text}"` : `Added ${payload.annotation.type}`,
        });
      } else if (payload.action === "delete") {
        setAnnotations((prev) => prev.filter((a) => a.id !== payload.annotationId));
      } else if (payload.action === "clear") {
        setAnnotations([]);
      }
    };

    return () => {
      if (meshManager) meshManager.onPdfAnnotation = undefined;
    };
  }, [meshManager, activePdf?.id, toast]);

  // Convert client click coordinates to percentage (0 - 100%)
  const getPercentageCoords = (e: React.MouseEvent<HTMLDivElement>) => {
    const overlay = overlayRef.current;
    if (!overlay) return { x: 0, y: 0 };
    const rect = overlay.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) };
  };

  // Handle Adding Annotation via Click
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!activePdf || tool === "view" || tool === "draw") return;

    const coords = getPercentageCoords(e);
    const authorName = meshManager?.myPeerName || "You";

    let newAnnotation: LivePdfAnnotation | null = null;

    if (tool === "stamp") {
      newAnnotation = {
        id: `ann_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type: "stamp",
        x: coords.x,
        y: coords.y,
        color: PRESET_STAMPS.find((s) => s.label === selectedStamp)?.color || "#10b981",
        text: selectedStamp,
        authorName,
        timestamp: Date.now(),
      };
    } else if (tool === "note") {
      newAnnotation = {
        id: `ann_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type: "note",
        x: coords.x,
        y: coords.y,
        color: "#fbbf24",
        text: newNoteText.trim() || "Review Note",
        authorName,
        timestamp: Date.now(),
      };
      setNewNoteText("");
    } else if (tool === "highlight") {
      newAnnotation = {
        id: `ann_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type: "highlight",
        x: Math.max(0, coords.x - 10),
        y: coords.y,
        width: 25,
        height: 3.5,
        color: highlightColor,
        authorName,
        timestamp: Date.now(),
      };
    }

    if (newAnnotation) {
      const nextList = [...annotations, newAnnotation];
      setAnnotations(nextList);
      saveAnnotationsToServer(activePdf.id, nextList);

      // Broadcast over P2P DataChannel mesh
      if (meshManager) {
        meshManager.broadcastPdfAnnotation({
          action: "upsert",
          fileId: activePdf.id,
          annotation: newAnnotation,
        });
      }
    }
  };

  // Freehand Markup Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (tool !== "draw") return;
    setIsDrawing(true);
    const coords = getPercentageCoords(e);
    setCurrentDrawPoints([coords]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || tool !== "draw") return;
    const coords = getPercentageCoords(e);
    setCurrentDrawPoints((prev) => [...prev, coords]);
  };

  const handleMouseUp = () => {
    if (!isDrawing || tool !== "draw" || !activePdf) return;
    setIsDrawing(false);

    if (currentDrawPoints.length > 1) {
      const newAnnotation: LivePdfAnnotation = {
        id: `ann_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type: "draw",
        x: currentDrawPoints[0].x,
        y: currentDrawPoints[0].y,
        color: highlightColor,
        points: currentDrawPoints,
        authorName: meshManager?.myPeerName || "You",
        timestamp: Date.now(),
      };

      const nextList = [...annotations, newAnnotation];
      setAnnotations(nextList);
      saveAnnotationsToServer(activePdf.id, nextList);

      if (meshManager) {
        meshManager.broadcastPdfAnnotation({
          action: "upsert",
          fileId: activePdf.id,
          annotation: newAnnotation,
        });
      }
    }
    setCurrentDrawPoints([]);
  };

  const handleDeleteAnnotation = (annId: string) => {
    if (!activePdf) return;
    const nextList = annotations.filter((a) => a.id !== annId);
    setAnnotations(nextList);
    saveAnnotationsToServer(activePdf.id, nextList);

    if (meshManager) {
      meshManager.broadcastPdfAnnotation({
        action: "delete",
        fileId: activePdf.id,
        annotationId: annId,
      });
    }
  };

  const handleClearAll = () => {
    if (!activePdf || annotations.length === 0) return;
    setAnnotations([]);
    saveAnnotationsToServer(activePdf.id, []);

    if (meshManager) {
      meshManager.broadcastPdfAnnotation({
        action: "clear",
        fileId: activePdf.id,
      });
    }
    toast({ title: "Annotations Cleared" });
  };

  // 1-Click Save Flattened Annotated PDF to Room Vault
  const handleSaveToVault = async () => {
    const targetElement = pdfContainerRef.current;
    if (!targetElement || !activePdf) {
      toast({ variant: "destructive", title: "Cannot Export", description: "No active PDF container found." });
      return;
    }

    setIsSavingToVault(true);
    try {
      const canvas = await html2canvas(targetElement, {
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

      const baseName = activePdf.originalName.replace(/\.pdf$/i, "");
      const fileName = `${baseName}_reviewed.pdf`;
      const file = new File([pdfBlob], fileName, { type: "application/pdf" });

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
          title: "Flattened PDF Saved to Room Vault",
          description: `"${fileName}" is now available in Room Files.`,
        });
        onFileSavedToVault?.();
      } else {
        throw new Error("Upload failed");
      }
    } catch {
      toast({ variant: "destructive", title: "Failed to save annotated PDF" });
    } finally {
      setIsSavingToVault(false);
    }
  };

  // 1-Click Download Local Annotated PDF
  const handleDownloadLocalPdf = async () => {
    const targetElement = pdfContainerRef.current;
    if (!targetElement || !activePdf) return;

    try {
      const canvas = await html2canvas(targetElement, {
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
      pdf.save(`${activePdf.originalName.replace(/\.pdf$/i, "")}_reviewed.pdf`);
      toast({ title: "Downloaded Annotated PDF" });
    } catch {
      toast({ variant: "destructive", title: "Export failed" });
    }
  };

  // Open Export & Multi-App Share Dialog
  const handleOpenExportShare = async () => {
    if (!activePdf) return;
    setIsPreparingShare(true);
    try {
      if (annotations.length > 0 && pdfContainerRef.current) {
        const canvas = await html2canvas(pdfContainerRef.current, {
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
        const blob = pdf.output("blob");
        setExportShareBlob(blob);
      } else {
        setExportShareBlob(undefined);
      }
      setIsExportShareOpen(true);
    } catch {
      setIsExportShareOpen(true);
    } finally {
      setIsPreparingShare(false);
    }
  };

  return (
    <div className="flex flex-col rounded-3xl bg-card/70 backdrop-blur-xl border border-border/80 shadow-sm overflow-hidden h-[540px] sm:h-[600px] relative select-none">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) onUploadNewPdf(e.target.files);
        }}
      />

      {/* Top Header & Document Picker Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 sm:px-4 bg-secondary/50 border-b border-border/70 z-10">
        {/* Document Selection Dropdown */}
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-rose-500 shrink-0" />
          {pdfFiles.length > 0 ? (
            <select
              value={selectedFileId}
              onChange={(e) => setSelectedFileId(e.target.value)}
              className="h-8 rounded-xl bg-card border border-border/60 text-xs font-bold px-2 text-foreground max-w-[160px] sm:max-w-xs truncate"
            >
              {pdfFiles.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.originalName}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs font-bold text-muted-foreground">No PDFs in Vault</span>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="h-8 rounded-xl text-xs font-semibold gap-1.5 border-border/80"
          >
            <Upload className="w-3.5 h-3.5 text-primary" />
            <span className="hidden sm:inline">Upload PDF</span>
          </Button>
        </div>

        {/* Viewport Actions (Zoom, Rotate, Dark/Light) */}
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setZoom((z) => Math.max(50, z - 15))}
            className="h-8 w-8 rounded-xl"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <span className="text-[10px] font-mono font-bold w-10 text-center text-muted-foreground">
            {zoom}%
          </span>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setZoom((z) => Math.min(200, z + 15))}
            className="h-8 w-8 rounded-xl"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="h-8 w-8 rounded-xl"
            title="Rotate"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setIsDarkMode((d) => !d)}
            className="h-8 w-8 rounded-xl"
            title="Toggle Contrast Mode"
          >
            {isDarkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </Button>
        </div>

        {/* Save & Export Deck */}
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={handleOpenExportShare}
            disabled={!activePdf || isPreparingShare}
            className="h-8 rounded-xl text-xs font-bold gap-1.5 border-border/80 text-foreground"
            title="Export and share via WhatsApp, Telegram, Gmail, etc."
          >
            {isPreparingShare ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5 text-primary" />}
            <span className="hidden sm:inline">Export & Share</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleDownloadLocalPdf}
            disabled={!activePdf}
            className="h-8 rounded-xl text-xs font-bold gap-1.5 border-border/80"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export PDF</span>
          </Button>

          <Button
            size="sm"
            onClick={handleSaveToVault}
            disabled={!activePdf || isSavingToVault}
            className="h-8 rounded-xl text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isSavingToVault ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderPlus className="w-3.5 h-3.5" />}
            <span>Save to Room</span>
          </Button>
        </div>
      </div>

      {/* Floating Review Tools Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-secondary/30 border-b border-border/60 z-10 px-3">
        {/* Tool Selector */}
        <div className="flex items-center gap-1 bg-card p-1 rounded-2xl border border-border/60 shadow-xs">
          <button
            type="button"
            onClick={() => setTool("view")}
            className={`px-2.5 py-1 text-xs font-bold rounded-xl transition-colors ${
              tool === "view" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Browse
          </button>
          <button
            type="button"
            onClick={() => setTool("highlight")}
            className={`px-2.5 py-1 text-xs font-bold rounded-xl flex items-center gap-1 transition-colors ${
              tool === "highlight" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Highlighter className="w-3.5 h-3.5" />
            <span>Highlight</span>
          </button>
          <button
            type="button"
            onClick={() => setTool("note")}
            className={`px-2.5 py-1 text-xs font-bold rounded-xl flex items-center gap-1 transition-colors ${
              tool === "note" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Comment</span>
          </button>
          <button
            type="button"
            onClick={() => setTool("stamp")}
            className={`px-2.5 py-1 text-xs font-bold rounded-xl flex items-center gap-1 transition-colors ${
              tool === "stamp" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Stamp className="w-3.5 h-3.5" />
            <span>Stamp</span>
          </button>
          <button
            type="button"
            onClick={() => setTool("draw")}
            className={`px-2.5 py-1 text-xs font-bold rounded-xl flex items-center gap-1 transition-colors ${
              tool === "draw" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>Markup</span>
          </button>
        </div>

        {/* Dynamic Tool Sub-Controls */}
        <div className="flex items-center gap-2">
          {tool === "highlight" && (
            <div className="flex items-center gap-1 bg-card px-2 py-1 rounded-2xl border border-border/60">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setHighlightColor(c)}
                  className={`w-4 h-4 rounded-full border border-border transition-transform ${
                    highlightColor === c ? "scale-125 ring-2 ring-primary" : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          )}

          {tool === "stamp" && (
            <div className="flex items-center gap-1 bg-card p-1 rounded-2xl border border-border/60">
              {PRESET_STAMPS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setSelectedStamp(s.label)}
                  className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-lg border transition-all ${
                    selectedStamp === s.label
                      ? `${s.border} ${s.text} bg-white/10 shadow-xs scale-105`
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {tool === "note" && (
            <Input
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              placeholder="Type comment then click on document..."
              className="h-7 text-xs rounded-xl w-48 sm:w-64"
            />
          )}

          {annotations.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClearAll}
              className="h-7 text-[10px] font-bold text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-xl"
            >
              Clear Annotations ({annotations.length})
            </Button>
          )}
        </div>
      </div>

      {/* Main PDF Interactive Viewport Canvas */}
      <div className="flex-1 overflow-auto bg-slate-900/60 p-4 flex items-center justify-center relative">
        {isLoadingPdf && (
          <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center z-30">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {!activePdf ? (
          <div className="text-center space-y-3 py-12">
            <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto" />
            <h4 className="text-sm font-bold text-foreground">No Document Selected</h4>
            <p className="text-xs text-muted-foreground max-w-sm">
              Upload a PDF to the room or select one from the dropdown above to review collaboratively.
            </p>
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-2xl text-xs font-bold gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload PDF to Review</span>
            </Button>
          </div>
        ) : (
          <div
            ref={pdfContainerRef}
            className={`relative transition-transform duration-200 shadow-2xl rounded-2xl overflow-hidden ${
              isDarkMode ? "invert hue-rotate-180" : ""
            }`}
            style={{
              transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
              transformOrigin: "center center",
              width: "100%",
              maxWidth: "800px",
              minHeight: "520px",
            }}
          >
            {/* Native PDF Embedded Viewer / Fallback Frame */}
            <iframe
              src={`/api/files/${activePdf.id}/download?token=${activePdf.shareToken}#toolbar=0&navpanes=0`}
              className="w-full h-[520px] sm:h-[620px] border-0 pointer-events-auto bg-white"
              title={activePdf.originalName}
            />

            {/* Interactive Live Collaborative Annotation Layer */}
            <div
              ref={overlayRef}
              onClick={handleOverlayClick}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              className={`absolute inset-0 z-20 ${
                tool === "view" ? "pointer-events-none" : "cursor-crosshair pointer-events-auto"
              }`}
            >
              {/* Existing Synced Annotations */}
              {annotations.map((ann) => {
                if (ann.type === "highlight") {
                  return (
                    <div
                      key={ann.id}
                      style={{
                        left: `${ann.x}%`,
                        top: `${ann.y}%`,
                        width: `${ann.width || 20}%`,
                        height: `${ann.height || 3}%`,
                        backgroundColor: ann.color,
                      }}
                      className="absolute rounded-xs pointer-events-auto group cursor-pointer border border-transparent hover:border-black/30"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (tool === "eraser") handleDeleteAnnotation(ann.id);
                      }}
                    >
                      <div className="hidden group-hover:flex absolute -top-5 left-0 bg-black/80 text-white text-[9px] font-mono px-1.5 py-0.5 rounded shadow whitespace-nowrap">
                        {ann.authorName}
                      </div>
                    </div>
                  );
                }

                if (ann.type === "stamp") {
                  return (
                    <div
                      key={ann.id}
                      style={{ left: `${ann.x}%`, top: `${ann.y}%` }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto group cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (tool === "eraser") handleDeleteAnnotation(ann.id);
                      }}
                    >
                      <div
                        className="px-3 py-1 rounded-xl border-2 font-mono font-black text-xs uppercase tracking-widest shadow-md -rotate-6 select-none"
                        style={{
                          borderColor: ann.color,
                          color: ann.color,
                          backgroundColor: `${ann.color}15`,
                        }}
                      >
                        {ann.text}
                      </div>
                      <div className="hidden group-hover:flex absolute -top-5 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[9px] font-mono px-1.5 py-0.5 rounded shadow whitespace-nowrap">
                        By {ann.authorName}
                      </div>
                    </div>
                  );
                }

                if (ann.type === "note") {
                  return (
                    <div
                      key={ann.id}
                      style={{ left: `${ann.x}%`, top: `${ann.y}%` }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto group cursor-pointer z-20"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (tool === "eraser") handleDeleteAnnotation(ann.id);
                        else setActiveNoteId(activeNoteId === ann.id ? null : ann.id);
                      }}
                    >
                      <div className="w-7 h-7 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-lg border border-white/60 hover:scale-110 transition-transform">
                        <MessageSquare className="w-3.5 h-3.5 fill-current" />
                      </div>

                      {/* Sticky Note Popover Card */}
                      <div
                        className={`absolute left-8 -top-3 w-48 p-2.5 rounded-2xl bg-amber-100 dark:bg-amber-950 text-slate-900 dark:text-amber-100 border border-amber-300 dark:border-amber-800 shadow-xl text-xs space-y-1 transition-all ${
                          activeNoteId === ann.id ? "block z-30" : "hidden group-hover:block"
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex justify-between items-center text-[10px] font-mono text-amber-800 dark:text-amber-300">
                          <span className="font-bold">{ann.authorName}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteAnnotation(ann.id)}
                            className="hover:text-rose-500"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="font-medium leading-relaxed">{ann.text}</p>
                      </div>
                    </div>
                  );
                }

                if (ann.type === "draw" && ann.points && ann.points.length > 1) {
                  return (
                    <svg
                      key={ann.id}
                      className="absolute inset-0 w-full h-full pointer-events-none"
                    >
                      <polyline
                        fill="none"
                        stroke={ann.color}
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={ann.points.map((p) => `${p.x}%,${p.y}%`).join(" ")}
                      />
                    </svg>
                  );
                }

                return null;
              })}

              {/* In-progress drawing preview */}
              {isDrawing && currentDrawPoints.length > 1 && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  <polyline
                    fill="none"
                    stroke={highlightColor}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={currentDrawPoints.map((p) => `${p.x}%,${p.y}%`).join(" ")}
                  />
                </svg>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Live Review Status Bar */}
      <div className="px-4 py-2 bg-secondary/40 border-t border-border/60 flex items-center justify-between text-[11px] font-mono text-muted-foreground z-10">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-emerald-500 font-semibold">
            <Radio className="w-3 h-3 animate-pulse" /> Live Multi-Peer Review
          </span>
          <span>·</span>
          <span>{annotations.length} annotation{annotations.length !== 1 ? "s" : ""}</span>
        </div>

        <div>
          <span>Click anywhere to apply {tool} · Synced across room</span>
        </div>
      </div>

      {/* Export & Multi-App Share Dialog */}
      {activePdf && (
        <ExportShareModal
          isOpen={isExportShareOpen}
          onClose={() => setIsExportShareOpen(false)}
          fileName={
            annotations.length > 0
              ? `${activePdf.originalName.replace(/\.pdf$/i, "")}_reviewed.pdf`
              : activePdf.originalName
          }
          fileSize={activePdf.size}
          mimeType="application/pdf"
          shareUrl={`/api/files/${activePdf.id}/download?token=${activePdf.shareToken}`}
          downloadUrl={`/api/files/${activePdf.id}/download?token=${activePdf.shareToken}`}
          fileBlob={exportShareBlob}
          customNote={`Collaborative PDF document reviewed in room "${roomName}".`}
        />
      )}
    </div>
  );
}
