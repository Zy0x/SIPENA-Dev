# Action Plan Implementasi Penyempurnaan Ekspor Presensi WYSIWYG

## 1. Ringkasan Eksekutif

Dokumen ini merumuskan rencana implementasi detail untuk menyempurnakan fitur Ekspor Presensi pada SIPENA dengan target utama:

1. Live preview identik dengan hasil akhir cetak/PDF.
2. Seluruh kolom presensi muat rapi dalam 1 halaman lebar sesuai ukuran kertas yang dipilih.
3. Page-break vertikal aman, tanpa baris tabel atau blok informasi yang terpotong di tengah halaman.
4. Keterangan libur/cuti lebih rapi melalui smart grouping tanggal berurutan dengan deskripsi yang sama.

Keputusan arsitektur yang dipakai dalam rencana ini:

1. Browser print preview adalah gold standard teknis.
2. Renderer HTML/CSS cetak menjadi source of truth tunggal untuk preview dan hasil PDF.
3. One-click PDF tetap didukung, tetapi basis rendernya mengikuti dokumen print yang sama.
4. Strategi auto-fit mengutamakan penyusutan tipografi, padding, dan lebar kolom sampai batas aman, bukan memecah kolom ke beberapa halaman.
5. Smart grouping libur mencakup hari libur custom dan nasional yang tampil pada area keterangan.

Hasil akhir yang dituju bukan sekadar "mirip", melainkan model render yang sama antara:

1. Live preview di layar.
2. Konten tersembunyi yang dipakai saat `window.print()` atau print iframe.
3. Konversi PDF satu klik berbasis dokumen print yang sama.

## 2. Kondisi Kode Saat Ini

### 2.1 File yang paling relevan

File utama yang perlu menjadi fokus implementasi:

1. [src/pages/Attendance.tsx](/E:/Data/GitHub/tessipena2/src/pages/Attendance.tsx)
2. [src/components/export/AttendanceExportPreviewV2.tsx](/E:/Data/GitHub/tessipena2/src/components/export/AttendanceExportPreviewV2.tsx)
3. [src/lib/attendanceExport.ts](/E:/Data/GitHub/tessipena2/src/lib/attendanceExport.ts)
4. [src/lib/reportExportLayoutV2.ts](/E:/Data/GitHub/tessipena2/src/lib/reportExportLayoutV2.ts)
5. [src/index.css](/E:/Data/GitHub/tessipena2/src/index.css)
6. [src/components/export/ExportStudioDialog.tsx](/E:/Data/GitHub/tessipena2/src/components/export/ExportStudioDialog.tsx)

File tambahan yang kemungkinan perlu disentuh:

1. [src/lib/exportEngine/pngEngine.ts](/E:/Data/GitHub/tessipena2/src/lib/exportEngine/pngEngine.ts)
2. [src/lib/exportEngine/sharedMetrics.ts](/E:/Data/GitHub/tessipena2/src/lib/exportEngine/sharedMetrics.ts)
3. Opsional baru: `src/lib/attendancePrintLayout.ts`
4. Opsional baru: `src/lib/attendanceHolidayGrouping.ts`
5. Opsional baru: `src/components/export/AttendancePrintDocument.tsx`

### 2.2 Temuan arsitektur

Berdasarkan inspeksi kode:

1. `Attendance.tsx` masih menampung terlalu banyak tanggung jawab: persiapan data preview, pemilihan kolom, logika PDF native `jsPDF`, logika PDF raster berbasis `html2canvas`, dan PNG export.
2. `AttendanceExportPreviewV2.tsx` sudah cukup maju sebagai renderer DOM/CSS, tetapi masih berperan ganda sebagai preview visual dan pseudo-print renderer tanpa kontrak layout yang terpisah dan eksplisit.
3. PDF presensi saat ini masih memiliki dua jalur:
   1. `handleExportPDFV2`: render ulang tabel ke `jsPDF/autoTable`.
   2. `handleExportPDFPreviewV2`: render DOM lalu raster ke PDF.
