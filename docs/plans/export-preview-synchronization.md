# Rencana Perbaikan Kompleks: Sinkronisasi Live Preview dan Hasil Ekspor (WYSIWYG)

## 1. Analisis Akar Permasalahan (Root Cause Analysis)

Berdasarkan analisis mendalam terhadap struktur kode `tessipena2`, ditemukan beberapa ketidaksinkronan kritikal antara *Live Preview* (HTML/CSS) dan *Hasil Ekspor* (PDF via jsPDF/autoTable):

| Dimensi | Akar Permasalahan | Dampak |
| :--- | :--- | :--- |
| **Ukuran Kertas** | Preview menggunakan konstanta `PX_PER_MM = 3.15` yang bersifat statis, sedangkan browser memiliki DPI yang bervariasi. PDF menggunakan unit `mm` murni. | Ukuran fisik di layar tidak merepresentasikan ukuran kertas asli saat dicetak. |
| **Margin & Padding** | Perbedaan kalkulasi antara CSS Box Model (Preview) dan koordinat absolut jsPDF. Padding sel tabel di PDF seringkali lebih sempit dari tampilan web. | Teks yang terlihat aman di preview bisa terpotong atau tumpang tindih di PDF. |
| **Tipografi (Font)** | Preview menggunakan font 'Plus Jakarta Sans' (Google Fonts), sedangkan PDF menggunakan font standar 'helvetica'. Perbedaan *glyph width* sangat signifikan. | Jumlah karakter yang muat dalam satu baris berbeda jauh, menyebabkan *text wrapping* yang tidak sinkron. |
| **Posisi Tanda Tangan** | Preview menggunakan sistem *drag-and-drop* berbasis persentase atau offset pixel, sementara PDF menghitung posisi berdasarkan `finalY` dari tabel terakhir. | Penanda tangan bisa tumpang tindih dengan tabel di preview tapi jauh di PDF, atau sebaliknya. |
| **Layout Engine** | Adanya dua implementasi preview yang berbeda (`AttendanceExportPreviewV2` vs `SignaturePreviewDocument`), menciptakan inkonsistensi antar fitur. | Perbaikan di satu fitur tidak berdampak pada fitur lainnya. |

---

## 2. Alternatif Solusi

Berikut adalah 5 alternatif solusi untuk menangani kasus-kasus awam hingga jarang (edge cases) secara dinamis dan fleksibel:

### Solusi A: Unified Layout Engine (Recommended)
Membuat satu *Layout Engine* pusat yang menghitung seluruh metrik (lebar kolom, tinggi baris, posisi elemen) dalam unit `mm`. Preview hanya bertugas merender hasil kalkulasi tersebut ke dalam CSS `transform: scale()`.
*   **Kelebihan:** Presisi 100% karena logika kalkulasi identik.
*   **Kasus:** Menangani tabel dengan ratusan kolom yang harus di-*split* ke beberapa halaman.

### Solusi B: PDF-to-Canvas Preview
Menggunakan `pdf.js` untuk merender hasil ekspor PDF asli ke dalam elemen `<canvas>` sebagai preview.
*   **Kelebihan:** Apa yang dilihat adalah PDF yang sebenarnya akan diunduh.
*   **Kasus:** Menghilangkan seluruh keraguan perbedaan font dan margin.

### Solusi C: CSS Print Profile & Shadow DOM
Menggunakan CSS `@media print` dan unit `pt`/`mm` di dalam Shadow DOM untuk mengisolasi gaya preview dari gaya aplikasi utama.
*   **Kelebihan:** Memanfaatkan engine print bawaan browser yang sangat akurat.
*   **Kasus:** Memastikan preview di web sama persis dengan dialog `Ctrl+P`.

### Solusi D: Font Metrics Normalization
Menyematkan font custom (TTF/Base64) ke dalam jsPDF agar identik dengan font di web, serta menggunakan library `canvas-text-metrics` untuk menghitung lebar teks secara presisi sebelum dirender.
*   **Kelebihan:** Sinkronisasi *text wrapping* yang sangat akurat.
*   **Kasus:** Nama siswa yang sangat panjang tidak akan terpotong secara tidak terduga.

### Solusi E: Adaptive Safe-Zone Collision Detection
Implementasi algoritma pendeteksi tabrakan (collision detection) antara blok tanda tangan dan konten tabel. Jika terdeteksi tumpang tindih, sistem secara otomatis menambah `page break` atau menggeser posisi secara dinamis.
*   **Kelebihan:** Mencegah hasil ekspor rusak pada kasus data yang sangat padat.
*   **Kasus:** Tanda tangan yang diletakkan secara manual tidak akan pernah menutupi data penting.

---

## 3. Rencana Implementasi Detail

### Tahap 1: Standarisasi Metrik & Font (Kritikal)
1.  **Integrasi Font Custom:** Mengonversi 'Plus Jakarta Sans' ke Base64 dan menyematkannya ke jsPDF.
2.  **Dynamic DPI Scaling:** Mengganti `PX_PER_MM` statis dengan fungsi pendeteksi DPI layar untuk akurasi ukuran fisik.
3.  **Unit Consistency:** Seluruh konfigurasi `documentStyle` wajib menggunakan unit `mm`.

### Tahap 2: Refaktor Layout Engine V3
1.  **Pre-calculation Layer:** Sebelum render, engine akan menghitung `estimatedHeight` setiap baris berdasarkan font metrics asli.
2.  **Synchronized Pagination:** Logika pemotongan halaman (page break) di preview harus menggunakan algoritma yang sama dengan `autoTable`.
3.  **Virtual Paper Component:** Membuat komponen pembungkus yang mensimulasikan ukuran kertas (A4/F4) dengan margin yang terkunci.

### Tahap 3: Perbaikan Interaksi Tanda Tangan
1.  **Real-time Collision Warning:** Memberikan indikator visual (warna merah) di preview jika posisi tanda tangan tumpang tindih dengan tabel.
2.  **Anchor-based Positioning:** Memungkinkan user memilih apakah tanda tangan "Menempel di akhir tabel" atau "Posisi absolut di halaman terakhir".
3.  **Smart Padding:** Menambahkan *buffer zone* otomatis di bawah tabel untuk menjamin ruang tanda tangan.

### Tahap 4: Validasi & Testing Otomatis
1.  **Visual Regression Testing:** Membandingkan screenshot preview dengan hasil ekspor PDF secara otomatis.
2.  **Edge Case Simulation:** Testing dengan 1 siswa, 100 siswa, 5 kolom, dan 50 kolom untuk memastikan responsivitas layout.

---

## 4. Target Hasil
*   **Akurasi Visual:** Deviasi antara preview dan ekspor < 1mm.
*   **Sinkronisasi Font:** *Text wrapping* identik antara web dan PDF.
*   **Fleksibilitas:** Script mampu menangani perubahan ukuran kertas (A4 ke F4) secara instan tanpa merusak layout.
*   **User Experience:** Tampilan preview yang "nyata" memberikan kepercayaan diri bagi user sebelum melakukan ekspor.
