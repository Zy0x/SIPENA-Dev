# SIPENA — Dokumentasi Teknis & Hierarki Sistem

> **SIPENA** (Sistem Informasi Penilaian Akademik)
> Aplikasi web untuk pengelolaan nilai, presensi, dan data akademik siswa.
> Dibangun dengan React + TypeScript + Supabase.
> Versi: 2.3.61 | Tanggal: 7 Maret 2026

---

## Daftar Isi

1. [Arsitektur Umum](#1-arsitektur-umum)
2. [Struktur Direktori](#2-struktur-direktori)
3. [Halaman & Routing](#3-halaman--routing)
4. [Komponen](#4-komponen)
5. [Hooks (Custom Logic)](#5-hooks-custom-logic)
6. [Konteks (Context Providers)](#6-konteks-context-providers)
7. [Library & Utility](#7-library--utility)
8. [Supabase Edge Functions](#8-supabase-edge-functions)
9. [Database Schema](#9-database-schema)
10. [Sistem Autentikasi](#10-sistem-autentikasi)
11. [Sistem Import Data](#11-sistem-import-data)
12. [Sistem Ekspor](#12-sistem-ekspor)
13. [Morphe AI](#13-morphe-ai)
14. [Portal Orang Tua](#14-portal-orang-tua)
15. [PWA & Service Worker](#15-pwa--service-worker)
16. [Sistem Desain & Theming](#16-sistem-desain--theming)
17. [Keamanan](#17-keamanan)
18. [File Dokumentasi](#18-file-dokumentasi)
19. [Panduan Pengembangan](#19-panduan-pengembangan)

---

## 1. Arsitektur Umum

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND (React)                  │
│  ┌───────────┐ ┌───────────┐ ┌──────────────────┐   │
│  │   Pages   │ │Components │ │  Hooks/Contexts   │   │
│  └─────┬─────┘ └─────┬─────┘ └────────┬─────────┘   │
│        └──────────────┼────────────────┘              │
│                       │                               │
│              ┌────────▼────────┐                      │
│              │ Supabase Client │                      │
│              └────────┬────────┘                      │
└───────────────────────┼───────────────────────────────┘
                        │ HTTPS
┌───────────────────────▼───────────────────────────────┐
│              BACKEND (Supabase Eksternal)              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │PostgreSQL│ │   Auth   │ │  Edge Fn  │ │ Storage  │ │
│  │ + RLS    │ │          │ │  (Deno)   │ │          │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
└───────────────────────────────────────────────────────┘
```

### Hierarki Data

```
User (auth.users)
 └── Academic Year (Tahun Ajaran)
      ├── Semester 1
      │    ├── Class (Kelas)
      │    │    ├── Student (Siswa)
      │    │    │    ├── Grade (Nilai)
      │    │    │    └── Attendance (Presensi)
      │    │    └── Student ...
      │    ├── Subject (Mata Pelajaran)
      │    │    ├── Chapter (BAB)
      │    │    │    └── Assignment (Tugas/Ujian)
      │    │    └── Chapter ...
      │    └── Subject ...
      └── Semester 2
           └── (struktur sama)
```

---

## 2. Struktur Direktori

```
sipena/
├── public/                    # Aset statis (favicon, manifest, SW)
│   ├── manifest.json          # PWA manifest
│   ├── sw.js                  # Service Worker
│   └── *.png                  # Ikon dan gambar
├── src/
│   ├── App.tsx                # Root component & routing
│   ├── main.tsx               # Entry point React
│   ├── index.css              # Design tokens & global styles
│   ├── components/            # Komponen UI
│   │   ├── ui/                # Komponen dasar (shadcn/ui)
│   │   ├── admin/             # Panel admin
│   │   ├── auth/              # Komponen autentikasi
│   │   ├── classes/           # CRUD kelas & siswa
│   │   ├── dashboard/         # Widget dashboard
│   │   ├── grades/            # Input & tampilan nilai
│   │   ├── import/            # Dialog import (Excel, OCR, Batch)
│   │   ├── layout/            # Header, sidebar, footer
│   │   ├── notifications/     # Sistem notifikasi
│   │   ├── onboarding/        # Onboarding & tema
│   │   ├── profile/           # Editor profil & foto
│   │   ├── rankings/          # Perangkingan siswa
│   │   ├── reports/           # Laporan & ekspor
│   │   ├── search/            # Pencarian global
│   │   ├── settings/          # Halaman pengaturan
│   │   └── subjects/          # CRUD mata pelajaran
│   ├── contexts/              # React Context providers
│   ├── hooks/                 # Custom hooks
│   ├── lib/                   # Utility functions
│   ├── config/                # Konfigurasi (versi, dll)
│   ├── data/                  # Data statis (changelog)
│   ├── pages/                 # Halaman utama
│   └── integrations/          # Integrasi Supabase (auto-gen)
├── supabase/
│   ├── config.toml            # Konfigurasi Supabase CLI
│   ├── functions/             # Edge Functions (Deno)
│   └── migrations/            # Migration files (read-only)
├── docs/
│   ├── guide/                 # Panduan teknis
│   │   ├── README.md
│   │   ├── 001_ATTENDANCE_V2_MIGRATION.md
│   │   ├── 002_ACTIVITY_LOGS_SETUP.md
│   │   ├── 003_DEPLOY_CLOUDFLARE_NETLIFY.md
│   │   ├── 004_DEPLOY_EDGE_FUNCTIONS.md
│   │   ├── 005_MIGRATION_SCHEMA.md
│   │   ├── 006_PWA_PUSH_NOTIFICATION_SETUP.md
│   │   ├── 007_SETUP_PGCRON.md
│   │   └── 008_TUTORIAL.md
│   ├── plans/                 # Rencana pengembangan
│   │   ├── BATCH_IMPORT_PLAN.md
│   │   ├── IMPORT_DATA_PLAN.md
│   │   ├── MORPHE_AI_PLAN.md
│   │   ├── UI_IMPROVEMENT_PLAN.md
│   │   ├── SEMESTER_COMPREHENSIVE.md
│   │   └── ACADEMIC_YEAR_COMPREHENSIVE.md
│   └── sql/                   # SQL Supabase yang harus dijalankan
│       ├── 001_ATTENDANCE_V2_MIGRATION.sql
│       ├── 002_ACTIVITY_LOGS_SETUP.sql
│       ├── 003_DATABASE_OVERVIEW_RPC.sql
│       ├── 004_MAINTENANCE_PARENT_PORTAL.sql
│       ├── 005_MIGRATION_SCHEMA.sql
│       ├── 006_MORPHE_AI_SETUP.sql
│       ├── 007_PWA_PUSH_NOTIFICATION_SETUP.sql
│       ├── 008_SIGNATURE_SETTINGS_SETUP.sql
│       ├── 009_SIGNATURE_SETTINGS_V2.sql
│       ├── 010_SEMESTER_COMPREHENSIVE.sql
│       ├── 011_TEAM_PROFILES_SETUP.sql
│       └── 012_ACADEMIC_YEAR_COMPREHENSIVE.sql
│       └── TUTORIAL.md
└── tailwind.config.ts         # Konfigurasi Tailwind CSS
```

---

## 3. Halaman & Routing

| Route | Halaman | Akses | Fungsi |
|---|---|---|---|
| `/` | `Index.tsx` | Publik | Landing page |
| `/auth` | `Auth.tsx` | Publik | Login & registrasi |
| `/dashboard` | `Dashboard.tsx` | 🔒 Protected | Ringkasan statistik, aktivitas terbaru, quick actions |
| `/classes` | `Classes.tsx` | 🔒 Protected | CRUD kelas, tambah/edit/hapus siswa, import CSV/OCR |
| `/attendance` | `Attendance.tsx` | 🔒 Protected | Presensi harian & rekap bulanan, import/ekspor |
| `/subjects` | `Subjects.tsx` | 🔒 Protected | CRUD mata pelajaran, KKM, share link |
| `/grades` | `Grades.tsx` | 🔒 Protected | Input nilai spreadsheet, BAB/tugas, formula, import |
| `/reports` | `Reports.tsx` | 🔒 Protected | Hub laporan (nilai & ranking) |
| `/reports/grades` | `GradeReports.tsx` | 🔒 Protected | Laporan nilai detail, ekspor PDF/Excel/CSV |
| `/reports/rankings` | `StudentRankings.tsx` | 🔒 Protected | Perangkingan siswa per kelas/mapel |
| `/parent-portal` | `ParentPortal.tsx` | 🔒 Protected | Buat & kelola portal laporan orang tua |
| `/portal/:code` | `PortalView.tsx` | Publik | Tampilan portal orang tua (share link) |
| `/morphe` | `MorpheChat.tsx` | 🔒 Protected | AI Chat assistant (Morphe AI) |
| `/settings` | `Settings.tsx` | 🔒 Protected | Pengaturan akun, tema, batch import |
| `/settings/profile` | `Profile.tsx` | 🔒 Protected | Edit profil, foto, crop gambar |
| `/help` | `Help.tsx` | 🔒 Protected | Panduan penggunaan, shortcut keyboard |
| `/about` | `About.tsx` | 🔒 Protected | Tentang SIPENA, lisensi, kredit |
| `/changelog` | `Changelog.tsx` | Publik | Riwayat perubahan versi |
| `/terms` | `Terms.tsx` | Publik | Syarat & Ketentuan |
| `/share` | `GuestAccess.tsx` | Publik | Halaman akses tamu via shared link |
| `/guest/grades` | `GuestGrades.tsx` | Publik | Lihat nilai sebagai tamu |
| `/admin` | `Admin.tsx` | Admin Only | Panel administrasi sistem |
| `*` | `NotFound.tsx` | Publik | Halaman 404 |

---

## 4. Komponen

### 4.1 Komponen Global
| Komponen | Fungsi |
|---|---|
| `AppLayout.tsx` | Layout utama dengan sidebar, header, footer |
| `ErrorBoundary.tsx` | Menangkap error React per-section |
| `ProtectedRoute.tsx` | Guard route terautentikasi |
| `SplashScreen.tsx` | Animasi splash saat PWA launch |
| `PWAInstallBanner.tsx` | Banner instalasi PWA |
| `ExportLoaderOverlay.tsx` | Overlay loading saat ekspor (PDF/Excel/PNG) |
| `RotationOverlay.tsx` | Overlay peringatan rotasi layar |
| `SipenaLogo.tsx` | Logo SIPENA (SVG) |
| `Footer.tsx` | Footer global |
| `NavLink.tsx` | Link navigasi aktif |
| `MiniProfilePopup.tsx` | Popup profil mini di sidebar |
| `KeyboardShortcutsProvider.tsx` | Provider shortcut keyboard global |
| `ScrollToTop.tsx` | Auto scroll ke atas saat navigasi |
| `MaintenanceBanner.tsx` | Banner peringatan maintenance |

### 4.2 Komponen Import Data
| Komponen | Fungsi |
|---|---|
| `grades/GradeImportExportDialog.tsx` | Smart Import/Ekspor nilai |
| `classes/ImportClassesStudentsDialog.tsx` | Import kelas dan siswa dari template Excel multi-sheet dasar |
| `import/ImportStudentsDialog.tsx` | Import siswa dari file Excel |
| `import/ImportAttendanceDialog.tsx` | Import presensi dari file Excel |
| `import/OCRImportDialog.tsx` | Import data dari foto (Beta OCR) |
| `import/BatchImportDialog.tsx` | Import batch multi-sheet (seluruh ekosistem akademik) |

### 4.3 Komponen Layout
| Komponen | Fungsi |
|---|---|
| `layout/SidebarNav.tsx` | Navigasi sidebar (collapse/expand) |
| `layout/HeaderYearDisplay.tsx` | Tampilan tahun ajaran di header |
| `layout/ActiveYearBadge.tsx` | Badge tahun ajaran aktif |
| `layout/SemesterToggle.tsx` | Toggle semester 1/2 |
| `layout/YearSwitchDialog.tsx` | Dialog ganti tahun ajaran |

### 4.4 Komponen Autentikasi
| Komponen | Fungsi |
|---|---|
| `auth/FloatingLabelInput.tsx` | Input dengan label mengambang |
| `auth/ForgotPasswordDialog.tsx` | Dialog reset password |
| `auth/GuestAuthDialog.tsx` | Dialog autentikasi tamu |
| `auth/ReCaptcha.tsx` | Integrasi reCAPTCHA v3 |
| `auth/ReCaptchaV2.tsx` | reCAPTCHA v2 checkbox |

### 4.5 Komponen Grades
| Komponen | Fungsi |
|---|---|
| `grades/SpreadsheetTable.tsx` | Tabel spreadsheet input nilai utama |
| `grades/GradeInputCell.tsx` | Cell input nilai individual |
| `grades/FullscreenGradeInput.tsx` | Input nilai fullscreen mobile |
| `grades/ChapterStructure.tsx` | Struktur BAB & tugas |
| `grades/GradePrediction.tsx` | Prediksi nilai berbasis AI |
| `grades/FormulaSettings.tsx` | Pengaturan formula perhitungan |

---

## 5. Hooks (Custom Logic)

| Hook | Fungsi |
|---|---|
| `useClasses.ts` | CRUD kelas (+ duplikasi, filter TA) |
| `useStudents.ts` | CRUD siswa per kelas |
| `useSubjects.ts` | CRUD mata pelajaran (+ filter TA) |
| `useChapters.ts` | CRUD BAB per mata pelajaran |
| `useAssignments.ts` | CRUD tugas/ujian per BAB |
| `useGrades.ts` | CRUD nilai per siswa per tugas |
| `useGradesWithUndo.ts` | Input nilai dengan undo/redo |
| `useAttendance.ts` | Presensi harian, rekap, hari libur |
| `useMorpheChat.ts` | Morphe AI chat, sesi, streaming, model auto-select |
| `useParentPortal.ts` | CRUD portal orang tua |
| `useAcademicYears.ts` | CRUD tahun ajaran |
| `useSemesters.ts` | CRUD semester per tahun ajaran |
| `useNotifications.ts` | Baca & kelola notifikasi |
| `useSharedLinks.ts` | CRUD link berbagi (akses tamu) |
| `useThemes.ts` | Manajemen tema (light/dark + warna) |

---

## 6. Konteks (Context Providers)

| Context | Fungsi |
|---|---|
| `AuthContext.tsx` | State autentikasi (user, session, signIn, signOut) |
| `AcademicYearContext.tsx` | Tahun ajaran aktif & semester aktif |
| `ToastContext.tsx` | Toast notification terpusat |
| `AvatarContext.tsx` | URL avatar pengguna (cache) |

---

## 7. Library & Utility

| File | Fungsi |
|---|---|
| `lib/supabase-external.ts` | Client Supabase eksternal |
| `lib/utils.ts` | `cn()` class merging |
| `lib/activityLogger.ts` | Logger aktivitas ke DB |
| `lib/exportReports.ts` | Ekspor laporan PDF/Excel/CSV |
| `lib/formatNumber.ts` | Format angka Indonesia |
| `lib/fuzzySearch.ts` | Fuzzy search |
| `lib/throttle.ts` | Throttle & debounce |

---

## 8. Supabase Edge Functions

| Function | Fungsi |
|---|---|
| `morphe-chat` | AI Chat via Groq API (streaming, SIPENA data injection, deep data mode) |
| `predict-grades` | Prediksi nilai berbasis statistik |
| `admin-auth` | Autentikasi admin panel |
| `admin-database` | Operasi database admin (backup, restore) |
| `delete-auth-user` | Hapus user dari auth.users |
| `delete-semester-data` | Hapus data semester |
| `send-otp-email` | Kirim OTP verifikasi email |
| `verify-recaptcha` | Verifikasi reCAPTCHA v3 |
| `verify-recaptcha-v2` | Verifikasi reCAPTCHA v2 |

---

## 9. Database Schema

### Tabel Utama
| Tabel | Keterangan |
|---|---|
| `academic_years` | Tahun ajaran |
| `semesters` | Semester per TA |
| `classes` | Kelas |
| `students` | Siswa per kelas |
| `subjects` | Mata pelajaran |
| `chapters` | BAB/Materi per mapel |
| `assignments` | Tugas/ujian per BAB |
| `grades` | Nilai siswa per tugas |
| `attendance_records` | Presensi harian |
| `morphe_sessions` | Sesi chat Morphe AI |
| `morphe_messages` | Pesan chat Morphe AI |
| `parent_portal_configs` | Konfigurasi portal orang tua |
| `notifications` | Notifikasi sistem |
| `shared_links` | Link akses tamu |
| `profiles` | Profil pengguna |
| `activity_logs` | Log aktivitas |

---

## 10. Sistem Autentikasi

- Supabase Auth (email/password + Google OAuth)
- reCAPTCHA v3 (soft-check) + v2 (wajib registrasi)
- Login attempt tracking (3x gagal → saran reset)
- Protected routes via `ProtectedRoute` component
- Back-button protection setelah logout

---

## 11. Sistem Import Data

### Jenis Import
| Jenis | Lokasi | Deskripsi |
|---|---|---|
| Import Excel per halaman | Kelas, Nilai, Presensi | Upload .xlsx, auto-detect kolom, preview |
| Import OCR (BETA) | Siswa, Nilai, Presensi | Maksimal 5 foto → Groq Vision → normalisasi AI → tabel editable → konfirmasi |
| Import Batch Multi-Sheet | Settings | Satu file .xlsx multi-sheet untuk seluruh ekosistem |

### Import Kelas & Siswa
Lihat `docs/guide/class-student-import.md` untuk standar workbook, aturan duplikat, dan perbedaan dengan Import Siswa ke Kelas Ini.

### Batch Import Flow
1. Download template Excel (7 sheet)
2. Isi data: Kelas → Siswa → Mapel → BAB/Tugas → Nilai → Presensi
3. Upload → Validasi cross-reference → Preview per sheet
4. Import dengan progress bar → Laporan hasil

---

## 12. Sistem Ekspor

| Format | Halaman | Konten |
|---|---|---|
| PDF | Nilai, Presensi | Tabel berwarna, header bertingkat |
| Excel (.xlsx) | Nilai, Presensi | Multi-sheet (ringkasan + detail) |
| CSV | Nilai | Header bertingkat |
| PNG HD/4K | Presensi | Gambar tabel high-resolution |

---

## 13. Morphe AI

### Fitur
- Chat AI ultra-cepat via Groq API (streaming)
- Multi-sesi dengan pin, rename, delete (right-click context menu)
- Auto model selection (Vision, Coding, Reasoning)
- LaTeX rendering (remark-math + rehype-katex)
- File attachment (gambar, dokumen, kode)
- Mode SIPENA: injeksi data akademik guru
- Deep Data Mode: akses detail per-siswa (dengan consent)
- Auto-summarize setelah 28 pesan
- Dark mode forced pada halaman Morphe

### Model yang Didukung
Auto, Llama 3.3/3.1/4 Scout (Vision), GPT-OSS, DeepSeek R1, Qwen 3/2.5, Mixtral, Gemma

---

## 14. Portal Orang Tua

### Fitur
- Guru membuat portal dengan konfigurasi granular
- Data yang bisa ditampilkan: Nilai detail per mapel/tugas, Presensi, Ranking, Prediksi AI
- Share via link atau QR Code
- Nilai ditampilkan secara konkret per mata pelajaran dan per tugas/BAB
- Tab navigasi per mapel dengan status KKM (Tuntas/Belum Tuntas)
- Kedaluwarsa opsional, view count tracking

---

## 15. PWA & Service Worker

- Installable (manifest lengkap)
- Splash Screen animasi
- Service Worker caching
- Push notification handler
- Rotation overlay

---

## 16. Sistem Desain & Theming

- CSS custom properties (`--background`, `--primary`, `--grade-pass`, dll)
- Light + Dark mode + System
- Multi-theme color palette
- shadcn/ui dengan kustomisasi
- Touch target min 44×44px
- Mobile-first responsive

---

## 17. Keamanan

- RLS (Row Level Security) pada setiap tabel
- Frontend hanya menggunakan anon/publishable key
- Service Role Key hanya di Edge Functions
- Input sanitization
- No hardcoded secrets
- Admin panel dengan autentikasi terpisah + session timeout

---

## 18. File Dokumentasi

### Rencana Pengembangan (`docs/plans/`)
| File | Deskripsi |
|---|---|
| `BATCH_IMPORT_PLAN.md` | Rencana import batch multi-sheet |
| `IMPORT_DATA_PLAN.md` | Strategi import data keseluruhan |
| `MORPHE_AI_PLAN.md` | Roadmap Morphe AI |
| `UI_IMPROVEMENT_PLAN.md` | Standarisasi UI/UX + kategorisasi toolbar |

### SQL Schema (`docs/sql/`)
| File | Urutan |
|---|---|
| `001_ATTENDANCE_V2_MIGRATION.sql` | 1️⃣ Presensi V2 |
| `002_ACTIVITY_LOGS_SETUP.sql` | 2️⃣ Log aktivitas |
| `003_DATABASE_OVERVIEW_RPC.sql` | 3️⃣ Database overview |
| `004_MAINTENANCE_PARENT_PORTAL.sql` | 4️⃣ Portal Orang Tua |
| `005_MIGRATION_SCHEMA.sql` | 5️⃣ Schema dasar |
| `006_MORPHE_AI_SETUP.sql` | 6️⃣ Tabel Morphe AI |
| `007_PWA_PUSH_NOTIFICATION_SETUP.sql` | 7️⃣ Push notification |
| `008_SIGNATURE_SETTINGS_SETUP.sql` | 8️⃣ Signature setup |
| `009_SIGNATURE_SETTINGS_V2.sql` | 9️⃣ Signature V2 |
| `010_SEMESTER_COMPREHENSIVE.sql` | 🔟 Layer semester |
| `011_TEAM_PROFILES_SETUP.sql` | 1️⃣1️⃣ Team profiles |
| `012_ACADEMIC_YEAR_COMPREHENSIVE.sql` | 1️⃣2️⃣ Isolasi TA |
| `011_TEAM_PROFILES_SETUP.sql` | 1️⃣1️⃣ Team profiles |
| `012_ACADEMIC_YEAR_COMPREHENSIVE.sql` | 1️⃣2️⃣ Isolasi TA |

---

## 19. Panduan Pengembangan

### Setup Lokal
```bash
git clone <repo-url> && cd sipena
npm install
# Set .env: VITE_SUPABASE_PROJECT_ID, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_URL
npm run dev
```

### Versioning
Format: `2.X.Y` — X dinaikkan eksplisit, Y increment per update.

### Menambah Fitur Baru
1. Buat hook di `src/hooks/`
2. Buat komponen di `src/components/<module>/`
3. Tambah route di `src/App.tsx`
4. Update SQL di `docs/`
5. Update changelog di `src/data/changelog.ts`
6. Update versi di `src/config/version.ts`

---

> **Catatan**: Dokumen ini di-update pada 7 Maret 2026 untuk versi 2.3.61.