4. Ketika preview dan export punya dua jalur render berbeda, sinkronisasi absolut sulit dipertahankan.
5. `computeAttendanceColumnLayout` saat ini baru menyelesaikan distribusi lebar kolom secara heuristik, tetapi belum menjadi layout contract yang lengkap untuk:
   1. font final,
   2. padding final,
   3. row-height final,
   4. tinggi blok ringkasan,
   5. page-break final,
   6. grouping libur final.
6. `@media print` di `index.css` sudah ada, namun masih bersifat adaptasi dari preview yang ada, belum menjadi sistem print-first yang benar-benar authoritative.

### 2.3 Implikasi teknis

Masalah utama yang harus diperbaiki bukan sekadar styling, tetapi pemisahan sumber kebenaran layout. Selama preview dan PDF dibangun dengan aturan layout berbeda, deviasi akan terus muncul pada:

1. wrapping nama siswa,
2. tinggi baris,
3. titik page-break,
4. posisi tanda tangan,
5. warna/header yang berubah di print,
6. margin fisik terhadap ukuran kertas.

## 3. Sasaran Produk dan Acceptance Criteria

### 3.1 Sasaran utama

1. Preview tampak sama dengan hasil `Ctrl+P` browser.
2. File PDF akhir mengikuti tampilan print document yang sama.
3. Pengguna tidak perlu menebak apakah elemen akan pindah halaman atau terpotong saat diekspor.
4. Dokumen presensi tetap rapi pada data kecil maupun besar.

### 3.2 Acceptance criteria wajib

Sebuah implementasi dianggap selesai jika semua kondisi ini terpenuhi:

1. Saat mode PDF dipilih di Export Studio, preview menggunakan komposisi halaman yang sama dengan mode print.
2. Hasil `window.print()` dan hasil PDF satu klik menunjukkan:
   1. jumlah halaman yang sama,
   2. urutan baris yang sama,
   3. titik page-break yang sama,
   4. ringkasan/libur/catatan/tanda tangan di halaman yang sama.
3. Tidak ada `tr`, `td`, atau blok ringkasan yang terpotong di batas halaman.
4. Pada A4 dan F4 landscape, seluruh kolom yang dipilih tetap muat ke dalam 1 halaman lebar.
5. Untuk bulan dengan banyak siswa, sistem memecah halaman berdasarkan baris dengan aman.
6. Untuk rangkaian libur berurutan dengan deskripsi sama, output keterangan diringkas menjadi rentang tanggal.
7. Saat jumlah konten ringkasan terlalu banyak, sistem memindahkannya ke halaman yang valid tanpa overlap dengan tabel atau tanda tangan.

### 3.3 Definisi "pixel-perfect" dalam implementasi ini

Karena PDF satu klik kemungkinan tetap bergantung pada konversi dari dokumen print, definisi praktis pixel-perfect yang dipakai adalah:

1. preview layar adalah versi terskala dari dokumen print yang sama,
2. print browser adalah referensi final,
3. PDF satu klik dihasilkan dari dokumen print yang sama, bukan dari tabel yang digambar ulang lewat engine berbeda.

Dengan demikian, sinkronisasi dicapai lewat shared renderer, bukan lewat dua renderer yang diusahakan "mirip".

## 4. Keputusan Arsitektur

### 4.1 Prinsip arsitektur

Prinsip yang akan dipakai:

1. Print-first, preview-second.
2. Satu layout engine, banyak output.
3. Semua ukuran internal berasal dari satu kontrak layout.
4. Pemecahan halaman dilakukan pada level data/layout plan, bukan diserahkan sepenuhnya ke browser secara implisit.
5. Browser print tetap digunakan sebagai validator terakhir terhadap ukuran fisik.

### 4.2 Arsitektur target

Arsitektur target dibagi menjadi 4 lapisan:

1. `Data normalization`
   1. merakit dataset baris, sel, event, holiday, notes,
   2. menghitung total dan metadata,
   3. membentuk daftar holiday/event yang sudah dikelompokkan.
2. `Layout planning`
   1. menghitung lebar kolom final,
   2. menghitung font/padding/row-height final,
   3. memecah baris menjadi halaman aman,
   4. menentukan halaman mana yang berisi summary dan signature.
