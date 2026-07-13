# Bug Investigation

## Symptoms
Notifikasi update PWA muncul berulang setelah pengguna menekan update. Halaman reload, tetapi bundle lama kadang masih berjalan dan kembali mendeteksi `/version.json` yang lebih baru.

## Expected behavior
Setelah pengguna menekan update, target versi yang sama tidak boleh ditawarkan ulang berkali-kali. Aplikasi harus menerapkan update, menunggu aktivasi service worker, lalu hanya menampilkan fallback satu kali bila browser masih memuat versi lama.

## Actual behavior
Deteksi update dari `/version.json`, `pwa.needsUpdate`, dan `registration.waiting` dapat membuka banner lagi setelah reload karena tidak ada target-version lock lintas reload.

Setelah lock ditambahkan, pemulihan lock masih bisa macet: effect menyalakan
`isUpdating` sebelum timer retry berjalan. Perubahan callback membatalkan timer,
sedangkan callback berikutnya langsung keluar karena guard sudah aktif.

Follow-up kedua menemukan race lain: polling versi atau event service worker yang
datang setelah recovery dapat menjalankan `requestUpdate`, membaca lock `applying`,
dan menyalakan guard kembali sebelum timer recovery memanggil `handleUpdate`.

## Suspected files
- `apps/frontend/src/components/PWAManager.tsx`
- `apps/frontend/src/hooks/usePWA.ts`
- `apps/frontend/src/components/settings/PwaNotificationSettingsSection.tsx`

## Working fix
Tambahkan update lock berbasis `targetVersion` di `localStorage`, satukan trigger melalui `requestUpdate(...)`, hentikan reload ganda dari `usePWA`, dan buat status `available/applying/stalled`.

Perbaikan lanjutan membiarkan execution guard tetap terbuka sampai retry benar-benar
dimulai, melewati penantian worker jika worker terbaru sudah aktif, dan mengubah
reload yang tidak bernavigasi menjadi status `stalled` yang dapat dipulihkan.

Guard eksekusi kini hanya dapat dinyalakan oleh `handleUpdate` yang benar-benar
menjalankan proses. Reuse lock tidak lagi menandai eksekusi aktif, state/ref ditulis
secara sinkron, dan lock applying lebih dari 30 detik otomatis menjadi stalled.

## Verification
- Component Vitest `PWAManager.test.tsx`: 2 passed, including the service-worker/polling race and stale-lock recovery.
- Targeted Vitest `apps/frontend/src/lib/gradeImport/phase12Regression.test.ts`: passed.
- `npm run typecheck`: passed.
- `npm run lint -- --quiet`: passed.
- `npm run build`: passed.
- `npm test`: passed.
- `npm run verify:web:dist`: passed.
- `git diff --check`: passed with line-ending notices only.
- Generated Workbox service worker contains the `SKIP_WAITING` message listener.

## Status
Second follow-up patch verified locally; ready for release and production smoke test.
