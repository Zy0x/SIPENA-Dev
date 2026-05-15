# Dark Mode Audit Plan

Tanggal: 2026-05-04

## Tujuan

Pastikan mode gelap SIPENA konsisten di seluruh halaman, subhalaman, modal, panel, dialog, export studio, dan alat internal. Preferensi mode gelap harus tersimpan di database dan diterapkan ulang saat pengguna berpindah device.

## Root Cause Awal

- Aplikasi menginisialisasi mode gelap dari `localStorage.theme` di `main.tsx`.
- Halaman Settings memakai `useThemes`, tetapi hook tersebut hanya menyimpan `theme` dan `colorTheme` ke `localStorage`.
- Database sudah memiliki tabel `user_preferences` dengan kolom `theme_mode` dan `theme_palette`, tetapi preference ini belum menjadi sumber kebenaran global untuk menerapkan dark mode.
- Akibatnya device B bisa tetap light mode walaupun device A sudah menyimpan preferensi dark mode di database.

## Target Perbaikan

1. Buat satu jalur theme runtime yang konsisten untuk menerapkan class `.dark` dan CSS variables.
2. Saat user login, ambil `user_preferences` dari database dan terapkan `theme_mode` + `theme_palette` ke DOM.
3. Saat user mengubah toggle mode gelap atau palet warna, simpan perubahan ke `user_preferences` dan `localStorage`.
4. Tambahkan realtime sync untuk perubahan `user_preferences` agar device/tab lain bisa mengikuti perubahan terbaru.
5. Pastikan fallback lokal tetap berjalan saat user belum login atau database belum tersedia.
6. Audit komponen dengan warna hardcoded yang berpotensi tidak terbaca di dark mode.

## Area Audit UI

- Layout global: sidebar, header, footer, maintenance banner, PWA/update banner.
- Halaman utama: Dashboard, Kelas, Mapel, Input Nilai, Presensi, Laporan, Ranking, Portal Orang Tua, Profil, Settings, Help, About.
- Modal/dialog: import Excel, export studio, signature settings, delete confirmation, onboarding, profile editor, fullscreen spreadsheet.
- Alat internal: spreadsheet nilai, export preview, Morphe, admin panels, notifications/toasts.

## Prioritas Implementasi

1. Perbaiki persistence dan apply logic theme global.
2. Perbaiki Settings agar update theme menyimpan ke database.
3. Tambahkan helper reusable untuk apply theme dan local fallback.
4. Audit warna hardcoded dengan risiko tinggi, terutama teks `text-gray-*` tanpa `dark:*` dan background putih permanen di UI interaktif.
5. Jalankan lint/build.

## Acceptance Criteria

- Toggle mode gelap di Settings langsung mengubah UI.
- Toggle mode gelap menyimpan ke `user_preferences.theme_mode`.
- Pilih palet warna menyimpan ke `user_preferences.theme_palette`.
- Reload page dan login device baru menerapkan theme dari database.
- Jika database belum tersedia, fallback `localStorage` tetap bekerja.
- Build tidak rusak.
