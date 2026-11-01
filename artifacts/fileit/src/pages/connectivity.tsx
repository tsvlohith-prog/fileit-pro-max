import React, { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { useP2PConnection } from "@/components/p2p-connection-context";
import { P2PRadar } from "@/components/p2p-radar";
import { QrPairModal } from "@/components/qr-pair-modal";
import { FolderSyncExplorer } from "@/components/folder-sync-explorer";
import { P2PFileBeam } from "@/components/p2p-file-beam";
import {
  Radio,
  FolderTree,
  UploadCloud,
  ShieldCheck,
  Zap,
  Activity,
  QrCode,
  Laptop,
  Smartphone,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ConnectivityPage() {
  const { toast } = useToast();
  const {
    p2pState,
    sessionCode,
    remoteDeviceName,
    latency,
    startAsReceiver,
    startAsInitiator,
    disconnect,
  } = useP2PConnection();

  const [isPairModalOpen, setIsPairModalOpen] = useState(false);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<"folders" | "beam">("folders");

  const isConnected = p2pState === "connected";

  // Check URL query params for ?join=<code> (from scanning QR code on phone)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get("join") || params.get("pair");
    if (joinCode && /^[0-9]{6}$/.test(joinCode) && p2pState === "idle") {
      toast({
        title: "Auto-Pairing Initiated",
        description: `Connecting to host PIN ${joinCode}...`,
      });
      startAsReceiver(joinCode);
      // Clean query params from URL without refreshing
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [p2pState, startAsReceiver, toast]);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 md:py-8 max-w-6xl space-y-6">
        {/* Header Strip */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                P2P Link & Folder Sync
              </h1>
              {isConnected ? (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  PERSISTENT LINK ACTIVE
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-secondary text-muted-foreground">
                  READY TO PAIR
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              End-to-end encrypted direct WebRTC channel. Stays connected across all pages until you close the tab.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isConnected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={disconnect}
                className="rounded-xl text-xs font-semibold text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 border-border/80"
              >
                Disconnect
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => setIsPairModalOpen(true)}
                className="rounded-xl text-xs font-bold gap-1.5 shadow-sm bg-primary text-primary-foreground hover:bg-primary/95"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Pair Phone via QR</span>
              </Button>
            )}
          </div>
        </div>

        {/* Real-time Technical Metrics Strip (Zero-Pill Typography) */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-mono text-muted-foreground bg-card/40 p-3 rounded-2xl border border-border/60">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="text-foreground font-semibold">WebRTC DTLS-SRTP</span>
          </span>
          <span aria-hidden="true" className="text-border">·</span>
          <span className="flex items-center gap-1.5">
            <Radio className="w-4 h-4 text-primary" />
            <span>Transport: Direct DataChannel</span>
          </span>
          <span aria-hidden="true" className="text-border">·</span>
          <span className="flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-emerald-500" />
            <span>Ping: {isConnected && latency !== null ? `${latency}ms` : "Active"}</span>
          </span>
          <span aria-hidden="true" className="text-border">·</span>
          <span className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-500" />
            <span>Keep-Alive: 4s Heartbeat</span>
          </span>
        </div>

        {/* Main Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Proximity Radar & Device Status (lg: 5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <P2PRadar onOpenPairModal={() => setIsPairModalOpen(true)} />

            {/* Quick Session Summary Box */}
            {isConnected && (
              <div className="p-4 rounded-2xl bg-secondary/30 border border-border/60 space-y-2 text-xs">
                <div className="flex justify-between items-center text-muted-foreground font-mono">
                  <span>Linked Peer:</span>
                  <span className="font-bold text-foreground">{remoteDeviceName}</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground font-mono">
                  <span>Session PIN:</span>
                  <span className="font-bold text-foreground">{sessionCode}</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground font-mono">
                  <span>Cross-Navigation:</span>
                  <span className="font-bold text-emerald-500">Unbroken (Singleton)</span>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Remote Workspace (lg: 7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Workspace View Switcher */}
            <div className="flex items-center justify-between bg-card/60 p-1.5 rounded-2xl border border-border/80">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveWorkspaceTab("folders")}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors ${
                    activeWorkspaceTab === "folders"
                      ? "bg-card text-foreground shadow-xs border border-border/60"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <FolderTree className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Bi-Directional Folder Sync</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveWorkspaceTab("beam")}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors ${
                    activeWorkspaceTab === "beam"
                      ? "bg-card text-foreground shadow-xs border border-border/60"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <UploadCloud className="w-3.5 h-3.5 text-primary" />
                  <span>Direct File Beam & Clipboard</span>
                </button>
              </div>
            </div>

            {/* Tab 1: Bi-Directional Folder Sync */}
            {activeWorkspaceTab === "folders" && <FolderSyncExplorer />}

            {/* Tab 2: Direct File Beam & Real Clipboard */}
            {activeWorkspaceTab === "beam" && <P2PFileBeam />}
          </div>
        </div>
      </div>

      {/* 1-Click QR Pairing Modal */}
      <QrPairModal isOpen={isPairModalOpen} onClose={() => setIsPairModalOpen(false)} />
    </Layout>
  );
}
