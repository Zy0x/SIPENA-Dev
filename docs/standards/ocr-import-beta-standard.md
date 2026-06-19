# Standar Import OCR BETA

## Tujuan

Import OCR BETA membaca foto daftar siswa, nilai, atau presensi. OCR membantu menyalin data, tetapi keputusan akhir selalu berada pada pengguna.

## Alur Wajib

1. Pengguna memilih kelas atau konteks data tujuan.
2. Pengguna memilih maksimal 5 foto JPG, PNG, atau WebP.
3. Pengguna memberi persetujuan pengiriman foto ke layanan AI untuk sesi tersebut.
4. Browser mengecilkan foto menjadi maksimal 2048 px dan 1,5 MB.
5. Edge Function menjalankan OCR gambar, lalu merapikan hasil menjadi tabel.
6. Pengguna memeriksa, mengedit, menyertakan, atau mengeluarkan setiap baris.
7. Import hanya aktif jika semua baris yang disertakan bebas error.
8. Pengguna mengonfirmasi penyimpanan dan menerima laporan berhasil, dilewati, dan gagal.

## Privasi dan Keamanan

- Foto dan base64 hanya boleh hidup selama modal terbuka.
- Foto tidak boleh disimpan ke database, Storage, log, atau histori.
- Edge Function wajib memakai JWT dan tidak boleh memiliki akses tulis database.
- Log hanya boleh berisi metadata teknis seperti request ID, jenis import, jumlah foto, durasi, dan jumlah baris.
- Respons AI selalu diperlakukan sebagai input tidak tepercaya dan divalidasi ulang secara deterministik.

## Aturan Domain

### Siswa

- Kelas tujuan wajib dipilih secara eksplisit.
- Pemilih kelas menyediakan `Tambah Kelas Baru`. Kelas yang berhasil dibuat langsung menjadi kelas tujuan tanpa mereset foto atau hasil OCR pada sesi aktif.
- Tabel pemeriksaan selalu memiliki kolom canonical `Nama Siswa` dan `NISN`, meskipun salah satunya tidak terdeteksi oleh OCR.
- Nama Siswa wajib diisi dan menjadi error pemblokir jika kosong.
- NISN yang tidak terbaca ditampilkan dan disimpan sebagai tanda `-`. Placeholder ini tidak diperiksa panjangnya, tidak dianggap konflik NISN, dan boleh dipakai oleh lebih dari satu siswa.
- Sistem tidak boleh membuat nomor NISN palsu. NISN valid dari foto atau koreksi pengguna tetap dipertahankan.
- Kolom OCR selain Nama Siswa dan NISN hanya membantu pemeriksaan dan tidak ikut disimpan saat import siswa.
- Nama dan NISN duplikat mengikuti aturan import siswa yang berlaku.

### Nilai

- NISN menjadi pencocokan utama; nama hanya fallback.
- Setiap kolom nilai wajib dipetakan ke tugas aktif.
- Nilai harus 0 sampai 100.
- Nilai yang sudah ada dipertahankan secara default.

### Presensi

- Tanggal dinormalisasi ke `YYYY-MM-DD`.
- Status yang valid adalah H, I, S, A, atau D.
- Presensi yang sudah ada dipertahankan secara default.

## Standar Antarmuka

- Semua pintu masuk, judul modal, dan indikator proses menampilkan label `BETA`.
- Tabel review wajib editable, mendukung checkbox per baris, dan scroll horizontal native di layar kecil.
- Foto sumber, nomor halaman, confidence, serta error atau warning wajib terlihat.
- Tulisan tangan selalu diberi warning pemeriksaan meskipun confidence tinggi.
- Bila OCR gagal, foto tetap tersedia dan pengguna dapat mencoba lagi atau memakai editor manual.
- Preview gambar wajib dibatasi oleh lebar modal dan tidak boleh memperlebar dialog atau body pada foto yang sangat lebar.
- Foto utama dan foto sumber dapat membuka viewer berlapis yang mendukung zoom 50-400%, pan, pinch, double tap, tombol reset, serta keyboard `+`, `-`, dan `0`.
- Daftar foto memakai tombol pilihan dan tombol aksi yang terpisah, `aria-pressed` untuk halaman aktif, serta kontrol urutan atas/bawah. Struktur interactive nested dilarang.
- Panduan foto, foto sumber, dan teks OCR mentah memakai `sipena-collapsible-trigger` agar state open, ikon arah, focus, dan touch konsisten.
