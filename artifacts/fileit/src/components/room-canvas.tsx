import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Pen,
  Highlighter,
  Square,
  Circle as CircleIcon,
  ArrowRight,
  Minus,
  Eraser,
  RotateCcw,
  Trash2,
  Download,
  FolderPlus,
  Palette,
  Loader2,
  Check,
  Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getRoomToken } from "@/lib/rooms-storage";
import { RoomP2PMeshManager } from "@/lib/room-p2p-mesh";

export interface Stroke {
  id: string;
  tool: "pen" | "highlighter" | "eraser" | "line" | "arrow" | "rect" | "circle";
  color: string;
  width: number;
  points: Array<{ x: number; y: number }>;
}

interface RoomCanvasProps {
  roomId: string;
  roomName: string;
  meshManager?: RoomP2PMeshManager | null;
  onFileSavedToVault?: () => void;
}

const PRESET_COLORS = [
  "#ffffff", // White
  "#38bdf8", // Sky Blue
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#f43f5e", // Rose
  "#a855f7", // Purple
  "#000000", // Black
];

export function RoomCanvas({ roomId, roomName, meshManager, onFileSavedToVault }: RoomCanvasProps) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [tool, setTool] = useState<"pen" | "highlighter" | "eraser" | "line" | "arrow" | "rect" | "circle">("pen");
  const [color, setColor] = useState("#38bdf8");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const strokesRef = useRef<Stroke[]>([]);
  strokesRef.current = strokes;

  const [isDrawing, setIsDrawing] = useState(false);
  const [isSavingToVault, setIsSavingToVault] = useState(false);
  const [isLoadingCanvas, setIsLoadingCanvas] = useState(true);

  // In-progress stroke reference for 120fps direct rendering
  const activeStrokeRef = useRef<Stroke | null>(null);

  // Draw a single stroke onto a given 2D context
  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, st: Stroke) => {
    ctx.save();
    ctx.lineWidth = st.width;
    ctx.strokeStyle = st.color;
    ctx.fillStyle = st.color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (st.tool === "highlighter") {
      ctx.globalAlpha = 0.35;
    } else if (st.tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
    }

    const pts = st.points;
    if (!pts || pts.length === 0) {
      ctx.restore();
      return;
    }

    if (st.tool === "pen" || st.tool === "highlighter" || st.tool === "eraser") {
      if (pts.length === 1) {
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, st.width / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.stroke();
      }
    } else if (st.tool === "line" && pts.length >= 2) {
      const start = pts[0];
      const end = pts[pts.length - 1];
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    } else if (st.tool === "arrow" && pts.length >= 2) {
      const start = pts[0];
      const end = pts[pts.length - 1];
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const headLen = Math.max(10, st.width * 3.5);
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - headLen * Math.cos(angle - Math.PI / 6), end.y - headLen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(end.x - headLen * Math.cos(angle + Math.PI / 6), end.y - headLen * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    } else if (st.tool === "rect" && pts.length >= 2) {
      const start = pts[0];
      const end = pts[pts.length - 1];
      ctx.beginPath();
      ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
    } else if (st.tool === "circle" && pts.length >= 2) {
      const start = pts[0];
      const end = pts[pts.length - 1];
      const rx = Math.abs(end.x - start.x) / 2;
      const ry = Math.abs(end.y - start.y) / 2;
      const cx = Math.min(start.x, end.x) + rx;
      const cy = Math.min(start.y, end.y) + ry;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }, []);

  // Redraw all committed strokes on the canvas with Retina / DPR support
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    strokesRef.current.forEach((st) => {
      drawStroke(ctx, st);
    });
  }, [drawStroke]);

  // Handle Resize and Retina Scaling
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
    }

    redrawCanvas();
  }, [redrawCanvas]);

  // Initial load, resize listener, and server fetch
  useEffect(() => {
    handleResize();
    window.addEventListener("resize", handleResize);

    const token = getRoomToken(roomId);
    fetch(`/api/rooms/${roomId}/canvas`, {
      headers: token ? { "x-room-token": token } : {},
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.canvasData) {
          try {
            const loaded = JSON.parse(data.canvasData);
            if (Array.isArray(loaded)) {
              setStrokes(loaded);
              strokesRef.current = loaded;
              redrawCanvas();
            }
          } catch {}
        }
      })
      .finally(() => setIsLoadingCanvas(false));

    return () => window.removeEventListener("resize", handleResize);
  }, [roomId, handleResize, redrawCanvas]);

  // Redraw when strokes state updates
  useEffect(() => {
    redrawCanvas();
  }, [strokes, redrawCanvas]);

  // Listen to P2P Mesh Real-Time Stroke Broadcasts!
  useEffect(() => {
    if (!meshManager) return;

    meshManager.onCanvasStroke = (incomingStroke: Stroke) => {
      if (!incomingStroke || !incomingStroke.id) return;
      setStrokes((prev) => {
        if (prev.some((s) => s.id === incomingStroke.id)) return prev;
        const next = [...prev, incomingStroke];
        strokesRef.current = next;
        return next;
      });
    };

    meshManager.onCanvasClear = () => {
      setStrokes([]);
      strokesRef.current = [];
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        const dpr = window.devicePixelRatio || 1;
        if (ctx) ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      }
    };

    return () => {
      if (meshManager) {
        meshManager.onCanvasStroke = undefined;
        meshManager.onCanvasClear = undefined;
      }
    };
  }, [meshManager]);

  // Save to Server (Debounced)
  const saveCanvasToServer = useCallback(
    (newStrokes: Stroke[]) => {
      const token = getRoomToken(roomId);
      fetch(`/api/rooms/${roomId}/canvas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "x-room-token": token } : {}),
        },
        body: JSON.stringify({ canvasData: JSON.stringify(newStrokes) }),
      }).catch(() => {});
    },
    [roomId]
  );

  // Exact Pixel Coordinates Relative to Canvas
  const getCoordinates = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    let clientX = 0;
    let clientY = 0;

    if ("touches" in e) {
      const touch = e.touches[0] || (e as TouchEvent).changedTouches?.[0];
      if (touch) {
        clientX = touch.clientX;
        clientY = touch.clientY;
      }
    } else {
      clientX = (e as MouseEvent).clientX;
      clientY = (e as MouseEvent).clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  // Pointer Down: Start Drawing
  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if ("touches" in e) {
      e.stopPropagation();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setIsDrawing(true);
    const coords = getCoordinates(e);

    const newStroke: Stroke = {
      id: Math.random().toString(36).substring(2, 9),
      tool,
      color: tool === "eraser" ? "#000000" : color,
      width: tool === "highlighter" ? strokeWidth * 3 : tool === "eraser" ? strokeWidth * 4 : strokeWidth,
      points: [coords],
    };

    activeStrokeRef.current = newStroke;

    // Draw immediate initial dot
    drawStroke(ctx, newStroke);
  };

  // Pointer Move: 120fps Direct Canvas Rendering
  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !activeStrokeRef.current) return;
    if ("touches" in e && e.cancelable) {
      e.preventDefault();
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const coords = getCoordinates(e);
    const stroke = activeStrokeRef.current;
    stroke.points.push(coords);

    if (stroke.tool === "pen" || stroke.tool === "highlighter" || stroke.tool === "eraser") {
      // Freehand: Just draw the latest segment for optimal speed
      const len = stroke.points.length;
      if (len >= 2) {
        const p1 = stroke.points[len - 2];
        const p2 = stroke.points[len - 1];

        ctx.save();
        ctx.lineWidth = stroke.width;
        ctx.strokeStyle = stroke.color;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        if (stroke.tool === "highlighter") {
          ctx.globalAlpha = 0.35;
        } else if (stroke.tool === "eraser") {
          ctx.globalCompositeOperation = "destination-out";
        }

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.restore();
      }
    } else {
      // Shape (line, arrow, rect, circle): Redraw canvas then show in-progress shape preview
      redrawCanvas();
      drawStroke(ctx, stroke);
    }
  };

  // Pointer Up: Commit Stroke & Broadcast over Mesh
  const handlePointerUp = () => {
    if (!isDrawing || !activeStrokeRef.current) return;
    setIsDrawing(false);

    const completedStroke = activeStrokeRef.current;
    activeStrokeRef.current = null;

    if (completedStroke.points.length > 0) {
      const nextStrokes = [...strokesRef.current, completedStroke];
      setStrokes(nextStrokes);
      strokesRef.current = nextStrokes;

      // Broadcast stroke to other peers in room mesh
      if (meshManager) {
        meshManager.broadcastCanvasStroke(completedStroke);
      }

      // Save to server
      saveCanvasToServer(nextStrokes);
    }
  };

  const handleUndo = () => {
    if (strokes.length === 0) return;
    const next = strokes.slice(0, -1);
    setStrokes(next);
    strokesRef.current = next;
    saveCanvasToServer(next);
    redrawCanvas();
  };

  const handleClear = () => {
    if (strokes.length === 0) return;
    setStrokes([]);
    strokesRef.current = [];
    if (meshManager) {
      meshManager.broadcastCanvasClear();
    }
    saveCanvasToServer([]);
    redrawCanvas();
    toast({ title: "Whiteboard Cleared" });
  };

  const handleExportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const eCtx = exportCanvas.getContext("2d");
    if (!eCtx) return;

    eCtx.fillStyle = "#090d16"; // Deep slate backdrop
    eCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    eCtx.drawImage(canvas, 0, 0);

    const url = exportCanvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `whiteboard-${roomName.toLowerCase().replace(/[^a-z0-9_-]+/g, "-")}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast({ title: "Whiteboard Exported as PNG" });
  };

  const handleSaveToVault = async () => {
    const canvas = canvasRef.current;
    if (!canvas || strokes.length === 0) {
      toast({ variant: "destructive", title: "Canvas Empty", description: "Draw something before saving to vault." });
      return;
    }

    setIsSavingToVault(true);
    try {
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = canvas.width;
      exportCanvas.height = canvas.height;
      const eCtx = exportCanvas.getContext("2d");
      if (!eCtx) return;

      eCtx.fillStyle = "#090d16";
      eCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
      eCtx.drawImage(canvas, 0, 0);

      exportCanvas.toBlob(async (blob) => {
        if (!blob) {
          setIsSavingToVault(false);
          return;
        }

        const fileName = `whiteboard-${Date.now().toString().slice(-4)}.png`;
        const file = new File([blob], fileName, { type: "image/png" });

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
            description: `${fileName} is now available to all room members.`,
          });
          onFileSavedToVault?.();
        } else {
          throw new Error("Could not save to vault");
        }
        setIsSavingToVault(false);
      }, "image/png");
    } catch {
      setIsSavingToVault(false);
      toast({ variant: "destructive", title: "Failed to save whiteboard to vault" });
    }
  };

  return (
    <div className="flex flex-col rounded-3xl bg-card/70 backdrop-blur-xl border border-border/80 shadow-sm overflow-hidden h-[540px] sm:h-[600px] relative select-none">
      {/* Top Floating Whiteboard Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 sm:px-4 bg-secondary/50 border-b border-border/70 z-10">
        {/* Drawing Tools */}
        <div className="flex items-center gap-1 bg-card p-1 rounded-2xl border border-border/60 shadow-xs">
          <button
            type="button"
            onClick={() => setTool("pen")}
            className={`p-1.5 rounded-xl transition-colors ${
              tool === "pen" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
            title="Pen (P)"
          >
            <Pen className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setTool("highlighter")}
            className={`p-1.5 rounded-xl transition-colors ${
              tool === "highlighter" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
            title="Highlighter"
          >
            <Highlighter className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setTool("line")}
            className={`p-1.5 rounded-xl transition-colors ${
              tool === "line" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
            title="Line"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setTool("arrow")}
            className={`p-1.5 rounded-xl transition-colors ${
              tool === "arrow" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
            title="Arrow"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setTool("rect")}
            className={`p-1.5 rounded-xl transition-colors ${
              tool === "rect" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
            title="Rectangle"
          >
            <Square className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setTool("circle")}
            className={`p-1.5 rounded-xl transition-colors ${
              tool === "circle" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
            title="Circle"
          >
            <CircleIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setTool("eraser")}
            className={`p-1.5 rounded-xl transition-colors ${
              tool === "eraser" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
            title="Eraser"
          >
            <Eraser className="w-4 h-4" />
          </button>
        </div>

        {/* Color Palette & Stroke Weight */}
        <div className="flex items-center gap-2">
          {tool !== "eraser" && (
            <div className="flex items-center gap-1 bg-card px-2 py-1 rounded-2xl border border-border/60">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-4 h-4 rounded-full border border-border/60 transition-transform ${
                    color === c ? "scale-125 ring-2 ring-primary shadow-xs" : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          )}

          <select
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
            className="h-8 rounded-xl bg-card border border-border/60 text-xs font-mono px-2 text-foreground"
            title="Stroke Width"
          >
            <option value="2">2px</option>
            <option value="4">4px</option>
            <option value="8">8px</option>
            <option value="16">16px</option>
          </select>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleUndo}
            disabled={strokes.length === 0}
            className="h-8 w-8 rounded-xl"
            title="Undo"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            onClick={handleClear}
            disabled={strokes.length === 0}
            className="h-8 w-8 rounded-xl text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
            title="Clear Board"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportPng}
            disabled={strokes.length === 0}
            className="h-8 rounded-xl text-xs font-bold gap-1.5 border-border/80"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export PNG</span>
          </Button>

          <Button
            size="sm"
            onClick={handleSaveToVault}
            disabled={strokes.length === 0 || isSavingToVault}
            className="h-8 rounded-xl text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isSavingToVault ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderPlus className="w-3.5 h-3.5" />}
            <span>Save to Room</span>
          </Button>
        </div>
      </div>

      {/* Main Vector Canvas Container */}
      <div
        ref={containerRef}
        className="relative flex-1 bg-slate-950 overflow-hidden cursor-crosshair touch-none"
      >
        {isLoadingCanvas && (
          <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center z-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {/* Ambient Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:32px_32px] opacity-25 pointer-events-none" />

        <canvas
          ref={canvasRef}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
          className="absolute inset-0 touch-none block"
        />

        {strokes.length === 0 && !isLoadingCanvas && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-4">
            <Palette className="w-8 h-8 text-slate-700 mb-2" />
            <p className="text-xs font-medium text-slate-500">
              Interactive Room Whiteboard · Real-time P2P stroke streaming active
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
