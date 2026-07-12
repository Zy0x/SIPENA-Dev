# SIPENA

[![Source quality gate](https://github.com/Web-Modder/tessipena3-f7e2575d/actions/workflows/trigger-sync.yml/badge.svg?branch=main)](https://github.com/Web-Modder/tessipena3-f7e2575d/actions/workflows/trigger-sync.yml)
[![Production quality gate](https://github.com/Zy0x/SIPENA-Dev/actions/workflows/production-build.yml/badge.svg?branch=main)](https://github.com/Zy0x/SIPENA-Dev/actions/workflows/production-build.yml)

SIPENA adalah aplikasi web dan PWA untuk membantu guru mengelola kelas, murid, mata pelajaran, nilai, presensi, laporan, ranking, dan portal orang tua dalam satu ruang kerja.

- **Source development:** [Web-Modder/tessipena3-f7e2575d](https://github.com/Web-Modder/tessipena3-f7e2575d)
- **Production mirror:** [Zy0x/SIPENA-Dev](https://github.com/Zy0x/SIPENA-Dev)
- **Web preview:** [sipenadev.netlify.app](https://sipenadev.netlify.app)

## Fitur Utama

- Manajemen kelas dan data murid, termasuk import Excel dan OCR BETA.
- Mata pelajaran, KKM, struktur BAB, tugas, serta formula nilai.
- Input nilai berbentuk spreadsheet dengan autosave dan mode layar penuh.
- Presensi harian, rekap bulanan, kalender akademik, dan Studio Ekspor.
- Laporan nilai, ranking murid, dan portal orang tua.
- Akses Guru Tamu yang terbatas pada kelas/mapel yang dibagikan.
- Panel Admin untuk akun, feature access, database, maintenance, dan monitoring produksi.
- PWA responsif untuk desktop, tablet, mobile, keyboard, dan touchscreen.

## Arsitektur Repositori

```text
apps/frontend/        React + TypeScript + Vite
apps/backend/         API/backend modules
packages/shared/      Contract dan tipe bersama
packages/ui/          Komponen dan token UI bersama
supabase/             Migration, RLS, dan Edge Functions
scripts/              Build, verifikasi, monitoring, dan security checks
docs/                 Arsitektur, standar, dan panduan teknis
```

Source of truth frontend berada di `apps/frontend`. Root compatibility layer hanya mempertahankan kompatibilitas tool lama.

## Menjalankan Secara Lokal

Persyaratan:

- Node.js 22 direkomendasikan.
- npm 10 atau lebih baru.
- Supabase CLI hanya diperlukan untuk migration dan Edge Function.

```bash
git clone https://github.com/Web-Modder/tessipena3-f7e2575d.git
cd tessipena3-f7e2575d
npm ci
cp .env.example .env
npm run dev
```

Isi `.env` hanya di mesin lokal. Jangan commit `.env`, token, service-role key, password Admin, credential monitoring, atau credential akun pengujian.

## Environment

Frontend hanya boleh menerima variable publik berawalan `VITE_`:

```env
VITE_APP_ENV=development
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_VAPID_PUBLIC_KEY=
```

Secret server seperti `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_DB_PASSWORD`, Telegram Bot Token, dan webhook key harus disimpan melalui Supabase secret/Vault atau secret store GitHub/Netlify. Secret server tidak boleh memakai prefix `VITE_` karena seluruh variable `VITE_` dapat masuk ke bundle browser.

Lihat `.env.example`, `.env.production.example`, dan `docs/environment.md` untuk konfigurasi lengkap.

## Quality Gate

Jalankan pemeriksaan yang sama dengan CI sebelum membuat commit:

```bash
npm run security:scan
npm run typecheck
npm run lint -- --quiet
npm test
npm run build
npm run verify:web:dist
```

`security:scan` menolak `.env` yang terlacak, private key, token provider, service-role JWT, dan privileged secret mentah. Output build produksi berada di `apps/frontend/dist` dan disalin ke `dist` hanya untuk compatibility.

## Alur Sinkronisasi dan Produksi

```text
Web-Modder/tessipena3-f7e2575d
        │ push
        ▼
Source quality gate
  security → typecheck → lint → tests → build → dist verification
        │ hanya jika lulus
        ▼
repository_dispatch
        ▼
Zy0x/SIPENA-Dev
        │
        ├─ Production quality gate + artifact terverifikasi
        └─ Netlify production build
```

Workflow source tidak mengirim isi secret ke target. Ia hanya mengirim metadata repo, branch, commit SHA, dan mode sinkronisasi melalui `repository_dispatch`. Repo produksi kembali menjalankan quality gate dari dependency lockfile sebelum artifact dipublikasikan.

Jangan push langsung ke `Zy0x/SIPENA-Dev`. Perubahan harus berasal dari source development agar histori, pengujian, dan rollback tetap konsisten.

## Supabase dan Keamanan Data

- Semua perubahan schema bersifat migration-first dan additive bila memungkinkan.
- Tabel sensitif wajib memakai RLS; tabel server-only memakai `FORCE ROW LEVEL SECURITY` dan akses service role yang eksplisit.
- Edge Function memvalidasi sesi dan scope sebelum membaca atau menulis data.
- Data murid, nilai, credential, dan token tidak boleh dicetak ke log CI atau notifikasi eksternal.
- Migration produksi harus diuji, diperiksa dengan `supabase db lint --linked`, lalu diverifikasi pada project yang benar.

## Deployment Manual

Deployment manual hanya digunakan saat alur otomatis tidak tersedia:

```bash
npm run build
npm run verify:web:dist
npm run deploy:netlify
```

Setelah deploy, verifikasi `version.json`, manifest PWA, asset utama, route publik, autentikasi, dan health endpoint. Build lokal yang lulus belum dianggap sebagai bukti produksi sudah aktif.

## Dokumentasi

- `docs/architecture.md` - arsitektur aplikasi.
- `docs/environment.md` - kontrak environment.
- `docs/testing.md` - strategi pengujian.
- `docs/conventions.md` - konvensi engineering.
- `docs/standards/` - standar UI, touch, scroll, dan feature access.
- `attendance/` - dokumentasi arsitektur Presensi.

## Kontribusi

1. Buat branch dari `main`.
2. Jaga perubahan tetap terfokus dan jangan sertakan file lokal/secret.
3. Tambahkan regression test untuk perubahan perilaku.
4. Jalankan seluruh quality gate.
5. Buat pull request dengan ringkasan risiko, bukti pengujian, dan rencana rollback.

## Status

SIPENA masih dikembangkan aktif. Fitur berlabel BETA dikontrol melalui Feature Access dan tidak otomatis aktif untuk semua akun.
