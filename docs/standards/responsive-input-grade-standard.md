# Standar Responsif Input Nilai SIPENA

Dokumen ini menjadi standar wajib untuk perubahan pada halaman Input Nilai, terutama komponen tabel nilai, toolbar, dropdown, modal, dan mode fullscreen. Tujuannya mencegah regresi seperti tombol terpotong, dropdown tertutup header, scroll touch bocor ke halaman, teks pencarian menggeser toolbar, atau ruang input nilai tidak efisien pada viewport sempit.

## Scope Wajib

Standar ini berlaku untuk:

- `apps/frontend/src/pages/Grades.tsx`
- `apps/frontend/src/components/grades/SpreadsheetTable.tsx`
- `apps/frontend/src/components/grades/SmartStudentSearch.tsx`
- semua dialog, dropdown, tooltip, dan popover yang muncul di halaman Input Nilai
- style global yang mengatur `.sipena-grade-*`

## Viewport Target

Setiap perubahan UI Input Nilai wajib aman di viewport berikut:

- Mobile portrait: `320x642`, `375x642`, `392x778`, `415x866`, `425x642`, `431x846`
- Mobile landscape pendek: `850x296`, `866x415`, `894x399`, `946x335`, `946x348`
- Tablet dan compact desktop: `640x560`, `714x704`, `736x711`, `768x642`, `768x1024`
- Laptop: `1366x768`, `1440x900`
- Desktop lebar: `1920x1080`, `2560x1440`, `3840x2160`

Observasi `viewport_observations` terbaru pada 2026-06-13 menunjukkan `/grades` sebagai route dominan untuk mobile QA. Outlier yang wajib dipertahankan dalam regression sweep: `320x616`, `393x406`, `393x462`, `393x514`, `415x462`, `415x525`, `415x866`, `393x886` dengan safe-area atas sampai `36px`, serta landscape pendek `894x399`, `946x335`, dan `946x415`. Pada viewport pendek tersebut, header kartu, info bar, dan toolbar wajib memadat sebelum mengorbankan area spreadsheet.

Jika toolbar atau tabel tidak cukup ruang, UI harus memadat secara bertahap: sembunyikan label non-kritis, pertahankan ikon dan tooltip/aria-label, lalu susun toolbar fullscreen menjadi bento dua baris. Jangan memotong tombol dan jangan memakai scroll horizontal pada toolbar fullscreen.

## Toolbar Input Nilai

