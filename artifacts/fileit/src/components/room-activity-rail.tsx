import React, { useState } from "react";
import {
  Users,
  MessageSquare,
  Radio,
  Send,
  Clock,
  Flame,
  ShieldCheck,
  Laptop,
  Smartphone,
  Tablet,
  Activity,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { MeshPeer, MeshFlashMessage } from "@/lib/room-p2p-mesh";

interface RoomActivityRailProps {
  roomId: string;
  roomName: string;
  timeRemaining?: string | { text: string; isUrgent?: boolean };
  peers: MeshPeer[];
  flashMessages: MeshFlashMessage[];
  onSendFlash: (text: string) => void;
  onDissolveRoom: () => void;
  auditEvents: Array<{ id: string; text: string; time: string }>;
}

export function RoomActivityRail({
  roomId,
  roomName,
  timeRemaining,
  peers,
  flashMessages,
  onSendFlash,
  onDissolveRoom,
  auditEvents,
}: RoomActivityRailProps) {
  const { toast } = useToast();
  const [inputText, setInputText] = useState("");
  const [activeTab, setActiveTab] = useState<"chat" | "peers" | "audit">("chat");

  const displayTime = typeof timeRemaining === "object" && timeRemaining ? timeRemaining.text : timeRemaining;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendFlash(inputText.trim());
    setInputText("");
  };

  const getDeviceIcon = (deviceType?: string) => {
    if (deviceType === "mobile") return <Smartphone className="w-3.5 h-3.5 text-emerald-400" />;
    if (deviceType === "tablet") return <Tablet className="w-3.5 h-3.5 text-emerald-400" />;
    return <Laptop className="w-3.5 h-3.5 text-emerald-400" />;
  };

  return (
    <div className="flex flex-col rounded-3xl bg-card/70 backdrop-blur-xl border border-border/80 shadow-sm overflow-hidden h-[540px] sm:h-[600px] relative">
      {/* Rail Header with Dissolution Timer */}
      <div className="p-3 sm:px-4 bg-secondary/50 border-b border-border/70 flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="text-xs font-mono font-bold text-foreground truncate">
            {displayTime || "3 Days Remaining"}
          </span>
        </div>

        <Button
          size="sm"
          variant="ghost"
          onClick={onDissolveRoom}
          className="h-7 px-2 text-[10px] font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg gap-1"
          title="Instantly wipe and destroy room files"
        >
          <Flame className="w-3 h-3" />
          <span>Burn Room</span>
        </Button>
      </div>

      {/* Switcher Navigation */}
      <div className="flex items-center gap-1 p-2 border-b border-border/60 bg-secondary/30">
        <button
          type="button"
          onClick={() => setActiveTab("chat")}
          className={`flex-1 py-1 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === "chat" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageSquare className="w-3 h-3" />
          <span>Flash Chat</span>
          {flashMessages.length > 0 && (
            <span className="text-[10px] font-mono px-1 rounded bg-primary/20 text-primary">
              {flashMessages.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("peers")}
          className={`flex-1 py-1 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === "peers" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="w-3 h-3 text-emerald-400" />
          <span>Peers ({peers.length + 1})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("audit")}
          className={`flex-1 py-1 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === "audit" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <History className="w-3 h-3" />
          <span>Feed</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 p-3 overflow-y-auto space-y-2">
        {/* TAB 1: FLASH CHAT */}
        {activeTab === "chat" && (
          <div className="h-full flex flex-col justify-between">
            <div className="space-y-2 overflow-y-auto max-h-[380px] pr-1">
              {flashMessages.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  <p>Ephemeral Room Chat</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-1">
                    Messages broadcast live across room participants.
                  </p>
                </div>
              ) : (
                flashMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className="p-2.5 rounded-2xl bg-secondary/50 border border-border/60 text-xs space-y-1"
                  >
                    <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground">
                      <span className="font-bold text-foreground">{msg.fromName}</span>
                      <span>{msg.timestamp}</span>
                    </div>
                    <p className="text-foreground/90 break-words">{msg.text}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSend} className="flex gap-1.5 pt-2 border-t border-border/60">
              <Input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Broadcast a flash message..."
                className="h-9 rounded-xl text-xs"
              />
              <Button type="submit" size="icon" className="h-9 w-9 rounded-xl bg-primary text-primary-foreground shrink-0">
                <Send className="w-3.5 h-3.5" />
              </Button>
            </form>
          </div>
        )}

        {/* TAB 2: ACTIVE PEERS */}
        {activeTab === "peers" && (
          <div className="space-y-2">
            {/* Self Device */}
            <div className="flex items-center justify-between p-2.5 rounded-2xl bg-primary/10 border border-primary/20 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-bold text-foreground">You (This Browser)</span>
              </div>
              <span className="text-[10px] font-mono text-primary font-bold">Host Member</span>
            </div>

            {/* Other Room Peers */}
            {peers.map((peer) => (
              <div
                key={peer.peerId}
                className="flex items-center justify-between p-2.5 rounded-2xl bg-secondary/40 border border-border/60 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {getDeviceIcon(peer.deviceType)}
                  <span className="font-medium text-foreground truncate">{peer.peerName}</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                  <Radio className="w-3 h-3" /> Live
                </span>
              </div>
            ))}

            {peers.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No other members currently in room. Share the room invite QR to collaborate.
              </p>
            )}
          </div>
        )}

        {/* TAB 3: AUDIT FEED */}
        {activeTab === "audit" && (
          <div className="space-y-1.5">
            {auditEvents.map((ev) => (
              <div key={ev.id} className="p-2 rounded-xl bg-secondary/30 text-[11px] font-mono text-muted-foreground flex justify-between gap-2">
                <span className="text-foreground truncate">{ev.text}</span>
                <span className="shrink-0">{ev.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
