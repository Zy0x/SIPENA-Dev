# PHASE 06: Attendance V2 Import, Export, OCR, and Reports

Dokumen ini menjelaskan strategi integrasi fitur operasional penting: **Ekspor Laporan (Excel/PDF/Signatures)**, **Impor Massal (Dry-Run & Idempotensi)**, serta **Optical Character Recognition (OCR)** ke dalam modul **Attendance V2** SIPENA dengan mempertahankan keselarasan visual dan kepatuhan kontrak data canonical.

---

## 1. Ekspor Laporan Bulanan (Excel / PDF / Signatures)

Modul **Attendance V2** mengkonsumsi data ekspor secara eksklusif melalui API server-side `/api/attendance/v2/export-dataset` demi menjaga integritas data dan membatasi akses langsung client-side ke Supabase.

### Alur Ekspor V2:
1. Pengguna membuka bilah alat `AttendanceV2Toolbar` dan memilih tombol **Export**.
2. Sistem membuka panel `UnifiedExportStudio` yang memicu kueri dataset canonical V2 bulanan atau tahunan dari backend.
3. Generator layout `handleExportExcel` dan `handleExportPDFVector` menerima berkas canonical tersebut, kemudian memproses formatting:
   - **Tanda Tangan (Signature)**: Menyisipkan blok tanda tangan dinamis dari konfigurasi `signatureConfig` sekolah.
   - **Pilihan Kolom**: Menyembunyikan/menampilkan kolom presensi berdasarkan `selectedAttendanceColumnKeys`.
   - **Gaya Laporan & Ukuran Kertas**: Menggunakan `ReportDocumentStyle` untuk merender PDF dengan orientasi lanskap/potret dan ukuran A4/F4 secara presisi.

---

## 2. Impor Data Berbasis Dry-Run & Idempotensi

Impor berkas Excel/CSV untuk Attendance V2 mewajibkan validasi berlapis guna mencegah tabrakan data dan korupsi presensi di tingkat kelas.

### Protokol Validasi Impor V2:
- **Validasi Klien & Pra-Impor**: Memastikan struktur file cocok, memuat data nama siswa, tanggal, dan kode status presensi yang sahih (`H`, `S`, `I`, `A`, `D`).
- **Dry-Run Mode (Uji Simulasi)**:
  - Sebelum data ditulis ke database, klien mengirimkan berkas payload ke backend dengan flag `dryRun: true`.
  - Backend memverifikasi cakupan siswa (*student scope*), cakupan kelas (*class scope*), dan status penguncian periode (*locked period*).
  - Backend membalas dengan status detail: jumlah baris valid, warning, konflik, atau error kritis tanpa menulis data ke tabel utama.
- **Commit dengan Idempotency Key**:
  - Setelah pengguna meninjau preview simulasi dan menyetujui impor, klien mengirimkan payload final beserta `idempotencyKey` unik (UUID/Timestamp).
  - Backend mencatat key ini; jika terjadi kegagalan jaringan atau pengiriman ulang duplikat, backend mengabaikan payload tanpa membuat duplikasi baris.
- **Rollback Transaksi**: Setiap proses tulis impor massal dibungkus dalam transaksi basis data PostgreSQL tunggal. Jika satu baris data gagal divalidasi, seluruh batch dibatalkan (*rolled back*).

---

## 3. Alur OCR (Optical Character Recognition) V2

Fitur pemindaian foto presensi fisik (OCR) pada V2 dirancang sebagai asisten pengisian, bukan penulis database otomatis langsung.

### Alur Kerja OCR:
1. Guru mengunggah foto presensi kelas via modal dialog `OCRImportDialog`.
2. Mesin OCR memproses gambar dan mengekstrak matriks nama/status.
3. Hasil ekstraksi dikonversi menjadi berkas **Canonical Patch** sementara.
4. **Preview Table Stage**: Hasil pemindaian ditampilkan pada tabel kisi pratinjau agar guru dapat mengoreksi kesalahan pembacaan teks OCR.
5. **Safe Bulk Commit**: Setelah dikonfirmasi oleh guru, mutasi dikirim melalui bulk API `/api/attendance/v2/bulk` dengan kode alasan (*source/reason code*) diatur sebagai `'ocr'`.

---

## 4. Audit Log untuk Operasi Massal

Semua tindakan penulisan massal melalui Impor Excel dan OCR wajib terekam dalam skema tabel audit `attendance_v2_audit_logs`:
- **`source`**: Dicatat sebagai `'import'` atau `'ocr'` sesuai asal penulisan.
- **`reason_code`**: Menyimpan deskripsi singkat (contoh: `IMPORT_BULK_EXCEL_JUNE_2026` atau `OCR_SCAN_IMAGE_2026-06-15`).
- **`before_data` & `after_data`**: Menyimpan snapshot status presensi siswa sebelum dan sesudah perubahan untuk pemantauan keamanan administratif secara penuh.
