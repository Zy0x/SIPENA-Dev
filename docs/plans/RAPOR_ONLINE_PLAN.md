# Rencana Pembuatan Rapor Online — SIPENA (Kurikulum Merdeka)

## 1. Ringkasan

Rapor Online adalah fitur premium SIPENA untuk menghasilkan laporan hasil belajar siswa sesuai format **Kurikulum Merdeka** (dan backward-compatible K13). Fitur ini mendukung template standar Kemendikbud, **import format rapor kustom (AI + OCR)**, preview & editor halaman penuh, merge field otomatis, dan ekspor PDF profesional.

---

## 2. Fitur Utama

### 2.1 Template Rapor Kurikulum Merdeka
| Fitur | Detail |
|-------|--------|
| Template standar Kurikulum Merdeka | Layout resmi: Capaian Pembelajaran (CP), Tujuan Pembelajaran (TP), Projek P5 |
| Template K13 (legacy) | Backward-compatible untuk sekolah yang masih menggunakan K13 |
| Identitas sekolah | Logo, nama sekolah, alamat, NPSN, kepala sekolah, NIP |
| Identitas siswa | Nama, NIS/NISN, kelas, fase, semester, tahun ajaran |
| Custom header/footer | Bisa disesuaikan per sekolah |
| Multi-template | Guru bisa menyimpan beberapa template sekaligus |

### 2.2 Konten Rapor (Kurikulum Merdeka)
| Section | Sumber Data | Keterangan |
|---------|------------|------------|
| **Capaian Pembelajaran (CP)** | Auto dari tabel grades + formula | Per mata pelajaran sesuai fase |
| **Tujuan Pembelajaran (TP)** | Auto atau input manual | Breakdown TP per CP |
| **Nilai Intrakurikuler** | Tabel `grades` → rata-rata per mapel | Sumatif, formatif, akhir semester |
| **Projek P5** | Input manual atau import | Tema, dimensi Pancasila, deskripsi |
| **Predikat** | Kalkulasi dari rentang nilai | BB/MB/BSH/SB (Kurikulum Merdeka) |
| **Deskripsi Capaian** | Auto-generate AI atau manual | Kalimat naratif per mata pelajaran |
| **Refleksi Guru** | Input manual per mapel | Catatan refleksi pembelajaran |
| **Presensi** | Tabel `attendance_v2` | Sakit, Izin, Tanpa Keterangan, Hadir |
| **Ekstrakurikuler** | Input manual per siswa | Nama ekskul + predikat |
| **Catatan Wali Kelas** | Input manual | Textarea per siswa |
| **Ranking** | Kalkulasi dari rata-rata | Ranking di kelas (opsional) |

### 2.3 Import Format Rapor Kustom (AI + OCR)
| Fitur | Detail |
|-------|--------|
| **Upload PDF/Image** | Guru upload format rapor sekolah (scan/foto/PDF) |
| **OCR Processing** | Ekstraksi teks & layout dari gambar/PDF |
| **AI Layout Analysis** | AI menganalisis struktur: header, tabel, field, tanda tangan |
| **Field Detection** | AI mendeteksi field yang bisa di-merge (nama, nilai, dll) |
| **Template Generation** | Auto-generate template HTML/CSS dari analisis AI |
| **Preview & Validation** | Preview hasil deteksi, guru bisa koreksi |
| **Save as Template** | Simpan sebagai template reusable |

### 2.4 Merge Fields (Auto-Fill Data)
| Merge Field | Sumber | Contoh Output |
|-------------|--------|---------------|
| `{{nama_siswa}}` | Tabel `students` | "Ahmad Fauzi" |
| `{{nisn}}` | Tabel `students` | "0012345678" |
| `{{kelas}}` | Tabel `classes` | "X IPA 1" |
| `{{semester}}` | Tabel `semesters` | "Ganjil" |
| `{{tahun_ajaran}}` | Tabel `academic_years` | "2025/2026" |
| `{{nilai_[mapel]}}` | Tabel `grades` (kalkulasi) | "85" |
| `{{predikat_[mapel]}}` | Kalkulasi dari nilai | "BSH" |
| `{{deskripsi_[mapel]}}` | AI-generated atau manual | "Ananda menunjukkan..." |
| `{{total_hadir}}` | Tabel `attendance_v2` | "120" |
| `{{total_izin}}` | Tabel `attendance_v2` | "3" |
| `{{total_sakit}}` | Tabel `attendance_v2` | "5" |
| `{{total_alpha}}` | Tabel `attendance_v2` | "0" |
| `{{ranking}}` | Kalkulasi | "5 dari 32" |
| `{{catatan_wali}}` | Input manual | "Ahmad menunjukkan..." |
| `{{nama_sekolah}}` | `rapor_config` | "SMA Negeri 1..." |
| `{{kepala_sekolah}}` | `rapor_config` | "Dr. Budi S.Pd" |
| `{{wali_kelas}}` | Input / auto | "Ibu Siti S.Pd" |
| `{{tanggal_terbit}}` | Auto | "15 Juni 2026" |
| `{{logo_sekolah}}` | `rapor_config` | Base64 image |
| `{{qr_code}}` | Auto-generated | QR verifikasi keaslian |

