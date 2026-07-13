# Audit Hardening Performa Frontend - Juli 2026

## Objective

Mengurangi beban startup dan lag interaksi pada perangkat low-end tanpa mengubah perilaku Presensi Stable/V2, Input Nilai, OCR, maupun ekspor.

## Evidence

- Build sebelum route splitting menghasilkan chunk utama sekitar 7,2 MB raw karena seluruh page di-import eager.
- `AppLayout` menjalankan tween GSAP untuk overlay, drawer, collapse, stagger item, hover, dan press.
- Pergantian tab `Grades` mengukur tinggi dua kali, mengubah `document.body`, memaksa reflow, dan menjalankan tiga timer hingga 450 ms.
- Engine Excel dan PDF Presensi ikut terhubung secara statis ke route Presensi.

## Perbaikan Aman

- Semua page dan route Presensi memakai `React.lazy` dengan fallback netral.
- Excel, PDF, PDF.js, dan ZIP Presensi dimuat saat aksi ekspor dijalankan.
- Drawer mobile memakai CSS transform/opacity; GSAP hanya dipertahankan untuk desktop dengan profil motion penuh.
- Profil motion otomatis menjadi ringan pada reduced-motion, coarse pointer, Save-Data, koneksi 2G, memori <= 4 GB, atau CPU <= 4 logical core.
- Pergantian tab Input Nilai memakai `startTransition` dan satu frame koreksi posisi tanpa height lock, body mutation, forced reflow, atau smooth-scroll paksa.
- Modal Presensi Massal dipusatkan pada satu komponen shared dengan body scroll tunggal dan footer aman.

## Risiko yang Ditunda

- Virtualisasi tabel Presensi sudah tersedia; perubahan algoritme data tidak dilakukan pada pass UI ini.
- Beberapa modul laporan lama masih mengimpor engine ekspor secara statis di chunk route masing-masing. Route splitting mencegahnya masuk startup, tetapi pemecahan lebih lanjut perlu golden test ekspor terpisah.
- Animasi GSAP desktop masih digunakan untuk collapse dan hover pada perangkat kuat agar karakter visual tidak berubah drastis.

## Regression Gate

- Guard sumber mengunci shared bulk dialog, Tabs filter, lazy route/export, adaptive sidebar, dan larangan forced reflow tab Nilai.
- Verifikasi akhir wajib mencakup typecheck, targeted tests, lint, build, full test, `verify:web:dist`, serta QA viewport pendek dan mobile.

## Optimasi PWA Android

### Baseline Produksi

- Entry JavaScript sekitar 1.044 KB raw / 317 KB gzip.
- CSS global sekitar 332 KB raw / 52 KB gzip.
- Precache service worker 179 file / sekitar 13,4 MB.
- GIF navigasi sekitar 18 MB dan dapat diminta walaupun perangkat tidak membutuhkan animasi.
- Pemeriksaan update, notifikasi, aktivitas, dan status footer berjalan dari beberapa scheduler terpisah.

### Implementasi

- Profil `full`, `balanced`, dan `lite` ditetapkan sebelum React dirender berdasarkan Android, memori, CPU, Save-Data, koneksi, pointer, standalone, dan reduced motion.
- Android serta perangkat low-end memakai ikon Lucide statik. Elemen GIF tidak dibuat sehingga browser tidak pernah meminta aset animasi berat.
- Precache dibatasi ke app shell dan vendor inti. Route berat, PDF, XLSX, ZIP, OCR, KaTeX, Morphe, tour, dan export memakai runtime cache setelah dibuka.
- Pemeriksaan update menjadi satu scheduler yang berhenti di background dan di-throttle saat aplikasi kembali foreground.
- Komponen header nonkritis, query Dashboard sekunder, AI, ranking, dan aktivitas ditunda sampai idle.
- Footer aplikasi tidak lagi melakukan ping database berkala atau memuat GSAP.
- Bagian bawah Dashboard memakai `content-visibility` agar browser tidak mengerjakan layout/paint sebelum diperlukan.

### Budget Produksi

- Entry utama maksimum 700 KB raw / 220 KB gzip.
- CSS maksimum 360 KB raw / 60 KB gzip.
- Precache maksimum 3,5 MB.
- Dependency PDF/XLSX/Morphe/KaTeX tidak boleh masuk startup atau precache.
- Aset GIF navigasi Android harus 0 byte karena elemen GIF tidak dirender pada profil balanced/lite.

Budget diperiksa otomatis melalui `npm run perf:budget` dan dikunci oleh guard Vitest.
