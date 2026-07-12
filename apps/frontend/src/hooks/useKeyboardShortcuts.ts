import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { isEditableShortcutTarget, NAVIGATION_SHORTCUTS, SHORTCUT_PATH_BY_KEY } from "@/lib/keyboardShortcuts";

interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
}

export const GLOBAL_SHORTCUTS: Shortcut[] = [
  ...NAVIGATION_SHORTCUTS.map((shortcut) => ({
    key: shortcut.key.toLowerCase(),
    ctrl: true,
    shift: true,
    description: `Buka ${shortcut.label}`,
    action: () => {},
  })),
  { key: "/", ctrl: true, description: "Fokus Pencarian", action: () => {} },
  { key: "Escape", description: "Tutup Dialog/Modal", action: () => {} },
];

export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  const handleShortcut = useCallback((e: KeyboardEvent) => {
    // Skip if user is typing in input/textarea
    if (isEditableShortcutTarget(e.target)) {
      // Only allow Escape in inputs
      if (e.key !== "Escape") return;
    }

    // Navigation shortcuts (Ctrl/Cmd + Shift + Key)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
      const path = SHORTCUT_PATH_BY_KEY.get(e.key.toLowerCase());
      if (path) {
        e.preventDefault();
        navigate(path);
      }
    }

    // Search focus (Ctrl/Cmd + /)
    if ((e.ctrlKey || e.metaKey) && e.key === "/") {
      e.preventDefault();
      const searchInput = document.querySelector<HTMLInputElement>(
        'input[placeholder*="Cari"], input[placeholder*="cari"]'
      );
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }
  }, [navigate]);

  useEffect(() => {
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [handleShortcut]);

  return { shortcuts: GLOBAL_SHORTCUTS };
}