### 2.5 Editor Halaman Penuh (Full-Page Editor)
| Fitur | Detail |
|-------|--------|
| **WYSIWYG Editor** | Edit template rapor langsung di browser |
| **Drag & Drop** | Pindahkan elemen (tabel, teks, logo, tanda tangan) |
| **Resize Elements** | Ubah ukuran kolom, baris, font |
| **Insert Merge Field** | Toolbar khusus untuk insert `{{field}}` |
| **Page Break Control** | Atur page break manual |
| **Preview Mode** | Toggle antara edit mode dan preview mode |
| **Zoom Controls** | Zoom in/out untuk presisi |
| **Undo/Redo** | History pengeditan |
| **Multi-Page** | Navigasi antar halaman rapor |
| **A4 Layout** | Presisi layout A4 (210×297mm) |

### 2.6 AI Features
| Fitur | Detail |
|-------|--------|
| **Auto Deskripsi Capaian** | AI generate deskripsi naratif per mapel berdasarkan nilai, TP, dan capaian |
| **Smart Layout Detection** | AI analisis format rapor yang di-upload (OCR + vision) |
| **Bulk Generation** | AI generate deskripsi untuk seluruh siswa sekaligus |
| **Template Suggestion** | AI sarankan template berdasarkan jenjang & kurikulum |
| **Grammar Check** | AI cek tata bahasa deskripsi |
| **Personalized Description** | AI sesuaikan kalimat berdasarkan gender, prestasi, dan kebutuhan siswa |
| **Morphe Integration** | Tanya Morphe AI untuk revisi/generate deskripsi |

### 2.7 Ekspor & Distribusi
- **PDF individual**: 1 siswa = 1 file PDF (A4, print-ready)
- **PDF batch**: Semua siswa 1 kelas = 1 file multi-page
- **Print-ready**: Layout A4, margin standar cetak (2cm/2.5cm)
- **Share via Portal**: Integrasi dengan Portal Orang Tua (link/QR)
- **QR Code Verifikasi**: QR unik per rapor untuk validasi keaslian
- **Watermark**: Opsi watermark "DRAFT" atau custom

---

## 3. Arsitektur Teknis

### 3.1 Database Schema

