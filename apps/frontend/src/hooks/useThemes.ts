import { useState, useEffect, useCallback } from 'react';
import { useAuth } from "@/contexts/AuthContext";
import { supabaseExternal as supabase } from "@/core/repositories/supabase-compat.repository";

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
    border?: string;
    muted?: string;
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
    border?: string;
    muted?: string;
  };
}

export const themes: Record<string, ThemeColors> = {
  "default": {
    name: "Default SIPENA",
    colors: ["#3b82f6", "#14b8a6", "#1e293b", "#f8fafc"],
    light: { bg: "#f8fafc", surface: "#ffffff", text: "#0f172a", sec: "#475569", accent: "#2563eb", hover: "#1d4ed8", h1: "#dbeafe", h2: "#60a5fa", border: "#cbd5e1", muted: "#f1f5f9" },
    dark: { bg: "#0f1729", surface: "#1e293b", text: "#f1f5f9", sec: "#94a3b8", accent: "#60a5fa", hover: "#3b82f6", h1: "#1e3a8a", h2: "#3b82f6", border: "#2d3748", muted: "#1e293b" }
  },
  "1": {
    name: "Soft Periwinkle",
    colors: ["#edf2fb", "#e2eafc", "#c1d3fe", "#b6ccfe"],
    light: { bg: "#f5f7fb", surface: "#ffffff", text: "#1e293b", sec: "#475569", accent: "#4f46e5", hover: "#3730a3", h1: "#e2eafc", h2: "#b6ccfe", border: "#c7d2fe", muted: "#e0e7ff" },
    dark: { bg: "#0f172a", surface: "#1e293b", text: "#e2e8f0", sec: "#94a3b8", accent: "#a5b4fc", hover: "#818cf8", h1: "#4c1d95", h2: "#7c3aed", border: "#334155", muted: "#1e293b" }
  },
  "2": {
    name: "Warm Neutral",
    colors: ["#DAD9D4", "#B8B1AA", "#8F8882", "#5D6E75"],
    light: { bg: "#fafaf9", surface: "#ffffff", text: "#1c1917", sec: "#44403c", accent: "#57534e", hover: "#292524", h1: "#e7e5e4", h2: "#d6d3d1", border: "#d6d3d1", muted: "#f5f5f4" },
    dark: { bg: "#1c1917", surface: "#292524", text: "#fafaf9", sec: "#a8a29e", accent: "#a8a29e", hover: "#78716c", h1: "#44403c", h2: "#57534e", border: "#44403c", muted: "#292524" }
  },
  "3": {
    name: "Desert Sand",
    colors: ["#ffe8d6", "#ddbea9", "#cb997e", "#b7b7a4"],
    light: { bg: "#faf6f0", surface: "#ffffff", text: "#451a03", sec: "#78350f", accent: "#b45309", hover: "#92400e", h1: "#fed7aa", h2: "#fdba74", border: "#fed7aa", muted: "#fef3c7" },
    dark: { bg: "#292524", surface: "#44403c", text: "#fefce8", sec: "#e7e5e4", accent: "#fbbf24", hover: "#f59e0b", h1: "#92400e", h2: "#b45309", border: "#57534e", muted: "#44403c" }
  },
  "4": {
    name: "Sky Serenity",
    colors: ["#dceef3", "#c2e2ea", "#a7d5e1", "#72bbce"],
    light: { bg: "#f0f9ff", surface: "#ffffff", text: "#0369a1", sec: "#075985", accent: "#0284c7", hover: "#0369a1", h1: "#bae6fd", h2: "#7dd3fc", border: "#bae6fd", muted: "#e0f2fe" },
    dark: { bg: "#0c4a6e", surface: "#155e75", text: "#e0f2fe", sec: "#7dd3fc", accent: "#38bdf8", hover: "#0ea5e9", h1: "#0f375a", h2: "#1e4e79", border: "#1e4e79", muted: "#134a71" }
  },
  "5": {
    name: "Pastel Lavender",
    colors: ["#fbe4ff", "#e9cfff", "#d7b8ff", "#b28dff"],
    light: { bg: "#faf5ff", surface: "#ffffff", text: "#4c1d95", sec: "#6b21a8", accent: "#7c3aed", hover: "#6d28d9", h1: "#f3e8ff", h2: "#e9d5ff", border: "#e9d5ff", muted: "#f3e8ff" },
    dark: { bg: "#1e1b4b", surface: "#312e81", text: "#ddd6fe", sec: "#c4b5fd", accent: "#a78bfa", hover: "#8b5cf6", h1: "#4c1d95", h2: "#7c3aed", border: "#4338ca", muted: "#312e81" }
  },
  "6": {
    name: "Fresh Mint",
    colors: ["#C8FFC8", "#86efac", "#22c55e", "#14532d"],
    light: { bg: "#f0fdf4", surface: "#ffffff", text: "#14532d", sec: "#166534", accent: "#16a34a", hover: "#15803d", h1: "#dcfce7", h2: "#bbf7d0", border: "#bbf7d0", muted: "#dcfce7" },
    dark: { bg: "#052e16", surface: "#14532d", text: "#bbf7d0", sec: "#86efac", accent: "#22c55e", hover: "#16a34a", h1: "#15803d", h2: "#166534", border: "#166534", muted: "#14532d" }
  },
  "7": {
    name: "Nature Green",
    colors: ["#CEEDB2", "#CEF17B", "#84cc16", "#365314"],
    light: { bg: "#f7fee7", surface: "#ffffff", text: "#365314", sec: "#3f6212", accent: "#65a30d", hover: "#4d7c0f", h1: "#ecfccb", h2: "#d9f99d", border: "#d9f99d", muted: "#ecfccb" },
    dark: { bg: "#1a2e05", surface: "#365314", text: "#dcfce7", sec: "#86efac", accent: "#84cc16", hover: "#65a30d", h1: "#4d7c0f", h2: "#3f6212", border: "#3f6212", muted: "#365314" }
  },
  "8": {
    name: "Modern Indigo",
    colors: ["#EAEFFE", "#9787F3", "#6366f1", "#312e81"],
    light: { bg: "#f5f7ff", surface: "#ffffff", text: "#1e1b4b", sec: "#312e81", accent: "#4f46e5", hover: "#3730a3", h1: "#e0e7ff", h2: "#c7d2fe", border: "#c7d2fe", muted: "#e0e7ff" },
    dark: { bg: "#1e1b4b", surface: "#312e81", text: "#e0e7ff", sec: "#c7d2fe", accent: "#818cf8", hover: "#6366f1", h1: "#4c1d95", h2: "#4338ca", border: "#4338ca", muted: "#312e81" }
  },
  "9": {
    name: "Clean Minimal",
    colors: ["#F6F3ED", "#C2CBD3", "#64748b", "#1e293b"],
    light: { bg: "#fafafa", surface: "#ffffff", text: "#171717", sec: "#404040", accent: "#525252", hover: "#262626", h1: "#e5e5e5", h2: "#d4d4d4", border: "#d4d4d4", muted: "#f5f5f5" },
    dark: { bg: "#0f172a", surface: "#1e293b", text: "#e2e8f0", sec: "#94a3b8", accent: "#94a3b8", hover: "#64748b", h1: "#475569", h2: "#334155", border: "#334155", muted: "#1e293b" }
  },
  "10": {
    name: "Ocean Blue",
    colors: ["#E6F5FA", "#93c5fd", "#3b82f6", "#1e3a8a"],
    light: { bg: "#f0f9ff", surface: "#ffffff", text: "#0f375a", sec: "#1e4e79", accent: "#0284c7", hover: "#0369a1", h1: "#bae6fd", h2: "#7dd3fc", border: "#bae6fd", muted: "#e0f2fe" },
    dark: { bg: "#0c4a6e", surface: "#155e75", text: "#cffafe", sec: "#67e8f9", accent: "#22d3ee", hover: "#06b6d4", h1: "#0e7490", h2: "#0891b2", border: "#0e7490", muted: "#155e75" }
  },
  "11": {
    name: "Cyan Teal",
    colors: ["#d1faff", "#67e8f9", "#22d3ee", "#134e4a"],
    light: { bg: "#ecfeff", surface: "#ffffff", text: "#115e59", sec: "#134e4a", accent: "#0d9488", hover: "#0f766e", h1: "#cffafe", h2: "#a5f3fc", border: "#a5f3fc", muted: "#cffafe" },
    dark: { bg: "#042f2e", surface: "#134e4a", text: "#a5f3fc", sec: "#67e8f9", accent: "#22d3ee", hover: "#06b6d4", h1: "#164e63", h2: "#0e7490", border: "#115e59", muted: "#134e4a" }
  },
  "12": {
    name: "Muted Taupe",
    colors: ["#f3f9d2", "#a8a29e", "#78716c", "#292524"],
    light: { bg: "#fafaf9", surface: "#ffffff", text: "#292524", sec: "#44403c", accent: "#78716c", hover: "#57534e", h1: "#f5f5f4", h2: "#e7e5e4", border: "#e7e5e4", muted: "#f5f5f4" },
    dark: { bg: "#1c1917", surface: "#292524", text: "#fafaf9", sec: "#e7e5e4", accent: "#a8a29e", hover: "#78716c", h1: "#57534e", h2: "#44403c", border: "#44403c", muted: "#292524" }
  },
  "13": {
    name: "Baby Blue",
    colors: ["#c1dff0", "#88ccf1", "#06b6d4", "#164e63"],
    light: { bg: "#f0f9ff", surface: "#ffffff", text: "#0f3747", sec: "#164e63", accent: "#0284c7", hover: "#0369a1", h1: "#bae6fd", h2: "#7dd3fc", border: "#bae6fd", muted: "#e0f2fe" },
    dark: { bg: "#083344", surface: "#164e63", text: "#a5f3fc", sec: "#67e8f9", accent: "#22d3ee", hover: "#06b6d4", h1: "#0e7490", h2: "#0891b2", border: "#115e59", muted: "#164e63" }
  },
  "14": {
    name: "Icy Steel",
    colors: ["#cfdee7", "#93c5fd", "#3b82f6", "#1e3a8a"],
    light: { bg: "#f1f5f9", surface: "#ffffff", text: "#0f172a", sec: "#334155", accent: "#2563eb", hover: "#1d4ed8", h1: "#e2e8f0", h2: "#cbd5e1", border: "#cbd5e1", muted: "#e2e8f0" },
    dark: { bg: "#172554", surface: "#1e3a8a", text: "#dbeafe", sec: "#93c5fd", accent: "#60a5fa", hover: "#3b82f6", h1: "#1e40af", h2: "#2563eb", border: "#1e40af", muted: "#1e3a8a" }
  },
  "15": {
    name: "Pearl Aqua",
    colors: ["#a1d2ce", "#14b8a6", "#0d9488", "#134e4a"],
    light: { bg: "#f0fdfa", surface: "#ffffff", text: "#115e59", sec: "#134e4a", accent: "#0d9488", hover: "#0f766e", h1: "#ccfbf1", h2: "#99f6e4", border: "#99f6e4", muted: "#ccfbf1" },
    dark: { bg: "#042f2e", surface: "#134e4a", text: "#a5f3fc", sec: "#67e8f9", accent: "#22d3ee", hover: "#06b6d4", h1: "#164e63", h2: "#0e7490", border: "#115e59", muted: "#134e4a" }
  },
  "16": {
    name: "Deep Teal",
    colors: ["#dadff7", "#94a3b8", "#475569", "#0f172a"],
    light: { bg: "#f0fdfa", surface: "#ffffff", text: "#0f3737", sec: "#115e59", accent: "#0f766e", hover: "#115e59", h1: "#ccfbf1", h2: "#99f6e4", border: "#99f6e4", muted: "#ccfbf1" },
    dark: { bg: "#0f172a", surface: "#1e293b", text: "#e2e8f0", sec: "#cbd5e1", accent: "#94a3b8", hover: "#64748b", h1: "#334155", h2: "#1e293b", border: "#334155", muted: "#1e293b" }
  },
  "17": {
    name: "Sapphire",
    colors: ["#cfdee7", "#60a5fa", "#3b82f6", "#1e3a8a"],
    light: { bg: "#f0f4f8", surface: "#ffffff", text: "#102a43", sec: "#334e68", accent: "#127fbf", hover: "#0b69a3", h1: "#d9e2ec", h2: "#bcccdc", border: "#bcccdc", muted: "#d9e2ec" },
    dark: { bg: "#172554", surface: "#1e3a8a", text: "#dbeafe", sec: "#93c5fd", accent: "#60a5fa", hover: "#3b82f6", h1: "#1e40af", h2: "#2563eb", border: "#1e40af", muted: "#1e3a8a" }
  },
  "18": {
    name: "Midnight Violet",
    colors: ["#fdf2f8", "#c084fc", "#a855f7", "#581c87"],
    light: { bg: "#faf5ff", surface: "#ffffff", text: "#2e1065", sec: "#581c87", accent: "#7c3aed", hover: "#6d28d9", h1: "#f3e8ff", h2: "#e9d5ff", border: "#e9d5ff", muted: "#f3e8ff" },
    dark: { bg: "#1e1b4b", surface: "#312e81", text: "#e9d5ff", sec: "#d8b4fe", accent: "#c084fc", hover: "#a855f7", h1: "#581c87", h2: "#7c3aed", border: "#4338ca", muted: "#312e81" }
  },
  "19": {
    name: "Imperial Magenta",
    colors: ["#fffaff", "#a78bfa", "#d946ef", "#1e1b4b"],
    light: { bg: "#fff5f7", surface: "#ffffff", text: "#4a0404", sec: "#881337", accent: "#be123c", hover: "#9f1239", h1: "#ffe4e6", h2: "#fecdd3", border: "#fecdd3", muted: "#ffe4e6" },
    dark: { bg: "#1e1b4b", surface: "#312e81", text: "#f3e8ff", sec: "#e9d5ff", accent: "#d946ef", hover: "#c026d3", h1: "#7e22ce", h2: "#6b21b6", border: "#4338ca", muted: "#312e81" }
  },
  "20": {
    name: "Baltic Cerulean",
    colors: ["#d9dcd6", "#22d3ee", "#06b6d4", "#134e4a"],
    light: { bg: "#f4f7f6", surface: "#ffffff", text: "#115e59", sec: "#134e4a", accent: "#0d9488", hover: "#0f766e", h1: "#ccfbf1", h2: "#99f6e4", border: "#99f6e4", muted: "#ccfbf1" },
    dark: { bg: "#042f2e", surface: "#134e4a", text: "#a5f3fc", sec: "#67e8f9", accent: "#22d3ee", hover: "#06b6d4", h1: "#164e63", h2: "#0e7490", border: "#115e59", muted: "#134e4a" }
  }
};

