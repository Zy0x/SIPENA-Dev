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
