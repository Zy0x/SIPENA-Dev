# Rencana Integrasi Web Service Dapodik

## Tujuan
- Sinkronkan data sekolah, GTK, rombel, peserta didik, dan penugasan tanpa input ulang manual.
- Buat alur yang aman, mudah dipakai user biasa, dan tetap berbasis backend Supabase eksternal + Edge Functions.

## Cakupan Data
- Sekolah/profil satuan pendidikan
- PTK/GTK
- Peserta didik
- Rombel dan anggota rombel
- Mapel, pembelajaran, wali kelas, tahun ajaran bila tersedia

## Arsitektur Disarankan
1. User isi URL Web Service Dapodik + token di halaman Pengaturan Admin.
2. Frontend kirim request ke Edge Function aman.
3. Edge Function validasi input, panggil Web Service Dapodik, normalisasi respons, lalu simpan ke tabel staging.
4. User menekan tombol sinkronkan untuk memindahkan data staging ke tabel utama setelah preview perubahan.

## Alur User Sederhana
1. Buka Pengaturan → Integrasi Dapodik.
2. Isi URL Web Service dan token.
3. Klik Tes Koneksi.
4. Klik Ambil Data.
5. Lihat ringkasan perubahan: data baru, berubah, duplikat, gagal.
6. Klik Terapkan Sinkronisasi.

## Tabel yang Disarankan
- `dapodik_connections`
- `dapodik_sync_runs`
- `dapodik_school_staging`
- `dapodik_teachers_staging`
- `dapodik_students_staging`
- `dapodik_classrooms_staging`
- `dapodik_memberships_staging`
- `dapodik_sync_logs`

## Tahap Implementasi
### Fase 1 — Koneksi Aman
- Simpan URL dan token terenkripsi.
- Tes koneksi dan validasi struktur respons.

### Fase 2 — Staging
- Ambil data bertahap per endpoint.
- Simpan raw payload + normalized payload.
- Buat indikator freshness dan checksum.

### Fase 3 — Sinkronisasi ke Tabel Inti
- Mapping `peserta_didik -> students`
- Mapping `gtk -> profiles/teachers`
- Mapping `rombel -> classes`
- Mapping anggota rombel ke relasi siswa-kelas.

### Fase 4 — UX Admin
- Tombol Tes Koneksi, Ambil Data, Terapkan, Rollback terakhir.
- Progress sinkronisasi dan log error yang mudah dibaca.

## Aturan Keamanan
- Token hanya di Edge Function/secrets, tidak pernah tampil penuh di frontend.
- Rate limit dan retry adaptif.
- Audit log tiap sinkronisasi.
- Semua operasi sensitif server-side.

## Panduan untuk User Biasa
- Cukup siapkan URL Web Service Dapodik aktif dan token.
- Pastikan server sekolah bisa diakses dari internet jika sinkronisasi dilakukan dari hosting.
- Gunakan tombol Tes Koneksi sebelum sinkronisasi penuh.
- Jika gagal, periksa token, firewall, atau sertifikat HTTPS.

## Output yang Perlu Disiapkan di Iterasi Berikutnya
- SQL schema lengkap
- Edge Function proxy Dapodik
- UI Pengaturan Integrasi Dapodik
- Preview diff sebelum apply sinkronisasi