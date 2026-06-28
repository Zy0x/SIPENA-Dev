# BLUEPRINT DOKUMEN DESAIN: MESIN KALENDER AKADEMIK & ATURAN PRESENSI (ACE) SIPENA

Dokumen cetak biru (*blueprint*) ini memetakan rancangan arsitektur domain presensi komprehensif pada SIPENA untuk bertransisi dari *Holiday-Oriented System* menuju **Academic Calendar Engine (ACE)** dan **Attendance Rule Engine**. Dokumen ini dirancang untuk menjawab 28 kasus operasional riil sekolah di Indonesia (Kategori A s.d. P) agar platform SIPENA siap menangani multi-sekolah, multi-kebijakan, dan integrasi data eksternal secara tangguh.

---

## 1. Tiga Pilar Prioritas Utama Arsitektur (Architect's Priority)

Untuk mengatasi kompleksitas tata kelola sekolah, arsitektur presensi dibangun di atas tiga pilar mesin utama:

```
┌────────────────────────────────────────────────────────┐
│             ACADEMIC CALENDAR ENGINE (ACE)             │
│   (Satu CalendarEvent untuk libur, event, & pengecualian)│
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│             ATTENDANCE RULE ENGINE (ARE)               │
│  (Evaluasi prioritas, scope, target, & working_day)    │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│              AUDIT & HISTORY ENGINE (AHE)              │
│    (Timeline presensi, pencegahan tabrakan & restore)  │
└────────────────────────────────────────────────────────┘
```

---

## 2. Resolusi Kategori A s.d. P: Kasus Riil Sekolah di Indonesia

Seluruh kasus operasional sekolah dikelompokkan dan diselesaikan secara arsitektural:

### A. Kasus Perubahan Struktur Akademik
*   **Kasus 1: Mutasi Murid di Tengah Semester**:
    - **Masalah**: Murid berpindah kelas (misal Kelas 5A ke 5B pada tanggal 15 September).
    - **Solusi**: Dibuat tabel `student_class_history` (mengaitkan `student_id`, `class_id`, `start_date`, dan `end_date`). Evaluasi kehadiran murid pada tanggal tertentu hanya menanyakan kelas murid *pada tanggal tersebut*. Wali kelas lama mengedit data sebelum 15 September, wali kelas baru mengedit data sejak 15 September.
*   **Kasus 2: Naik Kelas Sebelum Tahun Ajaran Selesai (Kelulusan)**:
    - **Solusi**: Murid kelas 6 yang sudah lulus/TO diposisikan dalam status kalender non-efektif melalui pembuatan `CalendarEvent` dengan `scope = GRADE`, `target = 6`, dan `is_working_day = false`, menghentikan penulisan presensi secara aman tanpa merusak rekap bulanan sebelumnya.
*   **Kasus 3 & 4: Penggabungan & Pemecahan Kelas (5A + 5B $\rightarrow$ 5AB / 5A $\rightarrow$ 5A & 5B)**:
    - **Solusi**: Peta kehadiran murid diikat berdasarkan UUID Murid (`student_id`), bukan UUID Kelas. Jika kelas digabung atau dipecah, data presensi historis pada tanggal lama tetap merujuk pada `class_id` lama murid, sementara penulisan presensi baru merujuk pada `class_id` baru yang terdaftar di `student_class_history`.

### B. Kasus Kalender & Force Majeure
*   **Kasus 5: Perubahan Kalender Pasca Presensi Terisi**:
    - **Solusi**: Pemicuan **Mekanisme Rekonsiliasi Mundur**. Jika suatu hari diubah menjadi Libur Sekolah padahal sudah ada data presensi yang terisi:
      - Sistem mendeteksi inkonsistensi (*mismatch*).
      - Guru diberikan dialog konfirmasi: (1) Otomatis hapus data presensi lama, atau (2) Tetap simpan sebagai pengecualian khusus kelas.
*   **Kasus 6: Libur Mendadak (Banjir, Gempa, Kabut Asap, Pemilu TPS)**:
    - **Solusi**: Pembuatan event tipe `SCHOOL_CLOSURE` dengan prioritas tinggi (`95`) dan `is_working_day = false`. Mengunci sel kehadiran secara global di pagi hari kejadian.
