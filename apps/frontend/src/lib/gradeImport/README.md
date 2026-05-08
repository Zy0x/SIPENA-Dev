# SIPENA Grade Import Engine

## ConflictSimplifier

`conflictSimplifier.ts` menjembatani engine import yang detail dengan UI guru yang lebih sederhana. Engine tetap menyimpan kode teknis, tetapi UI memakai tiga kategori:

- `auto_fixable`: aman diterapkan sekaligus, misalnya kolom Rapor/Ranking/Rata-rata diabaikan, UTS/PTS dibaca sebagai STS, UAS/PAS dibaca sebagai SAS, `student_id` cocok tetapi nama/NISN Excel berbeda, dan mode `fill_empty_only`.
- `needs_confirmation`: SIPENA punya saran kuat tetapi tetap butuh persetujuan, misalnya membuat tugas baru dari header `BAB 1 - Tugas 2`, membuat BAB dan tugas baru dari header eksplisit, atau nama siswa mirip dengan satu kandidat kuat.
- `manual_required`: wajib dipilih manual karena berisiko, misalnya siswa ambigu, dua baris menuju siswa yang sama, dua kolom menuju tugas yang sama, file beda kelas/mapel/semester, nilai invalid, atau header tugas tanpa BAB yang cocok ke banyak BAB.

Bulk apply hanya boleh untuk item yang aman:

- Abaikan kolom yang bukan nilai.
- Pakai alias STS/SAS yang jelas.
- Gunakan data siswa dari web saat `student_id` cocok.
- Pertahankan `fill_empty_only`.

Bulk apply tidak boleh membuat BAB/tugas berisiko, memilih siswa ambigu, resolve duplicate target, atau menimpa nilai lama. Mode overwrite disembunyikan di opsi lanjutan dan harus dikonfirmasi dengan teks `TIMPA`.

## Spreadsheet Preview UX

Step `Preview & Perbaiki` tidak menampilkan daftar konflik teknis sebagai tampilan utama. Guru melihat tabel seperti Input Nilai agar langsung memahami bagian mana yang aman dan bagian mana yang harus dipilih.

Status warna:

- `Tidak berubah`: data hanya sebagai konteks.
- `Akan diisi`: nilai Excel akan mengisi sel kosong.
- `Nilai berbeda`: nilai Excel berbeda dari nilai lama.
- `Kolom baru`: header Excel akan menjadi BAB/tugas baru jika disetujui.
- `Perlu dicek`: SIPENA punya saran yang aman untuk ditinjau.
- `Harus dipilih`: guru wajib memilih manual.
- `Diabaikan`: data tidak akan diimport.
- `Nilai tidak valid`: nilai tidak bisa dibaca sebagai angka 0-100.

Aturan auto-safe tetap terbatas pada aksi yang tidak mengubah nilai lama: abaikan kolom bukan nilai, pakai alias STS/SAS, pakai data siswa web saat ID cocok, dan pertahankan mode `fill_empty_only`.

Aturan manual-required dipakai untuk siswa ambigu, target kolom ambigu, file beda konteks, nilai invalid, dan struktur baru yang belum dikonfirmasi. User memperbaiki dengan klik cell, kolom, atau baris berwarna; panel perbaikan hanya menampilkan aksi utama, aksi sekunder, dan detail lanjutan. Mode overwrite tetap disembunyikan di opsi lanjutan dan memerlukan konfirmasi `TIMPA`.
