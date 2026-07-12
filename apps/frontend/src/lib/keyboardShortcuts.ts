export interface NavigationShortcut {
  key: string;
  label: string;
  path: string;
}

export const NAVIGATION_SHORTCUTS: readonly NavigationShortcut[] = [
  { key: "D", label: "Dashboard", path: "/dashboard" },
  { key: "K", label: "Kelas & Murid", path: "/classes" },
  { key: "M", label: "Mata Pelajaran", path: "/subjects" },
  { key: "N", label: "Input Nilai", path: "/grades" },
  { key: "P", label: "Presensi", path: "/attendance" },
  { key: "L", label: "Laporan", path: "/reports" },
  { key: "R", label: "Laporan Nilai", path: "/reports/grades" },
  { key: "O", label: "Ranking Murid", path: "/reports/rankings" },
  { key: "W", label: "Portal Orang Tua", path: "/reports/portal" },
  { key: "T", label: "Pengaturan", path: "/settings" },
  { key: "U", label: "Profil Saya", path: "/settings/profile" },
  { key: "H", label: "Panduan", path: "/help" },
  { key: "A", label: "Tentang SIPENA", path: "/about" },
] as const;

export const SHORTCUT_PATH_BY_KEY = new Map(
  NAVIGATION_SHORTCUTS.map((shortcut) => [shortcut.key.toLowerCase(), shortcut.path]),
);

export const UTILITY_SHORTCUTS = [
  { keys: "Ctrl/Cmd + K", label: "Buka pencarian global" },
  { keys: "Ctrl/Cmd + /", label: "Fokus pencarian halaman" },
  { keys: "Ctrl/Cmd + B", label: "Buka atau tutup sidebar" },
  { keys: "Escape", label: "Tutup dialog atau lepaskan fokus" },
] as const;

export function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}
