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

## Sidebar dan Navigasi Responsif

- Sidebar mobile/tablet wajib memakai drawer overlay dengan lebar dinamis (`min()`/`calc(100vw - safe area)`) dan menyisakan area gelap yang cukup untuk menutup menu.
- State collapsed desktop tidak boleh diterapkan ke mobile/tablet. Pada viewport di bawah `lg`, menu harus menampilkan label agar tidak berubah menjadi kolom ikon kosong yang membingungkan.
- Drawer navigasi harus memakai tinggi dynamic viewport (`100dvh` atau variabel visual viewport) dan membuat area daftar menu scrollable, sementara header dan logout tetap terlihat.
- Breakpoint sidebar wajib berbasis perilaku: desktop rail/collapsed mulai `lg`, sedangkan semua viewport di bawahnya memakai overlay. Jangan memakai width statis seperti `260px` untuk seluruh mobile tanpa guard `max-width`.

## Kontras dan State Warna

- Pasangan background/foreground harus memakai token semantic yang cocok: `background/foreground`, `card/card-foreground`, `popover/popover-foreground`, `primary/primary-foreground`, dan setara.
- Hover/focus/active pada menu, select, popover, tab, dan tombol outline/ghost tidak boleh memakai background penuh dengan foreground yang membuat teks menyatu.
- Tint ringan seperti `primary/10` harus memakai `foreground`, bukan `primary-foreground`.
- Target minimal: teks normal WCAG AA 4.5:1; teks besar, icon, border, dan affordance kontrol minimal 3:1.
- Light mode dan dark mode wajib dicek untuk modal, dropdown, kartu, tab, dan tombol destructive.

## Scroll Internal

- Elemen halaman biasa yang punya scroll internal wajib memakai perilaku chaining vertikal: saat kontainer sudah mentok atas/bawah, gesture berikutnya diteruskan ke scroller halaman.
- Gunakan `.sipena-scroll-chain-page` untuk kontainer scroll halaman biasa. Kelas ini mempertahankan containment horizontal dan melepas sumbu vertikal.
- Gunakan `.sipena-scroll-isolated` untuk modal, fullscreen, sheet, editor/canvas, atau overlay yang harus mengunci halaman belakang.
- Jika perlu forwarding manual, gunakan helper `isVerticalScrollBoundary(...)` dan `scrollPageBy(...)` dari `apps/frontend/src/lib/scrollChaining.ts`.
- Horizontal scroll pada tabel, toolbar, carousel, atau preview tetap boleh `overscroll-behavior-x: contain` agar swipe horizontal tidak bocor ke halaman.

## QA Wajib

- Uji tombol dengan mouse, keyboard, touch, dan drag horizontal.
- Uji scroll internal di awal, tengah, dan akhir kontainer.
- Uji modal/fullscreen: latar tidak boleh ikut bergerak saat isi modal mentok.
- Uji light/dark mode untuk state normal, hover, focus, active, disabled, dan selected.
- Untuk perubahan shared primitive, jalankan source guard, typecheck, test, lint, build, dan browser smoke pada route yang memakai primitive tersebut.
