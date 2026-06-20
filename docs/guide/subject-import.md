# Import Mata Pelajaran dari Kelas Lain

Fitur **Import Mapel** menyalin mata pelajaran dari satu kelas sumber ke kelas yang sedang dipilih. Fitur ini cocok untuk memakai kembali susunan mapel dari kelas lain atau tahun ajaran terdahulu tanpa mengetik ulang.

## Alur Dasar

1. Pilih kelas tujuan di halaman **Mata Pelajaran**.
2. Tekan **Import Mapel**.
3. Pilih **Tahun Ajaran**, **Semester**, dan **Kelas Sumber**.
4. Centang mapel yang ingin diambil, lalu tekan **Periksa & Import**.
5. Periksa ringkasan terakhir dan konfirmasi import.

Import dasar hanya menyalin nama mapel, KKM, dan status mapel custom. Bila nama mapel sudah ada di kelas tujuan, mapel tersebut dilewati dan KKM lama tidak diubah.

## Struktur Pembelajaran

Aktifkan **Sertakan struktur pembelajaran** untuk ikut menyalin:

- BAB dan urutannya;
- tugas dan urutannya;
- rumus, bobot, dan pengaturan pembulatan rapor;
- link baru bila mapel sumber memiliki link aktif.

Struktur lama dipetakan ke semester tujuan yang aktif. Nilai siswa, token lama, pengguna tamu, histori penggunaan link, dan audit lama tidak pernah disalin. Mode ini meminta dua konfirmasi agar dampaknya dapat diperiksa sebelum data disimpan.

## Satuan dan Batch

Dialog **Tambah Mapel** memiliki dua mode:

- **Satuan** untuk menambahkan satu mapel dari katalog atau mapel custom.
- **Batch** untuk memilih banyak mapel, menambahkan mapel custom, dan menentukan KKM berbeda pada setiap mapel.

Mapel yang sudah ada ditandai dan tidak dapat dipilih ulang. Penyimpanan Batch dilakukan sekali sehingga hasil dan mapel yang dilewati dilaporkan dalam satu feedback.
