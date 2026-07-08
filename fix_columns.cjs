const fs = require('fs');

const hookPath = 'e:/Data/GitHub/SIPENA/tessipena3-f7e2575d/apps/frontend/src/hooks/useAttendanceV2Export.tsx';
let hookContent = fs.readFileSync(hookPath, 'utf8');

if (!hookContent.includes('import type { ExportColumnOption }')) {
  hookContent = hookContent.replace(
    'import { createDefaultReportDocumentStyle, type ReportDocumentStyle } from "@/lib/reportExportLayoutV2";',
    'import { createDefaultReportDocumentStyle, type ReportDocumentStyle } from "@/lib/reportExportLayoutV2";\nimport type { ExportColumnOption } from "@/components/export/UnifiedExportStudio";'
  );
}

const replacement = `  const attendanceColumnOptions = useMemo<ExportColumnOption[]>(() => {
    const selectedSet = new Set(selectedAttendanceColumnKeys);
    
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    const dayChildren: ExportColumnOption[] = days.map((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const isSun = getDay(day) === 0;
      const isNat = isNationalHoliday(day);
      const isCustom = holidays.some((h) => h.date === dateStr);
      let label = format(day, "d");
      if (isSun) label += " (Min)";
      else if (isNat) label += " (Libur Nas)";
      else if (isCustom) label += " (Kustom)";
      
      return {
        key: dateStr,
        label,
        description: isSun || isNat || isCustom
          ? "Kolom hari libur. Nilai biasanya L atau kosong."
          : "Kolom presensi harian siswa.",
        checked: selectedSet.has(dateStr)
      };
    });

    const totalChildren: ExportColumnOption[] = [
      { key: "H", label: "Hadir (H)", description: "Jumlah hadir per siswa.", checked: selectedSet.has("H") },
      { key: "S", label: "Sakit (S)", description: "Jumlah sakit per siswa.", checked: selectedSet.has("S") },
      { key: "I", label: "Izin (I)", description: "Jumlah izin per siswa.", checked: selectedSet.has("I") },
      { key: "A", label: "Alpha (A)", description: "Jumlah alpha per siswa.", checked: selectedSet.has("A") },
      { key: "D", label: "Dispensasi (D)", description: "Jumlah dispensasi per siswa.", checked: selectedSet.has("D") },
      { key: "total", label: "Jumlah Total", description: "Total akumulasi ketidakhadiran/rekap.", checked: selectedSet.has("total") },
    ];

    return [
      {
        key: "days",
        label: "Kolom Hari",
        description: "Pilih tanggal mana saja yang ingin ikut tampil di preview dan file ekspor.",
        checked: dayChildren.length > 0 && dayChildren.every((child) => child.checked),
        groupMeta: {
          detailTitle: "Kolom presensi harian",
          activeSummaryLabel: "hari aktif",
          collapsedHint: "Daftar hari disembunyikan agar panel tetap ringkas. Tekan Detail untuk membuka pengaturan per hari presensi.",
        },
        children: dayChildren,
      },
      {
        key: "totals",
        label: "Rekap Status",
        description: "Atur kolom ringkasan kehadiran di sisi kanan tabel.",
        checked: totalChildren.every((child) => child.checked),
        groupMeta: {
          detailTitle: "Kolom rekap status",
          activeSummaryLabel: "status aktif",
          collapsedHint: "Gunakan Detail untuk memilih kategori rekap yang ditampilkan.",
        },
        children: totalChildren,
      },
      {
        key: "Catatan Siswa",
        label: "Catatan Presensi",
        description: "Tambahkan kolom kosong untuk catatan manual (hanya untuk PDF/Print/PNG).",
        checked: selectedSet.has("Catatan Siswa"),
      },
    ];
  }, [selectedAttendanceColumnKeys, currentMonth, holidays, isNationalHoliday]);`;

const regex = /const attendanceColumnOptions = useMemo\(\(\) => \{[\s\S]*?return options;\n  \}, \[currentMonth, holidays, isNationalHoliday\]\);/;

if (regex.test(hookContent)) {
  fs.writeFileSync(hookPath, hookContent.replace(regex, replacement));
  console.log("Hook updated successfully");
} else {
  console.log("Regex not matched");
}

const controlsPath = 'e:/Data/GitHub/SIPENA/tessipena3-f7e2575d/apps/frontend/src/components/attendance/v2/AttendanceV2Controls.tsx';
let controlsContent = fs.readFileSync(controlsPath, 'utf8');

if (!controlsContent.includes('import type { ExportColumnOption }')) {
  controlsContent = controlsContent.replace(
    'import { cn } from "@/lib/utils";',
    'import { cn } from "@/lib/utils";\nimport type { ExportColumnOption } from "@/components/export/UnifiedExportStudio";'
  );
  controlsContent = controlsContent.replace(
    'attendanceColumnOptions: any[];',
    'attendanceColumnOptions: ExportColumnOption[];'
  );
  fs.writeFileSync(controlsPath, controlsContent);
  console.log("Controls updated successfully");
}
