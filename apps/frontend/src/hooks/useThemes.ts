import { useState, useEffect, useCallback } from 'react';

export interface ThemeColors {
  name: string;
  colors: string[];
  light: {
    bg: string;
    surface: string;
    text: string;
    sec: string;
    accent: string;
    hover: string;
    h1: string;
    h2: string;
  };
  dark: {
    bg: string;
    surface: string;
    text: string;
    sec: string;
    accent: string;
    hover: string;
    h1: string;
    h2: string;
  };
}

export const themes: Record<string, ThemeColors> = {
  "default": {
    name: "Default SIPENA",
    colors: ["#3b82f6", "#14b8a6", "#1e293b", "#f8fafc"],
    light: { bg: "#f8fafc", surface: "#ffffff", text: "#1e293b", sec: "#475569", accent: "#3b82f6", hover: "#2563eb", h1: "#dbeafe", h2: "#60a5fa" },
    dark: { bg: "#0f1729", surface: "#1e293b", text: "#f1f5f9", sec: "#94a3b8", accent: "#60a5fa", hover: "#3b82f6", h1: "#1e3a8a", h2: "#3b82f6" }
  },
  "1": {
    name: "Soft Periwinkle",
    colors: ["#edf2fb", "#e2eafc", "#c1d3fe", "#b6ccfe"],
    light: { bg: "#edf2fb", surface: "#ffffff", text: "#1e293b", sec: "#475569", accent: "#c1d3fe", hover: "#abc4ff", h1: "#e2eafc", h2: "#b6ccfe" },
    dark: { bg: "#0f172a", surface: "#1e293b", text: "#e2e8f0", sec: "#94a3b8", accent: "#a5b4fc", hover: "#818cf8", h1: "#4c1d95", h2: "#7c3aed" }
  },
  "2": {
    name: "Warm Neutral",
    colors: ["#DAD9D4", "#B8B1AA", "#8F8882", "#5D6E75"],
    light: { bg: "#DAD9D4", surface: "#ffffff", text: "#1f2937", sec: "#4b5563", accent: "#5D6E75", hover: "#4c5a62", h1: "#B8B1AA", h2: "#8F8882" },
    dark: { bg: "#1e2937", surface: "#2d3748", text: "#f1f5f9", sec: "#cbd5e1", accent: "#60a5fa", hover: "#3b82f6", h1: "#636e72", h2: "#9ca3af" }
  },
  "3": {
    name: "Desert Sand",
    colors: ["#ffe8d6", "#ddbea9", "#cb997e", "#b7b7a4"],
    light: { bg: "#ffe8d6", surface: "#ffffff", text: "#44403c", sec: "#78716c", accent: "#ddbea9", hover: "#cb997e", h1: "#ddbea9", h2: "#cb997e" },
    dark: { bg: "#292524", surface: "#44403c", text: "#fefce8", sec: "#e7e5e4", accent: "#fbbf24", hover: "#f59e0b", h1: "#92400e", h2: "#b45309" }
  },
  "4": {
    name: "Sky Serenity",
    colors: ["#dceef3", "#c2e2ea", "#a7d5e1", "#72bbce"],
    light: { bg: "#dceef3", surface: "#ffffff", text: "#1e40af", sec: "#3b82f6", accent: "#60a5fa", hover: "#3d8bfd", h1: "#a7d5e1", h2: "#72bbce" },
    dark: { bg: "#172554", surface: "#1e3a8a", text: "#dbeafe", sec: "#93c5fd", accent: "#60a5fa", hover: "#3b82f6", h1: "#1e40af", h2: "#2563eb" }
  },
  "5": {
    name: "Pastel Lavender",
    colors: ["#fbe4ff", "#e9cfff", "#d7b8ff", "#b28dff"],
    light: { bg: "#fbe4ff", surface: "#ffffff", text: "#581c87", sec: "#7c3aed", accent: "#c4b5fd", hover: "#a78bfa", h1: "#d7b8ff", h2: "#b28dff" },
    dark: { bg: "#1e1b4b", surface: "#312e81", text: "#ddd6fe", sec: "#c4b5fd", accent: "#a78bfa", hover: "#8b5cf6", h1: "#4c1d95", h2: "#7c3aed" }
  },
  "6": {
    name: "Fresh Mint",
    colors: ["#C8FFC8", "#86efac", "#22c55e", "#14532d"],
    light: { bg: "#C8FFC8", surface: "#ffffff", text: "#0f766e", sec: "#14b8a6", accent: "#14b8a6", hover: "#0d9488", h1: "#86efac", h2: "#10b981" },
    dark: { bg: "#052e16", surface: "#14532d", text: "#bbf7d0", sec: "#86efac", accent: "#22c55e", hover: "#16a34a", h1: "#15803d", h2: "#166534" }
  },
  "7": {
    name: "Nature Green",
    colors: ["#CEEDB2", "#CEF17B", "#84cc16", "#365314"],
    light: { bg: "#CEEDB2", surface: "#ffffff", text: "#166534", sec: "#22c55e", accent: "#84cc16", hover: "#65a30d", h1: "#CEF17B", h2: "#84cc16" },
    dark: { bg: "#1a2e05", surface: "#365314", text: "#dcfce7", sec: "#86efac", accent: "#84cc16", hover: "#65a30d", h1: "#4d7c0f", h2: "#3f6212" }
  },
  "8": {
    name: "Modern Indigo",
    colors: ["#EAEFFE", "#9787F3", "#6366f1", "#312e81"],
    light: { bg: "#EAEFFE", surface: "#ffffff", text: "#312e81", sec: "#6366f1", accent: "#818cf8", hover: "#6366f1", h1: "#9787F3", h2: "#6366f1" },
    dark: { bg: "#1e1b4b", surface: "#312e81", text: "#e0e7ff", sec: "#c7d2fe", accent: "#818cf8", hover: "#6366f1", h1: "#4c1d95", h2: "#4338ca" }
  },
  "9": {
    name: "Clean Minimal",
    colors: ["#F6F3ED", "#C2CBD3", "#64748b", "#1e293b"],
    light: { bg: "#F6F3ED", surface: "#ffffff", text: "#1e293b", sec: "#475569", accent: "#94a3b8", hover: "#64748b", h1: "#cbd5e1", h2: "#64748b" },
    dark: { bg: "#0f172a", surface: "#1e293b", text: "#e2e8f0", sec: "#94a3b8", accent: "#94a3b8", hover: "#64748b", h1: "#475569", h2: "#334155" }
  },
  "10": {
    name: "Ocean Blue",
    colors: ["#E6F5FA", "#93c5fd", "#3b82f6", "#1e3a8a"],
    light: { bg: "#E6F5FA", surface: "#ffffff", text: "#1e3a8a", sec: "#1d4ed8", accent: "#60a5fa", hover: "#3b82f6", h1: "#93c5fd", h2: "#60a5fa" },
    dark: { bg: "#0c4a6e", surface: "#155e75", text: "#cffafe", sec: "#67e8f9", accent: "#22d3ee", hover: "#06b6d4", h1: "#0e7490", h2: "#0891b2" }
  },
  "11": {
    name: "Cyan Teal",
    colors: ["#d1faff", "#67e8f9", "#22d3ee", "#134e4a"],
    light: { bg: "#d1faff", surface: "#ffffff", text: "#134e4a", sec: "#115e59", accent: "#14b8a6", hover: "#0d9488", h1: "#67e8f9", h2: "#22d3ee" },
    dark: { bg: "#042f2e", surface: "#134e4a", text: "#a5f3fc", sec: "#67e8f9", accent: "#22d3ee", hover: "#06b6d4", h1: "#164e63", h2: "#0e7490" }
  },
  "12": {
    name: "Muted Taupe",
    colors: ["#f3f9d2", "#a8a29e", "#78716c", "#292524"],
    light: { bg: "#f3f9d2", surface: "#ffffff", text: "#292524", sec: "#44403c", accent: "#78716c", hover: "#57534e", h1: "#a8a29e", h2: "#78716c" },
    dark: { bg: "#1c1917", surface: "#292524", text: "#fafaf9", sec: "#e7e5e4", accent: "#a8a29e", hover: "#78716c", h1: "#57534e", h2: "#44403c" }
  },
  "13": {
    name: "Baby Blue",
    colors: ["#c1dff0", "#88ccf1", "#06b6d4", "#164e63"],
    light: { bg: "#c1dff0", surface: "#ffffff", text: "#164e63", sec: "#0891b2", accent: "#06b6d4", hover: "#0e7490", h1: "#22d3ee", h2: "#06b6d4" },
    dark: { bg: "#083344", surface: "#164e63", text: "#a5f3fc", sec: "#67e8f9", accent: "#22d3ee", hover: "#06b6d4", h1: "#0e7490", h2: "#0891b2" }
  },
  "14": {
    name: "Icy Steel",
    colors: ["#cfdee7", "#93c5fd", "#3b82f6", "#1e3a8a"],
    light: { bg: "#cfdee7", surface: "#ffffff", text: "#1e3a8a", sec: "#1e40af", accent: "#3b82f6", hover: "#2563eb", h1: "#60a5fa", h2: "#3b82f6" },
    dark: { bg: "#172554", surface: "#1e3a8a", text: "#dbeafe", sec: "#93c5fd", accent: "#60a5fa", hover: "#3b82f6", h1: "#1e40af", h2: "#2563eb" }
  },
  "15": {
    name: "Pearl Aqua",
    colors: ["#a1d2ce", "#14b8a6", "#0d9488", "#134e4a"],
    light: { bg: "#a1d2ce", surface: "#ffffff", text: "#134e4a", sec: "#115e59", accent: "#14b8a6", hover: "#0d9488", h1: "#22d3ee", h2: "#06b6d4" },
    dark: { bg: "#042f2e", surface: "#134e4a", text: "#a5f3fc", sec: "#67e8f9", accent: "#22d3ee", hover: "#06b6d4", h1: "#164e63", h2: "#0e7490" }
  },
  "16": {
    name: "Deep Teal",
    colors: ["#dadff7", "#94a3b8", "#475569", "#0f172a"],
    light: { bg: "#dadff7", surface: "#ffffff", text: "#1e293b", sec: "#334155", accent: "#475569", hover: "#1e293b", h1: "#94a3b8", h2: "#64748b" },
    dark: { bg: "#0f172a", surface: "#1e293b", text: "#e2e8f0", sec: "#cbd5e1", accent: "#94a3b8", hover: "#64748b", h1: "#334155", h2: "#1e293b" }
  },
  "17": {
    name: "Sapphire",
    colors: ["#cfdee7", "#60a5fa", "#3b82f6", "#1e3a8a"],
    light: { bg: "#cfdee7", surface: "#ffffff", text: "#1e3a8a", sec: "#1e40af", accent: "#3b82f6", hover: "#2563eb", h1: "#60a5fa", h2: "#3b82f6" },
    dark: { bg: "#172554", surface: "#1e3a8a", text: "#dbeafe", sec: "#93c5fd", accent: "#60a5fa", hover: "#3b82f6", h1: "#1e40af", h2: "#2563eb" }
  },
  "18": {
    name: "Midnight Violet",
    colors: ["#fdf2f8", "#c084fc", "#a855f7", "#581c87"],
    light: { bg: "#fdf2f8", surface: "#ffffff", text: "#4c1d95", sec: "#7c3aed", accent: "#a78bfa", hover: "#9333ea", h1: "#c084fc", h2: "#a855f7" },
    dark: { bg: "#1e1b4b", surface: "#312e81", text: "#e9d5ff", sec: "#d8b4fe", accent: "#c084fc", hover: "#a855f7", h1: "#581c87", h2: "#7c3aed" }
  },
  "19": {
    name: "Imperial Magenta",
    colors: ["#fffaff", "#a78bfa", "#d946ef", "#1e1b4b"],
    light: { bg: "#fffaff", surface: "#ffffff", text: "#1e1b4b", sec: "#312e81", accent: "#8b5cf6", hover: "#7c3aed", h1: "#a78bfa", h2: "#9333ea" },
    dark: { bg: "#1e1b4b", surface: "#312e81", text: "#f3e8ff", sec: "#e9d5ff", accent: "#d946ef", hover: "#c026d3", h1: "#7e22ce", h2: "#6b21b6" }
  },
  "20": {
    name: "Baltic Cerulean",
    colors: ["#d9dcd6", "#22d3ee", "#06b6d4", "#134e4a"],
    light: { bg: "#d9dcd6", surface: "#ffffff", text: "#164e63", sec: "#0891b2", accent: "#06b6d4", hover: "#0e7490", h1: "#22d3ee", h2: "#06b6d4" },
    dark: { bg: "#042f2e", surface: "#134e4a", text: "#a5f3fc", sec: "#67e8f9", accent: "#22d3ee", hover: "#06b6d4", h1: "#164e63", h2: "#0e7490" }
  }
};