3. `Print document renderer`
   1. merender halaman HTML/CSS dengan ukuran kertas dan margin fisik,
   2. dipakai untuk live preview dan print.
4. `Export adapters`
   1. print browser adapter,
   2. one-click PDF adapter,
   3. PNG adapter.

### 4.3 Komponen dan modul target

Tambahan struktur yang direkomendasikan:

1. `src/lib/attendancePrintLayout.ts`
   1. source of truth untuk hitung layout plan,
   2. input: dataset + style + paper size + visible columns + signature,
   3. output: layout plan siap render.
2. `src/lib/attendanceHolidayGrouping.ts`
   1. utility grouping tanggal berurutan,
   2. reusable dan mudah diuji.
3. `src/components/export/AttendancePrintDocument.tsx`
   1. renderer print document final,
   2. menggantikan peran ganda `AttendanceExportPreviewV2` sebagai renderer utama.
4. `AttendanceExportPreviewV2.tsx`
   1. diubah menjadi wrapper preview shell,
   2. atau dilebur menjadi adapter yang hanya menskalakan `AttendancePrintDocument`.

## 5. Desain Data dan Interface

### 5.1 Model data baru yang disarankan

Tambahkan model eksplisit untuk layout plan:

```ts
type AttendanceSummarySection = {
  type: "legend" | "events" | "holidays" | "notes" | "signature";
  estimatedHeightPx: number;
};

type AttendanceHolidayGroup = {
  startDate: string;
  endDate: string;
  label: string;
  text: string;
};

type AttendancePrintPage = {
  key: string;
  pageNumber: number;
  totalPages: number;
  rowStart: number;
  rowEnd: number;
  showSummary: boolean;
  summarySections: AttendanceSummarySection[];
};

type AttendancePrintLayoutPlan = {
  paper: {
    key: ReportPaperSize;
    pageWidthMm: number;
    pageHeightMm: number;
    marginTopMm: number;
    marginRightMm: number;
    marginBottomMm: number;
    marginLeftMm: number;
    contentWidthMm: number;
    contentHeightMm: number;
  };
  table: {
    headerRowHeightsPx: [number, number];
    bodyRowHeightPx: number;
    widthsPx: Record<string, number>;
  };
  pages: AttendancePrintPage[];
  fit: {
    appliedScale: number;
    typographyMode: "base" | "shrunk-soft" | "shrunk-hard";
  };
};
```

Tujuannya agar preview, print, dan export tidak perlu menghitung ulang aturan layout masing-masing.

### 5.2 Model smart grouping holiday

Utility grouping harus bekerja dengan langkah berikut:

1. gabungkan sumber data libur:
   1. custom holiday bulan aktif,
   2. national holiday bulan aktif yang memang tampil di output.
2. normalisasi item menjadi:
   1. tanggal lokal,
   2. deskripsi final,
   3. tipe sumber.
3. urutkan berdasarkan tanggal naik.
4. lakukan group jika:
   1. deskripsi sama persis setelah normalisasi trimming,
   2. tanggal saling berurutan tanpa jeda.
5. format hasil:
   1. `20 Cuti bersama Hari Raya Idul Fitri`,
   2. `20-25 Cuti bersama Hari Raya Idul Fitri`,
   3. jika lintas bulan tidak mungkin terjadi karena dataset dibatasi bulan aktif.

Normalisasi minimal:

1. trim spasi ekstra,
2. samakan beberapa dash separator bila diperlukan,
3. pertahankan kapitalisasi asli jika tidak ada alasan kuat untuk mengubah.

## 6. Rencana Refactor Teknis

### 6.1 Tahap A - Pisahkan source of truth layout

Tujuan:

1. mengeluarkan kalkulasi layout dari `Attendance.tsx`,
2. mengurangi coupling antara UI halaman dengan engine ekspor.

Pekerjaan:

1. Pindahkan logika pembentukan dataset preview dari `Attendance.tsx` ke utility builder di `attendanceExport.ts` atau modul baru.
2. Tambahkan fungsi builder terstruktur, misalnya:
   1. `buildAttendancePrintDataset(...)`,
   2. `buildAttendancePrintLayoutPlan(...)`,
   3. `groupAttendanceHolidayRanges(...)`.
