# Rencana Unified Export Studio

## Ringkasan
Menyatukan seluruh fitur ekspor di semua halaman (Laporan Nilai, Presensi, Ranking Siswa) ke dalam satu komponen **Export Studio** yang konsisten dengan live preview, pengaturan kolom dinamis, dan tanda tangan terintegrasi.

## Status Saat Ini

### Halaman dengan Fitur Ekspor
| Halaman | Format | Mekanisme | Live Preview |
|---------|--------|-----------|--------------|
| Laporan Nilai (GradeReports) | PDF, Excel, CSV, PNG | Export Studio Dialog + jsPDF-autoTable | ✅ Ya |
| Presensi (Attendance) | PDF, Excel, PNG | Direct export functions | ❌ Tidak |
| Ranking Siswa (StudentRankings) | PDF, Excel | Direct export functions | ❌ Tidak |

### Masalah
1. **Inkonsistensi UX**: Laporan Nilai punya Export Studio lengkap, halaman lain hanya tombol ekspor sederhana
2. **Duplikasi Kode**: Logika ekspor PDF/Excel diulang di berbagai file
3. **Tidak Ada Live Preview**: Presensi dan Ranking tidak punya preview sebelum ekspor
4. **Pengaturan Kolom Terpisah**: Tidak ada cara mudah memilih kolom untuk diekspor di Presensi/Ranking

## Arsitektur Target

### Komponen Utama

```
src/components/export/
├── UnifiedExportStudio.tsx       # Dialog utama — dipakai di semua halaman
├── ExportPreviewRenderer.tsx     # Live preview universal (tabel HTML)
├── ExportColumnSelector.tsx      # Selector kolom dinamis
├── ExportFormatPanel.tsx         # Panel pilihan format (PDF/Excel/CSV/PNG)
├── ExportStylePanel.tsx          # Panel pengaturan font, preset, ukuran kertas
├── SignatureExportPanel.tsx      # Panel tanda tangan (existing)
├── SignaturePreviewCanvas.tsx    # Canvas preview tanda tangan (existing)
├── SignaturePreviewDocument.tsx  # Dokumen preview (existing)
└── exportEngine/
    ├── pdfEngine.ts              # jsPDF + autoTable — PDF asli
    ├── excelEngine.ts            # XLSX export
    ├── csvEngine.ts              # CSV export
    └── pngEngine.ts              # html2canvas PNG export
```

### Interface Universal

```typescript
interface UnifiedExportConfig {
  // Metadata
  title: string;
  subtitle?: string;
  className?: string;
  periodLabel: string;
  dateStr: string;

  // Data
  columns: ExportColumn[];
  headerGroups: HeaderGroup[];
  data: Record<string, string | number>[];

  // Pengaturan
  paperSize: "a4" | "f4" | "auto";
  orientation: "landscape" | "portrait";
  documentStyle: ReportDocumentStyle;
  
  // Tanda tangan
  includeSignature: boolean;
  signature?: SignatureData;
  
  // Format
  availableFormats: ("pdf" | "excel" | "csv" | "png-hd" | "png-4k")[];
}
```

### Alur Penggunaan

```
Pengguna → Klik "Ekspor" → UnifiedExportStudio terbuka
  ├── Tab "Preview"  → Live preview tabel + tanda tangan
  ├── Tab "Kolom"    → Pilih/hapus kolom yang akan diekspor  
  ├── Tab "Gaya"     → Preset ukuran, font, ukuran kertas
  ├── Tab "TTD"      → Editor tanda tangan (opsional)
  └── Tombol "Ekspor" → Pilih format → Download
```

## Tahapan Implementasi

### Fase 1: Refactor Export Engine (1-2 hari)
1. Pindahkan logika PDF dari `exportReports.ts` ke `exportEngine/pdfEngine.ts`
2. Pindahkan logika Excel/CSV ke file terpisah
3. Buat interface `UnifiedExportConfig` yang universal
4. Pastikan ukuran kertas A4 (210×297mm) dan F4 (215.9×330.2mm) presisi

### Fase 2: Komponen UnifiedExportStudio (2-3 hari)
1. Buat `UnifiedExportStudio.tsx` sebagai dialog utama
2. Integrasikan `ExportColumnSelector` untuk semua tipe data
3. Integrasikan `ExportStylePanel` dengan preset
4. Integrasikan `SignatureExportPanel` yang sudah ada
5. Buat `ExportPreviewRenderer` untuk live preview universal

### Fase 3: Integrasi ke Halaman (1-2 hari)
1. **Laporan Nilai**: Migrasi dari `ExportStudioDialog` ke `UnifiedExportStudio`
2. **Presensi**: Ganti tombol ekspor langsung dengan `UnifiedExportStudio`
3. **Ranking Siswa**: Ganti tombol ekspor langsung dengan `UnifiedExportStudio`

### Fase 4: Polish & Testing (1 hari)
1. Responsivitas di semua ukuran layar
2. Konsistensi dark/light mode
3. Performa live preview dengan data besar
4. Validasi presisi ukuran kertas pada hasil ekspor

## Spesifikasi Ukuran Kertas (Presisi)

| Format | Width (mm) | Height (mm) | Toleransi |
|--------|-----------|-------------|-----------|
| A4     | 210.0     | 297.0       | 0 mm      |
| F4     | 215.9     | 330.2       | 0 mm      |
| Auto   | Dinamis   | Dinamis     | Sesuai konten |

## Spesifikasi PDF Asli
- Menggunakan `jsPDF` + `jspdf-autotable` untuk tabel
- Teks dapat di-select dan di-copy
- Font embedded (Helvetica default)
- Ukuran file optimal
- **TIDAK** menggunakan html2canvas untuk konversi gambar ke PDF

## Keamanan
- Tidak mengekspos informasi backend di changelog
- Sanitasi input pada nama siswa/kelas sebelum ekspor
- Tidak menyimpan file ekspor di server
