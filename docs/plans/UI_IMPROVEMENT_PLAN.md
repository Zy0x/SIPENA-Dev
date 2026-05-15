# Rencana Perbaikan UI/UX SIPENA — Komprehensif

## 1. Struktur Layout Global

### Status Saat Ini
- Layout menggunakan sidebar + main content area
- Responsif dasar sudah ada (mobile/tablet/desktop)
- Spacing dan padding tidak selalu konsisten antar halaman

### Rekomendasi
| Area | Perbaikan | Prioritas |
|------|-----------|-----------|
| Sidebar | Konsistensi width (260px desktop, full-width mobile) | 🔴 Tinggi |
| Main content | Max-width konsisten (1400-1600px) + centered | 🔴 Tinggi |
| Padding halaman | Standarisasi: `p-3 sm:p-4 lg:p-6` untuk semua halaman | 🔴 Tinggi |
| Header halaman | Template komponen reusable `PageHeader` | 🟡 Sedang |
| Footer | Sembunyikan di halaman fullscreen (Morphe, Grades fullscreen) | 🟢 Rendah |

## 2. Konsistensi Komponen

### Card Pattern
- **Standar**: `rounded-2xl bg-card border border-border/60`
- **Aktif/Selected**: `border-primary/30 bg-primary/5`
- **Error**: `border-destructive/30 bg-destructive/5`
- **Semua card** harus menggunakan pattern yang sama

### Button Sizing
| Konteks | Ukuran | Padding |
|---------|--------|---------|
| Action utama (toolbar) | `h-9 sm:h-10` | `px-3 sm:px-4` |
| Secondary/icon | `h-8 w-8` | icon-only |
| In-table/compact | `h-7 text-xs` | `px-2` |
| CTA/hero | `h-11 sm:h-12` | `px-6 sm:px-8` |

### Badge Variants
- Gunakan design token: `pass`, `warning`, `fail`, `outline`, `secondary`
- Jangan custom warna langsung di komponen

## 3. Standar Spacing
```
Antar section: gap-4 sm:gap-6
Antar card/element: gap-3
Dalam card: p-3 sm:p-4
Antara label dan input: gap-1.5 sm:gap-2
Antar item list: gap-0.5 sm:gap-1
```

## 4. Tipografi

| Level | Desktop | Mobile | Font Weight |
|-------|---------|--------|-------------|
| H1 (judul halaman) | text-lg | text-base | font-bold |
| H2 (section) | text-base | text-sm | font-semibold |
| Body | text-sm | text-sm | font-normal |
| Caption | text-xs | text-[10px] | font-medium |
| Label | text-sm | text-xs | font-medium |

## 5. Navigasi

### Pola Saat Ini
- Sidebar dengan icon + label
- Mobile: hamburger menu → drawer
- Breadcrumb belum ada

### Rekomendasi
- Tambahkan breadcrumb pada halaman detail (Grades, Attendance, Reports)
- Konsistensi back button placement (kiri atas)
- Active state sidebar: `bg-primary/10 text-primary border-l-2 border-primary`

## 6. Responsivitas per Halaman

### Dashboard
- ✅ Grid auto-fit sudah bagus
- ⚠️ Card spacing terlalu rapat di mobile kecil
- 🔧 Fix: Tambah `gap-3` minimum

### Grades (Input Nilai)
- ✅ Spreadsheet horizontal scroll works
- ⚠️ Toolbar terlalu crowded di mobile
- 🔧 Fix: Pindahkan action ke dropdown menu di mobile

### Attendance (Presensi)
- ✅ Monthly view works
- ⚠️ Status button terlalu kecil di mobile
- 🔧 Fix: Min `h-10 w-10` untuk touch target

### Classes
- ✅ Card grid responsive
- ⚠️ Import button tidak terlihat jelas
- 🔧 Fix: Tambah secondary action button di header

### Reports (Laporan)
- ✅ Export dialog works
- ⚠️ Chart terlalu kecil di mobile
- 🔧 Fix: Full-width chart di mobile, min-height 300px

### Morphe AI
- ✅ Chat layout bagus
- ⚠️ Sidebar session list bisa overflow
- 🔧 Fix: Sudah di-fix dengan truncation

### Settings
- ⚠️ Form layout tidak konsisten
- 🔧 Fix: Gunakan form grid 1-column di mobile, 2-column di desktop

## 7. Aksesibilitas

| Area | Status | Perbaikan |
|------|--------|-----------|
| Color contrast | ⚠️ Beberapa text terlalu ringan | Minimum WCAG AA (4.5:1) |
| Focus indicators | ⚠️ Default ring saja | Custom focus ring: `ring-2 ring-primary/50` |
| ARIA labels | ⚠️ Tidak lengkap | Tambahkan di semua interactive elements |
| Keyboard nav | ✅ Tab order benar | Tambah shortcut hints |
| Screen reader | ⚠️ Semantic heading | Pastikan H1 > H2 > H3 hierarchy |

