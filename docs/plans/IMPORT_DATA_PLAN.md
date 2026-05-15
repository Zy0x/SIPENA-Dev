# Rencana Import Data SIPENA

Lihat `docs/plans/BATCH_IMPORT_PLAN.md` untuk rencana batch import multi-sheet.

## Fitur Import Tersedia
1. **Import Excel** — Per halaman (Kelas, Nilai, Presensi)
2. **Import OCR (Beta)** — Dari foto dokumen
3. **Import Batch** — Multi-sheet satu file untuk seluruh ekosistem

## Teknologi
- Library: XLSX (SheetJS)
- OCR: Manual text extraction + AI vision (planned)
- Validasi: Cross-reference antar sheet, fuzzy matching nama