3. `Attendance.tsx` hanya menyuplai:
   1. data siswa,
   2. month days,
   3. attendance getter,
   4. holiday/event getter,
   5. config style,
   6. paper size,
   7. visible columns,
   8. signature config.

Hasil tahap ini:

1. perhitungan tidak lagi tersebar di halaman,
2. lebih mudah diuji unit,
3. lebih mudah dipakai ulang oleh preview, print, dan export.

### 6.2 Tahap B - Bangun print document renderer tunggal

Tujuan:

1. menjadikan satu komponen DOM sebagai sumber untuk preview dan print.

Pekerjaan:

1. Buat `AttendancePrintDocument.tsx` yang menerima:
   1. dataset final,
   2. layout plan final,
   3. signature draft final,
   4. flags render mode.
2. Komponen ini harus merender halaman dengan ukuran fisik berbasis mm yang dikonversi ke px secara konsisten.
3. Hilangkan logika layout heuristik dari komponen sebisa mungkin; komponen hanya consume `layout plan`.
4. `AttendanceExportPreviewV2.tsx` cukup:
   1. membungkus document dengan shell preview,
   2. memberi zoom/scale layar,
   3. tidak menghitung page-break baru.

Kontrak render mode yang disarankan:

1. `mode: "preview"`
2. `mode: "print"`
3. `mode: "capture"`

Perbedaannya hanya pada:

1. dekorasi shell preview,
2. shadow/border kertas,
3. hidden UI,
4. scaling.

### 6.3 Tahap C - Ganti jalur PDF agar mengikuti print document

Tujuan:

1. menghapus ketergantungan pada render ulang `jsPDF/autoTable` untuk presensi.

Pekerjaan:

1. Jadikan jalur `handleExportPDFPreviewV2` sebagai basis utama PDF.
2. Deprecate `handleExportPDFV2` yang menggambar ulang tabel dengan `jsPDF/autoTable`.
3. Implementasikan adapter print/PDF baru:
   1. render `AttendancePrintDocument`,
   2. mount ke container tersembunyi atau iframe,
   3. trigger print flow atau capture flow dari DOM yang sama.
4. Pertimbangkan dua mode ekspor PDF:
   1. `Print / Save as PDF` untuk absolut accuracy,
   2. `Quick download PDF` untuk unduh langsung dari DOM yang sama.

Catatan penting:

1. Jika tetap ingin PDF satu klik, hasil paling konsisten akan berasal dari dokumen print yang sama.
2. Jangan kembali membuat tabel PDF dengan engine lain, karena itu membuka deviasi baru.

### 6.4 Tahap D - Auto-fit lebar kolom yang lebih deterministik

Tujuan:

1. memastikan semua kolom yang dipilih muat dalam 1 halaman lebar.

Pekerjaan:

1. Tingkatkan `computeAttendanceColumnLayout` agar mendukung 3 tahap kompresi:
   1. shrink font table body/header dalam rentang aman,
   2. shrink padding dan row height,
   3. shrink width untuk kolom non-prioritas.
2. Tetapkan prioritas lebar kolom:
   1. `no` paling kecil dan stabil,
   2. `nisn` kecil namun tetap terbaca,
   3. `name` fleksibel, wrap multi-line,
   4. kolom tanggal tetap seragam,
   5. kolom rekap tetap sempit tapi konsisten.
3. Definisikan batas minimum aman:
   1. font body minimum,
   2. font header minimum,
   3. day cell width minimum,
   4. name width minimum,
   5. NISN width minimum.
4. Tambahkan hasil `fit mode` ke layout plan agar preview bisa menampilkan status bila dokumen sedang memakai kompresi agresif.

Strategi shrink yang dipakai:

1. hitung kebutuhan lebar awal,
2. jika overflow:
   1. turunkan font body/header sedikit,
   2. hitung ulang row/header height,
   3. kurangi padding horizontal,
   4. kecilkan kolom name dan nisn,
   5. kecilkan rekap,
   6. sebagai langkah terakhir kecilkan day width sampai batas minimum.

