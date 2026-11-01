import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import jsQR from "jsqr";
import {
  AlertCircle,
  ScanLine,
  Camera,
  Flashlight,
  Upload,
  RefreshCw,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function QRScanPage() {
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [inputUrl, setInputUrl] = useState("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [scannedResult, setScannedResult] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const [, navigate] = useLocation();

  const playChime = () => {
    try {
      if (typeof window !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([40, 60, 40]);
      }
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx || typeof AudioCtx !== "function") return;
      let ctx;
      try {
        ctx = new AudioCtx();
      } catch {
        return;
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // AudioContext audio playback best-effort
    }
  };

  const handleNavigate = (rawUrl: string) => {
    if (!rawUrl.trim()) return;
    const url = rawUrl.trim();
    playChime();
    setScannedResult(url);

    toast({
      title: "QR Code Detected",
      description: `Redirecting to destination...`,
    });

    setTimeout(() => {
      // Check if it's a 6-digit PIN
      if (/^\d{6}$/.test(url)) {
        navigate(`/connectivity?code=${url}`);
        return;
      }

      // Check if it's a relative path or full URL
      try {
        if (url.startsWith("/") || url.startsWith("#")) {
          navigate(url);
        } else {
          const parsed = new URL(url);
          if (parsed.origin === window.location.origin) {
            navigate(parsed.pathname + parsed.search + parsed.hash);
          } else {
            // Check if it matches our app structure
            navigate(parsed.pathname + parsed.search + parsed.hash);
          }
        }
      } catch {
        // If not a full URL, attempt navigating as path
        navigate(`/${url.replace(/^\/+/, "")}`);
      }
    }, 600);
  };

  // Process a local image file for QR codes
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code && code.data) {
          handleNavigate(code.data);
        } else {
          toast({
            variant: "destructive",
            title: "No QR Code Found",
            description: "Could not detect a valid QR code in the uploaded image.",
          });
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const newTorch = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: newTorch }],
      });
      setTorchOn(newTorch);
    } catch {
      toast({
        variant: "destructive",
        title: "Torch Unavailable",
        description: "Flashlight is not supported by this camera sensor.",
      });
    }
  };

  useEffect(() => {
    if (!scanning) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setTorchOn(false);
      setHasTorch(false);
      return;
    }

    let stopped = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities ? (track.getCapabilities() as any) : {};
        setHasTorch(Boolean(capabilities.torch));

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // jsQR scanner loop
        const barcodeDetector = null;

        const scanLoop = async () => {
          if (stopped || !videoRef.current) return;

          const video = videoRef.current;
          if (video.readyState >= video.HAVE_CURRENT_DATA) {
            // 1. Try Native BarcodeDetector
            if (barcodeDetector) {
              try {
                const barcodes = await barcodeDetector.detect(video);
                if (barcodes.length > 0 && barcodes[0].rawValue) {
                  setScanning(false);
                  handleNavigate(barcodes[0].rawValue);
                  return;
                }
              } catch {
                // Fallback to jsQR below
              }
            }

            // 2. jsQR Canvas fallback
            if (canvasRef.current) {
              const canvas = canvasRef.current;
              const ctx = canvas.getContext("2d", { willReadFrequently: true });
              if (ctx) {
                canvas.width = video.videoWidth || 640;
                canvas.height = video.videoHeight || 480;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const qr = jsQR(imgData.data, imgData.width, imgData.height, {
                  inversionAttempts: "dontInvert",
                });
                if (qr && qr.data) {
                  setScanning(false);
                  handleNavigate(qr.data);
                  return;
                }
              }
            }
          }

          if (!stopped) {
            animFrameRef.current = requestAnimationFrame(scanLoop);
          }
        };

        animFrameRef.current = requestAnimationFrame(scanLoop);
      } catch (err: any) {
        setError("Could not access camera. Please allow camera permissions and ensure no other app is using it.");
        setScanning(false);
      }
    })();

    return () => {
      stopped = true;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [scanning, facingMode]);

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-4 sm:p-6 gap-6">
      {/* Hidden processing canvas for jsQR */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <div className="text-center space-y-1 max-w-sm">
        <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-3 border border-primary/20 shadow-xs">
          <ScanLine className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-black text-foreground tracking-tight">Universal QR Scanner</h1>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Instantly pair with Phone Link, connect to P2P rooms, or open shared files
        </p>
      </div>

      {/* Scanner Viewport */}
      <div className="w-full max-w-sm aspect-square rounded-3xl border-2 border-border bg-card overflow-hidden flex items-center justify-center relative shadow-lg">
        {scanning ? (
          <>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              muted
              playsInline
            />
            {/* Animated Reticle Overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-56 h-56 border-2 border-primary/80 rounded-2xl relative">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-primary -mt-1 -ml-1 rounded-tl" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-primary -mt-1 -mr-1 rounded-tr" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-primary -mb-1 -ml-1 rounded-bl" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-primary -mb-1 -mr-1 rounded-br" />
                {/* Laser scan bar */}
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse absolute top-1/2 -translate-y-1/2 shadow-sm shadow-primary" />
              </div>
            </div>

            {/* Quick in-camera control pills */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-auto bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
              <button
                type="button"
                onClick={() => setFacingMode((f) => (f === "environment" ? "user" : "environment"))}
                className="text-white text-xs font-bold flex items-center gap-1 hover:text-primary transition-colors"
                title="Switch Camera"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Flip</span>
              </button>

              {hasTorch && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className={`text-xs font-bold flex items-center gap-1 transition-colors ${
                    torchOn ? "text-amber-400" : "text-white hover:text-amber-300"
                  }`}
                  title="Flashlight"
                >
                  <Flashlight className="w-3.5 h-3.5" />
                  <span>{torchOn ? "Torch On" : "Torch"}</span>
                </button>
              )}

              <span className="text-[10px] text-white/70 font-mono">Live Sensing</span>
            </div>
          </>
        ) : (
          <div className="text-center space-y-3 p-8 text-muted-foreground">
            {scannedResult ? (
              <div className="space-y-2">
                <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 animate-bounce" />
                <p className="text-xs font-bold text-foreground">Scanned Successfully!</p>
                <p className="text-[11px] font-mono text-muted-foreground truncate max-w-[220px]">
                  {scannedResult}
                </p>
              </div>
            ) : error ? (
              <div className="space-y-2">
                <AlertCircle className="w-8 h-8 mx-auto text-destructive" />
                <p className="text-destructive text-xs leading-relaxed">{error}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-secondary/80 flex items-center justify-center mx-auto text-muted-foreground">
                  <ScanLine className="w-6 h-6" />
                </div>
                <p className="text-xs font-medium text-foreground">Camera is currently idle</p>
                <p className="text-[11px] text-muted-foreground">
                  Tap below to start camera or upload an image containing a QR code
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls & Options */}
      <div className="w-full max-w-sm space-y-3">
        <Button
          className="w-full h-12 font-bold rounded-2xl text-sm shadow-md"
          onClick={() => {
            setError("");
            setScannedResult(null);
            setScanning((s) => !s);
          }}
        >
          {scanning ? "Stop Camera" : "Start Live Scanner"}
        </Button>

        {/* Upload QR image option */}
        <label className="w-full h-10 flex items-center justify-center gap-2 border border-border bg-card hover:bg-secondary/60 rounded-2xl text-xs font-semibold cursor-pointer transition-colors text-foreground">
          <Upload className="w-3.5 h-3.5 text-primary" />
          <span>Scan from Photo / Screenshot</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
        </label>

        <div className="relative pt-1">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-[10px] font-bold uppercase">
            <span className="bg-background px-2 text-muted-foreground">or enter PIN / Link</span>
          </div>
        </div>

        {/* Direct Link or PIN input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleNavigate(inputUrl)}
            placeholder="6-digit PIN or paste link"
            className="flex-1 px-3.5 py-2.5 rounded-xl border border-border bg-card text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <Button
            variant="outline"
            className="rounded-xl px-4 text-xs font-bold"
            onClick={() => handleNavigate(inputUrl)}
          >
            Connect
          </Button>
        </div>

        <Button
          variant="ghost"
          className="w-full h-10 text-xs text-muted-foreground hover:text-foreground mt-2 rounded-xl"
          onClick={() => navigate("/")}
        >
          Cancel & Return Home
        </Button>
      </div>
    </div>
  );
}

