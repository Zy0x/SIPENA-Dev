import { cn } from "@/lib/utils";
import React from "react";

export const createGifIcon = (filename: string) => {
  return ({ className }: { className?: string }) => (
    <>
      <style>{`
        .sipena-gif-${filename.split('.')[0]} { mix-blend-mode: multiply; filter: none; }
        .dark .sipena-gif-${filename.split('.')[0]} { mix-blend-mode: screen; filter: invert(1) hue-rotate(180deg) brightness(1.2); }
      `}</style>
      <img 
        src={`/icons/${filename}`} 
        alt={filename.replace(".gif", "").replace("_", " ")} 
        className={cn(`rounded w-full h-full object-contain scale-[1.35] sipena-gif-${filename.split('.')[0]}`, className)} 
      />
    </>
  );
};

export const DashboardIcon = createGifIcon("Dashboard.gif");
export const KelasIcon = createGifIcon("Kelas.gif");
export const MataPelajaranIcon = createGifIcon("Mata_Pelajaran.gif");
export const InputNilaiIcon = createGifIcon("Input_Nilai.gif");
export const PresensiIcon = createGifIcon("Presensi.gif");
export const LaporanIcon = createGifIcon("Laporan.gif");
export const PengaturanIcon = createGifIcon("Pengaturan.gif");
export const PanduanIcon = createGifIcon("Panduan.gif");
export const TentangIcon = createGifIcon("Tentang.gif");
export const KeamananAkunIcon = createGifIcon("Keamanan_Akun.gif");
export const LaporanNilaiIcon = createGifIcon("Laporan_Nilai.gif");
export const PortalOrangtuaIcon = createGifIcon("Portal_Orangtua.gif");
export const ProfilSayaIcon = createGifIcon("Profil_Saya.gif");
export const RankingMuridIcon = createGifIcon("Ranking_Murid.gif");
export const HandWaveIcon = createGifIcon("Hand_Wave.gif");
