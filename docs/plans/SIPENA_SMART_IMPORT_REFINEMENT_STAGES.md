# SIPENA Smart Import Refinement Stages

## Tahap 1 - Fondasi Baca Excel

Tujuan: memastikan SIPENA memilih sheet, header, kolom identitas, dan region nilai yang benar sebelum pengguna masuk ke pengaturan import.

- Kenali variasi header guru seperti `Peserta Didik`, `Nama Peserta Didik`, `NISN / NIS`, dan `NIS / NISN`.
- Gabungkan header multi-baris sederhana, termasuk header hasil merged cell seperti `BAB 1` yang menaungi beberapa kolom tugas.
- Prioritaskan sheet yang paling cocok dengan daftar siswa aktif pada halaman Input Nilai.
- Tetap baca file secara aman tanpa menyimpan nilai ke database.

## Tahap 2 - Penyederhanaan Atur Kolom

Tujuan: mengurangi keputusan teknis yang perlu dipahami guru.

- Siswa yang tidak ada di web diperlakukan sebagai baris dilewati, bukan masalah utama.
- Target kolom yang jelas bisa disiapkan otomatis sebagai saran aman.
- Kolom bukan nilai otomatis dilewati.
- Sediakan aksi cepat untuk memakai semua target yang jelas.

Status implementasi awal:

- Baris Excel yang siswanya tidak ditemukan di web sekarang masuk jalur dilewati, bukan konflik merah per nilai.
- Preview menandai baris yang dilewati sebagai abu-abu/ignored.
- Smart Fix menampilkan kasus siswa tidak ditemukan sebagai perbaikan aman: lewati baris, tidak membuat siswa baru.

## Tahap 3 - UX Kolom Baru dan Nilai Manual

Tujuan: membuat pengaturan import terasa seperti spreadsheet interaktif.

- Header BAB/Tugas membuka overlay pengaturan kolom.
- Buat BAB/tugas baru ditampilkan sebagai panel sederhana, bukan opsi teknis.
- Klik cell nilai langsung mengubah include/skip dengan warna abu-abu untuk dilewati.
- Panel perbaikan hanya menampilkan aksi yang relevan untuk cell atau kolom terpilih.

Status implementasi awal:

- Header kolom nilai sekarang menampilkan badge `Atur`, status dipakai/dilewati, dan hint aksi.
- Overlay kolom menampilkan saran `Kolom baru terdeteksi` untuk BAB/tugas baru dengan tombol `Pakai saran SIPENA`.
- Target kolom tersedia sebagai kartu cepat: target saat ini, STS, SAS, tugas baru, BAB + tugas baru, dan lewati.
- Dropdown tugas existing tetap ada sebagai kontrol lanjutan untuk memindahkan kolom Excel ke tugas lain.

## Tahap 4 - Eksekusi Aman, Undo/Redo, dan QA

Tujuan: memastikan import yang sudah disetujui bisa dieksekusi dan dikembalikan bila hasilnya tidak sesuai.

- Executor menghormati pilihan kolom dan cell.
- Mode timpa nilai lama tetap butuh konfirmasi eksplisit.
- Tambahkan riwayat import yang bisa undo/redo.
- Lakukan QA dengan file test, akun pengguna yang diminta, build, dan deploy bila diperlukan.

Status implementasi awal:

- Import batch sudah masuk ke riwayat `useGradesWithUndo`, sehingga perubahan nilai hasil import menjadi satu batch undo.
- Step `Import` sekarang menampilkan kartu `Riwayat import tersedia` setelah proses selesai.
- Guru bisa menekan `Undo import terakhir` atau `Redo import` langsung dari modal tanpa keluar ke toolbar Input Nilai.
- Setelah undo/redo dari modal, data nilai, BAB, dan tugas di-refresh lewat invalidasi query yang sama dengan proses import.
