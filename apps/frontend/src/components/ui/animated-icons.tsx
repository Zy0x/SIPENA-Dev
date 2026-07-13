import { cn } from "@/lib/utils";
import React from "react";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  FileSpreadsheet,
  Hand,
  HelpCircle,
  Info,
  LayoutDashboard,
  LockKeyhole,
  Settings,
  Share2,
  Shield,
  Trophy,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { shouldLoadAnimatedAssets } from "@/lib/devicePerformance";

export const createGifIcon = (filename: string, StaticIcon: LucideIcon) => {
  return ({ className }: { className?: string }) => {
    if (!shouldLoadAnimatedAssets()) {
      return <StaticIcon aria-hidden="true" className={cn("h-full w-full", className)} />;
    }

    return <img
      src={`/icons/${filename}`}
      alt=""
      aria-hidden="true"
      className={cn("sipena-animated-nav-icon h-full w-full rounded object-contain", className)}
    />;
  };
};

export const DashboardIcon = createGifIcon("Dashboard.gif", LayoutDashboard);
export const KelasIcon = createGifIcon("Kelas.gif", Users);
export const MataPelajaranIcon = createGifIcon("Mata_Pelajaran.gif", BookOpen);
export const InputNilaiIcon = createGifIcon("Input_Nilai.gif", FileSpreadsheet);
export const PresensiIcon = createGifIcon("Presensi.gif", CalendarDays);
export const LaporanIcon = createGifIcon("Laporan.gif", BarChart3);
export const PengaturanIcon = createGifIcon("Pengaturan.gif", Settings);
export const PanduanIcon = createGifIcon("Panduan.gif", HelpCircle);
export const TentangIcon = createGifIcon("Tentang.gif", Info);
export const KeamananAkunIcon = createGifIcon("Keamanan_Akun.gif", Shield);
export const LaporanNilaiIcon = createGifIcon("Laporan_Nilai.gif", FileSpreadsheet);
export const PortalOrangtuaIcon = createGifIcon("Portal_Orangtua.gif", Share2);
export const ProfilSayaIcon = createGifIcon("Profil_Saya.gif", UserRound);
export const RankingMuridIcon = createGifIcon("Ranking_Murid.gif", Trophy);
export const HandWaveIcon = createGifIcon("Hand_Wave.gif", Hand);
export const LockIcon = createGifIcon("Keamanan_Akun.gif", LockKeyhole);