export type ThemeMode = "light" | "dark";

export interface ThemePreference {
  mode: ThemeMode;
  palette: string;
}

interface UserThemePreferenceRow {
  id?: string;
  theme_mode?: string | null;
  theme_palette?: string | null;
}

export const DEFAULT_THEME_PREFERENCE: ThemePreference = {
  mode: "light",
  palette: "default",
};

export const THEME_PREFERENCE_EVENT = "sipena:theme-preference";

// Convert hex to HSL string for CSS variables
function hexToHsl(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "0 0% 0%";
  
  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;
  
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

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

function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export function normalizeThemePreference(preference?: Partial<ThemePreference> | null): ThemePreference {
  const palette = preference?.palette && themes[preference.palette]
    ? preference.palette
    : DEFAULT_THEME_PREFERENCE.palette;
  const mode: ThemeMode = preference?.mode === "dark" ? "dark" : "light";

  return { mode, palette };
}

export function themePreferenceFromRow(row?: UserThemePreferenceRow | null): ThemePreference {
  return normalizeThemePreference({
    mode: row?.theme_mode === "dark" ? "dark" : "light",
    palette: row?.theme_palette || DEFAULT_THEME_PREFERENCE.palette,
  });
}

export function readStoredThemePreference(): ThemePreference {
  if (!isBrowser()) return DEFAULT_THEME_PREFERENCE;

  return normalizeThemePreference({
    mode: localStorage.getItem("theme") === "dark" ? "dark" : "light",
    palette: localStorage.getItem("colorTheme") || DEFAULT_THEME_PREFERENCE.palette,
  });
}

function writeStoredThemePreference(preference: ThemePreference) {
  if (!isBrowser()) return;

  localStorage.setItem("colorTheme", preference.palette);
  localStorage.setItem("theme", preference.mode);
}

function emitThemePreference(preference: ThemePreference) {
  if (!isBrowser()) return;

  window.dispatchEvent(
    new CustomEvent<ThemePreference>(THEME_PREFERENCE_EVENT, {
      detail: preference,
    }),
  );
}

export function applyThemePreference(
  preference?: Partial<ThemePreference> | null,
  options: { persist?: boolean; emit?: boolean } = {},
): ThemePreference {
  const { persist = true, emit = true } = options;
  const appliedPreference = normalizeThemePreference(preference);

  if (!isBrowser()) return appliedPreference;

  const theme = themes[appliedPreference.palette] || themes.default;
  const dark = appliedPreference.mode === "dark";
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
  if (appliedPreference.palette !== "default") {
    root.style.setProperty('--background', hexToHsl(mode.bg));
    root.style.setProperty('--card', hexToHsl(mode.surface));
    root.style.setProperty('--popover', hexToHsl(mode.surface));
    root.style.setProperty('--foreground', hexToHsl(mode.text));
    root.style.setProperty('--card-foreground', hexToHsl(mode.text));
    root.style.setProperty('--popover-foreground', hexToHsl(mode.text));
    root.style.setProperty('--muted-foreground', hexToHsl(mode.sec));
    root.style.setProperty('--primary', hexToHsl(mode.accent));
    root.style.setProperty('--accent', hexToHsl(mode.accent));
    
    // Apply theme-based border, input and muted variables dynamically
    const borderHex = mode.border || (dark ? '#2d3748' : '#cbd5e1');
    const mutedHex = mode.muted || (dark ? '#1e293b' : '#f3f4f6');
    root.style.setProperty('--border', hexToHsl(borderHex));
    root.style.setProperty('--input', hexToHsl(borderHex));
    root.style.setProperty('--muted', hexToHsl(mutedHex));
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
    root.style.removeProperty('--border');
    root.style.removeProperty('--input');
    root.style.removeProperty('--muted');
  }

  root.classList.toggle("dark", dark);

  if (persist) writeStoredThemePreference(appliedPreference);
  if (emit) emitThemePreference(appliedPreference);

  return appliedPreference;
}

export function useThemes() {
  const { user } = useAuth();
  const [currentTheme, setCurrentTheme] = useState<string>("default");
  const [isDark, setIsDark] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const syncStateFromPreference = useCallback((preference: ThemePreference) => {
    setCurrentTheme(preference.palette);
    setIsDark(preference.mode === "dark");
  }, []);

  const applyAndSync = useCallback((preference: Partial<ThemePreference>) => {
    const appliedPreference = applyThemePreference(preference);
    syncStateFromPreference(appliedPreference);
    return appliedPreference;
  }, [syncStateFromPreference]);

  const saveUserThemePreference = useCallback(async (preference: ThemePreference) => {
    if (!user?.id) return;

    const { error } = await supabase
      .from("user_preferences")
      .upsert({
        user_id: user.id,
        theme_mode: preference.mode,
        theme_palette: preference.palette,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (error) throw error;
  }, [user?.id]);

  // Initialize from localStorage immediately, then let the database sync override it.
  useEffect(() => {
    const storedPreference = applyThemePreference(readStoredThemePreference());
    syncStateFromPreference(storedPreference);
    setIsInitialized(true);
  }, [syncStateFromPreference]);

  // Keep hook state aligned when another component/tab applies a new theme.
  useEffect(() => {
    const handlePreferenceChange = (event: Event) => {
      const preference = (event as CustomEvent<ThemePreference>).detail;
      syncStateFromPreference(normalizeThemePreference(preference));
    };

    window.addEventListener(THEME_PREFERENCE_EVENT, handlePreferenceChange);
    return () => window.removeEventListener(THEME_PREFERENCE_EVENT, handlePreferenceChange);
  }, [syncStateFromPreference]);

  // Load database preference after login so every device follows the saved account setting.
  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;

    const loadUserThemePreference = async () => {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("theme_mode, theme_palette")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!isMounted || error || !data) return;

      const preference = themePreferenceFromRow(data);
      const appliedPreference = applyThemePreference(preference);
      syncStateFromPreference(appliedPreference);
    };

    loadUserThemePreference();

    return () => {
      isMounted = false;
    };
  }, [syncStateFromPreference, user?.id]);

  const selectTheme = useCallback(async (themeId: string) => {
    const preference = applyAndSync({
      palette: themeId,
      mode: isDark ? "dark" : "light",
    });

    await saveUserThemePreference(preference);
  }, [applyAndSync, isDark, saveUserThemePreference]);

  const toggleDarkMode = useCallback(async () => {
    const preference = applyAndSync({
      palette: currentTheme,
      mode: isDark ? "light" : "dark",
    });

    await saveUserThemePreference(preference);
  }, [applyAndSync, currentTheme, isDark, saveUserThemePreference]);

  const resetToDefault = useCallback(async () => {
    const preference = applyAndSync({
      palette: "default",
      mode: isDark ? "dark" : "light",
    });

    await saveUserThemePreference(preference);
  }, [applyAndSync, isDark, saveUserThemePreference]);


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
