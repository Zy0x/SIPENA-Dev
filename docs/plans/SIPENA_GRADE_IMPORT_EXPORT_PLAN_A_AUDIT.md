# Audit Plan A Export/Import Nilai SIPENA

Tanggal audit: 2026-05-08
Repo: Web-Modder/tessipena3-f7e2575d
Branch: main
Sumber spesifikasi: GitHub Issue #3 beserta 5 komentar.

## Ringkasan Plan A

Plan A final mengarahkan fitur Export/Import Nilai menjadi sistem import terkendali, bukan sekadar upload Excel. Invariant utama:

- Nama produksi di UI, toast, error, template, workbook, dan nama file export adalah SIPENA.
- Import harus selalu melalui preview rencana import sebelum ada perubahan database.
- Nilai lama tidak boleh ditimpa tanpa konfirmasi eksplisit.
- BAB/tugas baru tidak boleh dibuat otomatis tanpa konfirmasi.
- Mapping ambigu harus diblokir atau diminta konfirmasi manual.
- Flow input nilai lama harus tetap berjalan sebagai fallback sampai engine baru siap.

## 1. File Yang Akan Disentuh

Untuk audit ini, file runtime tidak diubah. File yang ditambahkan hanya:

- `docs/plans/SIPENA_GRADE_IMPORT_EXPORT_PLAN_A_AUDIT.md`

Kandidat file implementasi tahap berikutnya:

- `apps/frontend/src/pages/Grades.tsx`
- `apps/frontend/src/components/import/ImportGradesDialog.tsx`
- `apps/frontend/src/components/import/OCRImportDialog.tsx`
- `apps/frontend/src/components/grades/SpreadsheetTable.tsx`
- `apps/frontend/src/hooks/useGrades.ts`
- `apps/frontend/src/hooks/useGradesWithUndo.ts`
- `apps/frontend/src/hooks/useStudents.ts`
- `apps/frontend/src/hooks/useClasses.ts`
- `apps/frontend/src/hooks/useSubjects.ts`
- `apps/frontend/src/hooks/useChapters.ts`
- `apps/frontend/src/hooks/useAssignments.ts`
- `apps/frontend/src/lib/gradeImport/*` untuk modul baru parser/exporter/import plan/executor.
- `package.json` hanya jika dependency atau script verifikasi perlu disesuaikan.

## 2. Dependency Excel Yang Tersedia

Dependency Excel sudah tersedia di root `package.json`:

- `xlsx` versi `^0.18.5`
- `xlsx-js-style` versi `^1.2.0`

Kondisi saat audit:

- `ImportGradesDialog.tsx` masih memakai `xlsx` untuk membaca dan menulis workbook sederhana.
- Plan A dapat memakai `xlsx-js-style` untuk workbook resmi yang perlu styling, kolom hidden, data validation ringan, dan sheet metadata.
- Tidak perlu menambah dependency Excel baru pada tahap awal.

## 3. Alur Import Lama Saat Ini

Alur Excel lama di `ImportGradesDialog.tsx`:

1. Guru upload `.xlsx`, `.xls`, atau `.csv`.
2. Komponen membaca sheet pertama dengan `XLSX.read` dan `sheet_to_json(..., { header: 1 })`.
3. Baris pertama dianggap header.
4. Kolom nama dideteksi dari header berisi `nama`.
5. Kolom tugas dipetakan otomatis jika header sama atau mengandung nama assignment yang sudah ada.
6. Siswa dicocokkan dengan `student.name` memakai exact/lowercase/includes sederhana.
7. Nilai diparse dengan `parseFloat`, lalu dibulatkan dan di-clamp ke rentang 0-100.
8. Preview hanya menampilkan jumlah siswa cocok/tidak cocok dan jumlah nilai.
9. Tombol Import melakukan loop langsung ke Supabase `grades.upsert(...)`.

Catatan risiko dari alur lama:

- Upsert lama belum memakai ImportPlan bertahap.
- Konflik nilai lama vs nilai Excel belum dipreview.
- STS/SAS belum menjadi bagian import Excel lama.
- BAB/tugas baru tidak ditangani.
- Siswa ambigu masih bisa salah cocok karena matching `includes`.
- NISN hanya dibawa sebagai props, tetapi belum dipakai sebagai prioritas matching.
- Semester aktif belum dikirim eksplisit dari dialog lama ke upsert langsung.

Alur OCR lama:

1. `OCRImportDialog.tsx` hanya menghasilkan rows hasil input/edit OCR.
2. `Grades.tsx` menerima `onDataReady`.
3. Untuk tipe nilai, kode langsung mencocokkan siswa dengan nama dan menyimpan nilai assignment memakai `handleSaveGrade`.
4. OCR saat ini juga belum punya ImportPlan/conflict resolver.

## 4. Fungsi Dan Hook Yang Bisa Dipakai Ulang

Sumber data dan fungsi yang bisa dipakai ulang:

