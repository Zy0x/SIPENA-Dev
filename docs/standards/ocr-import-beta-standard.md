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
- NISN wajib berasal dari foto atau koreksi pengguna. Sistem tidak boleh membuat NISN palsu.
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
