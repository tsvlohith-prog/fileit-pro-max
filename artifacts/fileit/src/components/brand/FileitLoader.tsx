import React from "react";

interface FileitLoaderProps {
  size?: "sm" | "md" | "lg" | "xl";
  label?: string;
  sublabel?: string;
  variant?: "spinner" | "card" | "fullscreen" | "pulse";
  className?: string;
}

export function FileitLoader({
  size = "md",
  label,
  sublabel,
  variant = "spinner",
  className = "",
}: FileitLoaderProps) {
  const pixelSize =
    size === "sm" ? 28 : size === "lg" ? 56 : size === "xl" ? 72 : 40;

  const spinnerContent = (
    <div
      className="relative flex items-center justify-center"
      style={{ width: pixelSize, height: pixelSize }}
    >
      {/* Ambient background glow */}
      <div className="absolute inset-0 rounded-full bg-primary/15 blur-md animate-pulse" />

      {/* Outer segmented rotating orbital ring */}
      <svg
        className="w-full h-full animate-spin [animation-duration:2.4s]"
        viewBox="0 0 48 48"
        fill="none"
      >
        <circle
          cx="24"
          cy="24"
          r="20"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="30 40"
          className="text-primary/25"
        />
      </svg>

      {/* Counter-rotating accent ring */}
      <svg
        className="absolute inset-0 w-full h-full animate-spin [animation-duration:1.2s] [animation-direction:reverse]"
        viewBox="0 0 48 48"
        fill="none"
      >
        <circle
          cx="24"
          cy="24"
          r="16"
          stroke="url(#fileit-loader-grad)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="25 60"
        />
        <defs>
          <linearGradient id="fileit-loader-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>
        </defs>
      </svg>

      {/* Center geometric glowing core */}
      <div className="absolute w-2.5 h-2.5 rounded-sm bg-primary transform rotate-45 animate-ping opacity-75" />
      <div className="absolute w-2 h-2 rounded-sm bg-primary transform rotate-45 shadow-sm shadow-primary" />
    </div>
  );

  if (variant === "fullscreen") {
    return (
      <div
        className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/85 backdrop-blur-md transition-opacity ${className}`}
      >
        <div className="flex flex-col items-center gap-4 p-8 rounded-2xl border border-border/60 bg-card/60 shadow-xl max-w-xs text-center animate-in fade-in zoom-in-95 duration-200">
          {spinnerContent}
          {(label || sublabel) && (
            <div className="space-y-1">
              {label && <p className="text-sm font-semibold tracking-tight text-foreground">{label}</p>}
              {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div className={`flex flex-col items-center justify-center p-8 rounded-xl border border-dashed border-border/80 bg-card/40 text-center gap-3.5 ${className}`}>
        {spinnerContent}
        {(label || sublabel) && (
          <div className="space-y-1">
            {label && <p className="text-sm font-medium text-foreground">{label}</p>}
            {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {spinnerContent}
      {label && <span className="text-xs font-medium text-muted-foreground">{label}</span>}
    </div>
  );
}
