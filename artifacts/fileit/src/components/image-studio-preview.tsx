import React, { useState, useRef, useEffect } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Download,
  Maximize2,
  RefreshCcw,
  Sparkles,
  Layers,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { inspectFileType } from "@/lib/file-type-helpers";

export function ImageStudioPreview({
  url,
  fileName,
  size,
  className = "",
}: {
  url: string;
  fileName: string;
  size?: number;
  className?: string;
}) {
  const { toast } = useToast();
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [filter, setFilter] = useState<"none" | "grayscale" | "sepia" | "contrast" | "invert">("none");
  const [imgDimensions, setImgDimensions] = useState<{ width: number; height: number } | null>(null);

  const imgRef = useRef<HTMLImageElement | null>(null);

  const meta = inspectFileType(fileName);

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setFilter("none");
  };

  const handleExportFiltered = () => {
    if (!imgRef.current) return;
    const img = imgRef.current;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rads = (rotation * Math.PI) / 180;
    const isSideways = rotation % 180 !== 0;

    canvas.width = isSideways ? img.naturalHeight : img.naturalWidth;
    canvas.height = isSideways ? img.naturalWidth : img.naturalHeight;

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rads);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

    if (filter === "grayscale") ctx.filter = "grayscale(100%)";
    else if (filter === "sepia") ctx.filter = "sepia(100%)";
    else if (filter === "contrast") ctx.filter = "contrast(150%)";
    else if (filter === "invert") ctx.filter = "invert(100%)";

    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${fileName.replace(/\.[^/.]+$/, "")}_Processed.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    toast({
      title: "Image Exported",
      description: "Saved transformed image to disk as PNG.",
    });
  };

  const filterStyle =
    filter === "grayscale"
      ? "grayscale(100%)"
      : filter === "sepia"
      ? "sepia(100%)"
      : filter === "contrast"
      ? "contrast(150%)"
      : filter === "invert"
      ? "invert(100%)"
      : "none";

  const transformStyle = `scale(${zoom * (flipH ? -1 : 1)}, ${zoom * (flipV ? -1 : 1)}) rotate(${rotation}deg)`;

  return (
    <div className={`bg-card rounded-2xl border border-border overflow-hidden flex flex-col shadow-xs ${className}`}>
      {/* Top Image Studio Header */}
      <div className="px-4 py-3 border-b border-border bg-secondary/30 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-500/20 shrink-0">
            <ImageIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-foreground truncate">{fileName}</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                {meta.extension}
              </span>
            </div>
            {imgDimensions && (
              <p className="text-[10px] text-muted-foreground font-mono">
                {imgDimensions.width} × {imgDimensions.height} px •{" "}
                {( (imgDimensions.width * imgDimensions.height) / 1000000 ).toFixed(1)} MP •{" "}
                {Math.round(zoom * 100)}% zoom
              </p>
            )}
          </div>
        </div>

        {/* Action button */}
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportFiltered}
            className="h-8 text-xs font-bold rounded-xl gap-1.5"
            title="Download transformed image"
          >
            <Download className="w-3.5 h-3.5 text-primary" />
            <span className="hidden sm:inline">Export PNG</span>
          </Button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div className="p-4 sm:p-8 flex items-center justify-center bg-black/90 min-h-[380px] max-h-[70vh] overflow-hidden relative select-none">
        <img
          ref={imgRef}
          src={url}
          alt={fileName}
          onLoad={(e) => {
            const target = e.currentTarget;
            setImgDimensions({ width: target.naturalWidth, height: target.naturalHeight });
          }}
          style={{
            transform: transformStyle,
            filter: filterStyle,
            transition: "transform 0.2s ease, filter 0.2s ease",
          }}
          className="max-w-full max-h-[58vh] object-contain rounded-xl shadow-2xl pointer-events-auto"
        />
      </div>

      {/* Studio Tooling Bar */}
      <div className="p-3 bg-secondary/40 border-t border-border flex items-center justify-between gap-3 flex-wrap">
        {/* Zoom Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <Slider
            value={[zoom]}
            min={0.25}
            max={3}
            step={0.05}
            onValueChange={(val) => setZoom(val[0])}
            className="w-24 sm:w-32"
          />
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        {/* Rotate & Flip */}
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="h-8 px-2 text-xs font-medium rounded-lg gap-1"
            title="Rotate 90 degrees"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Rotate</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setFlipH(!flipH)}
            className={`h-8 px-2 text-xs font-medium rounded-lg gap-1 ${
              flipH ? "bg-primary/10 text-primary" : ""
            }`}
            title="Flip Horizontal"
          >
            <FlipHorizontal className="w-3.5 h-3.5" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setFlipV(!flipV)}
            className={`h-8 px-2 text-xs font-medium rounded-lg gap-1 ${
              flipV ? "bg-primary/10 text-primary" : ""
            }`}
            title="Flip Vertical"
          >
            <FlipVertical className="w-3.5 h-3.5" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleReset}
            className="h-8 px-2 text-xs font-medium rounded-lg gap-1 text-muted-foreground hover:text-foreground"
            title="Reset Transformations"
          >
            <RefreshCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </Button>
        </div>

        {/* Filter Presets */}
        <div className="flex items-center gap-1">
          {(["none", "grayscale", "sepia", "contrast", "invert"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-2 py-1 rounded-md text-[11px] font-bold capitalize transition-all ${
                filter === f
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
