# PHASE 03: Backend API Implementation - Attendance V2

Dokumen ini menjelaskan implementasi backend API produksi untuk **Attendance V2** SIPENA. Semua alur penulisan (write/mutasi) kini diwajibkan melewati backend API yang aman, memutus jalur penulisan langsung (direct write) dari klien frontend ke database Supabase.

---

## 1. Daftar Endpoint API V2 Yang Diimplementasikan

Backend API melayani endpoint berikut melalui Router Controller (`attendanceController`):

### Konfigurasi Runtime
- **`GET /api/attendance/runtime`**
  - Mengambil konfigurasi engine yang aktif (`v1` atau `v2`) dan status penulisan (`writesEnabled`).
- **`POST /api/attendance/runtime`**
  - Mengubah konfigurasi runtime secara dinamis (Hanya diperbolehkan untuk Admin Backend).

### Dataset & Mutasi Presensi
- **`GET /api/attendance/v2`**
  - Mengambil dataset presensi V2 lengkap untuk kelas dan bulan tertentu (Siswa, Records, Kalender, Libur, Locks, Recap Bulanan/Harian).
- **`POST /api/attendance/v2/record`**
  - Melakukan insert/update/delete presensi satu murid pada tanggal tertentu menggunakan stored procedure PostgreSQL `upsert_attendance_record`.
- **`POST /api/attendance/v2/bulk`**
  - Melakukan update presensi massal (bulk patches) secara berurutan dan terproteksi transaksi atomik.
- **`PATCH /api/attendance/v2/note`**
  - Memperbarui catatan (note) presensi murid untuk tanggal tertentu.

### Kalender & Hari Libur
- **`POST /api/attendance/v2/holiday`**
  - Menambahkan libur kustom untuk tanggal tertentu.
- **`DELETE /api/attendance/v2/holiday`**
  - Menghapus libur kustom dari kalender.

### Event Kalender Hari
- **`POST /api/attendance/v2/day-event`**
  - Menyimpan/memperbarui (upsert) nama kegiatan sekolah khusus pada tanggal kalender.
- **`DELETE /api/attendance/v2/day-event`**
  - Menghapus kegiatan kalender.

### Kunci Periode (Locks)
- **`POST /api/attendance/v2/lock`**
  - Mengunci atau membuka periode presensi kelas bulanan (`classId` + `month`).

### Ringkasan & Ekspor (Summaries)
- **`GET /api/attendance/v2/summary/daily`**
  - Mengambil rekap presensi harian kelas.
- **`GET /api/attendance/v2/summary/monthly`**
  - Mengambil rekap presensi bulanan siswa kelas.
- **`GET /api/attendance/v2/summary/yearly`**
  - Mengambil rekap presensi tahunan (Draft).
- **`GET /api/attendance/v2/export-dataset`**
  - Mengambil dataset canonical khusus untuk di-export ke Excel/PDF.

### Audit & Shadow
- **`GET /api/attendance/v2/audit`**
  - Mengambil riwayat lengkap log perubahan data (audit logs) untuk kelas tertentu.
- **`GET /api/attendance/v2/shadow/report`**
  - Mengambil log deviasi/perbedaan hasil (shadow mismatches) antara V1 dan V2.

---

## 2. Alur Validasi & Keamanan (Security)

1. **Autentikasi User**:
   - Token JWT Bearer diverifikasi ketat menggunakan auth adapter Supabase.
   - Panggilan ke database menggunakan user client khusus (`createSupabaseUserClient`) untuk menjaga konsistensi Row Level Security (RLS).
2. **Validasi Tanggal & Status**:
   - Memvalidasi format ISO tanggal (`YYYY-MM-DD`) dan kode status presensi (`H/I/S/A/D/L/-`).
3. **Pemeriksaan Kunci Periode (Lock Period Guard)**:
   - Menolak semua tulisan baru ke tanggal yang berada di dalam periode terkunci.
4. **Respon Error Terstruktur**:
   - Semua kesalahan diubah menjadi kode error yang ramah (misal: `ATTENDANCE_LOCKED_PERIOD`) dan tidak membocorkan mentah-mentah detail error database PostgreSQL kepada pengguna frontend.

---

## 3. Cakupan Pengujian (Test Coverage)

Unit dan Integration test telah diimplementasikan di `apps/frontend/src/features/attendance/testing/attendanceBackendV2.test.ts` untuk memverifikasi fungsionalitas backend:

- **Validation Unit Tests**: Menguji kebenaran parser DTO body request untuk single write, bulk write, holiday, day event, dan lock.
- **Service Unit Tests**: Memverifikasi delegasi adapter V2 yang tepat ketika engine V2 aktif, serta proteksi penulisan jika status `writesEnabled` bernilai `false`.
- **Controller Route Tests**: Memastikan penolakan akses `401 Unauthorized` berjalan sukses jika otentikasi Bearer JWT absen dari header permintaan HTTP.
