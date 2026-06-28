# PHASE 07: Shadow Mode, Data Migration, and Safe Cutover

Dokumen ini merangkum strategi migrasi data, pengoperasian **Mode Shadow (Uji Bayangan)**, konfigurasi Feature Flag, serta rencana pemulihan (*rollback plan*) dari modul **Attendance V1** ke **Attendance V2** secara aman dan non-destruktif di tingkat produksi.

---

## 1. Skrip Migrasi Data Aman (V1 ke V2)

Migrasi data historis dilakukan menggunakan skrip migrasi idempotent untuk menyalin catatan dari tabel lama V1 ke skema baru V2 tanpa memodifikasi atau menghapus data V1 asal:

### Pemetaan Tabel Migrasi:
- `attendance_records` $\rightarrow$ `attendance_v2_records`
- `attendance_holidays` $\rightarrow$ `attendance_v2_holidays`
- `attendance_day_events` $\rightarrow$ `attendance_v2_day_events`
- `attendance_locks` $\rightarrow$ `attendance_v2_locks`

### Kemampuan Skrip Migrasi:
- **Dry-Run Mode**: Menghitung jumlah record yang akan dimigrasikan, mendeteksi potensi duplikat, dan melaporkan kejanggalan (*mismatch*) sebelum penulisan nyata dilakukan ke tabel V2.
- **Idempotensi & Deteksi Duplikat**: Menggunakan klausa `ON CONFLICT (student_id, date) DO UPDATE` atau sejenis untuk mencegah duplikasi jika skrip dijalankan ulang.
- **Granularitas**: Mendukung migrasi bertahap per kelas (`classId`), per pengguna (`userId`), per bulan (`yyyy-MM`), atau migrasi penuh (*full migration*).
- **Rollback Path**: Laporan migrasi mencakup pencatatan baris mana saja yang disisipkan sehingga administrator dapat membatalkan salinan data V2 jika diperlukan.

---

## 2. Mode Shadow (Shadow Comparison Engine)

Mode Shadow memungkinkan verifikasi fungsionalitas backend V2 di lingkungan produksi tanpa memengaruhi pengalaman pengguna akhir:

- **Dual-Write Interception**: Saat guru mengirimkan presensi pada V1, adapter V1 mendeteksi jika mode shadow aktif. Mutasi ditulis ke tabel V1 (sumber utama terlihat oleh user) dan secara asinkron (atau shadow intercept) dikirimkan ke endpoint V2 untuk ditulis ke tabel V2.
- **Mismatch Report**: Engine pembanding membandingkan rekap dan catatan antara V1 dan V2 untuk mendeteksi deviasi perhitungan:
  - Selisih status presensi.
  - Selisih persentase rekapitulasi.
  - Perbedaan catatan alasan (*note mismatch*).
- **Graceful Failure**: Jika penulisan bayangan ke V2 gagal atau terjadi inkonsistensi data, transaksi V1 tetap diselesaikan sukses. Pengguna tidak akan diblokir atau menerima pesan kesalahan teknis shadow mode.
- **Admin/Debug Report**: Deviasi shadow dicatat dan dapat diakses oleh administrator di menu `/api/attendance/v2/shadow/report` untuk audit sebelum migrasi penuh.

---

## 3. Rencana Cutover Bertahap & Feature Flags

Pengaktifan V2 dikendalikan secara dinamis melalui tiga parameter Feature Flag utama pada backend:

1. **`ATTENDANCE_V2_SHADOW_ENABLED`**: Mengaktifkan penulisan bayangan asinkron dan pelaporan deviasi V1-V2.
2. **`ATTENDANCE_V2_READ_ONLY`**: Pengguna mulai melihat data V2 (sumber utama berpindah ke V2) tetapi penulisan baru belum diizinkan jika sedang pemeliharaan.
3. **`ATTENDANCE_V2_WRITE_ENABLED`**: Penulisan penuh ke database V2 diizinkan melalui REST API V2.
4. **`ATTENDANCE_V2_DEFAULT_ENABLED`**: V2 menjadi mesin presensi default secara global untuk seluruh pengguna sekolah.

### Fase Rilis Bertahap (Safe Release Cycle):
- **Fase A**: Aktifkan **Shadow Mode** untuk 100% kelas selama 2 minggu guna memverifikasi kestabilan data.
- **Fase B**: Aktifkan **V2 Klien** secara bertahap untuk kelompok kelas percontohan (Uji Coba Terbatas).
- **Fase C**: Aktifkan **V2 Klien** secara global dengan menyalakan `ATTENDANCE_V2_DEFAULT_ENABLED`.

---

## 4. Protokol Rollback Darurat (Rollback Gate)

Jika terjadi kegagalan atau kerusakan integritas data V2 saat masa cutover, pemulihan dilakukan secara instan:
- **Instant Switch Back**: Mematikan flag `ATTENDANCE_V2_DEFAULT_ENABLED` di database pengaturan runtime. Rute frontend secara otomatis mengembalikan tampilan guru ke halaman Attendance V1 legacy.
- **Data Parity Check**: Data yang ditulis selama masa cutover V2 disinkronkan kembali ke tabel V1 menggunakan skrip rekonsiliasi mundur untuk memastikan tidak ada data presensi harian guru yang hilang selama masa peralihan kembali ke V1.