Bukan bagian rencana ini:

1. memecah kolom tanggal ke beberapa segmen horizontal secara default.

Hal itu sengaja dihindari karena spesifikasi meminta seluruh kolom presensi muat ke lebar 1 halaman.

### 6.5 Tahap E - Pagination vertikal aman

Tujuan:

1. mencegah baris atau blok konten terpotong di batas halaman.

Pekerjaan:

1. Hitung tinggi area tetap per halaman:
   1. banner,
   2. meta,
   3. tabel header,
   4. footer,
   5. reserve summary/signature bila halaman terakhir.
2. Hitung `rowsPerRegularPage` dan `rowsPerLastPage` berdasarkan tinggi final yang sudah dipengaruhi auto-fit.
3. Bangun page plan eksplisit sebelum render.
4. Jangan mengandalkan browser untuk memutus `tbody` secara otomatis.
5. Render tabel per halaman dengan subset row yang sudah dipastikan valid.

Aturan summary:

1. summary, holiday list, notes, dan signature hanya muncul di halaman terakhir jika muat.
2. bila tidak muat:
   1. pindahkan summary ke halaman baru,
   2. atau pecah summary menjadi beberapa blok halaman secara eksplisit jika dibutuhkan.

Aturan signature:

1. signature tidak boleh overlap dengan summary atau tabel,
2. signature boleh dipindah ke halaman baru bila ruang aman tidak cukup,
3. keputusan ini harus terjadi di layout planning, bukan setelah render.

### 6.6 Tahap F - Smart grouping untuk libur/cuti

Tujuan:

1. membuat area keterangan lebih hemat ruang dan lebih rapi.

Pekerjaan:

1. Tambahkan utility grouping yang menerima daftar libur bulan aktif.
2. Gabungkan hari nasional dan custom holiday yang tampil di output.
3. Kelompokkan tanggal yang:
   1. berurutan,
   2. deskripsinya sama.
4. Format teks hasil grouping:
   1. tanggal tunggal: `21 Libur Waisak`
   2. rentang: `20-25 Cuti bersama Hari Raya Idul Fitri`
5. Gunakan hasil ini di:
   1. preview,
   2. print,
   3. PDF,
   4. PNG.

Tambahan aturan:

1. event non-libur tidak otomatis digabung kecuali nanti memang diminta.
2. jika dua tanggal berurutan tetapi label berbeda sedikit, jangan dipaksa digabung.

### 6.7 Tahap G - Print CSS dan ukuran fisik

Tujuan:

1. menyamakan tampilan preview dengan print browser.

Pekerjaan:

1. Rapikan `@media print` di `index.css` agar hanya mengatur:
   1. reset shell aplikasi,
   2. aturan halaman,
   3. hide non-print UI,
   4. break avoidance,
   5. paper sizing.
2. Pindahkan detail styling dokumen ke komponen/inline style atau CSS khusus dokumen, bukan ke aturan print global yang terlalu umum.
3. Untuk `@page`, gunakan ukuran yang sinkron dengan pilihan kertas aktif.

Catatan penting:

1. `@page size` tidak bisa diubah dinamis penuh di semua browser lewat inline style biasa.
2. Jika perlu, gunakan class atau style tag terisolasi yang di-inject khusus saat print/capture untuk menyesuaikan A4/F4.
3. Preview layar harus mensimulasikan ukuran kertas dari `resolveReportPaperSize()` yang sama.

### 6.8 Tahap H - Integrasi Export Studio

Tujuan:

1. memastikan pengguna tetap memakai alur ekspor saat ini tanpa kebingungan.

Pekerjaan:

1. `ExportStudioDialog.tsx` tetap menjadi shell kontrol.
2. `renderPreview` untuk Presensi diubah agar memakai `AttendancePrintDocument` melalui preview wrapper.
3. Tambahkan indikator kecil di UI bila:
   1. auto-fit sedang aktif,
   2. dokumen sedang dalam mode shrink,
   3. sebagian konten summary pindah ke halaman berikutnya.
4. Pastikan perubahan style, paper size, visible columns, dan signature langsung memicu layout plan rebuild, bukan patching DOM manual.

