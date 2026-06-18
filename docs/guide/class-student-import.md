# Import Kelas & Siswa

Import Kelas & Siswa adalah alur untuk membuat banyak kelas dan siswa dari satu file Excel resmi SIPENA. Fitur ini berbeda dari **Import Siswa ke Kelas Ini**, yang hanya menambahkan siswa ke satu kelas yang sudah dipilih.

## Struktur Workbook

Gunakan tombol **Download Template** pada dialog Import Kelas & Siswa. File resmi berisi:

| Sheet | Fungsi |
| --- | --- |
| `Panduan` | Instruksi pengisian dengan warna, teks tebal, bagian penting, contoh, dan cara membaca catatan saat cek data. |
| `Ringkasan` | Contoh ringkasan jumlah siswa per sheet kelas. |
| `Kelas` | Daftar kelas yang akan dibuat atau digunakan ulang. |
| `Siswa - <Nama Kelas>` | Daftar siswa untuk satu kelas. Buat satu sheet siswa untuk setiap kelas. |

## Cara Mengisi Template

1. Buka sheet `Kelas`.
2. Isi satu baris untuk setiap kelas yang ingin dibuat atau dipakai ulang, misalnya `VIIA`, `VIIB`, dan `IX-C`.
3. Isi `KKM Kelas *` dengan angka 0-100. Nilai ini menjadi KKM awal kelas.
4. Isi `Deskripsi` bila perlu. Batasi maksimal 500 karakter agar tetap rapi di tampilan kelas.
5. Isi `Sheet Siswa` dengan nama sheet siswa untuk kelas tersebut, misalnya `Siswa - VIIA`.
6. Buka sheet siswa yang sesuai, lalu isi `Nama Siswa *` dan `NISN *` satu siswa per baris.
7. Jika menambah kelas baru, duplikasi salah satu sheet siswa contoh, ubah nama sheet, lalu pastikan nama itu sama persis dengan kolom `Sheet Siswa`.
8. Simpan sebagai `.xlsx`, upload di SIPENA, lalu baca tahap **Cek Data** sebelum menekan import.

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

## Cek Data Sebelum Import

Import selalu berhenti di tahap cek data sebelum ada data yang disimpan. Bagian ini dibuat sebagai tabel agar guru dapat langsung melihat kelas mana yang akan dipakai.

Tabel cek data menampilkan:

- kotak centang **Ikut** untuk memasukkan atau mengeluarkan kelas dari import,
- nama kelas,
- nama sheet siswa,
- status kelas, misalnya `Kelas baru`, `Sudah ada`, atau `Tidak dipilih`,
- jumlah siswa,
- catatan yang perlu diperbaiki atau dicek.

Tombol import tidak aktif selama masih ada error pada kelas yang dipilih. Kelas yang tidak dicentang tidak ikut dibuat, siswanya tidak dimasukkan, dan error/warning milik kelas tersebut tidak memblokir import kelas lain. Warning boleh dilanjutkan hanya setelah pengguna mencentang konfirmasi.

## Cara Membaca Error dan Warning

| Jenis | Arti | Tindakan |
| --- | --- | --- |
| Error | Data tidak aman untuk disimpan. | Perbaiki file Excel, lalu upload ulang. |
| Warning | Data bisa disimpan, tetapi perlu dicek manual. | Baca baris yang ditandai, lalu centang konfirmasi jika benar. |
| Info | SIPENA hanya memberi tahu keputusan otomatis. | Biasanya tidak perlu diperbaiki, misalnya siswa existing dilewati. |

Contoh kasus yang sering terjadi:

- `Sheet siswa tidak ditemukan`: nama di kolom `Sheet Siswa` berbeda dengan nama tab sheet.
- `Nama kelas maksimal 50 karakter`: pendekkan nama kelas, pindahkan informasi tambahan ke `Deskripsi`.
- `Deskripsi maksimal 500 karakter`: ringkas deskripsi kelas.
- `NISN wajib diisi`: isi NISN sebelum import.
- `NISN maksimal 17 karakter`: hapus spasi, tanda baca tidak perlu, atau periksa ulang data sumber.
- `Nama sama tetapi NISN berbeda`: cek apakah siswa memang berbeda. Jika benar, lanjutkan dengan konfirmasi.

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

## Checklist Sebelum Upload

- Sheet `Kelas` masih ada dan headernya tidak diubah.
- Setiap baris kelas punya `Nama Kelas *` dan `KKM Kelas *`.
- Setiap kelas memiliki sheet siswa yang sesuai, atau memang sengaja dibuat tanpa siswa.
- Header `No`, `Nama Siswa *`, dan `NISN *` pada sheet siswa tidak dihapus.
- Tidak ada NISN yang tertukar antar siswa dalam kelas yang sama.
- File disimpan sebagai `.xlsx` atau `.xls`, bukan screenshot atau PDF.

## Setelah Import

Jika import berhasil sebagian lalu dihentikan karena koneksi atau error lain, upload ulang workbook yang sama setelah masalah diperbaiki. SIPENA melakukan preflight sebelum insert dan menandai kelas/siswa existing agar pengulangan import tidak membuat data dobel.