- Tombol aksi utama harus berada dalam grid/flex responsif yang tidak menyebabkan tombol close, zoom, dropdown, atau pencarian terpotong.
- Header kartu nilai dan toolbar tabel harus punya mode compact saat viewport tinggi pendek; jangan biarkan judul, search count, atau row kosong membuat area tabel turun terlalu jauh.
- Pada fullscreen dengan lebar panel di bawah `1080px`, toolbar wajib memakai dua baris tanpa scroll horizontal. Baris pertama memuat kontrol format/navigasi; baris kedua memuat pencarian yang lebar, zoom, dan tombol tutup.
- Fullscreen Input Nilai harus membedakan `Layar Penuh Browser` yang tetap berada di dalam tampilan browser dan `Layar Penuh Maksimal` yang memakai Fullscreen API perangkat. Jika browser menolak Fullscreen API, UI wajib fallback ke Layar Penuh Browser dengan pesan non-teknis.
- Layar Penuh Maksimal wajib membaca `visualViewport`, orientasi, DPR, dan `safe-area-inset-*` agar tombol kanan/kiri tidak masuk area notch, punch-hole, navigation bar, atau cutout mobile.
- Pada fullscreen compact, `Kelola Nilai`, `Rumus`, dan `Pembulatan` disembunyikan. Fitur tersebut tetap tersedia setelah keluar dari fullscreen compact.
- **Toolbar fullscreen compact tidak boleh memakai `overflow-x: auto` atau `white-space: nowrap`.** Jika lebar panel di bawah `1080px`, toolbar wajib beralih ke grid dua baris (`grid-template-rows: auto auto`) melalui `@container grade-sheet`.
- Pada mobile portrait sekitar `392x778`, pencarian siswa wajib tetap lebar dan kontrol zoom tetap dapat digunakan tanpa menggeser toolbar secara horizontal.
- Pada landscape sangat pendek seperti `946×335` (max-height 380px), toolbar wajib memadatkan padding dan menyembunyikan label teks agar area spreadsheet tetap berguna.
- Toolbar horizontal wajib membedakan gesture drag dan tap. Jika user menggeser toolbar melewati threshold kecil, klik/tap tombol di bawah jari harus dibatalkan agar tidak memicu aksi tidak sengaja.
- Toolbar horizontal tidak boleh memakai `setPointerCapture` pada container karena event tombol anak dapat diambil alih dan seluruh tombol menjadi tidak bisa ditekan.
- Dropdown Proteksi dan Fullscreen pada toolbar harus memakai perilaku normal untuk mouse/keyboard, dengan guard touch/pen yang hanya membuka menu pada `pointerup` jika gesture bukan drag.
- **Aksi pada card Input Nilai normal menggunakan container query `@container grade-card (max-width: 639px)` agar tata letak bento (manage 50%, formula 50%, rounding penuh, search penuh) bereaksi berdasarkan lebar panel, bukan sekadar lebar viewport.** Parent card actions wajib memiliki `container-type: inline-size` dan `container-name: grade-card`.
- Tombol tutup fullscreen wajib keluar dari overlay Input Nilai dan, bila aktif, juga keluar dari fullscreen browser.
- Tombol close/tutup harus selalu terlihat, memakai warna destructive/merah, dan tidak boleh terdorong keluar viewport.
- Count pencarian siswa tidak boleh menambah tinggi toolbar secara tiba-tiba. Jika ruang sempit, count dipindah ke info bar atau disembunyikan.
- Info bar harus ringkas. Hindari teks instruksi panjang di mode normal desktop jika informasi yang sama sudah terlihat di toolbar.

## Dropdown, Popover, dan Modal

- Semua dropdown/popover harus punya `max-height` berbasis `100dvh` dan `overflow-y: auto`.
- Dropdown tidak boleh menutup tombol sumbernya sampai user tidak bisa menutup atau memilih opsi.
- Dropdown/popover yang muncul di atas spreadsheet harus punya layer lebih tinggi dari sticky header tabel. Jangan memakai z-index yang sama dengan header jika elemen muncul lebih awal di DOM.
- Popover custom yang tidak memakai primitive Radix wajib tertutup saat klik/tap di luar area dan saat tombol `Escape` ditekan.
- Isi dropdown harus kontras di light/dark mode. State hover/active tidak boleh membuat teks deskripsi menyatu dengan background.
- State hover/active item menu tidak boleh memakai background penuh yang membuat judul, ikon, atau deskripsi sulit dibaca. Pakai tint ringan dari token semantic dan cek light/dark mode.
- Modal dan popover yang berisi tabel harus punya satu scroll container utama yang jelas.
- Modal, dialog, dropdown, dan popover yang dibuka dari mode fullscreen tidak boleh menutup mode fullscreen akibat event `fullscreenchange`. Jika browser memaksa keluar dari Fullscreen API saat overlay terbuka, UI wajib fallback ke mode fullscreen panel dan tetap berada di halaman Input Nilai.

## Tabel dan Scroll

