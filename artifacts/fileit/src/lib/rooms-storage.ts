export interface StoredRoom {
  id: string;
  name: string;
  token: string;
  expiresAt: string;
  joinedAt: string;
}

const STORAGE_KEY = "fileit_device_rooms_keyring";
const ACTIVE_ROOM_KEY = "fileit_active_room_session";

export function getStoredRooms(): StoredRoom[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const rooms: StoredRoom[] = JSON.parse(raw);
    const now = Date.now();
    // Filter out dissolved / expired rooms (3-day TTL)
    const valid = rooms.filter((r) => !r.expiresAt || new Date(r.expiresAt).getTime() > now);
    if (valid.length !== rooms.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
    }
    return valid;
  } catch {
    return [];
  }
}

export function saveStoredRoom(room: StoredRoom): void {
  try {
    const current = getStoredRooms().filter((r) => r.id !== room.id);
    current.unshift(room);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch (err) {
    console.error("Failed to save room to local keyring", err);
  }
}

export function removeStoredRoom(roomId: string): void {
  try {
    const current = getStoredRooms().filter((r) => r.id !== roomId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    if (getActiveRoomId() === roomId) {
      leaveActiveRoom();
    }
  } catch (err) {
    console.error("Failed to remove room from local keyring", err);
  }
}

export function getRoomToken(roomId: string): string | null {
  const rooms = getStoredRooms();
  const found = rooms.find((r) => r.id === roomId);
  return found ? found.token : null;
}

// ── Active Room Persistence ────────────────────────────────────────────────
// When validated into a room, the user stays in that room until explicit "Leave Room" is clicked.
export function setActiveRoom(roomId: string): void {
  try {
    localStorage.setItem(ACTIVE_ROOM_KEY, roomId);
    window.dispatchEvent(new CustomEvent("fileit_active_room_changed", { detail: { roomId } }));
  } catch (err) {
    console.error("Failed to set active room session", err);
  }
}

export function getActiveRoomId(): string | null {
  try {
    const activeId = localStorage.getItem(ACTIVE_ROOM_KEY);
    if (!activeId) return null;
    const rooms = getStoredRooms();
    const found = rooms.find((r) => r.id === activeId);
    if (!found) {
      // Room expired or removed from keyring
      localStorage.removeItem(ACTIVE_ROOM_KEY);
      return null;
    }
    // Check expiration
    if (found.expiresAt && new Date(found.expiresAt).getTime() <= Date.now()) {
      localStorage.removeItem(ACTIVE_ROOM_KEY);
      return null;
    }
    return activeId;
  } catch {
    return null;
  }
}

export function getActiveRoom(): StoredRoom | null {
  const activeId = getActiveRoomId();
  if (!activeId) return null;
  const rooms = getStoredRooms();
  return rooms.find((r) => r.id === activeId) || null;
}

export function leaveActiveRoom(): void {
  try {
    localStorage.removeItem(ACTIVE_ROOM_KEY);
    window.dispatchEvent(new CustomEvent("fileit_active_room_changed", { detail: { roomId: null } }));
  } catch (err) {
    console.error("Failed to leave active room", err);
  }
}

export function subscribeToActiveRoom(callback: () => void): () => void {
  const handler = () => callback();
  window.addEventListener("fileit_active_room_changed", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("fileit_active_room_changed", handler);
    window.removeEventListener("storage", handler);
  };
}

export function formatTimeRemaining(expiresAtStr?: string): {
  text: string;
  isUrgent: boolean;
  totalHours: number;
} {
  if (!expiresAtStr) {
    return { text: "No expiration set", isUrgent: false, totalHours: 999 };
  }
  const expiry = new Date(expiresAtStr).getTime();
  const now = Date.now();
  const diffMs = expiry - now;

  if (diffMs <= 0) {
    return { text: "Dissolved", isUrgent: true, totalHours: 0 };
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (days > 0) {
    return {
      text: `${days}d ${remainingHours}h remaining`,
      isUrgent: days < 1,
      totalHours: hours,
    };
  }

  if (hours > 0) {
    return {
      text: `${hours}h ${minutes}m remaining`,
      isUrgent: true,
      totalHours: hours,
    };
  }

  return {
    text: `${minutes}m remaining`,
    isUrgent: true,
    totalHours: 0,
  };
}
