import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { HardDrive, MessageSquareCode, ShieldCheck, ScanLine, Zap } from "lucide-react";
import { FileitLogo } from "@/components/brand/FileitLogo";
import { ThemeToggle } from "@/components/theme-toggle";
import { getActiveRoom, subscribeToActiveRoom, type StoredRoom } from "@/lib/rooms-storage";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [activeRoom, setActiveRoom] = useState<StoredRoom | null>(() => getActiveRoom());

  useEffect(() => {
    setActiveRoom(getActiveRoom());
    return subscribeToActiveRoom(() => {
      setActiveRoom(getActiveRoom());
    });
  }, []);

  const isFilesActive = location === "/" || location === "/files";
  const isTextActive = location === "/text";
  const isRoomsActive = location.startsWith("/rooms");
  const isConnectivityActive = location === "/connectivity";
  const isQrActive = location === "/qr";
  const roomsHref = activeRoom ? `/rooms/${activeRoom.id}` : "/rooms";

  const roomLabel = activeRoom
    ? `Room: ${activeRoom.name.length > 10 ? activeRoom.name.slice(0, 9) + "…" : activeRoom.name}`
    : "Rooms";

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background relative selection:bg-primary/20">
      {/* Ambient background mesh glow */}
        <div className="fixed inset-0 pointer-events-none z-0 glow-mesh opacity-70" />
        <div className="fixed inset-0 pointer-events-none z-0 bg-grid-ambient opacity-30" />

        {/* Top Header */}
        <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/80 shadow-xs">
          <div className="container mx-auto px-4 h-14 md:h-16 flex items-center justify-between max-w-7xl relative z-10">
            <Link
              href="/"
              className="flex items-center gap-2 group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg transition-transform hover:opacity-95 shrink-0"
            >
              <FileitLogo size="md" showWordmark={true} />
            </Link>

            {/* Desktop Navigation (> md) */}
            <nav className="hidden md:flex items-center gap-1 bg-secondary/40 border border-border/60 p-1 rounded-2xl backdrop-blur-sm">
              <Link
                href="/files"
                className={`flex items-center gap-2 text-sm font-medium transition-all px-3.5 py-1.5 rounded-xl ${
                  isFilesActive
                    ? "bg-card text-foreground shadow-xs border border-border/60 font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }`}
              >
                <HardDrive className="w-4 h-4" />
                <span>Files</span>
              </Link>

              <Link
                href="/text"
                className={`flex items-center gap-2 text-sm font-medium transition-all px-3.5 py-1.5 rounded-xl ${
                  isTextActive
                    ? "bg-card text-foreground shadow-xs border border-border/60 font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }`}
              >
                <MessageSquareCode className="w-4 h-4" />
                <span>Text & Code</span>
              </Link>

              <Link
                href={roomsHref}
                className={`flex items-center gap-2 text-sm font-medium transition-all px-3.5 py-1.5 rounded-xl ${
                  isRoomsActive
                    ? "bg-card text-foreground shadow-xs border border-border/60 font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }`}
                title={activeRoom ? `Active Room: ${activeRoom.name}` : "Private Rooms"}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{roomLabel}</span>
                {activeRoom && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                )}
              </Link>

              <Link
                href="/connectivity"
                className={`flex items-center gap-2 text-sm font-medium transition-all px-3.5 py-1.5 rounded-xl ${
                  isConnectivityActive
                    ? "bg-card text-foreground shadow-xs border border-border/60 font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }`}
              >
                <Zap className="w-4 h-4" />
                <span>Connectivity</span>
              </Link>

              <Link
                href="/qr"
                className={`flex items-center gap-1.5 text-sm font-medium transition-all p-1.5 rounded-xl ${
                  isQrActive
                    ? "bg-card text-foreground shadow-xs border border-border/60"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }`}
                title="Universal QR Scanner"
              >
                <ScanLine className="w-4 h-4" />
              </Link>
            </nav>

            {/* Right side tools */}
            <div className="flex items-center gap-2">
              <Link
                href="/qr"
                className={`md:hidden flex items-center justify-center w-9 h-9 rounded-xl transition-all border border-border/60 ${
                  isQrActive
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-foreground bg-secondary/80 hover:bg-secondary"
                }`}
                title="Scan QR Code"
              >
                <ScanLine className="w-4 h-4" />
              </Link>

              <ThemeToggle className="border border-border/60 bg-secondary/30" />
            </div>
          </div>
        </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full flex flex-col pb-20 md:pb-10 relative z-10">{children}</main>

      {/* Desktop Clean Footer */}
      <footer className="hidden md:block border-t border-border/60 bg-card/30 backdrop-blur-sm py-6 relative z-10">
        <div className="container mx-auto px-4 max-w-7xl flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-foreground tracking-tight">Fileit Studio</span>
            <span aria-hidden="true" className="text-border">|</span>
            <span>Zero-Knowledge Ephemeral Transfer</span>
            <span aria-hidden="true" className="text-border">|</span>
            <span>Direct WebRTC P2P</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/files" className="hover:text-foreground transition-colors">
              Storage Hub
            </Link>
            <Link href="/rooms" className="hover:text-foreground transition-colors">
              Private Rooms
            </Link>
            <Link href="/connectivity" className="hover:text-foreground transition-colors">
              Device Link
            </Link>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Navigation Bar (< md) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-t border-border/80 md:hidden safe-area-pb">
        <div className="grid grid-cols-4 h-16 max-w-lg mx-auto px-2">
          {/* Files */}
          <Link
            href="/files"
            className={`flex flex-col items-center justify-center gap-1 py-1 rounded-2xl transition-all ${
              isFilesActive
                ? "text-primary font-bold"
                : "text-muted-foreground hover:text-foreground font-medium"
            }`}
          >
            <div
              className={`w-9 h-7 flex items-center justify-center rounded-full transition-colors ${
                isFilesActive ? "bg-primary/15 text-primary" : ""
              }`}
            >
              <HardDrive className="w-4 h-4" />
            </div>
            <span className="text-[10px] leading-tight tracking-tight">Files</span>
          </Link>

          {/* Text & Code */}
          <Link
            href="/text"
            className={`flex flex-col items-center justify-center gap-1 py-1 rounded-2xl transition-all ${
              isTextActive
                ? "text-primary font-bold"
                : "text-muted-foreground hover:text-foreground font-medium"
            }`}
          >
            <div
              className={`w-9 h-7 flex items-center justify-center rounded-full transition-colors ${
                isTextActive ? "bg-primary/15 text-primary" : ""
              }`}
            >
              <MessageSquareCode className="w-4 h-4" />
            </div>
            <span className="text-[10px] leading-tight tracking-tight">Text/Code</span>
          </Link>

          {/* Private Rooms */}
          <Link
            href={roomsHref}
            className={`flex flex-col items-center justify-center gap-1 py-1 rounded-2xl transition-all relative ${
              isRoomsActive
                ? "text-primary font-bold"
                : "text-muted-foreground hover:text-foreground font-medium"
            }`}
          >
            <div
              className={`w-9 h-7 flex items-center justify-center rounded-full transition-colors relative ${
                isRoomsActive ? "bg-primary/15 text-primary" : ""
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              {activeRoom && (
                <span className="absolute top-1 right-2 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-background" />
              )}
            </div>
            <span className="text-[10px] leading-tight tracking-tight">Rooms</span>
          </Link>

          {/* Connectivity / Phone Link */}
          <Link
            href="/connectivity"
            className={`flex flex-col items-center justify-center gap-1 py-1 rounded-2xl transition-all ${
              isConnectivityActive
                ? "text-primary font-bold"
                : "text-muted-foreground hover:text-foreground font-medium"
            }`}
          >
            <div
              className={`w-9 h-7 flex items-center justify-center rounded-full transition-colors ${
                isConnectivityActive ? "bg-primary/15 text-primary" : ""
              }`}
            >
              <Zap className="w-4 h-4" />
            </div>
            <span className="text-[10px] leading-tight tracking-tight">Link/P2P</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
