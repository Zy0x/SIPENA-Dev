import React from "react";
import {
  Activity,
  Clock,
} from "lucide-react";

import {
  SectionIntro,
  InfoHelp,
  CompactMetric,
  EmptyState,
} from "./SettingsShared";

export interface AuditSectionProps {
  isLocked: boolean;
}

export const AuditSection: React.FC<AuditSectionProps> = ({ isLocked }) => {
  return (
    <div className="space-y-4" data-tour="attendance-v2-settings-audit">
      <SectionIntro
        icon={Clock}
        title="Audit Riwayat Perubahan"
        description="Area monitoring transaksi presensi. Peninjauan menyeluruh terhadap log riwayat perubahan status kehadiran murid."
        help={
          <InfoHelp
            label="Audit Log"
            summary="Jejak digital pengubahan data kehadiran."
            detail="Setiap pengubahan, baik manual, import Excel, pemindaian OCR, maupun restore backup, akan dicatat secara transparan di database."
            example="Wali kelas mengubah status Alfa menjadi Sakit untuk murid A pada pukul 09:30."
            impact="Menjaga integritas data akademik dan transparansi pelaporan kehadiran."
          />
        }
      />
      <div className="rounded-2xl border bg-card p-4 shadow-sm" data-tour="attendance-v2-settings-audit-history">
        <div className="grid grid-cols-3 gap-2 mb-4 border-b pb-4">
          <CompactMetric label="Sumber Aksi" value="Manual, Excel, OCR, Restore" />
          <CompactMetric label="Tipe Akun" value="Guru Piket / Asli" />
          <CompactMetric label="Mode Bulan" value={isLocked ? "Terkunci" : "Dapat Diedit"} tone={isLocked ? "amber" : "green"} />
        </div>
        <EmptyState
          icon={Activity}
          text="Belum ada riwayat aktivitas. Log pengubahan presensi murid akan otomatis muncul di panel ini saat proses edit berjalan."
        />
      </div>
    </div>
  );
};