*   **Kasus 7: Hari Belajar Pengganti (Sabtu Mengganti Senin)**:
    - **Solusi**: Pembuatan `CalendarEvent` bertipe `FORCED_EFFECTIVE` dengan `is_working_day = true` khusus pada hari Sabtu tersebut. Rule engine akan melompati aturan weekend normal dan membuka grid presensi.

### C. Kasus Presensi Kompleks
*   **Kasus 8: Presensi Setengah Hari (Sakit/Pulang di Tengah Jam)**:
    - **Solusi**: Perhitungan diserahkan ke konfigurasi sekolah. Sistem mendukung status transisi (misal: murid masuk, lalu pulang sakit, status dicatat sebagai Sakit `'S'` namun dengan catatan waktu kepulangan di kolom metadata).
*   **Kasus 9 & 10: Terlambat & Pulang Cepat**:
    - **Solusi**: Penambahan atribut `minutes_late` (menit terlambat) dan `early_departure_time` pada tabel `attendance_records` untuk mendukung data kepulangan/keterlambatan secara presisi demi evaluasi kedisiplinan murid.
*   **Kasus 11: Tidak Ikut Kegiatan Tertentu (Upacara Bolos, Belajar Ikut)**:
    - **Solusi**: Penanganan presensi multi-sesi di mana status kehadiran dipecah per sesi kegiatan (Sesi 1: Upacara, Sesi 2: Belajar Kelas).

### D. Penanganan Konflik Guru & Concurrency
*   **Kasus 12: Guru Pengganti / Wali Kelas Pengganti**:
    - **Solusi**: Tabel `attendance_records` mencatat audit `created_by` dan `updated_by`. Jika Guru B mengisi presensi menggantikan Guru A yang sakit, log audit mencatat UUID Guru B secara transparan.
*   **Kasus 13: Dua Guru Mengedit Bersamaan (Concurrency Control)**:
    - **Solusi**: Penerapan **Optimistic Locking** di backend. Setiap baris record presensi memiliki kolom `version` (integer) atau `updated_at`. Jika Guru A dan Operator mengirim pembaruan pada waktu bersamaan, pengirim kedua akan ditolak jika versinya tidak cocok, memaksa reload data terbaru untuk mencegah kehilangan data (*lost update protection*).

### E. Penyesuaian Semester
*   **Kasus 14 & 15: Semester Diperpanjang / Dipersingkat**:
    - **Solusi**: Semester tidak menyimpan data tanggal statis di tabel presensi, melainkan membaca data relasi tanggal dinamis dari `Academic Calendar`. Perubahan tanggal akhir semester otomatis memperbarui batas penarikan laporan rapor murid secara real-time.

### F. Rekapitulasi & Formula Bobot Pelanggaran
*   **Kasus 16: Rumus Kehadiran Berbeda Antar-Sekolah**:
    - **Solusi**: Status presensi tidak lagi di-hardcode (`H`, `I`, `S`, `A`, `D`). Sekolah memiliki kebebasan membuat status kustom (misal: status `'TL'` untuk Tugas Luar, `'BD'` untuk Belajar Daring). Setiap status memiliki kolom konfigurasi `is_present` (dihitung hadir), `requires_note` (wajib isi catatan), dan `weight` (bobot persentase).
*   **Kasus 17: Alpha Berbobot (Poin Pelanggaran)**:
    - **Solusi**: Konfigurasi bobot status presensi (misal: Alpha `'A'` = bobot `2` poin sanksi). Sistem menghitung akumulasi poin pelanggaran kehadiran murid secara otomatis untuk dashboard guru piket.

### G. Hak Akses (Multi-Role Permissions)
*   **Kasus 18, 19, & 20: Guru vs Operator vs Kepala Sekolah vs Wali Kelas**:
    - **Solusi**: Penerapan otorisasi RLS Supabase & Backend API:
      - **Operator**: Memiliki akses tulis (`Write`) penuh untuk semua kelas.
      - **Wali Kelas**: Memiliki akses tulis khusus untuk murid-murid di kelas bimbingannya.
      - **Guru Mapel**: Memiliki akses tulis presensi khusus untuk kelas/jam mengajar pelajaran mereka.
      - **Kepala Sekolah**: Akses baca (`Read-Only`) dan tombol persetujuan kunci bulanan (*Approve Lock*).