## 7. Desain Algoritme Kunci

### 7.1 Algoritme auto-fit horizontal

Urutan algoritme:

1. Tentukan visible columns.
2. Tentukan paper content width berdasarkan paper size dan margin.
3. Hitung baseline widths:
   1. `no`,
   2. `name`,
   3. `nisn`,
   4. `day`,
   5. `rekap`.
4. Hitung overflow.
5. Jika overflow `<= 0`, gunakan baseline.
6. Jika overflow `> 0`, jalankan tahap kompresi:
   1. shrink typography soft,
   2. shrink padding,
   3. shrink name,
   4. shrink nisn,
   5. shrink rekap,
   6. shrink day cell.
7. Setelah setiap tahap:
   1. hitung ulang header height,
   2. hitung ulang body row height,
   3. validasi minimum readability.
8. Simpan hasil final ke layout plan.

### 7.2 Algoritme page planning vertikal

Urutan algoritme:

1. Hitung total tinggi halaman.
2. Kurangi margin, footer, banner, meta, dan table header.
3. Tentukan tinggi row final.
4. Tentukan tinggi summary sections final:
   1. legend,
   2. holidays,
   3. events,
   4. notes,
   5. signature.
5. Hitung berapa row yang muat pada:
   1. halaman biasa,
   2. halaman terakhir,
   3. halaman summary-only bila perlu.
6. Bentuk daftar halaman eksplisit.
7. Pastikan tiap halaman memiliki:
   1. daftar row,
   2. apakah ada summary,
   3. apakah ada signature,
   4. label continuation bila bukan halaman terakhir.

### 7.3 Algoritme holiday grouping

Urutan algoritme:

1. Ambil seluruh holiday pada bulan aktif.
2. Map menjadi struktur `{dayNumber, dateIso, description}`.
3. Sort ascending.
4. Inisialisasi group pertama.
5. Untuk setiap item berikutnya:
   1. jika `dayNumber === previous + 1` dan `description` sama, extend group,
   2. jika tidak, commit group lama lalu mulai group baru.
6. Setelah iterasi selesai, commit group terakhir.
7. Format hasil menjadi teks siap tampil.

## 8. Rencana Per File

### 8.1 `src/pages/Attendance.tsx`

Perubahan:

1. Kurangi beban file dengan memindahkan:
   1. dataset builder,
   2. layout builder,
   3. holiday grouping,
   4. PDF print adapter.
2. Hapus atau nonaktifkan jalur `handleExportPDFV2` berbasis `jsPDF/autoTable` untuk presensi.
3. Pertahankan satu jalur PDF final yang berbasis print document.
4. Ubah `renderAttendanceExportElement` agar merender komponen print document final, bukan komponen preview yang masih berhitung sendiri.
5. Pastikan export PNG dan PDF memakai renderer yang sama.

### 8.2 `src/components/export/AttendanceExportPreviewV2.tsx`

Perubahan:

1. Sederhanakan fungsi menjadi adapter preview.
2. Pindahkan logic `buildLayout()` keluar ke modul layout plan.
3. Biarkan komponen ini fokus pada:
   1. preview zoom/scaling,
   2. preview shell,
   3. visual framing halaman.
4. Jika lebih bersih, gantikan sepenuhnya dengan `AttendancePrintDocument + AttendancePreviewShell`.

### 8.3 `src/lib/attendanceExport.ts`

Perubahan:

1. Simpan fungsi builder dataset generik di sini atau pecah ke file baru.
2. Tambahkan utilitas:
   1. `buildAttendancePrintDataset`,
   2. `buildAttendanceSummaryBlocks`,
   3. `groupAttendanceHolidayRanges`.
3. `computeAttendanceColumnLayout` ditingkatkan agar mengembalikan metadata fit yang lebih lengkap.

### 8.4 `src/lib/reportExportLayoutV2.ts`

Perubahan:

1. Reuse fungsi paper size resolver dan style resolver yang sudah ada.
2. Jangan paksakan layout plan laporan nilai ke presensi bila bentuk dokumennya berbeda.
3. Bila perlu, ekstrak bagian umum:
   1. paper metrics,
   2. shared document style,
   3. margin helpers.

