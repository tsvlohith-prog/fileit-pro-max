import { MinimizedFile } from "@/components/dynamic-bubble-context";

const STORAGE_KEY = "fileit_recent_files_v1";

export const RecentFilesService = {
  getRecentFiles(): MinimizedFile[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data);
    } catch (err) {
      console.error("Failed to load recent files from localStorage", err);
      return [];
    }
  },

  saveRecentFile(file: MinimizedFile): MinimizedFile[] {
    try {
      const current = this.getRecentFiles();
      const filtered = current.filter((f) => f.id !== file.id);
      const updated = [file, ...filtered].slice(0, 15); // keep up to 15
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    } catch (err) {
      console.error("Failed to save recent file to localStorage", err);
      return [];
    }
  },

  clearRecentFiles(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error("Failed to clear recent files", err);
    }
  },
};
