# Attendance Export Header Redesign — Plan

> Status: Draft (v1) · Scope: `AttendancePrintDocument` banner + meta bar + PDF mirror in `attendancePdfExport.ts`

## 1. Permasalahan Saat Ini

- Banner header padat: 2 baris di kiri (SIPENA | Dokumen Presensi · REKAP PRESENSI BULANAN), 2 baris di kanan (Kelas + bulan).
- Meta-bar di bawah banner mencampur 4 informasi sekaligus (siswa, hari efektif, halaman, format hari, waktu ekspor) dalam grid 2 kolom yang terasa berdesakan di kertas Landscape kecil.
- Waktu ekspor (`exportTimeLabel`) berada di pojok kanan bawah meta-bar — secara visual menyaingi label *Halaman* dan tidak terlihat sebagai metadata sekunder.
- Tidak ada hierarki visual yang membedakan **identitas dokumen** (SIPENA), **judul utama** (Rekap Presensi Bulanan), **konteks akademik** (kelas + bulan), dan **metadata teknis** (jumlah siswa, format hari, halaman, waktu ekspor).
- Live preview & hasil PDF masih sedikit berbeda karena banner di renderer pakai `borderRadius: 10` sementara PDF pakai `roundedRect(2,2)`.

## 2. Tujuan Redesign

1. Hierarki tunggal: identitas → judul → konteks → metadata.
2. Mengurangi tinggi banner agar tabel mendapat lebih banyak ruang vertikal (target ≤ 14 mm dari saat ini 16 mm).
3. Memindahkan **waktu ekspor** ke footer sebagai metadata teknis.
4. Konsistensi penuh antara live preview dan output PDF (sudut rounded, padding, ukuran font).

## 3. Opsi Layout

### Opsi A — Banner Tunggal Terpadu (Direkomendasikan)
```
┌─────────────────────────────────────────────────────────────┐
│ ▌ SIPENA                            Kelas VA · April 2026   │
│   REKAP PRESENSI BULANAN                                    │
│   29 siswa · 25 hari efektif · 6 hari (Senin-Sabtu)          │
└─────────────────────────────────────────────────────────────┘
```
- Hilangkan meta-bar terpisah. Semua metadata akademik masuk ke baris ke-3 banner.
- Garis vertikal tipis di kiri sebagai aksen brand.
- Halaman & waktu ekspor pindah ke footer.

### Opsi B — Banner Minimal + Strip Metadata
```
┌─────────────────────────────────────────────────────────────┐
│  REKAP PRESENSI BULANAN                       Kelas VA      │
│  SIPENA · Dokumen Presensi                    April 2026    │
└─────────────────────────────────────────────────────────────┘
  29 siswa  |  25 hari efektif  |  6 Hari (Senin-Sabtu)        Halaman 1/2
```
- Banner padat tinggi ~10 mm.
- Strip metadata transparan tanpa border, langsung di atas tabel.
- Waktu ekspor pindah ke footer.

### Opsi C — Banner Dua Kolom Asimetris
```
┌──────────────┬──────────────────────────────────────────────┐
│  ▌ SIPENA   │  REKAP PRESENSI BULANAN                       │
│  Dokumen    │  Kelas VA  ·  April 2026                      │
│  Presensi   │  29 siswa  ·  25 hari efektif                 │
└──────────────┴──────────────────────────────────────────────┘
```
- Brand block kiri (lebar tetap ~50 mm) memisahkan identitas dari konteks.
- Cocok kalau di masa depan ingin menambah logo sekolah.

## 4. Footer Baru

```
SIPENA · Sistem Penilaian      Halaman 1/2      Diekspor 21 Apr 2026 19:37
```
- Dipisah border-top tipis seperti sekarang.
- 3 kolom: identitas · halaman · waktu ekspor.
- Font lebih kecil dari meta utama.

## 5. Sinkronisasi Preview ↔ PDF

| Properti                 | Preview saat ini | PDF saat ini       | Target (sinkron) |
|--------------------------|------------------|--------------------|------------------|
| Banner border radius     | 10 px            | `roundedRect(2,2)` | `mm(2)` di preview = ~7.5 px → samakan |
| Banner padding vertikal  | mm(1.8)+mm(1.4)  | hard-coded teks    | derive dari `SHELL_MM.topBanner` |
| Font judul               | `titleFontPt*PT` | `titleFontPt-0.2`  | gunakan nilai sama persis |
| Meta-bar                 | grid 2 kolom     | 2 baris teks       | hilangkan total (Opsi A/B) |

## 6. Rekomendasi Final

**Opsi A** karena:
- Mengurangi 1 elemen layout (meta-bar) → menghemat ~7 mm vertikal.
- Hierarki paling jelas (identitas → judul → konteks → metadata akademik di satu tempat).
- Waktu ekspor di footer sesuai konvensi dokumen formal.
- Mudah di-mirror persis di PDF: 1 `roundedRect` + 3 baris `doc.text`.

## 7. Tahap Implementasi (saat disetujui)

1. Update `SHELL_HEIGHT_MM.topBanner` jadi 14, hapus `metaBar` dari planner.
2. Refactor banner di `AttendancePrintDocument.tsx` jadi 3 baris.
3. Refactor `drawPageHeader` di `attendancePdfExport.ts` mirror struktur banner.
4. Pindahkan `exportTimeLabel` ke `drawFooter` (PDF) dan footer JSX (preview).
5. Update planner `summaryHeightMm` & `availableBodyHeightMm` (gain ~7 mm).
6. Verifikasi visual A4/F4/Auto + dataset normal/ekstrem.
