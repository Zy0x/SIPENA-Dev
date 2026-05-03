import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

export function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    const target = e.target as HTMLElement;
    const isInputActive = target.tagName === "INPUT" || 
                          target.tagName === "TEXTAREA" || 
                          target.isContentEditable;
    
    // Navigation shortcuts: Ctrl/Cmd + Shift + Key
    if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
      const key = e.key.toLowerCase();
      
      switch (key) {
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
          navigate("/subjects"); // Changed from /setup - S for Subjects
          break;
        case "h":
          e.preventDefault();
          navigate("/help");
          break;
        case "t":
          e.preventDefault();
          navigate("/settings");
          break;
        case "a":
          e.preventDefault();
          navigate("/about");
          break;
      }
      return;
    }
    
    // Search focus: Ctrl/Cmd + /
    if ((e.ctrlKey || e.metaKey) && e.key === "/") {
      e.preventDefault();
      const searchInput = document.querySelector('input[type="text"][placeholder*="Cari"]') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
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