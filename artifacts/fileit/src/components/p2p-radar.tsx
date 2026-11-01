import React from "react";
import { motion } from "framer-motion";
import { Laptop, Smartphone, Tablet, Radio, Wifi, Zap, CheckCircle2 } from "lucide-react";
import { useP2PConnection } from "@/components/p2p-connection-context";
import { Button } from "@/components/ui/button";

interface P2PRadarProps {
  onOpenPairModal: () => void;
}

export function P2PRadar({ onOpenPairModal }: P2PRadarProps) {
  const { p2pState, remoteDeviceName, latency, sessionCode, disconnect } = useP2PConnection();

  const isConnected = p2pState === "connected";
  const isConnecting = p2pState === "connecting" || p2pState === "waiting_for_peer";

  const getDeviceIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes("phone") || lower.includes("iphone") || lower.includes("android")) {
      return <Smartphone className="w-5 h-5 text-emerald-400" />;
    }
    if (lower.includes("ipad") || lower.includes("tablet")) {
      return <Tablet className="w-5 h-5 text-emerald-400" />;
    }
    return <Laptop className="w-5 h-5 text-emerald-400" />;
  };

  return (
    <div className="relative flex flex-col items-center justify-center p-6 sm:p-8 rounded-3xl bg-card/60 backdrop-blur-xl border border-border/80 shadow-sm overflow-hidden min-h-[360px]">
      {/* Sonar Ambient Ripple Rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[380px] h-[380px] rounded-full border border-primary/10" />
        <div className="absolute w-[280px] h-[280px] rounded-full border border-primary/15" />
        <div className="absolute w-[180px] h-[180px] rounded-full border border-primary/20" />
        <div className="absolute w-[90px] h-[90px] rounded-full border border-primary/30" />

        {/* Animated Sweep / Pulse Wave */}
        {isConnecting && (
          <motion.div
            animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
            className="absolute w-36 h-36 rounded-full bg-primary/15 border border-primary/40 pointer-events-none"
          />
        )}
      </div>

      {/* Center Radar Core */}
      <div className="relative z-10 flex flex-col items-center text-center space-y-4">
        {isConnected ? (
          /* Connected State Presentation */
          <div className="space-y-4">
            <div className="relative flex items-center justify-center mx-auto">
              {/* Connected Device Avatar */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-20 h-20 rounded-3xl bg-emerald-500/15 border-2 border-emerald-500/50 flex flex-col items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.25)]"
              >
                {getDeviceIcon(remoteDeviceName)}
                <span className="text-[10px] font-mono font-bold text-emerald-400 mt-1 uppercase tracking-wider">
                  Linked
                </span>
              </motion.div>
              <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground flex items-center justify-center gap-1.5">
                <span>{remoteDeviceName}</span>
              </h3>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground font-mono">
                <span className="flex items-center gap-1 text-emerald-500 font-semibold">
                  <Radio className="w-3.5 h-3.5 animate-pulse" /> P2P Stream Active
                </span>
                <span>·</span>
                <span>{latency !== null ? `${latency}ms` : "< 5ms"}</span>
              </div>
              <p className="text-[11px] text-muted-foreground pt-1">
                Persistent link: continues even when navigating other pages.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={onOpenPairModal}
                className="h-8 rounded-xl text-xs font-semibold border-border/80"
              >
                Re-Pair / New Code
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={disconnect}
                className="h-8 rounded-xl text-xs font-semibold text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
              >
                Disconnect
              </Button>
            </div>
          </div>
        ) : isConnecting ? (
          /* Connecting / Waiting State */
          <div className="space-y-4">
            <div className="relative w-20 h-20 rounded-3xl bg-primary/10 border-2 border-primary/40 flex items-center justify-center mx-auto shadow-inner">
              <Radio className="w-8 h-8 text-primary animate-pulse" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">Waiting for Peer to Connect</h3>
              <p className="text-xs text-muted-foreground max-w-xs font-mono">
                {sessionCode ? `Session PIN: ${sessionCode}` : "Establishing signaling channel..."}
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-1">
              <Button
                size="sm"
                onClick={onOpenPairModal}
                className="h-8 rounded-xl text-xs font-bold gap-1.5 bg-primary text-primary-foreground"
              >
                <span>View QR Code</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={disconnect}
                className="h-8 rounded-xl text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          /* Idle / Disconnected State */
          <div className="space-y-4">
            <div className="w-20 h-20 rounded-3xl bg-secondary/80 border border-border flex items-center justify-center mx-auto shadow-xs text-muted-foreground">
              <Wifi className="w-8 h-8 text-muted-foreground/60" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">No Device Paired</h3>
              <p className="text-xs text-muted-foreground max-w-xs">
                Scan the 1-click QR code on your phone to link clipboard, files, and folders end-to-end.
              </p>
            </div>

            <Button
              onClick={onOpenPairModal}
              className="h-10 px-6 rounded-2xl text-xs font-bold gap-2 shadow-md bg-primary hover:bg-primary/95 text-primary-foreground transition-transform active:scale-95"
            >
              <Zap className="w-4 h-4" />
              <span>1-Click Pair Phone</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
