# DEEP AUDIT, ARCHITECTURE REVIEW & ROADMAP: Modul Presensi (Attendance) SIPENA

Dokumen ini menyajikan pembedahan mendalam terhadap **Modul Presensi** SIPENA. Dokumen ini meninjau keunggulan arsitektur, mengidentifikasi kelemahan logika (terutama mengenai tata kelola hari libur kustom dan kompleksitas komponen), serta memetakan rencana pengembangan (*roadmap*) fitur-fitur masa depan agar modul ini siap menjadi standar emas sistem presensi akademik.

---

## 1. Analisis Arsitektur & Alur Data Saat Ini

Arsitektur presensi SIPENA dirancang secara berlapis dengan pemisahan tanggung jawab (*separation of concerns*) yang baik:

```
UI (Pages/Components) 
    ↓
Hooks (useAttendance / useAttendanceV2Dataset)
    ↓
API & Service Layer (attendanceV2Api / Supabase client)
    ↓
Business Engines (Calendar, Rule, Status, Summary Engines)
    ↓
Persistence Layer (Database V1 & V2 Tables)
```

### Kelebihan Utama:
*   **Model Data Komprehensif**: Berbeda dengan aplikasi sekolah biasa yang hanya mencatat status hadir/tidak hadir, SIPENA mendukung rekaman presensi (`AttendanceRecord`), pencatatan libur (`HolidayRecord`), kegiatan harian sekolah (`DayEvent`), dan mekanisme penguncian rekapitulasi bulanan (`AttendanceLock`).
*   **Dukungan Dispensasi (`'D'`)**: Penanganan status dispensasi yang setara dengan kehadiran penuh, namun secara ketat mewajibkan pengisian catatan alasan (`note`), mencerminkan kebutuhan administrasi sekolah yang nyata.
*   **Dokumentasi Terstruktur**: Adanya folder `/docs` khusus untuk memandu skema basis data dan pengujian otomatis menunjukkan tingkat maturitas rekayasa yang tinggi.

---

## 2. Analisis Kelemahan Sistem & Potensi Bottleneck

### A. Masalah Hari Libur Kustom (Custom Holidays)
*   **Tidak Adanya Batasan Lingkup Kelas**: Tabel `attendance_holidays` mengaitkan libur kustom langsung ke `user_id` (guru) tanpa kolom `class_id`. Akibatnya, hari libur kustom yang dibuat guru otomatis berlaku untuk **seluruh kelas** yang diajarkan oleh guru tersebut. Perbedaan hari libur antar-kelas tidak dapat dikonfigurasi.
*   **Overhead Kinerja (*Memory & Rendering Bloat*)**: Kueri memuat semua hari libur tanpa batasan rentang waktu atau penapisan tahun ajaran aktif. Grid tabel presensi yang besar (Jumlah Murid $\times$ Jumlah Hari) rentan mengalami lag render parah saat mencocokkan status `isHoliday` untuk ribuan data libur.
*   **Risiko Pembagian dengan Nol (*Division by Zero*)**: Jika guru mendaftarkan terlalu banyak libur kustom sehingga total hari efektif dalam sebulan menjadi `0`, perhitungan persentase kehadiran murid akan menghasilkan nilai `NaN%` atau `Infinity%`, yang berpotensi merusak layout perenderan PDF/Excel.

### B. Tantangan "God Component" pada `Attendance.tsx` (V1)
*   **Masalah**: Halaman `Attendance.tsx` versi V1 mengimpor puluhan dependensi (ekspor PDF/Excel, import OCR, sinkronisasi libur, diagram statistik, tabel gulir, layout tanda tangan, dsb) dalam satu file raksasa berukuran ribuan baris.
*   **Dampak**: Menurunkan tingkat keterbacaan (*readability*), menyulitkan pembuatan pengujian unit (*unit testing*), serta meningkatkan risiko konflik kode saat dikerjakan oleh beberapa pengembang secara paralel.

---

## 3. Solusi & Pola Dekopling Modular (V2 Solution)

Dalam perancangan V2, tantangan "God Component" diselesaikan dengan memecah halaman utama menjadi komponen-komponen kecil yang terfokus:

*   **`AttendanceV2Page`**: Bertindak sebagai dirigen (*orchestrator*) yang mengatur komunikasi state, dialog modal, dan koordinasi mutasi.
*   **`AttendanceV2Toolbar`**: Mengelola masukan filter pemilih kelas, navigasi bulan, serta pemicu aksi impor/ekspor.
*   **`AttendanceV2Table` & `AttendanceV2Cell`**: Berfokus murni pada perenderan kisi murid dan penanganan interaksi sel.
*   **`AttendanceV2SummaryCards`**: Menampilkan rekapitulasi data kehadiran murid secara real-time.
*   **`AttendanceV2AuditPanel`**: Menampilkan riwayat mutasi presensi langsung pada halaman guru demi asas transparansi data.

---

## 4. Peta Jalan Fitur Unggulan Masa Depan (Future Roadmap)

Untuk membuat modul presensi SIPENA semakin unggul, berikut adalah peta jalan fitur yang direkomendasikan untuk dikembangkan:

### A. Jurnal Transparansi & Riwayat Presensi (Attendance Timeline / Audit Trail)
Menyediakan lini masa perubahan status presensi untuk mendeteksi tindakan manipulasi atau kesalahan input.
```
08:00 WIB - Hadir ('H') oleh Sistem (Default)
08:15 WIB - Sakit ('S') oleh Ibu Guru Budi (Dilengkapi Catatan: "Demam Tinggi")
08:20 WIB - Dispensasi ('D') oleh Guru Piket (Catatan Diperbarui: "Mewakili Lomba Catur")
15:00 WIB - Dikunci ('Locked') oleh Kepala Sekolah
```

### B. Pengisian Cepat Sekali Klik (Bulk Fill & One-Click Normalization)
Untuk menghemat waktu guru saat mengajar kelas dengan jumlah murid yang banyak (30-40 murid per kelas):
*   Sistem secara otomatis mengeset status awal seluruh murid sebagai Hadir (`'H'`).
*   Guru cukup memfokuskan perhatian untuk mengubah status murid-murid yang tidak hadir (Sakit, Izin, atau Alpha). Ini memangkas jumlah interaksi klik hingga 90%.

### C. Navigasi Papan Ketik Pintar (Smart Keyboard Input)
Memungkinkan guru melakukan pengisian presensi secara beruntun menggunakan keyboard tanpa menyentuh mouse:
*   Gunakan tombol panah (`↑`, `↓`, `←`, `→`) untuk berpindah antar-sel presensi murid.
*   Gunakan tombol shortcut karakter (`H` untuk Hadir, `I` untuk Izin, `S` untuk Sakit, `A` untuk Alpha, `D` untuk Dispensasi) untuk langsung mengisi status sel yang sedang terpilih.

### D. Indikator Penyimpanan Otomatis (Autosave Indicator & Offline Recovery)
Meningkatkan rasa aman pengguna saat sistem bekerja pada kondisi jaringan internet sekolah yang lambat:
*   Menampilkan status visual `Menyimpan...` di bagian toolbar saat mutasi dikirim, berubah menjadi `Tersimpan ✓` saat database V2 sukses mencatat data.
*   Menyimpan transaksi presensi secara lokal (*IndexedDB/Cache*) apabila koneksi internet terputus mendadak, lalu menyinkronkannya kembali secara otomatis (*background sync*) saat jaringan kembali pulih.

### E. Heatmap Distribusi Kehadiran Murid (Attendance Heatmap)
Menyajikan visualisasi grafis berbentuk blok warna bulanan untuk mendeteksi pola ketidakhadiran murid secara cepat:
```
Murid A: 🟩🟩🟩🟩🟩🟩🟩 (Konsisten Hadir)
Murid B: 🟩🟩🟥🟩🟩🟨🟩 (Kerap tidak hadir di hari Rabu)
(Keterangan: 🟩 Hadir/Dispen, 🟨 Izin/Sakit, 🟥 Alpha)
```
Guru dapat mendeteksi murid-murid yang rentan membolos pada hari-hari tertentu secara sekilas.