### 8.5 `src/index.css`

Perubahan:

1. Rapikan aturan `@media print`.
2. Tambahkan kelas print khusus presensi yang lebih terisolasi.
3. Hindari aturan yang terlalu mengandalkan `transform` patching setelah render bila layout plan sudah bisa menyelesaikan ukuran lebih awal.

### 8.6 `src/components/export/ExportStudioDialog.tsx`

Perubahan:

1. Pastikan preview capture ref mengarah ke dokumen print final.
2. Tambahkan informasi kualitas fit bila dibutuhkan.
3. Pastikan perubahan setting memicu rerender stabil tanpa race condition.

## 9. Strategi Export dan Push PDF

### 9.1 Strategi PDF yang direkomendasikan

Strategi final:

1. `Print Preview / Save as PDF`
   1. dijadikan mode paling akurat,
   2. memakai browser print secara langsung.
2. `Quick PDF`
   1. tetap satu klik dari aplikasi,
   2. namun sumber rendernya tetap dokumen print yang sama.

Implementasi realistis:

1. Tahap awal fokus pada keakuratan `preview <-> print`.
2. Setelah itu, rapikan `quick PDF`.
3. Bila quick PDF masih raster, hasilnya tetap akurat secara visual karena sumbernya sama.

### 9.2 Trade-off yang diterima

Trade-off yang secara sadar diterima:

1. PDF presensi bisa menjadi image-based bila quick PDF masih menggunakan capture DOM.
2. Ini diterima sementara karena prioritas utama adalah WYSIWYG absolut.
3. Jika nanti diperlukan text-selectable PDF, perlu proyek lanjutan dengan print-to-pdf pipeline yang lebih advance atau server-side renderer khusus.

## 10. Rencana Implementasi Bertahap

### Sprint 1 - Foundation

Target:

1. source of truth layout terpisah,
2. holiday grouping siap,
3. data builder lebih bersih.

Task:

1. ekstrak dataset builder dari `Attendance.tsx`,
2. buat utility grouping holiday,
3. buat layout plan builder dasar,
4. tambahkan unit tests untuk grouping dan fit basics.

### Sprint 2 - Unified print document

Target:

1. preview dan print memakai komponen render yang sama.

Task:

1. implement `AttendancePrintDocument`,
2. adapter `AttendanceExportPreviewV2` menjadi shell preview,
3. sinkronkan visible columns, paper size, auto-fit, style, dan signature,
4. validasi hasil preview dengan print browser.

### Sprint 3 - Replace PDF path

Target:

1. PDF tidak lagi memiliki renderer tabel terpisah.

Task:

1. deprecate jalur `jsPDF/autoTable` untuk presensi,
2. arahkan ekspor PDF ke dokumen print,
3. stabilkan flow quick PDF dan PNG,
4. rapikan handling multi-page capture.

### Sprint 4 - Polish dan hardening

Target:

1. hasil stabil pada edge cases besar.

Task:

1. tuning fit thresholds,
2. tuning summary splitting,
3. fine-tune print css,
4. regression checklist manual dan automated.

## 11. Testing Plan

### 11.1 Unit test

Tambahkan test untuk:

1. `groupAttendanceHolidayRanges`
   1. single day,
   2. consecutive same label,
   3. consecutive different label,
   4. mixed custom + national,
   5. empty data.
2. `computeAttendanceColumnLayout`
   1. A4 sedikit kolom,
   2. A4 banyak kolom,
   3. F4 banyak kolom,
   4. batas minimum day width,
   5. auto-fit shrink mode.
3. page planner
   1. satu halaman,
   2. dua halaman,
   3. summary muat di halaman terakhir,
   4. signature pindah ke halaman baru,
   5. notes panjang.

### 11.2 Manual QA matrix

Skenario manual minimum:

1. A4, 10 siswa, 20 hari aktif, tanpa signature.
2. A4, 40 siswa, 31 tanggal, dengan signature.
3. F4, 40 siswa, 31 tanggal, dengan signature.
4. Banyak notes siswa.
5. Banyak libur custom dan nasional.
6. Nama siswa sangat panjang.
7. NISN panjang/pendek.
8. Hanya sebagian kolom tanggal dipilih.
9. Semua kolom rekap ditampilkan.
10. Signature alignment kiri/tengah/kanan.
11. Signature offset ekstrem.
12. Auto-fit on/off.

Verifikasi tiap skenario:

1. preview jumlah halaman,
2. print preview jumlah halaman,
3. posisi summary,
4. posisi signature,
5. tidak ada baris terpotong,
6. teks tetap terbaca.

### 11.3 Visual regression

Jika memungkinkan, tambahkan screenshot regression untuk:

1. preview page 1,
2. preview last page,
3. print-only document state.

Fokus visual comparison:

1. header dan footer,
2. tinggi baris,
3. warna holiday/event,
4. posisi ringkasan,
5. signature block.

## 12. Risiko dan Mitigasi

### 12.1 Risiko browser print berbeda-beda

Risiko:

1. Chrome, Edge, dan browser lain punya perilaku print sedikit berbeda.

Mitigasi:

1. jadikan Chrome/Edge Chromium sebagai baseline resmi,
2. gunakan unit fisik konsisten,
3. uji minimal di dua browser Chromium.

### 12.2 Risiko quick PDF masih raster

Risiko:

1. file PDF tidak text-selectable.

Mitigasi:

1. dokumentasikan bahwa prioritas tahap ini adalah akurasi visual,
2. jika diperlukan, buat fase lanjutan khusus selectable PDF.

### 12.3 Risiko layout plan terlalu berat

Risiko:

1. rerender preview melambat saat banyak siswa dan banyak perubahan setting.

Mitigasi:

1. gunakan `useMemo` secara tepat pada dataset dan layout plan,
2. pisahkan builder pure function,
3. hindari pengukuran DOM berulang yang tidak perlu.

### 12.4 Risiko hidden capture DOM tidak stabil

Risiko:

1. hasil capture berbeda jika font belum siap atau layout belum settle.

Mitigasi:

1. tunggu font/document ready,
2. tambahkan satu frame sinkronisasi sebelum capture,
3. gunakan container terisolasi untuk capture.

## 13. Definition of Done

Implementasi dianggap selesai jika:

1. `Attendance` tidak lagi memiliki dua engine layout PDF yang saling bersaing.
2. Preview, print, dan quick PDF memakai dokumen render yang sama.
3. Semua kolom terpilih muat ke lebar halaman A4/F4 sesuai pilihan.
4. Pagination vertikal aman untuk data kecil dan besar.
5. Smart grouping holiday aktif pada output.
6. Manual QA matrix lulus.
7. Tidak ada regresi UX pada Export Studio.

## 14. Urutan Pengerjaan yang Direkomendasikan

Urutan implementasi paling aman:

1. ekstrak dataset dan grouping utility,
2. bangun layout plan builder,
3. bangun `AttendancePrintDocument`,
4. sambungkan preview ke renderer baru,
5. validasi print browser,
6. ganti jalur PDF satu klik,
7. hardening edge cases,
8. tambah test dan dokumentasi.

## 15. Hasil yang Diharapkan Setelah Implementasi

Setelah plan ini dieksekusi, fitur ekspor presensi SIPENA akan memiliki karakteristik berikut:

1. pengguna melihat preview yang sama dengan dokumen yang benar-benar akan dicetak,
2. perubahan ukuran kertas, tipografi, kolom, dan tanda tangan langsung tercermin secara konsisten,
3. layout tabel presensi tetap padat namun aman dibaca,
4. daftar libur/cuti menjadi hemat ruang dan profesional,
5. maintenance jangka panjang jauh lebih mudah karena hanya ada satu sumber kebenaran render.

## 16. Catatan Penutup

Keberhasilan perbaikan ini tidak bergantung pada memperhalus CSS semata, tetapi pada keberanian menyederhanakan arsitektur: satu layout engine, satu print document renderer, dan satu alur ekspor visual. Itulah fondasi yang paling realistis untuk mencapai target WYSIWYG absolut di fitur presensi SIPENA.
