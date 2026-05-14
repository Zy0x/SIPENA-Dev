import type { PreviewCellStatus } from "@/lib/gradeImport";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export const previewCellBadgeText: Record<PreviewCellStatus, { label: string; description: string }> = {
  unchanged: {
    label: "Tetap",
    description: "Nilai sama atau tidak memiliki perubahan yang perlu ditampilkan.",
  },
  included: {
    label: "Dipilih",
    description: "Nilai ini dipilih untuk ikut diproses.",
  },
  new_value: {
    label: "Nilai baru",
    description: "Nilai Excel akan mengisi sel SIPENA yang masih kosong.",
  },
  changed: {
    label: "Beda",
    description: "Nilai Excel berbeda dari nilai SIPENA dan perlu aturan kolom.",
  },
  new_column: {
    label: "Kolom baru",
    description: "Header ini dibaca sebagai target baru dan perlu dikonfirmasi.",
  },
  needs_check: {
    label: "Cek",
    description: "Data valid, tetapi masih perlu ditinjau agar target atau keputusan aman.",
  },
  manual_required: {
    label: "Pilih",
    description: "Sistem belum bisa memastikan pilihan. Pengguna perlu menentukan keputusan.",
  },
  ignored: {
    label: "Lewati",
    description: "Baris, kolom, atau nilai ini tidak akan disimpan.",
  },
  invalid: {
    label: "Tidak valid",
    description: "Nilai tidak sesuai aturan angka 0-100 dan tidak boleh disimpan.",
  },
  skipped: {
    label: "Dilewati",
    description: "Nilai ini aman dilewati, biasanya karena kosong atau sama dengan data SIPENA.",
  },
  manual_included: {
    label: "Dipilih",
    description: "Pengguna memilih nilai ini secara manual untuk ikut diproses.",
  },
  manual_skipped: {
    label: "Dilewati",
    description: "Pengguna memilih nilai ini untuk dilewati.",
  },
  blocked: {
    label: "Menunggu pilihan",
    description: "Nilai menunggu pilihan siswa, target header, atau keputusan yang aman.",
  },
  overwrite: {
    label: "Timpa",
    description: "Nilai Excel akan mengganti nilai SIPENA setelah konfirmasi.",
  },
};

export function PreviewCellBadge({ status }: { status: PreviewCellStatus }) {
  if (status === "unchanged" || status === "included") return null;
  const text = previewCellBadgeText[status];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="sipena-preview-cell-badge">
          {text.label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] text-xs leading-5">
        {text.description}
      </TooltipContent>
    </Tooltip>
  );
}