// Convert hex to HSL string for CSS variables
function hexToHsl(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "0 0% 0%";
  
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function useThemes() {
  const [currentTheme, setCurrentTheme] = useState<string>("default");
  const [isDark, setIsDark] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize from localStorage - runs once on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("colorTheme") || "default";
    const savedMode = localStorage.getItem("theme");
    
    // Default to light mode unless explicitly set to dark
    const shouldBeDark = savedMode === "dark";
    
    setCurrentTheme(savedTheme);
    setIsDark(shouldBeDark);
    setIsInitialized(true);
    
    // Immediately apply theme on mount to prevent flash
    const theme = themes[savedTheme];
    if (theme) {
      const mode = shouldBeDark ? theme.dark : theme.light;
      const root = document.documentElement;

      // Apply custom CSS variables
      root.style.setProperty('--custom-bg', hexToHsl(mode.bg));
      root.style.setProperty('--custom-surface', hexToHsl(mode.surface));
      root.style.setProperty('--custom-text', hexToHsl(mode.text));
      root.style.setProperty('--custom-text-sec', hexToHsl(mode.sec));
      root.style.setProperty('--custom-accent', hexToHsl(mode.accent));
      root.style.setProperty('--custom-accent-hover', hexToHsl(mode.hover));
      root.style.setProperty('--custom-header-start', hexToHsl(mode.h1));
      root.style.setProperty('--custom-header-end', hexToHsl(mode.h2));

      if (savedTheme !== "default") {
        root.style.setProperty('--background', hexToHsl(mode.bg));
        root.style.setProperty('--card', hexToHsl(mode.surface));
        root.style.setProperty('--popover', hexToHsl(mode.surface));
        root.style.setProperty('--foreground', hexToHsl(mode.text));
        root.style.setProperty('--card-foreground', hexToHsl(mode.text));
        root.style.setProperty('--popover-foreground', hexToHsl(mode.text));
        root.style.setProperty('--muted-foreground', hexToHsl(mode.sec));
        root.style.setProperty('--primary', hexToHsl(mode.accent));
        root.style.setProperty('--accent', hexToHsl(mode.accent));
      }

      // Toggle dark class
      if (shouldBeDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  }, []);

  // Apply theme to document
  const applyTheme = useCallback((themeId: string, dark: boolean) => {
    const theme = themes[themeId];
    if (!theme) return;

    const mode = dark ? theme.dark : theme.light;
    const root = document.documentElement;

    // Apply custom CSS variables
    root.style.setProperty('--custom-bg', hexToHsl(mode.bg));
    root.style.setProperty('--custom-surface', hexToHsl(mode.surface));
    root.style.setProperty('--custom-text', hexToHsl(mode.text));
    root.style.setProperty('--custom-text-sec', hexToHsl(mode.sec));
    root.style.setProperty('--custom-accent', hexToHsl(mode.accent));
    root.style.setProperty('--custom-accent-hover', hexToHsl(mode.hover));
    root.style.setProperty('--custom-header-start', hexToHsl(mode.h1));
    root.style.setProperty('--custom-header-end', hexToHsl(mode.h2));

    // For non-default themes, apply to main CSS variables
    if (themeId !== "default") {
      root.style.setProperty('--background', hexToHsl(mode.bg));
      root.style.setProperty('--card', hexToHsl(mode.surface));
      root.style.setProperty('--popover', hexToHsl(mode.surface));
      root.style.setProperty('--foreground', hexToHsl(mode.text));
      root.style.setProperty('--card-foreground', hexToHsl(mode.text));
      root.style.setProperty('--popover-foreground', hexToHsl(mode.text));
      root.style.setProperty('--muted-foreground', hexToHsl(mode.sec));
      root.style.setProperty('--primary', hexToHsl(mode.accent));
      root.style.setProperty('--accent', hexToHsl(mode.accent));
    } else {
      // Reset to default by removing inline styles
      root.style.removeProperty('--background');
      root.style.removeProperty('--card');
      root.style.removeProperty('--popover');
      root.style.removeProperty('--foreground');
      root.style.removeProperty('--card-foreground');
      root.style.removeProperty('--popover-foreground');
      root.style.removeProperty('--muted-foreground');
      root.style.removeProperty('--primary');
      root.style.removeProperty('--accent');
    }

    // Toggle dark class
    if (dark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    localStorage.setItem("colorTheme", themeId);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, []);

  const selectTheme = useCallback((themeId: string) => {
    setCurrentTheme(themeId);
    applyTheme(themeId, isDark);
  }, [isDark, applyTheme]);

  const toggleDarkMode = useCallback(() => {
    const newDark = !isDark;
    setIsDark(newDark);
    applyTheme(currentTheme, newDark);
  }, [isDark, currentTheme, applyTheme]);

  const resetToDefault = useCallback(() => {
    setCurrentTheme("default");
    applyTheme("default", isDark);
  }, [isDark, applyTheme]);

  // Only apply theme changes after initialization (not on initial mount)
  useEffect(() => {
    if (isInitialized) {
      applyTheme(currentTheme, isDark);
    }
  }, [currentTheme, isDark, applyTheme, isInitialized]);

  return {
    themes,
    currentTheme,
    isDark,
    isInitialized,
    selectTheme,
    toggleDarkMode,
    resetToDefault,
  };
}
