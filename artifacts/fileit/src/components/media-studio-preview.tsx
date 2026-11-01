import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  Volume2,
  Volume1,
  VolumeX,
  RotateCcw,
  RotateCw,
  Camera,
  Maximize,
  Minimize,
  Repeat,
  Music,
  Video as VideoIcon,
  Sparkles,
  Activity,
  BarChart3,
  Waves,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { inspectFileType } from "@/lib/file-type-helpers";
import { useDynamicBubble } from "@/components/dynamic-bubble-context";

type VisualizerMode = "spectrum" | "waveform" | "neon_pulse";

export function MediaStudioPreview({
  url,
  fileName,
  type = "audio",
  className = "",
}: {
  url: string;
  fileName: string;
  type?: "audio" | "video";
  className?: string;
}) {
  const { toast } = useToast();
  const { playMedia } = useDynamicBubble();
  const mediaContainerRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Web Audio API References
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const connectedElementRef = useRef<HTMLMediaElement | null>(null);

  // Playback & Scrubber States
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLooping, setIsLooping] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);

  // Real-time Sound Metrics
  const [visualizerMode, setVisualizerMode] = useState<VisualizerMode>("spectrum");
  const [bassLevel, setBassLevel] = useState(0);
  const [midLevel, setMidLevel] = useState(0);
  const [trebleLevel, setTrebleLevel] = useState(0);

  const meta = inspectFileType(fileName);

  // Format seconds to mm:ss or hh:mm:ss
  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0 || !isFinite(seconds)) return "00:00";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const getMediaElement = useCallback((): HTMLMediaElement | null => {
    return type === "audio" ? audioRef.current : videoRef.current;
  }, [type]);

  // ── Web Audio API Initialization ──────────────────────────────────────────
  const setupWebAudio = useCallback(() => {
    const el = getMediaElement();
    if (!el) return;

    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx || typeof AudioCtx !== "function") return;
        try {
          audioCtxRef.current = new AudioCtx();
        } catch {
          return;
        }
      }

      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      if (!analyserRef.current) {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.82;
        analyserRef.current = analyser;
      }

      // Connect media element if not already connected
      if (connectedElementRef.current !== el) {
        try {
          const source = ctx.createMediaElementSource(el);
          source.connect(analyserRef.current);
          analyserRef.current.connect(ctx.destination);
          sourceNodeRef.current = source;
          connectedElementRef.current = el;
        } catch {
          // If already connected or CORS-protected, browser will stream normally
        }
      }
    } catch {
      // Best-effort Web Audio setup
    }
  }, [getMediaElement]);

  // ── Real-time Canvas Visualizer Animation Loop ─────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let simulatedPhase = 0;
    const freqData = new Uint8Array(128);
    const timeData = new Uint8Array(128);

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      let hasRealAudio = false;
      if (analyserRef.current && isPlaying) {
        analyserRef.current.getByteFrequencyData(freqData);
        analyserRef.current.getByteTimeDomainData(timeData);

        // Calculate frequency bands
        let bassSum = 0;
        let midSum = 0;
        let trebleSum = 0;
        for (let i = 0; i < 16; i++) bassSum += freqData[i];
        for (let i = 16; i < 64; i++) midSum += freqData[i];
        for (let i = 64; i < 128; i++) trebleSum += freqData[i];

        setBassLevel(Math.round((bassSum / 16 / 255) * 100));
        setMidLevel(Math.round((midSum / 48 / 255) * 100));
        setTrebleLevel(Math.round((trebleSum / 64 / 255) * 100));

        // Check if real signal is flowing
        if (bassSum > 0 || midSum > 0 || trebleSum > 0) {
          hasRealAudio = true;
        }
      }

      // ── MODE 1: DYNAMIC SPECTRUM EQUALIZER BARS ──
      if (visualizerMode === "spectrum") {
        const numBars = 36;
        const barWidth = 6;
        const totalBarWidth = numBars * barWidth;
        const gap = Math.max(2, (width - totalBarWidth) / (numBars - 1));

        for (let i = 0; i < numBars; i++) {
          const x = i * (barWidth + gap);
          let amplitude = 0.08;

          if (hasRealAudio) {
            const dataIndex = Math.floor((i / numBars) * 64);
            amplitude = freqData[dataIndex] / 255;
          } else if (isPlaying) {
            // Simulated harmonic resonance fallback
            amplitude = Math.sin(simulatedPhase + i * 0.28) * 0.4 + 0.5;
          }

          const barHeight = Math.max(4, height * amplitude * 0.92);
          const y = height - barHeight;

          // Dynamic vibrant gradient
          const grad = ctx.createLinearGradient(0, y, 0, height);
          grad.addColorStop(0, "#f43f5e"); // Rose peak
          grad.addColorStop(0.4, "#a855f7"); // Purple mid
          grad.addColorStop(1, "#3b82f6"); // Blue base
          ctx.fillStyle = grad;

          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, [3, 3, 1, 1]);
          ctx.fill();

          // Peak cap indicator
          if (amplitude > 0.25) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(x, Math.max(0, y - 2), barWidth, 1.5);
          }
        }
      }

      // ── MODE 2: DYNAMIC WAVEFORM OSCILLOSCOPE ──
      else if (visualizerMode === "waveform") {
        ctx.lineWidth = 2.5;
        const grad = ctx.createLinearGradient(0, 0, width, 0);
        grad.addColorStop(0, "#06b6d4");
        grad.addColorStop(0.5, "#ec4899");
        grad.addColorStop(1, "#8b5cf6");
        ctx.strokeStyle = grad;
        ctx.beginPath();

        const sliceWidth = width / 128;
        let x = 0;

        for (let i = 0; i < 128; i++) {
          let v = 128;
          if (hasRealAudio) {
            v = timeData[i];
          } else if (isPlaying) {
            v = 128 + Math.sin(simulatedPhase * 1.5 + i * 0.15) * 35;
          }

          const y = (v / 255) * height;
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.stroke();

        // Subtle glow reflection
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(236, 72, 153, 0.35)";
        ctx.stroke();
      }

      // ── MODE 3: NEON PULSE CORE ──
      else if (visualizerMode === "neon_pulse") {
        const centerX = width / 2;
        const centerY = height / 2;
        let power = 0.15;

        if (hasRealAudio) {
          let sum = 0;
          for (let i = 0; i < 32; i++) sum += freqData[i];
          power = sum / 32 / 255;
        } else if (isPlaying) {
          power = Math.sin(simulatedPhase * 2) * 0.35 + 0.45;
        }

        const radius = Math.max(10, (height / 2.6) * (0.6 + power * 0.65));

        // Outer glow
        const radGrad = ctx.createRadialGradient(centerX, centerY, 4, centerX, centerY, radius * 1.8);
        radGrad.addColorStop(0, "rgba(244, 63, 94, 0.8)");
        radGrad.addColorStop(0.5, "rgba(168, 85, 247, 0.35)");
        radGrad.addColorStop(1, "rgba(59, 130, 246, 0)");

        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 1.8, 0, Math.PI * 2);
        ctx.fill();

        // Core Circle
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(centerX, centerY, Math.max(4, radius * 0.35), 0, Math.PI * 2);
        ctx.fill();
      }

      if (isPlaying) simulatedPhase += 0.09;
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, visualizerMode]);

  // ── Play / Pause Toggle ───────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const el = getMediaElement();
    if (!el) return;

    setupWebAudio();

    if (isPlaying) {
      el.pause();
    } else {
      el.play().catch(() => {
        // Autoplay policy or media source error handling
      });
    }
  }, [getMediaElement, isPlaying, setupWebAudio]);

  // ── Timeline Scrubber & Adjuster Mechanics (Fixed & Smooth) ───────────────
  const handleScrubStart = (val: number[]) => {
    setIsScrubbing(true);
    setScrubValue(val[0]);
  };

  const handleScrubMove = (val: number[]) => {
    setScrubValue(val[0]);
    setCurrentTime(val[0]);
  };

  const handleScrubCommit = (val: number[]) => {
    const target = val[0];
    const el = getMediaElement();
    if (el && isFinite(target)) {
      el.currentTime = target;
      setCurrentTime(target);
    }
    setIsScrubbing(false);
  };

  const handleSkip = (seconds: number) => {
    const el = getMediaElement();
    if (!el) return;
    const newTime = Math.min(Math.max(0, el.currentTime + seconds), duration || el.duration || 0);
    el.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleSpeedChange = (speed: number) => {
    const el = getMediaElement();
    if (!el) return;
    el.playbackRate = speed;
    setPlaybackRate(speed);
  };

  const handleTakeSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${fileName.replace(/\.[^/.]+$/, "")}_Frame_${Math.round(currentTime)}s.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    toast({
      title: "Video Snapshot Saved",
      description: `Saved frame at ${formatTime(currentTime)} as PNG.`,
    });
  };

  // Fullscreen Toggle
  const toggleFullscreen = () => {
    if (!mediaContainerRef.current) return;
    if (!document.fullscreenElement) {
      mediaContainerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // ── Keyboard Shortcuts (Space, Left, Right, Up, Down, M, F) ───────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === "Space" || e.key === "k") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "ArrowLeft" || e.key === "j") {
        e.preventDefault();
        handleSkip(-5);
      } else if (e.code === "ArrowRight" || e.key === "l") {
        e.preventDefault();
        handleSkip(5);
      } else if (e.code === "ArrowUp") {
        e.preventDefault();
        const el = getMediaElement();
        if (el) {
          const newVol = Math.min(1, volume + 0.1);
          el.volume = newVol;
          setVolume(newVol);
          setIsMuted(false);
        }
      } else if (e.code === "ArrowDown") {
        e.preventDefault();
        const el = getMediaElement();
        if (el) {
          const newVol = Math.max(0, volume - 0.1);
          el.volume = newVol;
          setVolume(newVol);
        }
      } else if (e.key === "m") {
        e.preventDefault();
        const el = getMediaElement();
        if (el) {
          el.muted = !isMuted;
          setIsMuted(!isMuted);
        }
      } else if (e.key === "f" && type === "video") {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, volume, isMuted, type, getMediaElement]);

  const activeTime = isScrubbing ? scrubValue : currentTime;
  const progressPercent = duration > 0 ? (activeTime / duration) * 100 : 0;

  return (
    <div
      ref={mediaContainerRef}
      className={`bg-card rounded-3xl border border-border overflow-hidden flex flex-col shadow-lg transition-all ${className}`}
    >
      {/* ── Top Header Bar ── */}
      <div className="px-4 py-3 border-b border-border bg-secondary/30 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center border shrink-0 ${
              type === "audio"
                ? "bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/20"
                : "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20"
            }`}
          >
            {type === "audio" ? <Music className="w-4 h-4" /> : <VideoIcon className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-foreground truncate max-w-[180px] sm:max-w-xs">{fileName}</span>
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold border shrink-0 ${
                  type === "audio"
                    ? "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20"
                    : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                }`}
              >
                {meta.extension.toUpperCase()}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground font-mono">
              {formatTime(activeTime)} / {formatTime(duration)} • {playbackRate}x speed
            </p>
          </div>
        </div>

        {/* Action Controls in Header */}
        <div className="flex items-center gap-1.5 shrink-0">
          {type === "audio" && (
            <div className="flex items-center gap-1 bg-background/80 p-0.5 rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setVisualizerMode("spectrum")}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors ${
                  visualizerMode === "spectrum" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                title="Spectrum Equalizer"
              >
                <BarChart3 className="w-3 h-3" />
                <span className="hidden sm:inline">Bars</span>
              </button>
              <button
                type="button"
                onClick={() => setVisualizerMode("waveform")}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors ${
                  visualizerMode === "waveform" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                title="Oscilloscope Waveform"
              >
                <Waves className="w-3 h-3" />
                <span className="hidden sm:inline">Wave</span>
              </button>
              <button
                type="button"
                onClick={() => setVisualizerMode("neon_pulse")}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors ${
                  visualizerMode === "neon_pulse" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                title="Neon Core Pulse"
              >
                <Zap className="w-3 h-3" />
                <span className="hidden sm:inline">Core</span>
              </button>
            </div>
          )}

          {type === "audio" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const el = getMediaElement();
                if (el) el.pause();
                playMedia({ id: fileName, title: fileName, url, type: "audio" });
                toast({
                  title: "Background Listening Active",
                  description: "Audio routed to Dynamic Island for persistent playback.",
                });
              }}
              className="h-8 text-xs font-bold rounded-xl gap-1.5 border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10"
              title="Play continuously in top Dynamic Island"
            >
              <Music className="w-3.5 h-3.5 text-purple-500" />
              <span>Island Play</span>
            </Button>
          )}

          {type === "video" && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleTakeSnapshot}
                className="h-8 text-xs font-bold rounded-xl gap-1.5"
                title="Capture high-res frame snapshot"
              >
                <Camera className="w-3.5 h-3.5 text-purple-500" />
                <span className="hidden sm:inline">Capture</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={toggleFullscreen}
                className="h-8 w-8 p-0 rounded-xl"
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Main Stage Area ── */}
      {type === "audio" ? (
        <div className="p-6 sm:p-8 flex flex-col items-center justify-center bg-gradient-to-b from-card via-secondary/20 to-secondary/40 gap-5">
          <audio
            ref={audioRef}
            src={url}
            loop={isLooping}
            crossOrigin="anonymous"
            onTimeUpdate={() => {
              if (!isScrubbing && audioRef.current) {
                setCurrentTime(audioRef.current.currentTime);
              }
            }}
            onDurationChange={() => audioRef.current && setDuration(audioRef.current.duration)}
            onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
          />

          {/* Dynamic Frequency Bands Indicators */}
          <div className="flex items-center gap-3 sm:gap-6 text-[10px] font-mono font-bold text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="text-pink-500">BASS</span>
              <div className="w-12 sm:w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-pink-500 transition-all duration-75" style={{ width: `${bassLevel}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-purple-500">MIDS</span>
              <div className="w-12 sm:w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 transition-all duration-75" style={{ width: `${midLevel}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-blue-500">TREBLE</span>
              <div className="w-12 sm:w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 transition-all duration-75" style={{ width: `${trebleLevel}%` }} />
              </div>
            </div>
          </div>

          {/* Canvas Waveform / Spectrum Display */}
          <div className="w-full max-w-lg h-28 sm:h-32 bg-card/80 backdrop-blur-md rounded-2xl border border-border p-3 flex items-center justify-center shadow-inner relative overflow-hidden">
            <canvas ref={canvasRef} width={480} height={100} className="w-full h-full" />
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center bg-black/95 p-2 relative group overflow-hidden">
          <video
            ref={videoRef}
            src={url}
            loop={isLooping}
            controls={false}
            playsInline
            crossOrigin="anonymous"
            className="max-w-full max-h-[55vh] sm:max-h-[65vh] rounded-xl object-contain shadow-2xl cursor-pointer"
            onTimeUpdate={() => {
              if (!isScrubbing && videoRef.current) {
                setCurrentTime(videoRef.current.currentTime);
              }
            }}
            onDurationChange={() => videoRef.current && setDuration(videoRef.current.duration)}
            onLoadedMetadata={() => videoRef.current && setDuration(videoRef.current.duration)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            onClick={togglePlay}
          />

          {/* Big Center Play/Pause Overlay Indicator on Hover */}
          {!isPlaying && (
            <div
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px] cursor-pointer"
            >
              <div className="w-16 h-16 rounded-full bg-primary/90 text-primary-foreground flex items-center justify-center shadow-2xl transition-transform hover:scale-110">
                <Play className="w-8 h-8 ml-1" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Media Studio Bottom Control Center ── */}
      <div className="p-4 bg-secondary/40 border-t border-border space-y-3">
        {/* Interactive Smooth Timeline Scrubber */}
        <div className="space-y-1">
          <div
            className="relative flex items-center group py-1.5 cursor-pointer"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pos = (e.clientX - rect.left) / rect.width;
              setHoverPosition(e.clientX - rect.left);
              setHoverTime(Math.max(0, Math.min(pos * (duration || 0), duration || 0)));
            }}
            onMouseLeave={() => setHoverTime(null)}
          >
            {/* Hover Timestamp Tooltip */}
            {hoverTime !== null && duration > 0 && (
              <div
                className="absolute -top-7 px-2 py-0.5 bg-black/85 text-white text-[10px] font-mono font-bold rounded-md pointer-events-none transform -translate-x-1/2 shadow-md border border-white/10"
                style={{ left: `${hoverPosition}px` }}
              >
                {formatTime(hoverTime)}
              </div>
            )}

            <Slider
              value={[activeTime]}
              max={duration || 100}
              step={0.05}
              onValueChange={handleScrubMove}
              onPointerDown={() => handleScrubStart([activeTime])}
              onPointerUp={() => handleScrubCommit([activeTime])}
              className="flex-1 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground px-0.5">
            <span>{formatTime(activeTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Master Controls Row */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Left: Speed multiplier buttons */}
          <div className="flex items-center gap-1">
            {[0.75, 1, 1.25, 1.5, 2].map((speed) => (
              <button
                key={speed}
                type="button"
                onClick={() => handleSpeedChange(speed)}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  playbackRate === speed
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>

          {/* Center: Rewind, Play/Pause, Forward, Loop */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleSkip(-5)}
              className="h-9 w-9 p-0 rounded-full text-foreground hover:bg-secondary"
              title="Rewind 5s (←)"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>

            <Button
              size="sm"
              onClick={togglePlay}
              className="h-11 w-11 rounded-full p-0 shadow-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 transition-transform"
              title="Play / Pause (Space)"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleSkip(5)}
              className="h-9 w-9 p-0 rounded-full text-foreground hover:bg-secondary"
              title="Forward 5s (→)"
            >
              <RotateCw className="w-4 h-4" />
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsLooping(!isLooping)}
              className={`h-9 w-9 p-0 rounded-full transition-colors ${
                isLooping ? "text-primary bg-primary/15 font-bold" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
              title={isLooping ? "Loop is ON" : "Loop is OFF"}
            >
              <Repeat className="w-4 h-4" />
            </Button>
          </div>

          {/* Right: Volume Slider */}
          <div className="flex items-center gap-2 w-32 sm:w-36">
            <button
              type="button"
              onClick={() => {
                const el = getMediaElement();
                if (!el) return;
                el.muted = !isMuted;
                setIsMuted(!isMuted);
              }}
              className="text-muted-foreground hover:text-foreground p-1 transition-colors"
              title={isMuted ? "Unmute (M)" : "Mute (M)"}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-destructive" />
              ) : volume < 0.5 ? (
                <Volume1 className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <Slider
              value={[isMuted ? 0 : volume]}
              max={1}
              step={0.02}
              onValueChange={(val) => {
                const el = getMediaElement();
                if (!el) return;
                el.volume = val[0];
                el.muted = false;
                setVolume(val[0]);
                setIsMuted(val[0] === 0);
              }}
              className="flex-1 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
