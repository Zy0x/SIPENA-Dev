# Standar Panduan Interaktif & Injeksi Data Tiruan (Dummy) SIPENA

Dokumen ini mendefinisikan standar utama dan pedoman teknis bagi semua pengembang/agen dalam merancang, memodifikasi, dan menguji fitur Panduan Produk (*Product Tour*) di SIPENA. Tujuannya adalah memastikan tur interaktif dapat menyorot elemen UI riil di layar secara dinamis tanpa mengotori database sekolah.

---

## 1. Filosofi & Pendekatan Utama

Setiap halaman operasional utama di SIPENA (Input Nilai, Mata Pelajaran, Kelas & Murid, dsb.) wajib memiliki Panduan Interaktif (*Product Tour*) yang memandu pengguna baru.

*   **Penyajian Data Dinamis**: Panduan tidak boleh hanya berupa teks penjelasan statis; tur wajib menyorot (*highlight*) elemen DOM/UI riil (seperti kartu kelas, kartu mapel, tabel nilai, atau peringatan).
*   **Injeksi Data Tiruan Hibrida (*Hybrid Mocking*)**: Jika database kosong atau data yang diperlukan langkah tur tidak tersedia, halaman wajib membuat dan menyuntikkan data tiruan secara lokal ke dalam memori (*in-memory React state*).
*   **Zero Database Pollution**: Data tiruan **tidak boleh** disimpan atau ditulis ke database Supabase. Semua data tiruan harus dikelola 100% pada *local client state*.

---

## 2. Pola Injeksi Tiruan Hibrida (Hybrid Mocking Pattern)

Sistem harus mengevaluasi ketersediaan data secara asinkron sebelum memulai tur dan mengambil keputusan berdasarkan matriks berikut:

| Kondisi Database | Aksi Tur | Hasil Visual |
|---|---|---|
| **Kosong Total (Akun Baru)** | Aktifkan `isTourDummyActive = true` dan suntikkan data tiruan lengkap (kelas, mapel, murid, dsb.). | Seluruh layout terisi penuh dengan data contoh agar dapat disorot langkah demi langkah. |
| **Data Parsial (Ada Kelas, tetapi Mapel/Murid Kosong)** | Gunakan kelas asli, suntikkan daftar mapel/murid dummy secara lokal khusus untuk kelas tersebut. | Pengguna melihat visual tur di dalam konteks kelas nyata miliknya dengan mapel/murid contoh. |
| **Data Lengkap** | Jangan aktifkan dummy. Jalankan tur 100% menggunakan data asli di database. | Tur menggunakan data nyata tanpa menyisipkan data tiruan. |

### Contoh Pemicuan Khusus (Elemen Kondisional)
Jika terdapat komponen UI yang hanya merender secara kondisional (seperti kotak peringatan KKM kelas yang kosong), tur harus menyuntikkan data tiruan yang sesuai (misalnya, menyisipkan 1 kelas contoh dengan KKM `null` meskipun kelas asli lainnya sudah terisi KKM) agar elemen visual tersebut muncul dan dapat disorot oleh tur.

---

## 3. Alur Siklus Tur (Lifecycle) & Restorasi State

Tur harus mengimplementasikan fungsi inisialisasi (`prepare`) dan pembersihan (`cleanup`) secara ketat:

### A. Tahap Inisialisasi (`prepareClassesTour` / `prepareSubjectsTour` / dsb.)
1.  **Rekam Pilihan Asal**: Simpan pilihan kelas (`selectedClassId`), mata pelajaran (`selectedSubjectId`), atau kueri pencarian (`searchQuery`) pengguna ke dalam React `useRef` (misalnya `preTourClassIdRef`).
2.  **Bersihkan Pencarian**: Kosongkan filter pencarian aktif agar semua kartu kelas/mapel/murid terlihat di layar sebelum tur menyorotnya.
3.  **Suntikkan Dummy**: Isi state dummy lokal (`tourDummyClasses`, `tourDummySubjects`, dsb.) berdasarkan kondisi database.
4.  **Tunggu Render**: Berikan jeda waktu (*timeout* sekitar 150-300ms) setelah mengubah state agar elemen React selesai melakukan proses rendering di DOM sebelum tur dimulai.

### B. Tahap Pembersihan (`cleanupClassesTour` / dsb.)
Fungsi ini wajib dipanggil pada event `onComplete`, `onSkip`, maupun ketika tur ditutup secara paksa (klik backdrop/tombol tutup X):
1.  **Matikan Status Dummy**: Set `isTourDummyActive = false` dan kosongkan array data tiruan lokal.
2.  **Kembalikan State Pengguna**: Kembalikan pilihan kelas, mapel, dan kueri pencarian asli pengguna dari `useRef` ke state React.

---

## 4. Standar Bahasa & Terminologi

Sesuai dengan ketentuan global SIPENA, seluruh teks instruksi tur, judul langkah, deskripsi tooltip, dan label tombol pada halaman yang terpengaruh wajib menggunakan istilah **Murid** (bukan "siswa").

*   *Salah*: "Jumlah Siswa", "Import Siswa dari Foto", "Siswa".
*   *Benar*: "Jumlah Murid", "Import Murid dari Foto", "Murid".

---

## 5. Checklist QA-QC Implementasi Tur Baru

Sebelum merilis halaman dengan tur guide baru, pastikan:
- [ ] Pengujian dilakukan pada database kosong (kelas dummy terisi, tidak ada crash).
- [ ] Pengujian dilakukan pada database terisi sebagian (mapel/murid dummy terisi di bawah kelas asli).
- [ ] Menutup tur di tengah jalan (skip/close) membersihkan data dummy dan mengembalikan kueri pencarian & seleksi asli.
- [ ] Tidak ada log error lint, typecheck, atau error visual snapping (hentakan tinggi layout) saat transisi data.
- [ ] Kepatuhan istilah "murid" (no "siswa") diuji pada seluruh tooltip tur dan UI terkait.
