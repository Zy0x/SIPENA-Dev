# PHASE 08: Production Hardening for Attendance V2

Dokumen ini merangkum langkah-langkah pengerasan produksi (**Production Hardening Checklist**) untuk memastikan modul **Attendance V2** SIPENA aman, andal, berkinerja tinggi, teruji penuh, terdokumentasi, dan memiliki jalur rilis serta pemulihan (*rollback*) yang matang sebelum dijadikan sebagai pilihan bawaan (*production default*).

---

## 1. Pengerasan Keamanan (Security Hardening)

- **Otentikasi & Otorisasi Wajib**: Seluruh endpoint REST API di bawah `/api/attendance/v2/*` memverifikasi token JWT Bearer dari Supabase Auth pada tingkat backend. Penulisan tanpa session yang valid ditolak dengan status HTTP `401 Unauthorized`.
- **Keamanan RLS (Row Level Security)**:
  - Kebijakan RLS pada tabel V2 (`attendance_v2_*`) membatasi kueri baca/tulis hanya untuk baris data yang memiliki kecocokan `user_id = auth.uid()`.
  - Operasi administratif sensitif dilindungi dengan validasi peran pengguna (*user role checker*) di backend.
- **Audit Log Terproteksi**: Tabel `attendance_v2_audit_logs` hanya mengizinkan penulisan kueri *Insert* dari akun sistem backend/RPC dan menolak pembaruan (*Update*) atau penghapusan (*Delete*) dari pengguna biasa maupun admin melalui kebijakan RLS `NO UPDATE / NO DELETE` PostgreSQL.
- **Zero Hardcoded Secrets**: Semua kredensial database, port, dan kunci API dimuat secara dinamis via variabel lingkungan (*Environment Variables*) di backend dan hanya diakses melalui `Deno.env.get()` atau mekanisme dotenv yang aman.
- **Zero Direct Frontend Database Write**: Seluruh mutasi presensi dari antarmuka V2 wajib menggunakan API Gateway `/api/attendance/v2/record` dan `/api/attendance/v2/bulk`, mencegah penulisan langsung Supabase JS Client client-side.

---

## 2. Keandalan Sistem & Penanganan Kesalahan (Reliability)

- **Idempotensi Tindakan Massal**: Kueri `POST /api/attendance/v2/bulk` memvalidasi `idempotencyKey` yang dikirimkan oleh klien. Jika mendeteksi key yang sama dalam rentang waktu tertentu, backend mengabaikan request kedua dan mengembalikan respons transaksi pertama untuk mencegah duplikasi data akibat masalah jaringan.
- **Kepatuhan Transaksi PostgreSQL**: Operasi batch (seperti impor presensi atau pemindaian OCR massal) dieksekusi di dalam blok transaksi basis data (`BEGIN ... COMMIT`). Kegagalan validasi pada satu baris data memicu **Rollback Otomatis** penuh, mencegah penyimpanan data parsial (*no partial writes*).
- **Struktur Kesalahan Terstandar**: Respons error V2 menggunakan kode kesalahan terstruktur (seperti `ATTENDANCE_LOCKED_PERIOD`, `ATTENDANCE_INVALID_STATUS`) lengkap dengan deskripsi dan pelacakan kolom asal (*field-level validation issues*) untuk memudahkan penanganan error di sisi frontend.

---

## 3. Optimalisasi Kinerja (Performance Optimization)

- **Database Indexing**:
  - Indeks komposit unik disematkan pada `attendance_v2_records(class_id, student_id, date)` untuk mempercepat pemuatan grid presensi kelas bulanan dan menjamin integritas keunikan record.
  - Indeks pada `attendance_v2_records(user_id)` dan `attendance_v2_audit_logs(class_id)` mempercepat kueri pelaporan audit kelas.
- **N+1 Query Prevention**: Kueri kalkulasi rekap presensi bulanan dan tahunan diselesaikan di tingkat backend dalam satu pemanggilan kueri agregasi SQL efisien, menghindari kueri berulang per siswa di tingkat aplikasi (*N+1 database calls*).
- **Frontend Cache**: React-Query dikonfigurasi untuk menyimpan dataset kelas sementara dan secara pintar melakukan invalidasi otomatis hanya ketika mutasi data presensi terkonfirmasi berhasil oleh backend.

---

## 4. Matriks Pengujian & Kepatuhan Rilis (Testing Matrix)

- **Unit Tests**: Menguji logika mesin kalender 5/6 hari, prioritas konflik kegiatan vs hari libur, bobot status dispensasi, dan penolakan note kosong.
- **Integration Tests**: Memverifikasi interaksi API backend V2 dari pemanggilan token otorisasi hingga penyimpanan tabel relasional.
- **Regression Tests**: Menguji keselarasan hasil pemetaan dataset canonical V1 vs V2 untuk menjamin data presensi lama tetap terbaca dengan tepat tanpa modifikasi destruktif.
- **Migration & Rollback Tests**: Memverifikasi keandalan simulasi *dry-run* migrasi data V1 ke V2 per kelas/bulan dan pemulihan data presensi jika terjadi kegagalan.

---

## 5. Rencana Rilis Produksi & Pemulihan (Release & Rollback Plan)

### Siklus Peluncuran Bertahap:
1. **Fase Staging (1 Minggu)**: Deploy ke lingkungan staging internal sekolah untuk uji coba oleh tim QA dan administrator.
2. **Fase Shadow (2 Minggu)**: Aktifkan penulisan bayangan asinkron. Guru menggunakan halaman presensi V1, tetapi data disinkronkan ke V2 secara paralel di belakang layar untuk memantau deviasi laporan presensi.
3. **Fase Rilis Terbatas (1 Minggu)**: Aktifkan antarmuka V2 secara default hanya untuk kelompok percontohan pengguna (5-10 guru kelas).
4. **Fase Rilis Penuh**: Pengaktifan global V2 sebagai bawaan untuk seluruh pengguna SIPENA.

### Kriteria Pemulihan (Rollback Gate):
- Jika ditemukan deviasi laporan presensi murid > 0% antara data V1 dan V2 yang tidak dapat dijelaskan.
- Jika terjadi peningkatan error rate penulisan presensi > 1% pada backend API.
- Rollback dilakukan instan dengan mengubah konfigurasi Feature Flag `ATTENDANCE_V2_DEFAULT_ENABLED = false` di backend database.
