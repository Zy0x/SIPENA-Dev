# Standar Interaksi UI dan Scroll SIPENA

Dokumen ini menjadi standar global untuk tombol, state warna, modal, dropdown, popover, tabel, dan kontainer scroll internal di SIPENA.

## Tombol dan Kontrol Interaktif

- Semua aksi wajib memakai `<button>`, shared `Button`, atau primitive Radix yang benar; link hanya untuk navigasi.
- Label tombol, tab, select, menu item, switch, checkbox, radio, command item, dan semua turunannya wajib `user-select: none`.
- Input, textarea, textbox, dan contenteditable wajib tetap `user-select: text`.
- Touch target minimal 44x44 px. Icon-only button wajib punya `aria-label`.
- Shared `Button`, `SelectTrigger`, `DropdownMenuTrigger`, `PopoverTrigger`, tab, command item, dan menu item adalah standar utama. Komponen custom hanya boleh dibuat jika primitive ini tidak cukup, dan harus mengikuti kontrak select-none, focus ring, disabled state, dan target minimal 44px.
- Toolbar horizontal wajib membedakan drag dan tap. Drag melewati threshold membatalkan klik, tetapi container toolbar tidak boleh memakai `setPointerCapture` karena akan mengambil event dari tombol anak.
- Dropdown yang berada di toolbar horizontal boleh menunda aktivasi touch/pen sampai `pointerup`; mouse dan keyboard harus tetap memakai perilaku primitive normal.
- Dropdown, select, popover, dan tombol di dalam area yang bisa di-scroll tidak boleh membuka aksi dari `pointerdown`/`touchstart`. Aktivasi touch harus terjadi setelah tap final (`click`/`pointerup`) dan batal jika pointer bergerak melewati threshold scroll global.
- Semua trigger custom di dalam kontainer scroll wajib memakai semantic target (`button`, `role="combobox"`, `aria-haspopup="menu/listbox"`) atau `data-touch-scroll-click-target="true"` agar `useTouchScrollClickGuard()` dapat membatalkan accidental click setelah gesture scroll.
- Pada device touchscreen, tombol/dropdown yang berada di toolbar atau area scroll padat harus memakai `touch-action: pan-x pan-y` jika user diharapkan dapat melakukan scroll melewati kontrol tersebut. Gunakan `touch-manipulation` hanya untuk tombol tap murni yang tidak menjadi jalur scroll utama.
- Kontrol selected seperti tab aktif, segmented control aktif, dan tombol langkah tour wajib mendefinisikan state `hover`, `active`, dan `focus-visible` secara eksplisit pada state selected. Jangan memakai `active:bg-primary` global untuk semua tab, karena tab inactive dapat terlihat selected saat disentuh di mobile. Semua tab shared wajib membawa kelas `sipena-tab-trigger` agar CSS standar menjaga warna selected pada `data-state="active"`, `aria-selected="true"`, touch `:active`, dan focus.
- Tombol utama di tour guide wajib membawa kelas `sipena-tour-action`. Tombol langkah biasa memakai warna `primary/primary-foreground`, sedangkan tombol selesai memakai hijau semantik. Warna tombol tidak boleh hilang saat ditekan di perangkat touch, saat focus-visible, atau saat pointer masih berada di atas tombol.

### Standar Tab dan Tombol Tour

- Gunakan `TabsTrigger` shared dari `components/ui/tabs.tsx` untuk semua tab aplikasi. Komponen ini otomatis membawa `sipena-tab-trigger`, `touch-manipulation`, dan state selected yang stabil.
- Jangan membuat tab custom yang hanya mengandalkan `hover` atau `active` lokal. Jika perlu tab custom, tambahkan kontrak yang sama: `data-state="active"` atau `aria-selected="true"`, warna selected eksplisit, `-webkit-tap-highlight-color: transparent`, dan icon mengikuti `currentColor`.
- Untuk segmented control yang secara perilaku sama dengan tab, pakai `sipena-tab-trigger` atau buat kelas semantic setara yang menjaga warna selected pada `:active`, `:focus`, dan `:focus-visible`.
- Tombol `Lanjut` dan `Selesai` pada product tour wajib memakai `sipena-tour-action` plus atribut `data-tour-final`. Tombol `Selesai` harus tetap hijau ketika disentuh agar pengguna memahami bahwa langkah terakhir siap ditutup.
- Source guard UI wajib memeriksa keberadaan `sipena-tab-trigger` dan `sipena-tour-action` ketika primitive tab atau tour diubah.
- Pilihan katalog/kategori yang berperilaku seperti toggle wajib menyimpan state pada `data-selected`, bukan mengandalkan `:hover` atau `:active`. Gunakan kelas semantik domain seperti `sipena-subject-choice` agar warna aktif tetap permanen setelah tap pada coarse pointer.
- Shared `Button` membawa `data-button-variant`. Aturan coarse-pointer wajib mempertahankan warna dasar variant utama, destructive, dan outline pada `hover`, `active`, dan `focus-visible`; jangan menghapus warna tombol secara global tanpa pengganti berbasis variant.