```sql
-- Tabel konfigurasi rapor per sekolah/user
CREATE TABLE rapor_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  school_name TEXT NOT NULL DEFAULT '',
  school_address TEXT DEFAULT '',
  school_npsn TEXT DEFAULT '',
  school_logo_url TEXT DEFAULT '',
  principal_name TEXT DEFAULT '',
  principal_nip TEXT DEFAULT '',
  city_name TEXT DEFAULT '',
  curriculum_type TEXT DEFAULT 'merdeka', -- 'merdeka' | 'k13' | 'custom'
  -- Kurikulum Merdeka specific
  phase TEXT DEFAULT '', -- Fase A/B/C/D/E/F
  -- Predikat ranges (customizable)
  predicate_ranges JSONB DEFAULT '{"SB":[90,100],"BSH":[75,89],"MB":[60,74],"BB":[0,59]}',
  -- Template settings
  default_template_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Tabel template rapor (termasuk hasil OCR/AI import)
CREATE TABLE rapor_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL DEFAULT 'Template Baru',
  description TEXT DEFAULT '',
  template_type TEXT DEFAULT 'merdeka', -- 'merdeka' | 'k13' | 'custom_ocr'
  -- Template content (HTML/CSS)
  html_content TEXT DEFAULT '',
  css_content TEXT DEFAULT '',
  -- Layout metadata (AI-detected or manual)
  layout_metadata JSONB DEFAULT '{}',
  -- Merge fields mapping
  merge_fields JSONB DEFAULT '[]',
  -- Source (for OCR-imported templates)
  source_type TEXT DEFAULT 'builtin', -- 'builtin' | 'ocr_import' | 'manual'
  source_file_url TEXT DEFAULT '',
  -- Page settings
  page_size TEXT DEFAULT 'A4',
  page_orientation TEXT DEFAULT 'portrait',
  margins JSONB DEFAULT '{"top":20,"right":20,"bottom":20,"left":25}',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabel data rapor per siswa per semester
CREATE TABLE rapor_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  semester_id UUID REFERENCES semesters(id) ON DELETE CASCADE NOT NULL,
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE NOT NULL,
  template_id UUID REFERENCES rapor_templates(id) ON DELETE SET NULL,
  
  -- Kurikulum Merdeka: Projek P5
  p5_projects JSONB DEFAULT '[]',
    -- [{theme: "...", dimensions: ["Beriman","Gotong Royong"], grade: "BSH", description: "..."}]
  
  -- Ekstrakurikuler
  extracurriculars JSONB DEFAULT '[]',
    -- [{name: "Pramuka", grade: "A/SB", description: "..."}]
  
  -- Catatan
  teacher_notes TEXT DEFAULT '',
  homeroom_teacher_name TEXT DEFAULT '',
  
  -- Ranking snapshot
  class_rank INTEGER,
  total_students INTEGER,
  average_score NUMERIC(5,2),
  
  -- Status workflow
  status TEXT DEFAULT 'draft', -- 'draft' | 'review' | 'finalized' | 'published'
  finalized_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  finalized_by UUID,
  
  -- QR verification
  verification_code TEXT UNIQUE,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, semester_id)
);

-- Deskripsi capaian per mata pelajaran per siswa
CREATE TABLE rapor_subject_descriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rapor_entry_id UUID REFERENCES rapor_entries(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
  
  -- Nilai
  knowledge_score NUMERIC(5,2),    -- Nilai pengetahuan/intrakurikuler
  skill_score NUMERIC(5,2),        -- Nilai keterampilan (opsional)
  final_score NUMERIC(5,2),        -- Nilai akhir
  
  -- Kurikulum Merdeka
  predicate TEXT,                    -- BB/MB/BSH/SB
  capaian_pembelajaran TEXT DEFAULT '', -- Deskripsi CP
  tujuan_pembelajaran JSONB DEFAULT '[]', -- [{tp: "...", achieved: true}]
  
  -- Deskripsi naratif
  description TEXT DEFAULT '',       -- Deskripsi capaian (AI atau manual)
  description_source TEXT DEFAULT 'manual', -- 'manual' | 'ai_generated' | 'template'
  
  -- Refleksi guru
  teacher_reflection TEXT DEFAULT '',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(rapor_entry_id, subject_id)
);

-- RLS
ALTER TABLE rapor_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE rapor_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE rapor_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE rapor_subject_descriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own rapor_config"
  ON rapor_config FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users manage own rapor_templates"
  ON rapor_templates FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users manage own rapor_entries"
  ON rapor_entries FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users manage own rapor_subject_descriptions"
  ON rapor_subject_descriptions FOR ALL TO authenticated
  USING (
    rapor_entry_id IN (
      SELECT id FROM rapor_entries WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    rapor_entry_id IN (
      SELECT id FROM rapor_entries WHERE user_id = auth.uid()
    )
  );
```

### 3.2 Alur Lengkap

