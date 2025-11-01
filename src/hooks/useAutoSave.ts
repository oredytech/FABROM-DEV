import { useEffect, useCallback } from "react";
import { toast } from "sonner";

interface ProjectState {
  code: string;
  currentFile: string;
  conversationId: string | null;
  lastSaved: string;
  directoryName?: string;
}

interface HistoryEntry {
  timestamp: string;
  action: string;
  file?: string;
  details?: string;
}

export const useAutoSave = (
  userId: string | undefined,
  directoryHandle: FileSystemDirectoryHandle | null
) => {
  const STORAGE_KEY = `fabrom_autosave_${userId}`;
  const HISTORY_FILE = ".fabrom-history.txt";

  // Save state to localStorage
  const saveState = useCallback((state: Partial<ProjectState>) => {
    if (!userId) return;

    const currentState = localStorage.getItem(STORAGE_KEY);
    const existingState = currentState ? JSON.parse(currentState) : {};
    
    const newState: ProjectState = {
      ...existingState,
      ...state,
      lastSaved: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  }, [userId, STORAGE_KEY]);

  // Load state from localStorage
  const loadState = useCallback((): ProjectState | null => {
    if (!userId) return null;

    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;

    try {
      return JSON.parse(saved) as ProjectState;
    } catch (error) {
      console.error("Error loading saved state:", error);
      return null;
    }
  }, [userId, STORAGE_KEY]);

  // Add entry to history file
  const addHistoryEntry = useCallback(async (action: string, file?: string, details?: string) => {
    if (!directoryHandle) return;

    try {
      const entry: HistoryEntry = {
        timestamp: new Date().toISOString(),
        action,
        file,
        details
      };

      // Read existing history
      let history: HistoryEntry[] = [];
      try {
        const fileHandle = await directoryHandle.getFileHandle(HISTORY_FILE);
        const file = await fileHandle.getFile();
        const content = await file.text();
        history = JSON.parse(content);
      } catch (error) {
        // File doesn't exist yet, start fresh
      }

      // Add new entry
      history.push(entry);

      // Keep only last 100 entries
      if (history.length > 100) {
        history = history.slice(-100);
      }

      // Save updated history
      const fileHandle = await directoryHandle.getFileHandle(HISTORY_FILE, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(history, null, 2));
      await writable.close();
    } catch (error) {
      console.error("Error saving history:", error);
    }
  }, [directoryHandle, HISTORY_FILE]);

  // Load history from file
  const loadHistory = useCallback(async (): Promise<HistoryEntry[]> => {
    if (!directoryHandle) return [];

    try {
      const fileHandle = await directoryHandle.getFileHandle(HISTORY_FILE);
      const file = await fileHandle.getFile();
      const content = await file.text();
      return JSON.parse(content);
    } catch (error) {
      return [];
    }
  }, [directoryHandle, HISTORY_FILE]);

  // Check if there's a saved state on mount
  useEffect(() => {
    const savedState = loadState();
    if (savedState && savedState.lastSaved) {
      const lastSavedDate = new Date(savedState.lastSaved);
      const now = new Date();
      const diffMinutes = (now.getTime() - lastSavedDate.getTime()) / 1000 / 60;

      // If last save was less than 30 minutes ago, offer to restore
      if (diffMinutes < 30) {
        toast.info(
          `Travail détecté (${Math.round(diffMinutes)} min). Restaurer ?`,
          {
            duration: 10000,
            action: {
              label: "Restaurer",
              onClick: () => {
                window.dispatchEvent(new CustomEvent('fabrom:restore-state', { 
                  detail: savedState 
                }));
              }
            }
          }
        );
      }
    }
  }, [loadState]);

  return {
    saveState,
    loadState,
    addHistoryEntry,
    loadHistory
  };
};
