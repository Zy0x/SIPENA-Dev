import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { isEditableShortcutTarget, SHORTCUT_PATH_BY_KEY } from "@/lib/keyboardShortcuts";

export function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    const isInputActive = isEditableShortcutTarget(e.target);

    if (isInputActive && e.key !== "Escape") return;
    
    // Navigation shortcuts: Ctrl/Cmd + Shift + Key
    if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
      const key = e.key.toLowerCase();
      
      const path = SHORTCUT_PATH_BY_KEY.get(key);
      if (path) {
        e.preventDefault();
        navigate(path);
      }
      return;
    }
    
    // Search focus: Ctrl/Cmd + /
    if ((e.ctrlKey || e.metaKey) && e.key === "/") {
      e.preventDefault();
      const searchInput = document.querySelector(
        'input[type="search"], input[placeholder*="Cari"], input[placeholder*="cari"]',
      ) as HTMLInputElement | null;
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
      return;
    }
    
    // Escape: Close dialogs/blur focus
    if (e.key === "Escape") {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
  }, [navigate]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return <>{children}</>;
}
