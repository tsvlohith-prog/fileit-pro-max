import React, { useState, useEffect, useRef } from "react";
import { X, Copy, Check, QrCode, Camera, KeyRound, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QRCodeSVG } from "qrcode.react";
import { useToast } from "@/hooks/use-toast";
import { useP2PConnection } from "@/components/p2p-connection-context";
import jsQR from "jsqr";

interface QrPairModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QrPairModal({ isOpen, onClose }: QrPairModalProps) {
  const { toast } = useToast();
  const {
    sessionCode,
    startAsInitiator,
    startAsReceiver,
    p2pState,
    enteredCode,
    setEnteredCode,
  } = useP2PConnection();

  const [activeTab, setActiveTab] = useState<"qr" | "scan" | "code">("qr");
  const [copiedLink, setCopiedLink] = useState(false);
  const [isInitializingHost, setIsInitializingHost] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Camera Scanner Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Auto-initiate host session when opening on 'qr' tab if not already present
  useEffect(() => {
    if (isOpen && activeTab === "qr" && !sessionCode && p2pState !== "connected" && !isInitializingHost) {
      setIsInitializingHost(true);
      startAsInitiator().finally(() => setIsInitializingHost(false));
    }
  }, [isOpen, activeTab, sessionCode, p2pState, isInitializingHost, startAsInitiator]);

  // Close modal when successfully connected
  useEffect(() => {
    if (p2pState === "connected" && isOpen) {
      onClose();
    }
  }, [p2pState, isOpen, onClose]);

  // Full direct URL to auto-join
  const pairUrl = typeof window !== "undefined" && sessionCode
    ? `${window.location.origin}/connectivity?join=${sessionCode}`
    : "";

  // ── Camera Scanner Lifecycle ────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || activeTab !== "scan") {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
        videoRef.current.srcObject = null;
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      return;
    }

    let isScanning = true;
    setCameraError(null);

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        if (!isScanning) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "true");
          videoRef.current.play().catch(() => {});
        }

        const scanFrame = () => {
          if (!isScanning) return;
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.height = video.videoHeight;
            canvas.width = video.videoWidth;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "dontInvert",
              });

              if (code && code.data) {
                // Check if scanned code has join URL or PIN
                let extractedCode = code.data.trim();
                if (extractedCode.includes("join=")) {
                  const match = extractedCode.match(/join=([0-9a-zA-Z]+)/);
                  if (match) extractedCode = match[1];
                }

                if (/^[0-9]{6}$/.test(extractedCode)) {
                  isScanning = false;
                  toast({ title: "QR Code Detected", description: `Joining session ${extractedCode}...` });
                  startAsReceiver(extractedCode);
                  return;
                }
              }
            }
          }
          animFrameRef.current = requestAnimationFrame(scanFrame);
        };

        animFrameRef.current = requestAnimationFrame(scanFrame);
      })
      .catch((err) => {
        setCameraError(err?.message || "Camera access denied. Please grant permission or use 6-digit code.");
      });

    return () => {
      isScanning = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isOpen, activeTab, startAsReceiver, toast]);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    if (!pairUrl) return;
    await navigator.clipboard.writeText(pairUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    toast({ title: "Pairing Link Copied", description: "Send this URL to your other device." });
  };

  const handleManualJoin = async () => {
    if (!enteredCode.trim()) return;
    setIsJoining(true);
    try {
      await startAsReceiver(enteredCode.trim());
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120000] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-card text-card-foreground border border-border/80 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-base font-bold text-foreground">1-Click Device Pairing</h3>
            <p className="text-xs text-muted-foreground">End-to-end encrypted direct WebRTC</p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-3 gap-1 bg-secondary/60 p-1 rounded-2xl border border-border/60">
          <button
            type="button"
            onClick={() => setActiveTab("qr")}
            className={`py-1.5 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === "qr"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Show QR</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("scan")}
            className={`py-1.5 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === "scan"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Scan QR</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("code")}
            className={`py-1.5 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === "code"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Enter PIN</span>
          </button>
        </div>

        {/* Tab 1: Show QR Code (Host) */}
        {activeTab === "qr" && (
          <div className="flex flex-col items-center text-center space-y-4 py-2">
            {isInitializingHost ? (
              <div className="w-[210px] h-[210px] rounded-2xl bg-secondary/50 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">Generating QR...</span>
              </div>
            ) : pairUrl ? (
              <>
                <div className="p-3 bg-white rounded-2xl shadow-inner inline-block border border-border/60">
                  <QRCodeSVG value={pairUrl} size={190} level="M" />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] font-mono font-bold tracking-widest text-primary block">
                    SESSION PIN: {sessionCode}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    Point your phone camera at this code to pair instantly.
                  </p>
                </div>
              </>
            ) : (
              <Button onClick={() => startAsInitiator()} size="sm" className="rounded-xl gap-2">
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Session</span>
              </Button>
            )}

            <Button
              onClick={handleCopyLink}
              disabled={!pairUrl}
              variant="outline"
              className="w-full rounded-2xl h-9 text-xs font-bold gap-2 border-border/80"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? "Link Copied" : "Copy Direct Pairing Link"}</span>
            </Button>
          </div>
        )}

        {/* Tab 2: Camera QR Scanner (Client/Mobile) */}
        {activeTab === "scan" && (
          <div className="space-y-3 py-1">
            <div className="relative aspect-square max-h-[220px] rounded-2xl overflow-hidden bg-black flex items-center justify-center border border-border">
              {cameraError ? (
                <div className="p-4 text-center text-xs text-rose-400">
                  {cameraError}
                </div>
              ) : (
                <>
                  <video ref={videoRef} className="w-full h-full object-cover" />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="absolute inset-4 border-2 border-dashed border-emerald-400 rounded-xl pointer-events-none animate-pulse" />
                </>
              )}
            </div>
            <p className="text-[11px] text-center text-muted-foreground">
              Align peer QR code inside the target frame.
            </p>
          </div>
        )}

        {/* Tab 3: Manual 6-Digit PIN Entry */}
        {activeTab === "code" && (
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">6-Digit Session PIN</label>
              <Input
                type="text"
                maxLength={6}
                value={enteredCode}
                onChange={(e) => setEnteredCode(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="e.g. 849201"
                className="h-11 rounded-xl text-center text-lg font-mono tracking-widest"
              />
            </div>
            <Button
              onClick={handleManualJoin}
              disabled={enteredCode.length !== 6 || isJoining}
              className="w-full rounded-2xl h-10 text-xs font-bold gap-2 bg-primary text-primary-foreground"
            >
              {isJoining && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isJoining ? "Negotiating..." : "Connect to Host"}</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