- `useClasses()` untuk konteks kelas aktif dan `academic_year_id`.
- `useStudents(classId)` untuk daftar siswa, nama, NISN, dan `student_id`.
- `useSubjects(classId)` untuk mapel aktif dan KKM.
- `useChapters(subjectId)` untuk struktur BAB semester aktif.
- `useAllAssignments(subjectId)` untuk semua tugas mapel dalam semester aktif.
- `useGrades(subjectId, classId)` dan `useGradesWithUndo(subjectId, classId)` untuk pembacaan nilai dan invalidasi query.
- `getScopedGradeValue(...)` untuk mengambil nilai sesuai scope semester.
- `calculateStudentSubjectReport(...)` sebagai source of truth nilai Rapor, bukan untuk import mentah tetapi penting untuk preview dampak nilai.
- `SpreadsheetTable` menyediakan struktur tampilan web aktif: siswa, BAB, tugas, STS, SAS, Rapor.
- `ResponsiveStudio` components dapat dipakai untuk modal mobile/tablet agar fallback import lama tidak rusak.

Hook write yang tidak boleh langsung dipakai oleh parser tahap awal:

- `useGrades().upsertGrade`
- `useGradesWithUndo().saveGradeWithUndo`
- `useChapters().createBulkChapters`
- `useAssignments().createBulkAssignments`

Hook tersebut baru boleh dipakai pada fase executor setelah ImportPlan, resolusi konflik, validasi ulang, dan konfirmasi final selesai.

## 5. Risiko Implementasi

Risiko P0:

- Nilai lama tertimpa karena import langsung memakai upsert.
- Import tidak membawa `academic_year_id`/`semester_id` yang sama dengan halaman Input Nilai.
- Assignment/STS/SAS duplikat jika unique scope database belum kuat untuk `assignment_id = null`.
- Hidden metadata workbook dipercaya tanpa validasi context, hash, atau signature.
- Mapping siswa ambigu akibat nama sama, NISN duplikat, typo, atau OCR buruk.

Risiko P1:

- Template resmi tidak sinkron dengan struktur web saat ini.
- Kolom derived seperti KKM, Rapor, Predikat, Status, Ranking terbaca sebagai nilai mentah.
- Nilai 0 hilang karena dianggap empty.
- Sel kosong disalahartikan sebagai perintah hapus.
- Header multi-baris, merged cells, dan workbook bebas tidak terbaca stabil.
- File dari kelas/mapel/semester berbeda tidak terblokir jelas.

Risiko P2:

- Modal menjadi terlalu padat di mobile jika preview konflik besar ditampilkan sebagai tabel penuh.
- Parsing file besar membuat browser mobile reload.
- Pesan error tanpa kode membuat debugging import sulit.
- AI mapping berisiko mengirim data sensitif jika tidak dibatasi dan opt-in.

## 6. Strategi Menjaga Fallback

Strategi aman untuk tahap implementasi:

1. Tambahkan dialog baru atau mode baru secara berdampingan, jangan hapus `ImportGradesDialog` lama.
2. Jadikan import v2 feature-gated sampai parser dan preview stabil.
3. Parser hanya menghasilkan `ImportPlan`; tidak ada write database pada tahap analyze/preview.
4. Executor dipisah dari parser dan hanya menerima ImportPlan yang sudah dikonfirmasi.
5. Default update mode adalah `Isi nilai kosong saja`.
6. BAB/tugas baru hanya menjadi `structureSuggestion` sampai guru memilih aksi.
7. Mapping ambigu siswa/kolom harus berstatus blocked atau needs_confirmation.
8. Query invalidation dan hook save lama tetap dipakai untuk input manual di `SpreadsheetTable`.
9. OCR diarahkan ke ImportPlan preview sebelum digunakan untuk menyimpan nilai.
10. Semua copy produksi memakai SIPENA; istilah nama lama project tidak boleh masuk UI, toast, workbook, atau nama file export.

## Catatan Implementasi Bertahap

Tahap paling aman setelah audit:

1. Buat modul `apps/frontend/src/lib/gradeImport/` berisi tipe, normalizer, parser header, exporter template, dan builder ImportPlan.
2. Export template resmi dari struktur aktif web: siswa, NISN, BAB, tugas, STS, SAS, manifest, students, structure, column map.
3. Hubungkan dialog baru ke `Grades.tsx` tanpa menghapus import lama.
4. Tambahkan preview konflik siswa, kolom, nilai lama, dan aksi default.
5. Tambahkan executor belakangan dengan RPC/batch log/idempotency, bukan direct upsert dari browser.

## Verifikasi Audit

Perintah yang dijalankan dari branch `main`:

- `npm run lint`: gagal pada debt lint existing repo-wide, terutama `no-explicit-any`, `prefer-const`, empty block, dan aturan React refresh di banyak file lama. Audit ini tidak menambah file runtime yang terkena lint tersebut.
- `npm run typecheck`: gagal pada error existing `apps/frontend/src/pages/GradeReports.tsx(396,7)` karena `Chapter[]` belum memenuhi `ReportChapterRecord[]` yang membutuhkan `subject_id`.
- `npm run build`: berhasil setelah dependency dipasang sesuai `package-lock.json`. Build memberi warning existing tentang env Supabase production, dynamic/static import, dan chunk besar.

Catatan environment:

- Worktree audit awalnya tidak memiliki `node_modules`, sehingga lint/typecheck/build pertama gagal karena binary/dependency tidak tersedia.
- Setelah `npm ci --no-audit --prefer-offline`, dependency `xlsx` tersedia sesuai `package.json` dan `package-lock.json`, lalu build berhasil.
