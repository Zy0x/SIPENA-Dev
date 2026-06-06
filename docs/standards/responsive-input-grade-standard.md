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

- Mobile portrait: `320x642`, `375x642`, `392x778`, `415x866`, `425x642`
- Mobile landscape pendek: `850x296`, `866x415`, `946x335`, `946x348`
- Tablet: `768x642`, `768x1024`
- Laptop: `1366x768`, `1440x900`
- Desktop lebar: `1920x1080`, `2560x1440`, `3840x2160`

Jika toolbar atau tabel tidak cukup ruang, UI harus memadat secara bertahap: sembunyikan label non-kritis, pertahankan ikon dan tooltip/aria-label, lalu gunakan scroll horizontal terkontrol. Jangan memotong tombol.

## Toolbar Input Nilai

- Tombol aksi utama harus berada dalam grid/flex responsif yang tidak menyebabkan tombol close, zoom, dropdown, atau pencarian terpotong.
- Pada fullscreen landscape pendek, toolbar harus memprioritaskan satu baris compact. Label panjang boleh disembunyikan, tetapi icon dan tombol aksi wajib tetap dapat ditekan.
- Tombol close/tutup harus selalu terlihat, memakai warna destructive/merah, dan tidak boleh terdorong keluar viewport.
- Count pencarian siswa tidak boleh menambah tinggi toolbar secara tiba-tiba. Jika ruang sempit, count dipindah ke info bar atau disembunyikan.
- Info bar harus ringkas. Hindari teks instruksi panjang di mode normal desktop jika informasi yang sama sudah terlihat di toolbar.

## Dropdown, Popover, dan Modal

- Semua dropdown/popover harus punya `max-height` berbasis `100dvh` dan `overflow-y: auto`.
- Dropdown tidak boleh menutup tombol sumbernya sampai user tidak bisa menutup atau memilih opsi.
- Isi dropdown harus kontras di light/dark mode. State hover/active tidak boleh membuat teks deskripsi menyatu dengan background.
- Modal dan popover yang berisi tabel harus punya satu scroll container utama yang jelas.

## Tabel dan Scroll

- Kontainer tabel harus menguasai scroll saat pointer/touch berada di atas tabel.
- Di luar fullscreen, scroll halaman hanya boleh mengambil alih setelah tabel benar-benar berada di batas atas/bawah dan interaksi memang dimaksudkan keluar dari tabel.
- Di fullscreen, body belakang harus terkunci agar scroll tidak berpindah ke halaman di belakang.
- `overscroll-behavior` wajib digunakan untuk mencegah scroll chaining liar pada touch device.
- Scrollbar vertikal tidak boleh tertutup header. Area scroll tabel harus dimulai di bawah seluruh header sticky.
- Header, frozen column, dan cell hover harus tetap sinkron saat zoom dan saat kolom di-resize.

## Teks dan Spasi

- Nama siswa panjang harus wrap, bukan truncate, kecuali pada konteks yang benar-benar memiliki tooltip/akses detail lain.
- Placeholder dan teks input tidak boleh tertutup icon.
- Teks bantuan seperti `Klik = edit` hanya tampil jika membantu dan tidak mengurangi ruang input utama.
- Tombol, select, dropdown, badge, dan tab harus `select-none` agar label tidak mudah terblok saat user drag atau scroll.

## Warna dan Kontras

- Warna indikator nilai tidak boleh bergantung pada background saja. Nilai di bawah KKM harus lebih kuat dari nilai Cukup.
- Warna hover baris dan kolom harus terlihat di light/dark mode tanpa merusak warna status nilai.
- Kolom kalkulasi seperti Rata-rata dan Rapor boleh memakai background pembeda, tetapi teks nilai tetap mengikuti indikator KKM.
- STS dan SAS wajib punya warna kolom/header yang konsisten dan tidak menyatu dengan warna Rata-rata.

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