- Kontainer tabel harus menguasai scroll saat pointer/touch berada di atas tabel.
- Di luar fullscreen, scroll halaman hanya boleh mengambil alih setelah tabel benar-benar berada di batas atas/bawah dan interaksi memang dimaksudkan keluar dari tabel.
- Scroll chaining harus dua arah: saat tabel sudah mentok atas/bawah, gesture berikutnya boleh meneruskan scroll ke body; saat body kembali ke area tabel, gesture di atas tabel harus kembali menguasai scroll tabel.
- Touch scroll pada kolom frozen seperti `No` dan `Nama Siswa` wajib diarahkan ke scroll container tabel, bukan langsung ke body halaman.
- Overlay visual kolom frozen tidak boleh menangkap pointer/wheel/touch pada body tabel; biarkan event jatuh ke scroll container asli agar scroll tetap native dan smooth seperti kolom non-freeze.
- Di fullscreen, body belakang harus terkunci agar scroll tidak berpindah ke halaman di belakang.
- Back gesture/browser back saat fullscreen aktif harus menutup fullscreen terlebih dahulu, bukan langsung menavigasi ke halaman sebelumnya.
- `overscroll-behavior` wajib digunakan untuk mencegah scroll chaining liar pada touch device.
- Scrollbar vertikal tidak boleh tertutup header. Area scroll tabel harus dimulai di bawah seluruh header sticky.
- Header, frozen column, dan cell hover harus tetap sinkron saat zoom dan saat kolom di-resize.
- Resize kolom wajib memberi feedback berupa handle yang jelas, tint pada kolom aktif, garis panduan vertikal, dan label lebar aktual. Feedback visual tidak boleh mengganti logika ukuran atau menghambat scroll tabel.
- Header terakhir spreadsheet wajib punya pemisah visual yang jelas, minimal border plus shadow bawah ringan, agar tidak menyatu dengan baris nilai pertama.

## Teks dan Spasi

- Nama siswa panjang harus wrap, bukan truncate, kecuali pada konteks yang benar-benar memiliki tooltip/akses detail lain.
- Placeholder dan teks input tidak boleh tertutup icon.
- Field edit nama BAB dan Tugas harus fleksibel (`min-width: 0` dan `flex: 1`) sehingga nama panjang bisa diedit tanpa kolom input kecil.
- Editor nama BAB dan Tugas tidak boleh memakai `max-width` desktop seperti `sm:max-w-*`; input wajib mengisi lebar panel yang tersedia pada mobile, tablet, desktop, dan layar lebar.
- Aksi simpan/batal editor nama BAB/Tugas harus turun ke baris aksi di viewport tablet sempit sekitar `<=820px`, bukan mengorbankan lebar input.
- Ikon non-kritis pada editor nama BAB/Tugas boleh disembunyikan di viewport sangat sempit sekitar `<=420px` agar input tetap menjadi elemen utama.
- Aksi edit/hapus pada baris BAB/Tugas harus turun ke baris aksi di viewport sempit sekitar `<=420px`, dengan target sentuh minimal `40px`.
- BAB dan Tugas wajib memiliki label, surface, dan grup aksi yang berbeda. Jangan mengandalkan warna saja; gunakan label `BAB`/`Tugas`, ikon, border, dan `aria-label` grup aksi.
- Trigger buka/tutup BAB harus terpisah dari tombol edit/hapus agar kontrol tidak saling memicu dan tetap valid untuk keyboard maupun touch.
- Teks bantuan seperti `Klik = edit` hanya tampil jika membantu dan tidak mengurangi ruang input utama.
- Tombol, select, dropdown, badge, dan tab harus `select-none` agar label tidak mudah terblok saat user drag atau scroll.
- Tab Input Nilai harus terlihat menyatu dengan panel konten di bawahnya. Active tab memakai tint primer dan berbagi background/border dengan panel.
- Tooltip prediksi nilai tidak boleh muncul di fullscreen mobile sampai ada desain yang tidak menutup cell input.

## Telemetry Viewport Senyap