```
┌─────────────────────────────────────────────────────────────┐
│                    RAPOR ONLINE FLOW                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. SETUP                                                    │
│     ├── Konfigurasi identitas sekolah                       │
│     ├── Pilih kurikulum (Merdeka/K13)                       │
│     └── Setup predikat ranges                               │
│                                                              │
│  2. TEMPLATE                                                 │
│     ├── Pilih template bawaan (Merdeka/K13)                 │
│     ├── ATAU: Import format kustom                          │
│     │    ├── Upload PDF/Image format rapor sekolah           │
│     │    ├── OCR → Ekstraksi teks & layout                  │
│     │    ├── AI → Analisis struktur & detect fields          │
│     │    ├── Preview → Koreksi deteksi AI                   │
│     │    └── Save → Template reusable                       │
│     └── Edit template di Full-Page Editor                   │
│          ├── WYSIWYG editing                                │
│          ├── Insert merge fields {{field}}                   │
│          ├── Adjust layout, fonts, spacing                  │
│          └── Preview with sample data                       │
│                                                              │
│  3. GENERATE                                                 │
│     ├── Pilih Kelas + Semester                              │
│     ├── System auto-fetch: nilai, presensi, ranking         │
│     ├── Auto-populate rapor_entries                          │
│     └── Auto-fill merge fields                              │
│                                                              │
│  4. REVIEW & EDIT                                            │
│     ├── Review per siswa                                    │
│     │    ├── Edit deskripsi capaian (manual/AI)             │
│     │    ├── Tambah P5 projects                             │
│     │    ├── Tambah ekstrakurikuler                         │
│     │    ├── Tulis catatan wali kelas                       │
│     │    └── AI: Bulk generate deskripsi                    │
│     └── Preview rapor final (A4 layout)                     │
│                                                              │
│  5. FINALIZE                                                 │
│     ├── Lock data (snapshot)                                │
│     ├── Generate QR verification code                       │
│     └── Status: draft → finalized                           │
│                                                              │
│  6. DISTRIBUTE                                               │
│     ├── Export PDF (individual/batch)                        │
│     ├── Share via Portal Orang Tua                          │
│     └── Print-ready output                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Komponen Frontend

| Komponen | Deskripsi |
|----------|-----------|
| `RaporConfigForm` | Form konfigurasi identitas sekolah, kurikulum, predikat |
| `RaporTemplateManager` | Kelola template: list, create, import, edit, delete |
| `RaporTemplateEditor` | **Full-page WYSIWYG editor** untuk template rapor |
| `RaporMergeFieldToolbar` | Toolbar insert merge fields `{{field}}` |
| `RaporOCRImport` | Import format rapor via OCR + AI analysis |
| `RaporAIDescriptionGenerator` | Bulk generate deskripsi capaian per mapel |
| `RaporGenerator` | Halaman utama: pilih kelas → generate → review |
| `RaporEntryEditor` | Editor per siswa: P5, ekskul, catatan, deskripsi |
| `RaporPreview` | Preview rapor format A4 (HTML → PDF) |
| `RaporBatchExport` | Ekspor batch semua siswa per kelas |
| `RaporSubjectTable` | Tabel nilai per mapel dalam rapor |
| `RaporAttendanceSummary` | Rekap presensi dalam format rapor |
| `RaporP5Section` | Section Projek Penguatan Profil Pelajar Pancasila |
| `RaporQRVerification` | QR code verifikasi keaslian rapor |

### 3.4 Edge Functions

| Function | Deskripsi |
|----------|-----------|
| `rapor-ai-description` | Generate deskripsi capaian AI (Groq API) |
| `rapor-ocr-process` | OCR processing via vision model |
| `rapor-ai-layout` | AI layout analysis dari OCR result |
| `rapor-verify` | Verifikasi QR code keaslian rapor |

### 3.5 OCR + AI Import Pipeline

```
1. User upload PDF/Image format rapor sekolah
2. Frontend → Edge Function `rapor-ocr-process`
   └── Vision model (Llama 4 Scout) analisis gambar
   └── Return: detected text, bounding boxes, layout structure
3. Frontend → Edge Function `rapor-ai-layout`
   └── Input: OCR result + original image
   └── AI analisis:
       ├── Detect header area (logo, nama sekolah)
       ├── Detect student info fields
       ├── Detect grade tables (kolom, baris)
       ├── Detect signature areas
       ├── Detect merge-able fields
       └── Generate HTML/CSS template
   └── Return: template HTML + merge field positions
4. Frontend: Preview hasil deteksi
   └── Guru koreksi jika ada kesalahan deteksi
   └── Map merge fields ke data SIPENA
5. Save as reusable template
```

### 3.6 PDF Generation

Menggunakan **jsPDF + jspdf-autotable** (sudah terinstall):
- Render dari HTML template dengan merge fields resolved
- Support logo sekolah (base64 embed)
- Multi-page layout dengan page break control
- QR code embed per halaman
- Watermark support (DRAFT / RAHASIA)
- Print-ready: A4 margins sesuai standar (2cm/2.5cm)

---

## 4. Halaman & Navigasi

```
/reports/rapor                       → Dashboard rapor (pilih kelas + semester)
/reports/rapor/config                → Konfigurasi identitas sekolah
/reports/rapor/templates             → Kelola template rapor
/reports/rapor/templates/editor/:id  → Full-page template editor
/reports/rapor/templates/import      → Import format rapor (OCR + AI)
/reports/rapor/generate/:classId     → Generate & review rapor per kelas
/reports/rapor/preview/:entryId      → Preview individual siswa
/reports/rapor/batch/:classId        → Batch export per kelas
```

Integrasi navigasi:
- Tambah card "Rapor Online" di halaman `/reports` (Reports.tsx)
- Icon: `GraduationCap` atau `BookOpen`
- Badge: "Kurikulum Merdeka"

---

## 5. Predikat Kurikulum Merdeka

| Rentang | Predikat | Keterangan |
|---------|----------|------------|
| 90-100 | SB | Sangat Berkembang |
| 75-89 | BSH | Berkembang Sesuai Harapan |
| 60-74 | MB | Mulai Berkembang |
| < 60 | BB | Belum Berkembang |

> Rentang predikat bisa dikustomisasi per user di `rapor_config.predicate_ranges`.

---

## 6. Auto-Generate Deskripsi Capaian (AI)

### Template-based (Fallback tanpa AI)
```
SB: "Ananda [nama] menunjukkan capaian yang sangat baik pada [mapel]. 
     [Nama] mampu [TP yang tercapai] dengan sangat konsisten."
