# Import Kelas & Siswa

Import Kelas & Siswa adalah alur untuk membuat banyak kelas dan siswa dari satu file Excel resmi SIPENA. Fitur ini berbeda dari **Import Siswa ke Kelas Ini**, yang hanya menambahkan siswa ke satu kelas yang sudah dipilih.

## Struktur Workbook

Gunakan tombol **Download Template** pada dialog Import Kelas & Siswa. File resmi berisi:

| Sheet | Fungsi |
| --- | --- |
| `Panduan` | Panduan singkat berisi urutan pengisian, aturan wajib, dan arti catatan saat cek data. |
| `Ringkasan` | Contoh ringkasan jumlah murid per sheet kelas. |
| `Kelas` | Daftar kelas yang akan dibuat atau digunakan ulang. |
| `Kelas - <Nama Kelas>` | Daftar siswa untuk satu kelas. Buat satu sheet kelas untuk setiap kelas. |

Template baru memakai pola sheet `Kelas - <Nama Kelas>`, misalnya `Kelas - VA`. SIPENA tetap membaca file lama yang memakai `Siswa - <Nama Kelas>` dan juga bisa mengenali nama sheet kustom selama sheet tersebut memiliki header siswa dan namanya berkaitan dengan nama kelas.

## Cara Mengisi Template

1. Buka sheet `Kelas`.
2. Isi satu baris untuk setiap kelas yang ingin dibuat atau dipakai ulang, misalnya `VIIA`, `VIIB`, dan `IX-C`.
3. Isi `KKM Kelas *` dengan angka 0-100. Nilai ini menjadi KKM awal kelas.
4. Isi `Deskripsi` bila perlu. Batasi maksimal 500 karakter agar tetap rapi di tampilan kelas.
5. Isi `Nama Sheet Kelas` dengan nama sheet siswa untuk kelas tersebut, misalnya `Kelas - VA`.
6. Buka sheet kelas yang sesuai, lalu isi `Nama Siswa *` dan `NISN *` satu siswa per baris.
7. Jika menambah kelas baru, duplikasi salah satu sheet kelas contoh, ubah nama sheet, lalu pastikan nama itu sama dengan kolom `Nama Sheet Kelas`.
8. Simpan sebagai `.xlsx`, upload di SIPENA, lalu baca tahap **Cek Data** sebelum menekan import.

Template sengaja dibuat ringkas. Kolom teks panjang memakai wrap dan tinggi baris otomatis agar isi panduan tidak terpotong saat dibuka di Excel atau aplikasi spreadsheet lain.

Header boleh memakai tanda `*` atau tanpa tanda `*`. Contoh `Nama Kelas *` dan `Nama Kelas` sama-sama dibaca sebagai kolom nama kelas. SIPENA juga menerima variasi header yang masih bermakna sama, seperti `Nama Murid` untuk `Nama Siswa`.

Kolom utama pada sheet `Kelas`:

| Kolom | Wajib | Aturan |
| --- | --- | --- |
| `Nama Kelas *` | Ya | Maksimal 50 karakter. |
| `KKM Kelas *` | Ya | Angka 0 sampai 100. |
| `Deskripsi` | Tidak | Maksimal 500 karakter. |
| `Nama Sheet Kelas` | Disarankan | Nama sheet kelas/siswa. Wajib diisi jika nama kelas terlalu panjang atau sheet memakai nama khusus. |

Kolom utama pada sheet `Kelas - <Nama Kelas>`:

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
- nama sheet kelas/siswa,
- status kelas, misalnya `Kelas baru`, `Sudah ada`, atau `Tidak dipilih`,
- jumlah siswa,
- catatan yang perlu diperbaiki atau dicek.

Tabel cek data bisa digeser ke samping pada layar kecil. Geser area tabel untuk melihat kolom status, jumlah siswa, dan catatan lengkap.

Tombol import tidak aktif selama masih ada error pada kelas yang dipilih. Kelas yang tidak dicentang tidak ikut dibuat, siswanya tidak dimasukkan, dan error/warning milik kelas tersebut tidak memblokir import kelas lain. Warning boleh dilanjutkan hanya setelah pengguna mencentang konfirmasi.

## Cara Membaca Error dan Warning

| Jenis | Arti | Tindakan |
| --- | --- | --- |
| Error | Data tidak aman untuk disimpan. | Perbaiki file Excel, lalu upload ulang. |
| Warning | Data bisa disimpan, tetapi perlu dicek manual. | Baca baris yang ditandai, lalu centang konfirmasi jika benar. |
| Info | SIPENA hanya memberi tahu keputusan otomatis. | Biasanya tidak perlu diperbaiki, misalnya siswa existing dilewati. |

Contoh kasus yang sering terjadi:

- `Sheet siswa tidak ditemukan`: nama di kolom `Nama Sheet Kelas` berbeda dengan nama tab sheet dan SIPENA tidak menemukan sheet lain yang cocok.
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
- Setiap kelas memiliki sheet kelas/siswa yang sesuai, atau memang sengaja dibuat tanpa siswa.
- Header `No`, `Nama Siswa *`, dan `NISN *` pada sheet siswa tidak dihapus.
- Tidak ada NISN yang tertukar antar siswa dalam kelas yang sama.
- File disimpan sebagai `.xlsx` atau `.xls`, bukan screenshot atau PDF.

## Setelah Import

Jika import berhasil sebagian lalu dihentikan karena koneksi atau error lain, upload ulang workbook yang sama setelah masalah diperbaiki. SIPENA melakukan preflight sebelum insert dan menandai kelas/siswa existing agar pengulangan import tidak membuat data dobel.