### H. Integrasi Dapodik & Sinkronisasi Data
*   **Kasus 21: Murid Dihapus di Dapodik**:
    - **Solusi**: Penerapan **Soft Delete / Archiving** pada tabel `students`. Jika murid dihapus dari Dapodik, murid ditandai sebagai `deleted_at`, tetapi data presensi historis murid tersebut pada bulan-bulan sebelumnya tetap dipertahankan di database untuk laporan keuangan/rekap sekolah.
*   **Kasus 22: Perubahan Nama Murid**:
    - **Solusi**: Data presensi merujuk pada UUID murid (`student_id`), bukan nama. Nama di-resolve dinamis dari tabel profil murid saat dirender.

### I. Audit Trail & Kemampuan Undo
*   **Kasus 23: Audit Trail Log**:
    - **Solusi**: Pencatatan riwayat perubahan presensi murid di tabel audit secara granular: siapa, kapan, nilai sebelum, nilai sesudah, dan alasan perubahan.
*   **Kasus 24: Restore / Undo**:
    - **Solusi**: Tombol "Kembalikan" (*Restore*) pada panel audit untuk membatalkan perubahan presensi ke kondisi versi sebelumnya berdasarkan snapshot log audit.

### J. Bentrokan Kalender & Sub-Hari
*   **Kasus 25: Dua Event dalam Satu Hari**:
    - **Solusi**: Evaluasi bertingkat memilih event dengan prioritas (`priority`) tertinggi.
*   **Kasus 26: Event Jam Tertentu (Sesi Pagi/Siang)**:
    - **Solusi**: Pembedaan jam mulai (*start_time*) dan jam selesai (*end_time*) pada event untuk membatasi ruang lingkup pengecualian hari belajar efektif.

### K. Penguncian Data Historis
*   **Kasus 27 & 28: Kunci Tahun Ajaran Lama & Koreksi Operator**:
    - **Solusi**: Tahun ajaran yang telah berakhir otomatis dikunci menjadi *read-only* bagi semua guru. Hanya Operator/Admin dengan izin khusus yang dapat membuka gembok pelindung tahun lampau untuk koreksi data darurat.

### L. Multi-Sekolah (Multi-Tenancy)
*   **Kasus**: Yayasan memiliki SD, SMP, SMA dengan kalender berbeda.
*   **Solusi**: Penggunaan arsitektur **Multi-Tenancy** berbasis `school_id`. Kalender akademik, pola hari kerja, dan hari libur dievaluasi secara terisolasi per `school_id`.

### M. Zona Waktu (Timezone)
*   **Solusi**: Semua stempel waktu disimpan dalam format `TIMESTAMP WITH TIME ZONE (UTC)` di PostgreSQL. Frontend mengonversi dan menampilkan tanggal/jam sesuai dengan zona waktu lokal sekolah tujuan.

### N. Resolusi Konflik Sinkronisasi Offline-Online
*   **Kasus**: Guru A offline mengisi presensi murid B, Guru B online mengisi presensi murid B, lalu Guru A sinkronisasi online.
*   **Solusi**: Resolusi konflik berbasis stempel waktu perubahan terakhir (*Last-Write-Wins* berdasarkan `updated_at` lokal klien) atau menampilkan dialog pilihan data mana yang ingin dipertahankan jika waktu perubahan sangat berdekatan.

### O. Backup & Restore Mandiri
*   **Solusi**: Modul ekspor menghasilkan file cadangan data presensi bulanan/tahunan terenkripsi. Jika operator melakukan penghapusan tidak sengaja, file cadangan dapat diunggah kembali ke sistem untuk pemulihan parsial.

---

## 3. Desain Konfigurasi Status Presensi Dinamis Per Sekolah

Untuk menghilangkan keterbatasan hardcode status `H`, `I`, `S`, `A`, `D`, sistem beralih menggunakan tabel konfigurasi `attendance_status_settings`:

```json
{
  "school_id": "school-uuid-123",
  "status_code": "TL",
  "status_name": "Tugas Luar",
  "is_present": true,
  "weight": 1.0,
  "requires_note": true,
  "color": "#3b82f6",
  "is_active": true
}
```

Setiap kueri generator presensi akan memuat status-status aktif yang diizinkan untuk sekolah tersebut secara dinamis, sehingga SIPENA dapat digunakan oleh ribuan sekolah dengan kebijakan yang berbeda tanpa perlu melakukan refactoring kode program.