BSH: "Ananda [nama] menunjukkan capaian yang baik pada [mapel]. 
      [Nama] mampu [TP yang tercapai] dengan baik."
MB: "Ananda [nama] menunjukkan perkembangan yang cukup pada [mapel]. 
     [Nama] perlu meningkatkan [TP yang belum tercapai]."
BB: "Ananda [nama] masih memerlukan bimbingan lebih lanjut pada [mapel]. 
     [Nama] perlu pendampingan dalam [TP yang belum tercapai]."
```

### AI-Powered (via Edge Function + Groq)
- Input: nama siswa, mapel, nilai detail per tugas, TP, gender
- Output: kalimat deskripsi naratif yang dipersonalisasi
- Bulk mode: generate untuk seluruh siswa sekaligus
- Review: guru bisa edit/regenerate per siswa

---

## 7. Fase Implementasi

| Fase | Scope | Estimasi |
|------|-------|----------|
| **1** | Database schema + config form + template bawaan Merdeka | 2-3 iterasi |
| **2** | Generate rapor (auto-populate dari data existing) | 2-3 iterasi |
| **3** | Editor per siswa (P5, ekskul, catatan, deskripsi) | 2-3 iterasi |
| **4** | Full-page template editor (WYSIWYG + merge fields) | 3-4 iterasi |
| **5** | OCR + AI import pipeline (upload → detect → template) | 3-4 iterasi |
| **6** | AI deskripsi capaian (edge function + bulk generate) | 2-3 iterasi |
| **7** | Preview rapor (HTML layout A4) + QR verification | 2-3 iterasi |
| **8** | PDF export (individual + batch) + watermark | 2 iterasi |
| **9** | Integrasi Portal Orang Tua + share rapor | 1-2 iterasi |
| **10** | Polish: undo/redo editor, drag-drop, zoom, responsif | 2-3 iterasi |

---

## 8. Dependensi

- ✅ `jspdf` — sudah terinstall
- ✅ `jspdf-autotable` — sudah terinstall
- ✅ `qrcode.react` — sudah terinstall
- ✅ `react-markdown` — sudah terinstall
- ✅ `html2canvas` — sudah terinstall
- ✅ `konva` + `react-konva` — sudah terinstall (untuk canvas editor)
- ✅ Data nilai, presensi, ranking — sudah ada
- ✅ Portal Orang Tua — sudah ada infrastruktur
- ✅ Morphe AI (Groq) — sudah ada edge function
- 🆕 Perlu: rich text editor (atau custom implementation)

---

## 9. Keamanan

- RLS ketat: hanya user pemilik data yang bisa akses
- Rapor `finalized` tidak bisa diedit (harus un-finalize dulu)
- QR verification code unique per rapor entry
- PDF tidak menyertakan data sensitif selain yang diperlukan
- Share via portal menggunakan token/link yang sudah ada
- OCR processing dilakukan server-side (edge function)
- AI API key tersimpan di Supabase Secrets

---

## 10. Catatan Penting

- **Kurikulum Merdeka** sebagai default (bukan K13)
- Predikat menggunakan BB/MB/BSH/SB (bukan A/B/C/D)
- Projek P5 (Profil Pelajar Pancasila) wajib ada
- Capaian Pembelajaran (CP) dan Tujuan Pembelajaran (TP) harus ada
- Template editor harus presisi A4 untuk hasil cetak profesional
- OCR + AI import memungkinkan sekolah menggunakan format rapor mereka sendiri
- Merge fields memastikan data otomatis terisi dari database SIPENA
- Semua data rapor tersimpan di Supabase eksternal (bukan Lovable Cloud)
