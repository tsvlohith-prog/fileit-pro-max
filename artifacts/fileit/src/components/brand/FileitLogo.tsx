import React from "react";

interface FileitLogoProps {
  size?: "sm" | "md" | "lg" | "xl" | number;
  showWordmark?: boolean;
  animated?: boolean;
  className?: string;
  badge?: string;
}

export function FileitLogo({
  size = "md",
  showWordmark = true,
  animated = false,
  className = "",
  badge,
}: FileitLogoProps) {
  const pixelSize =
    typeof size === "number"
      ? size
      : size === "sm"
      ? 28
      : size === "lg"
      ? 44
      : size === "xl"
      ? 56
      : 36;

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Dynamic Shield & Arrow Emblem */}
      <div
        className="relative flex items-center justify-center shrink-0"
        style={{ width: pixelSize, height: pixelSize }}
      >
        <svg
          viewBox="0 0 256 256"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`w-full h-full drop-shadow-sm transition-transform duration-300 ${
            animated ? "hover:scale-105" : ""
          }`}
        >
          <defs>
            {/* Metallic Chrome & Silver Shield Gradient */}
            <linearGradient
              id="filit-shield-grad"
              x1="40"
              y1="30"
              x2="216"
              y2="226"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="30%" stopColor="#E2E8F0" />
              <stop offset="70%" stopColor="#94A3B8" />
              <stop offset="100%" stopColor="#64748B" />
            </linearGradient>

            {/* Inner Shield Bevel Accent */}
            <linearGradient
              id="filit-inner-grad"
              x1="60"
              y1="50"
              x2="196"
              y2="200"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#F8FAFC" />
              <stop offset="50%" stopColor="#CBD5E1" />
              <stop offset="100%" stopColor="#475569" />
            </linearGradient>

            {/* Speed Arrow Gradient */}
            <linearGradient
              id="filit-arrow-grad"
              x1="40"
              y1="210"
              x2="210"
              y2="50"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#94A3B8" />
              <stop offset="45%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#F1F5F9" />
            </linearGradient>

            {/* Glow / Edge Shadow */}
            <filter
              id="filit-shield-shadow"
              x="10"
              y="10"
              width="236"
              height="236"
              filterUnits="userSpaceOnUse"
            >
              <feDropShadow
                dx="0"
                dy="4"
                stdDeviation="8"
                floodColor="#0284C7"
                floodOpacity="0.2"
              />
            </filter>
          </defs>

          <g filter="url(#filit-shield-shadow)">
            {/* Outer Shield Shell */}
            <path
              d="M128 36 C155 46 182 43 194 48 C197 50 198 53 198 57 V126 C198 172 165 208 128 222 C91 208 58 172 58 126 V57 C58 53 59 50 62 48 C74 43 101 46 128 36 Z"
              fill="none"
              stroke="url(#filit-shield-grad)"
              strokeWidth="14"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* Inner Shield Line */}
            <path
              d="M128 66 C146 74 164 72 170 76 V122 C170 154 148 180 128 192 C108 180 86 154 86 122 V76 C92 72 110 74 128 66 Z"
              fill="none"
              stroke="url(#filit-inner-grad)"
              strokeWidth="7"
              strokeLinejoin="round"
              opacity="0.85"
            />

            {/* Diagonal Cutting Arrow Beam */}
            <path
              d="M44 212 L172 84"
              stroke="url(#filit-arrow-grad)"
              strokeWidth="16"
              strokeLinecap="round"
            />

            {/* Arrow Head Pointing Top-Right */}
            <path
              d="M138 80 H188 V130 L172 84 Z"
              fill="url(#filit-arrow-grad)"
              stroke="url(#filit-arrow-grad)"
              strokeWidth="4"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* Arrow Tail Fin */}
            <path
              d="M44 212 L36 220 L40 200 Z"
              fill="url(#filit-arrow-grad)"
            />
          </g>
        </svg>
      </div>

      {/* Modern FILIT / Fileit Wordmark */}
      {showWordmark && (
        <div className="flex items-center gap-2">
          <div className="flex items-baseline tracking-wide">
            <span className="font-black tracking-wider text-foreground text-lg sm:text-xl font-mono uppercase">
              FILE<span className="text-primary font-black">IT</span>
            </span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary ml-1 animate-pulse" />
          </div>

          {badge && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase rounded-md bg-primary/10 text-primary border border-primary/20">
              {badge}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
