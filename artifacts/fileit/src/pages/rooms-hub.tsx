import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useLocation } from "wouter";
import {
  ShieldCheck,
  Lock,
  Plus,
  LogIn,
  QrCode,
  Clock,
  Trash2,
  ArrowRight,
  ShieldAlert,
  HardDrive,
  EyeOff,
  LogOut,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  getStoredRooms,
  saveStoredRoom,
  removeStoredRoom,
  formatTimeRemaining,
  getActiveRoomId,
  getActiveRoom,
  setActiveRoom,
  leaveActiveRoom,
  type StoredRoom,
} from "@/lib/rooms-storage";
import { motion } from "framer-motion";

export default function RoomsHubPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"join" | "create">("join");
  const [deviceRooms, setDeviceRooms] = useState<StoredRoom[]>([]);
  const [currentActiveRoom, setCurrentActiveRoom] = useState<StoredRoom | null>(null);

  // Join Form State
  const [joinName, setJoinName] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [joinToken, setJoinToken] = useState("");
  const [joinViaQr, setJoinViaQr] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  // Create Form State
  const [createName, setCreateName] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Check active room and auto-redirect unless user explicitly requested directory
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isExplicitSwitch = urlParams.get("switch") === "true";
    const activeId = getActiveRoomId();

    if (activeId && !isExplicitSwitch) {
      // Once validated into a room, automatically stay in that room!
      setLocation(`/rooms/${activeId}`);
      return;
    }

    setDeviceRooms(getStoredRooms());
    setCurrentActiveRoom(getActiveRoom());
  }, [setLocation]);

  // Handle Join Secret Room
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (joinViaQr && !joinToken.trim()) {
      toast({
        title: "Token required",
        description: "Please enter the QR token or scan the room QR code.",
        variant: "destructive",
      });
      return;
    }
    if (!joinViaQr && (!joinName.trim() || !joinPassword.trim())) {
      toast({
        title: "Missing credentials",
        description: "Both Room Name and Room Password are required.",
        variant: "destructive",
      });
      return;
    }

    setIsJoining(true);
    try {
      const payload = joinViaQr
        ? { token: joinToken.trim() }
        : { name: joinName.trim(), password: joinPassword.trim() };

      const res = await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Invalid room credentials or room has dissolved");
      }

      const data = await res.json();
      // Store in device local keyring
      saveStoredRoom({
        id: data.id,
        name: data.name,
        token: data.token || data.shareToken,
        expiresAt: data.expiresAt,
        joinedAt: new Date().toISOString(),
      });

      // Set active room session
      setActiveRoom(data.id);

      toast({
        title: "Room Decrypted & Joined",
        description: `Welcome to "${data.name}". Active session stored.`,
      });

      // Navigate to Active Private Room
      setLocation(`/rooms/${data.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid room credentials or room has dissolved";
      toast({
        title: "Access Denied",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsJoining(false);
    }
  };

  // Handle Create Secret Room (3-Day Dissolution)
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim() || !createPassword.trim()) {
      toast({
        title: "Required Fields",
        description: "Please provide both a Room Name and Room Password.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch("/api/rooms/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName.trim(),
          password: createPassword.trim(),
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create room");
      }

      const data = await res.json();
      // Store in device local keyring
      saveStoredRoom({
        id: data.id,
        name: data.name,
        token: data.token || data.shareToken,
        expiresAt: data.expiresAt,
        joinedAt: new Date().toISOString(),
      });

      // Set active room session
      setActiveRoom(data.id);

      toast({
        title: "Secret Room Created",
        description: `Room "${data.name}" created. Auto-dissolves in 3 days.`,
      });

      // Navigate to Active Private Room
      setLocation(`/rooms/${data.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create private room";
      toast({
        title: "Creation Error",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Forget room from this device
  const handleForgetRoom = (roomId: string, roomName: string) => {
    removeStoredRoom(roomId);
    setDeviceRooms(getStoredRooms());
    if (currentActiveRoom?.id === roomId) {
      setCurrentActiveRoom(null);
    }
    toast({
      title: "Room Removed From Device",
      description: `Removed "${roomName}" from this device's keyring.`,
    });
  };

  // Explicit leave of active session
  const handleLeaveActiveSession = () => {
    leaveActiveRoom();
    setCurrentActiveRoom(null);
    toast({
      title: "Active Session Exited",
      description: "You have left the active room session.",
    });
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
        {/* Active Session Notification (if user is browsing hub while having an active session) */}
        {currentActiveRoom && (
          <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <div>
                <p className="text-xs font-semibold text-foreground">
                  Active Vault: <span className="text-primary font-bold">{currentActiveRoom.name}</span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  You are currently validated in this room. You will stay in this room until you leave.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                onClick={() => setLocation(`/rooms/${currentActiveRoom.id}`)}
                className="h-8 px-3 rounded-xl text-xs font-bold gap-1.5 bg-primary text-primary-foreground"
              >
                <span>Return to Room</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleLeaveActiveSession}
                className="h-8 px-3 rounded-xl text-xs font-semibold gap-1.5 border-border hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Leave Room</span>
              </Button>
            </div>
          </div>
        )}

        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-1">
              <EyeOff className="w-3.5 h-3.5" />
              <span>Zero-Leak Stealth Security</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <ShieldCheck className="w-7 h-7 text-primary" />
              Private Rooms
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Encrypted temporary workspaces for you and your roommates. Non-roommates cannot detect
              or sense the room. All files and data permanently dissolve after 3 days (72 hours).
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant={activeTab === "join" ? "default" : "outline"}
              onClick={() => setActiveTab("join")}
              className="rounded-xl h-10 px-4 text-xs font-semibold gap-1.5"
            >
              <LogIn className="w-4 h-4" />
              <span>Join Room</span>
            </Button>
            <Button
              variant={activeTab === "create" ? "default" : "outline"}
              onClick={() => setActiveTab("create")}
              className="rounded-xl h-10 px-4 text-xs font-semibold gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Create Secret Room</span>
            </Button>
          </div>
        </div>

        {/* Action Panel: Join vs Create */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7">
            {activeTab === "join" ? (
              <motion.div
                key="join-card"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 rounded-3xl bg-card border border-border shadow-xs space-y-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                      <LogIn className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-foreground">Join Private Room</h2>
                      <p className="text-xs text-muted-foreground">
                        Enter the room credentials or scan the room QR code
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setJoinViaQr(!joinViaQr)}
                    className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    {joinViaQr ? "Use Room & Password" : "Use QR Token"}
                  </button>
                </div>

                <form onSubmit={handleJoin} className="space-y-4">
                  {!joinViaQr ? (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground">
                          Room Name
                        </label>
                        <Input
                          value={joinName}
                          onChange={(e) => setJoinName(e.target.value)}
                          placeholder="e.g. Phone-PC-Sync, Project-Beta"
                          className="h-11 rounded-xl bg-background"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground">
                          Room Password
                        </label>
                        <Input
                          type="password"
                          value={joinPassword}
                          onChange={(e) => setJoinPassword(e.target.value)}
                          placeholder="Enter secret room password"
                          className="h-11 rounded-xl bg-background"
                          required
                        />
                      </div>
                    </>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">
                        Room Token or QR Code Payload
                      </label>
                      <Input
                        value={joinToken}
                        onChange={(e) => setJoinToken(e.target.value)}
                        placeholder="Paste the room token or scanned QR data"
                        className="h-11 rounded-xl bg-background font-mono text-xs"
                        required
                      />
                      <p className="text-[11px] text-muted-foreground">
                        You can scan your roommate's screen with your phone camera or paste the token here.
                      </p>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isJoining}
                    className="w-full h-11 rounded-xl font-bold gap-2 text-sm bg-primary text-primary-foreground"
                  >
                    <Lock className="w-4 h-4" />
                    {isJoining ? "Verifying Credentials..." : "Authenticate & Enter Room"}
                  </Button>
                </form>

                <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/60 text-xs text-muted-foreground flex items-start gap-2.5">
                  <EyeOff className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>
                    <strong>Zero Leakage:</strong> Non-roommates cannot discover room names. Any wrong attempt returns a timing-safe error.
                  </span>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="create-card"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 rounded-3xl bg-card border border-border shadow-xs space-y-5"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground">Create Secret Room</h2>
                    <p className="text-xs text-muted-foreground">
                      Set a Room Name and Password. Dissolves automatically in 3 days.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Room Name
                    </label>
                    <Input
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      placeholder="e.g. Workspace-Alpha, Phone-Laptop-Drop"
                      className="h-11 rounded-xl bg-background"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Room Password
                    </label>
                    <Input
                      type="password"
                      value={createPassword}
                      onChange={(e) => setCreatePassword(e.target.value)}
                      placeholder="Create a strong password for roommates"
                      className="h-11 rounded-xl bg-background"
                      required
                    />
                  </div>

                  {/* 3-Day Dissolution Security Notice */}
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-1.5 text-xs text-amber-600 dark:text-amber-400">
                    <div className="flex items-center gap-2 font-bold">
                      <Clock className="w-4 h-4 text-amber-500" />
                      <span>Strict 3-Day Auto-Dissolution</span>
                    </div>
                    <p className="leading-relaxed text-[11.5px] opacity-90">
                      All uploaded files, notes, and messages in this room will be permanently wiped
                      from the server after exactly 72 hours (3 days). Zero forensic trace will remain.
                    </p>
                  </div>

                  <Button
                    type="submit"
                    disabled={isCreating}
                    className="w-full h-11 rounded-xl font-bold gap-2 text-sm bg-primary text-primary-foreground"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    {isCreating ? "Encrypting & Creating..." : "Generate Secret Room"}
                  </Button>
                </form>
              </motion.div>
            )}
          </div>

          {/* Right Column: "My Rooms on this Device" (Stealth Keyring) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between pb-1">
              <div>
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-primary" />
                  My Active Rooms ({deviceRooms.length})
                </h2>
                <p className="text-xs text-muted-foreground">
                  Saved only on this device — no stranger can see this list
                </p>
              </div>
            </div>

            {deviceRooms.length === 0 ? (
              <div className="p-8 text-center rounded-3xl border border-dashed border-border bg-muted/20 space-y-2">
                <ShieldAlert className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                <p className="text-sm font-semibold text-foreground">No active rooms on this device</p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Create a secret room or enter room credentials on the left to add it to your device's private keyring.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {deviceRooms.map((room) => {
                  const remaining = formatTimeRemaining(room.expiresAt);
                  return (
                    <div
                      key={room.id}
                      className="p-4 rounded-2xl bg-card border border-border shadow-xs hover:border-primary/40 transition-colors flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm text-foreground truncate flex items-center gap-2">
                            <Lock className="w-3.5 h-3.5 text-primary" />
                            {room.name}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
                            <Clock className={`w-3 h-3 ${remaining.isUrgent ? "text-amber-500" : "text-primary"}`} />
                            <span className={remaining.isUrgent ? "font-semibold text-amber-500" : ""}>
                              {remaining.text}
                            </span>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleForgetRoom(room.id, room.name)}
                          className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-destructive"
                          title="Forget room on this device"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => {
                          setActiveRoom(room.id);
                          setLocation(`/rooms/${room.id}`);
                        }}
                        className="w-full h-9 rounded-xl font-semibold text-xs gap-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all"
                      >
                        <span>Enter Room Vault</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
