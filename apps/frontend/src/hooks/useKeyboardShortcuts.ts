import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
}

export const GLOBAL_SHORTCUTS: Shortcut[] = [
  { key: "d", ctrl: true, shift: true, description: "Buka Dashboard", action: () => {} },
  { key: "k", ctrl: true, shift: true, description: "Buka Kelas", action: () => {} },
  { key: "m", ctrl: true, shift: true, description: "Buka Mapel", action: () => {} },
  { key: "n", ctrl: true, shift: true, description: "Buka Input Nilai", action: () => {} },
  { key: "l", ctrl: true, shift: true, description: "Buka Laporan", action: () => {} },
  { key: "p", ctrl: true, shift: true, description: "Buka Presensi", action: () => {} },
  { key: "s", ctrl: true, shift: true, description: "Buka Setup", action: () => {} },
  { key: "h", ctrl: true, shift: true, description: "Buka Panduan", action: () => {} },
  { key: "/", ctrl: true, description: "Fokus Pencarian", action: () => {} },
  { key: "Escape", description: "Tutup Dialog/Modal", action: () => {} },
];

export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  const handleShortcut = useCallback((e: KeyboardEvent) => {
    // Skip if user is typing in input/textarea
    const target = e.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable
    ) {
      // Only allow Escape in inputs
      if (e.key !== "Escape") return;
    }

    // Navigation shortcuts (Ctrl/Cmd + Shift + Key)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
      switch (e.key.toLowerCase()) {
        case "d":
          e.preventDefault();
          navigate("/dashboard");
          break;
        case "k":
          e.preventDefault();
          navigate("/classes");
          break;
        case "m":
          e.preventDefault();
          navigate("/subjects");
          break;
        case "n":
          e.preventDefault();
          navigate("/grades");
          break;
        case "l":
          e.preventDefault();
          navigate("/reports");
          break;
        case "p":
          e.preventDefault();
          navigate("/attendance");
          break;
        case "s":
          e.preventDefault();
          navigate("/setup");
          break;
        case "h":
          e.preventDefault();
          navigate("/help");
          break;
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
