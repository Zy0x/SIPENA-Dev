# Rencana Import Data Batch Komprehensif

## Ringkasan
Fitur import batch memungkinkan guru mengimpor **seluruh ekosistem data akademik** dalam satu file Excel multi-sheet. File ini mencakup kelas, siswa, mata pelajaran, struktur BAB/tugas, nilai, dan presensi.

## Struktur File Excel

### Sheet 1: Panduan
| Baris | Konten |
|-------|--------|
| 1 | PANDUAN PENGISIAN DATA SIPENA |
| 2 | File ini digunakan untuk import data batch ke SIPENA |
| 3-5 | Instruksi umum pengisian |
| 6+ | Penjelasan setiap sheet |

### Sheet 2: Kelas
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| Nama Kelas | Teks (wajib) | Contoh: "Kelas 7A" |
| Deskripsi | Teks (opsional) | Keterangan kelas |
| Wali Kelas | Teks (opsional) | Nama wali kelas |

### Sheet 3: Siswa
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| Nama Kelas | Teks (wajib) | Harus sesuai dengan Sheet Kelas |
| No Absen | Angka (wajib) | Nomor urut di kelas |
| Nama Siswa | Teks (wajib) | Nama lengkap siswa |
| NISN | Teks (opsional) | Nomor Induk Siswa Nasional |

### Sheet 4: Mata Pelajaran
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| Nama Kelas | Teks (wajib) | Kelas yang diampu |
| Nama Mapel | Teks (wajib) | Nama mata pelajaran |
| KKM | Angka (wajib) | Kriteria Ketuntasan Minimal (0-100) |

### Sheet 5: Struktur BAB & Tugas
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| Nama Mapel | Teks (wajib) | Sesuai Sheet Mata Pelajaran |
| Nama Kelas | Teks (wajib) | Sesuai Sheet Kelas |
| Nama BAB | Teks (wajib) | Contoh: "BAB 1" |
| Nama Tugas | Teks (wajib) | Contoh: "Tugas 1" |

### Sheet 6: Nilai
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| Nama Kelas | Teks | Referensi kelas |
| Nama Siswa | Teks (wajib) | Sesuai Sheet Siswa |
| Nama Mapel | Teks (wajib) | Sesuai Sheet Mata Pelajaran |
| Nama Tugas | Teks (wajib) | Sesuai Sheet Struktur |
| Nilai | Angka (wajib) | 0-100 |

### Sheet 7: Presensi
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| Nama Kelas | Teks | Referensi kelas |
| Nama Siswa | Teks (wajib) | Sesuai Sheet Siswa |
| Tanggal | Tanggal (wajib) | Format YYYY-MM-DD |
| Status | Teks (wajib) | H/I/S/A/D |

## Alur Import

```
1. Upload File Excel
       ↓
2. Validasi Struktur Sheet
       ↓
3. Parse & Cross-Reference Data
       ↓
4. Preview Lengkap (per sheet)
       ↓
5. Validasi Otomatis
   - Duplikasi data
   - Format salah
   - Referensi tidak ditemukan
       ↓
6. Konfirmasi Import
       ↓
7. Batch Insert (dengan progress bar)
       ↓
8. Laporan Hasil Import
```

## Posisi UI: Settings → Tab "Import Batch"
- Tidak membingungkan pengguna
- Terpisah dari operasi sehari-hari
- Cocok untuk setup awal atau migrasi data
- Juga bisa diakses via shortcut link di Dashboard

## Validasi & Error Handling

| Validasi | Aksi |
|----------|------|
| Sheet tidak ditemukan | Warning, skip sheet |
| Kolom wajib kosong | Error per baris, highlight merah |
| Nama kelas tidak cocok | Warning, coba fuzzy match |
| Nilai di luar range | Auto-clamp 0-100, warning |
| NISN duplikat | Skip baris, catat di laporan |
| Tanggal invalid | Error per baris |
| Format file salah | Tolak file, pesan error |

## Keamanan
- Validasi ukuran file (max 10MB)
- Sanitasi semua input teks
- Rate limiting (1 import per 5 menit)
- Audit log untuk setiap operasi import
- Rollback support jika import gagal sebagian