### Collapsible dan Kartu Pilihan Touch

- Collapsible shared wajib memakai kelas `sipena-collapsible-trigger`. State terbuka harus berasal dari `data-state="open"` milik trigger, bukan state lokal pada ikon.
- Ikon arah di dalam collapsible memakai parent `group` dan `group-data-[state=open]` agar arah ikon, warna trigger, dan `aria-expanded` selalu sesuai dengan isi yang terlihat.
- Trigger collapsible wajib mempertahankan focus pada trigger setelah dibuka atau ditutup, memiliki focus ring, target minimal 44px, dan tidak memindahkan focus ke konten secara otomatis.
- Kartu pilihan yang juga memiliki tombol aksi tidak boleh memakai struktur `<button>` di dalam `<button>`. Buat tombol pilihan dan tombol aksi sebagai sibling di dalam container non-interaktif.
- Tombol pilihan gambar atau halaman wajib memakai `aria-pressed`, `data-selected`, kelas state permanen, dan `data-touch-scroll-click-target="true"`. Tap hanya memilih setelah gesture selesai; swipe untuk scroll tidak boleh berubah menjadi pilihan.
- Kontrol urutan daftar vertikal wajib memakai ikon atas/bawah. Seluruh tombol pilih, urutkan, dan hapus tetap memiliki target minimal 44px pada mouse, pen, dan touchscreen.

## Search Input dan Dropdown

- Kotak pencarian wajib menggambar border/focus ring di wrapper luar, bukan di input anak. Gunakan pola `.sipena-search-field` untuk container dan `.sipena-search-input` untuk input di dalamnya.
- Input anak pada search field harus borderless (`border-0`, `shadow-none`) hanya karena wrapper sudah memegang state visual; jangan membuat border focus di dalam kotak pencarian.
- Focus state search field wajib memakai `:focus-within` pada wrapper agar ring tetap mengikuti bentuk luar kotak dan tidak terlihat seperti border kecil di dalam card.
- Dropdown menu wajib collision-aware: gunakan `DropdownMenuContent` shared dengan `collisionPadding`, `max-height` berbasis `--radix-dropdown-menu-content-available-height`, dan `max-width: calc(100vw - safe margin)` agar menu tidak terpotong di mobile, tablet, PID, atau viewport sempit.
- Dropdown yang muncul dekat sisi layar harus memakai alignment yang memberi ruang baca paling besar. Untuk toolbar mobile yang berada di kiri/kanan, pilih `align="start"` atau `align="end"` secara eksplisit sesuai posisi trigger.
- Setiap dropdown/select yang opsinya berasal dari data wajib memiliki empty-state setelah loading selesai. Gunakan `isEmpty` dan `emptyLabel` pada primitive shared; jangan mendeteksi kekosongan dengan membaca struktur `children`.
- Label empty-state wajib mengikuti konteks, misalnya `Tidak ada pilihan Kelas`, `Tidak ada pilihan Mata Pelajaran`, `Tidak ada pilihan Semester`, atau `Tidak ada pilihan Kelas Sumber`. Default `Tidak ada pilihan` hanya untuk konteks yang benar-benar umum.
- Loading, error, dan empty adalah state berbeda. Selama request berjalan tampilkan `Memuat ...`; jangan tampilkan pesan tidak ada pilihan sebelum request selesai.
- Jika dropdown kosong masih menyediakan CTA seperti `Tambah Kelas Baru`, tampilkan pesan kosong terlebih dahulu lalu CTA tetap aktif dan dapat dipilih.
- Menu aksi statis tidak perlu empty-state. Aturan ini berlaku untuk pilihan dinamis pada Select, DropdownMenu, Command, combobox, dan komponen katalog setara.

## Modal, Toast, dan Table Header

- Dialog nested wajib tetap menampilkan overlay blur di atas dialog parent. Gunakan layer shared: dialog overlay/content, alert dialog, popover/select, lalu toast sebagai lapisan tertinggi.
- Dialog normal wajib menaikkan z-index overlay/content berdasarkan kedalaman stack agar modal anak tetap menggelapkan dan memburamkan modal parent.
- Registrasi stack dan `history.pushState` dialog hanya boleh terjadi sekali untuk setiap sesi buka. Perubahan callback, state form, pilihan tabel, atau rerender konten tidak boleh mendaftarkan ulang dialog maupun menambah history baru.
- Callback `onOpenChange` yang dipanggil oleh gesture Back harus selalu memakai callback terbaru melalui ref stabil; identitas callback tidak boleh menjadi dependency lifecycle stack dialog.
- Dialog berat boleh memakai profil motion adaptif. Pada coarse pointer atau reduced motion, hilangkan backdrop blur dan animasi zoom, tetapi pertahankan overlay, urutan layer, fokus, dan perilaku desktop non-touch.
- Toast sukses/error yang muncul dari aksi di dalam modal harus berada di atas modal agar feedback tidak tertutup.
- Semua header tabel pada halaman dan dialog wajib punya pembeda visual minimal berupa shadow/border bawah dan background solid agar tidak terlihat transparan saat scroll atau saat ada kolom sticky/freeze.