- Aplikasi boleh menyimpan telemetry teknis viewport secara senyap untuk kebutuhan QA developer: route, ukuran viewport, ukuran visual viewport, orientasi, DPR, touch points, display mode, dan safe-area/cutout.
- Telemetry viewport tidak boleh menyimpan data siswa, nilai, nama kelas, nama mapel, teks pencarian, atau isi input pengguna.
- Jika tabel telemetry belum tersedia di database, UI wajib tetap berjalan tanpa toast, banner, atau error visible.
- Data telemetry harus dibatasi RLS per akun dan hanya memakai role `authenticated`; developer membaca agregat melalui Supabase dashboard/service role untuk perencanaan responsif berikutnya.
- Untuk menarik acuan viewport server ke lokal, jalankan `npm run viewport:sync -- --days 30`. Script membaca `viewport_observations` memakai service role dari `.env`, memilih kolom teknis tanpa `user_id`, lalu menulis agregat ke `.codex/viewport-observations/latest.json`.
- File `.codex/viewport-observations/latest.json` tidak boleh di-commit. Gunakan isinya sebagai checklist tambahan sebelum mengubah Input Nilai: `top_viewports`, `mobile_focus_viewports`, `safe_area_max`, dan distribusi `viewport_profile`.
- Jika data server belum tersedia, developer wajib tetap memakai viewport target di dokumen ini dan menambah hasil repro baru ke bagian standar/QA sebelum commit.

## Warna dan Kontras

- Warna indikator nilai tidak boleh bergantung pada background saja. Nilai di bawah KKM harus lebih kuat dari nilai Cukup.
- Warna hover baris dan kolom harus terlihat di light/dark mode tanpa merusak warna status nilai.
- Kolom kalkulasi seperti Rata-rata dan Rapor boleh memakai background pembeda, tetapi teks nilai tetap mengikuti indikator KKM.
- STS dan SAS wajib punya warna kolom/header yang konsisten dan tidak menyatu dengan warna Rata-rata.

## PWA Update

- Banner update PWA tidak boleh berhenti permanen di status loading. Setiap proses apply update wajib punya timeout/fallback reload yang aman.
- Saat update tersedia, beri jeda otomatis 10 detik agar pengguna sempat menyimpan pekerjaan. Selama jeda itu, tampilkan aksi `Update sekarang` dan `Tunggu`.
- Tombol `Tunggu` menunda update sementara tanpa memunculkan error teknis. Setelah masa tunggu habis, banner boleh muncul kembali lewat siklus pengecekan update berikutnya.
- Jika service worker gagal menyelesaikan `skipWaiting` atau reload otomatis, aplikasi wajib melakukan reload halaman sebagai fallback terakhir.

## QA Wajib Sebelum Commit

Untuk perubahan Input Nilai, minimal lakukan:

1. `npm run typecheck`
2. `npm test`
3. `npm run lint`
4. `npm run build`
5. `git diff --check`

Visual smoke test wajib pada:

- normal desktop Input Nilai
- fullscreen desktop Input Nilai
- mobile portrait sekitar `392x778`
- mobile landscape pendek sekitar `850x296`
- compact desktop `640x560`, `714x704`, dan `736x711`
- dropdown Freeze
- dropdown Proteksi
- pencarian siswa dengan query aktif

Acceptance visual:

- tidak ada tombol terpotong
- tidak ada dropdown/modal tertutup viewport tanpa scroll
- tabel bisa discroll horizontal dan vertikal dengan mouse serta touch
- body tidak ikut scroll saat user menggeser tabel
- info bar tidak mengambil ruang berlebihan
- dark mode tetap terbaca

## Aturan Dokumentasi

Jika bug responsif baru ditemukan, tambahkan pola viewport dan akar masalahnya ke dokumen ini atau ke changelog teknis terkait. Jangan hanya memperbaiki CSS lokal tanpa menambah guard test atau standar bila bug tersebut dapat berulang.

Untuk standar global tombol, kontras, dan scroll internal lintas halaman, ikuti `docs/standards/ui-interaction-scroll-standard.md`.