## 8. Dark Mode
- ✅ Sudah implementasi via CSS variables
- ⚠️ Beberapa komponen hardcode warna
- 🔧 Audit seluruh komponen, ganti ke semantic token

## 9. Kategorisasi Tombol & Toolbar Optimization

### Masalah Saat Ini
- Terlalu banyak tombol action terlihat sekaligus di toolbar halaman
- Tombol Import Excel, Import OCR, Ekspor PDF, Ekspor Excel, Ekspor CSV, dll tampil berjajar
- Pada mobile, toolbar menjadi sangat penuh (crowded) dan tidak nyaman
- Beberapa tombol sejenis (misal semua jenis ekspor) sebaiknya digabung

### Strategi Kategorisasi

#### Pola 1: Dropdown Grouped Actions
Gabungkan tombol-tombol yang se-kategori ke dalam satu dropdown menu:

```tsx
// ❌ SEBELUM (terlalu crowded)
<Button>Ekspor PDF</Button>
<Button>Ekspor Excel</Button>
<Button>Ekspor CSV</Button>
<Button>Import Excel</Button>
<Button>Import OCR</Button>

// ✅ SESUDAH (rapi, kategorisasi)
<DropdownMenu>
  <DropdownMenuTrigger>
    <Button>📥 Import <ChevronDown /></Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>Import dari Excel</DropdownMenuItem>
    <DropdownMenuItem>Import dari Foto (OCR)</DropdownMenuItem>
    <DropdownMenuItem>Import Batch (Multi-Sheet)</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>

<DropdownMenu>
  <DropdownMenuTrigger>
    <Button>📤 Ekspor <ChevronDown /></Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>Ekspor PDF</DropdownMenuItem>
    <DropdownMenuItem>Ekspor Excel</DropdownMenuItem>
    <DropdownMenuItem>Ekspor CSV</DropdownMenuItem>
    <DropdownMenuItem>Ekspor PNG HD</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

#### Pola 2: Mobile Action Sheet
Pada viewport mobile, gabungkan SEMUA action ke satu tombol "⋮" (more actions):
```tsx
// Desktop: tampilkan dropdown Import + dropdown Ekspor + tombol utama
// Mobile: satu tombol "⋮" → bottom sheet dengan semua opsi
```

#### Pola 3: Floating Action Button (FAB) untuk Quick Actions
Pada halaman yang memiliki banyak aksi (seperti Grades, Attendance):
- Desktop: toolbar horizontal dengan dropdown
- Mobile: FAB di pojok kanan bawah, expand ke radial/list menu

### Rencana Per Halaman

| Halaman | Tombol Saat Ini | Solusi |
|---------|-----------------|--------|
| **Grades** | Import Excel, Import OCR, Ekspor (3 format), Fullscreen, Settings | **2 dropdown** (Import + Ekspor) + 2 icon button (Fullscreen, Settings) |
| **Attendance** | Import Excel, Import OCR, Ekspor (4 format), Filter | **2 dropdown** (Import + Ekspor) + 1 filter button |
| **Classes** | Tambah Kelas, Import OCR, Tour | 1 primary button (Tambah) + 1 dropdown (Import/OCR) |
| **Subjects** | Tambah Mapel, Tour | Tidak perlu perubahan |
| **Reports** | Ekspor (3 format), Filter mapel, Filter semester | **1 dropdown** (Ekspor) + 2 filter inline |
| **Dashboard** | Quick actions | Sudah clean |
| **Settings** | Batch Import (baru) | Tab khusus, tidak perlu di toolbar |

### Prioritas Implementasi
1. **Fase 1**: Gabungkan tombol ekspor ke dropdown di Grades & Attendance
2. **Fase 2**: Gabungkan tombol import ke dropdown di Grades & Attendance  
3. **Fase 3**: Implementasi mobile action sheet/FAB pattern
4. **Fase 4**: Standarisasi toolbar component yang reusable

## 10. Prioritas Implementasi

| Fase | Item | Estimasi |
|------|------|----------|
| 1 | Standarisasi spacing & padding | 1 iterasi |
| 2 | Konsistensi card & button pattern | 1-2 iterasi |
| 3 | Kategorisasi toolbar (dropdown grouped actions) | 1-2 iterasi |
| 4 | Mobile toolbar optimization (action sheet/FAB) | 1 iterasi |
| 5 | Breadcrumb navigation | 1 iterasi |
| 6 | Touch target sizing | 1 iterasi |
| 7 | Dark mode audit | 1 iterasi |
| 8 | ARIA & accessibility | 1-2 iterasi |
| 9 | Reusable PageHeader + Toolbar component | 1 iterasi |

## 11. Metrik Keberhasilan

- **Lighthouse Performance**: > 90
- **Lighthouse Accessibility**: > 95
- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Touch target compliance**: 100% (min 44×44px)
- **Color contrast compliance**: 100% WCAG AA
- **Toolbar button count visible**: max 4 di mobile, max 6 di desktop
- **Konsistensi spacing**: 100% halaman menggunakan standar spacing