## Sidebar dan Navigasi Responsif

- Sidebar mobile/tablet wajib memakai drawer overlay dengan lebar dinamis (`min()`/`calc(100vw - safe area)`) dan menyisakan area gelap yang cukup untuk menutup menu.
- State collapsed desktop tidak boleh diterapkan ke mobile/tablet. Pada viewport di bawah `lg`, menu harus menampilkan label agar tidak berubah menjadi kolom ikon kosong yang membingungkan.
- Drawer navigasi harus memakai tinggi dynamic viewport (`100dvh` atau variabel visual viewport) dan membuat area daftar menu scrollable, sementara header dan logout tetap terlihat.
- Breakpoint sidebar wajib berbasis perilaku: desktop rail/collapsed mulai `lg`, sedangkan semua viewport di bawahnya memakai overlay. Jangan memakai width statis seperti `260px` untuk seluruh mobile tanpa guard `max-width`.

## Kontras dan State Warna

- Pasangan background/foreground harus memakai token semantic yang cocok: `background/foreground`, `card/card-foreground`, `popover/popover-foreground`, `primary/primary-foreground`, dan setara.
- Hover/focus/active pada menu, select, popover, tab, dan tombol outline/ghost tidak boleh memakai background penuh dengan foreground yang membuat teks menyatu.
- Tab dan tombol tour wajib punya warna aktif/pressed eksplisit di touchscreen agar indikator pilihan tidak hilang saat tap atau saat berpindah langkah. State selected harus tetap mempertahankan pasangan warna `primary/primary-foreground` atau warna semantik yang setara sampai state benar-benar berubah.
- Tint ringan seperti `primary/10` harus memakai `foreground`, bukan `primary-foreground`.
- Target minimal: teks normal WCAG AA 4.5:1; teks besar, icon, border, dan affordance kontrol minimal 3:1.
- Light mode dan dark mode wajib dicek untuk modal, dropdown, kartu, tab, dan tombol destructive.

## Scroll Internal

- Elemen halaman biasa yang punya scroll internal wajib memakai perilaku chaining vertikal: saat kontainer sudah mentok atas/bawah, gesture berikutnya diteruskan ke scroller halaman.
- Gunakan `.sipena-scroll-chain-page` untuk kontainer scroll halaman biasa. Kelas ini mempertahankan containment horizontal dan melepas sumbu vertikal.
- Gunakan `.sipena-scroll-isolated` untuk modal, fullscreen, sheet, editor/canvas, atau overlay yang harus mengunci halaman belakang.
- Jika perlu forwarding manual, gunakan helper `isVerticalScrollBoundary(...)` dan `scrollPageBy(...)` dari `apps/frontend/src/lib/scrollChaining.ts`.
- Horizontal scroll pada tabel, toolbar, carousel, atau preview tetap boleh `overscroll-behavior-x: contain` agar swipe horizontal tidak bocor ke halaman.
- Preview tabel yang masuk ke mode mobile/hybrid wajib memakai overflow horizontal native (`overflow-x-auto` atau `overflow-x-scroll`) pada wrapper luar dan min-width pada tabel agar pengguna dapat melakukan swipe langsung di atas tabel. Inner wrapper/table tetap wajib `width: 100%` agar pada desktop tabel otomatis mengisi lebar panel jika kolom cukup muat, lalu baru scroll horizontal saat viewport lebih kecil dari batas minimum tabel.

## QA Wajib

- Uji tombol dengan mouse, keyboard, touch, dan drag horizontal.
- Uji scroll internal di awal, tengah, dan akhir kontainer.
- Uji modal/fullscreen: latar tidak boleh ikut bergerak saat isi modal mentok.
- Uji light/dark mode untuk state normal, hover, focus, active, disabled, dan selected.
- Untuk perubahan shared primitive, jalankan source guard, typecheck, test, lint, build, dan browser smoke pada route yang memakai primitive tersebut.
- Untuk collapsible atau kartu pilihan gambar, uji tap, swipe melewati kartu, state terbuka, pemilihan aktif, dan fokus keyboard pada viewport mobile serta desktop.
