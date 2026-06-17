# Import Kelas & Siswa

Import Kelas & Siswa adalah alur untuk membuat banyak kelas dan siswa dari satu workbook Excel resmi SIPENA. Fitur ini berbeda dari **Import Siswa ke Kelas Ini**, yang hanya menambahkan siswa ke satu kelas yang sudah dipilih.

## Struktur Workbook

Gunakan tombol **Download Template** pada dialog Import Kelas & Siswa. Workbook resmi berisi:

| Sheet | Fungsi |
| --- | --- |
| `Panduan` | Instruksi pengisian, aturan validasi, dan cara membaca error preview. |
| `Ringkasan` | Contoh ringkasan jumlah siswa per sheet kelas. |
| `Kelas` | Daftar kelas yang akan dibuat atau digunakan ulang. |
| `Siswa - <Nama Kelas>` | Daftar siswa untuk satu kelas. Buat satu sheet siswa untuk setiap kelas. |

Kolom utama pada sheet `Kelas`:

| Kolom | Wajib | Aturan |
| --- | --- | --- |
| `Nama Kelas *` | Ya | Maksimal 50 karakter. |
| `KKM Kelas *` | Ya | Angka 0 sampai 100. |
| `Deskripsi` | Tidak | Maksimal 500 karakter. |
| `Sheet Siswa` | Disarankan | Nama sheet siswa. Wajib diisi jika nama kelas terlalu panjang untuk nama sheet Excel. |

Kolom utama pada sheet `Siswa - <Nama Kelas>`:

| Kolom | Wajib | Aturan |
| --- | --- | --- |
| `No` | Tidak | Hanya untuk membantu urutan di file. |
| `Nama Siswa *` | Ya | Nama lengkap siswa. |
| `NISN *` | Ya | Maksimal 17 karakter. Kurang dari 10 karakter akan tampil sebagai warning. |

## Validasi Preview

Import selalu berhenti di tahap preview sebelum ada data yang disimpan. Preview menampilkan:

- total kelas yang terdeteksi,
- jumlah kelas baru dan kelas existing,
- jumlah siswa per sheet,
- jumlah siswa baru, siswa dilewati, warning, dan error,
- daftar error/warning per sheet dan baris.

Tombol import tidak aktif selama masih ada error. Warning boleh dilanjutkan hanya setelah pengguna mencentang konfirmasi.

## Aturan Duplikat

- Nama kelas yang sudah ada pada tahun ajaran aktif akan digunakan ulang dan tidak dibuat dobel.
- Nama siswa dan NISN yang sama di kelas existing akan dilewati.
- Nama siswa sama tetapi NISN berbeda akan diberi warning dan membutuhkan konfirmasi.
- NISN sama pada kelas yang sama tetapi nama berbeda adalah error dan harus diperbaiki di workbook.
- Duplikat kelas di sheet `Kelas` adalah error.

## Perbedaan Alur Import

| Alur | Lokasi | Tujuan |
| --- | --- | --- |
| `Import Kelas & Siswa` | Menu import halaman Kelas & Siswa | Membuat atau memakai ulang banyak kelas, lalu menambahkan siswa dari sheet per kelas. |
| `Import Siswa ke Kelas Ini` | Konteks detail/satu kelas | Menambahkan siswa ke satu kelas yang sudah dipilih. CSV tetap dipakai untuk alur lokal ini. |
