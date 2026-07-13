# Bug Investigation

## Symptoms
Notifikasi update PWA muncul berulang setelah pengguna menekan update. Halaman reload, tetapi bundle lama kadang masih berjalan dan kembali mendeteksi `/version.json` yang lebih baru.

## Expected behavior
Setelah pengguna menekan update, target versi yang sama tidak boleh ditawarkan ulang berkali-kali. Aplikasi harus menerapkan update, menunggu aktivasi service worker, lalu hanya menampilkan fallback satu kali bila browser masih memuat versi lama.

## Actual behavior
Deteksi update dari `/version.json`, `pwa.needsUpdate`, dan `registration.waiting` dapat membuka banner lagi setelah reload karena tidak ada target-version lock lintas reload.

## Suspected files
- `apps/frontend/src/components/PWAManager.tsx`
- `apps/frontend/src/hooks/usePWA.ts`
- `apps/frontend/src/components/settings/PwaNotificationSettingsSection.tsx`

## Working fix
Tambahkan update lock berbasis `targetVersion` di `localStorage`, satukan trigger melalui `requestUpdate(...)`, hentikan reload ganda dari `usePWA`, dan buat status `available/applying/stalled`.

## Verification
- Targeted Vitest `apps/frontend/src/lib/gradeImport/phase12Regression.test.ts`: passed.
- `npm run typecheck`: passed.
- `npm run lint -- --quiet`: passed.
- `npm run build`: passed.
- `npm test`: passed, 80 files / 584 tests.
- `npm run verify:web:dist`: passed.
- `git diff --check`: passed with line-ending warnings only.

## Status
Patched and locally verified.
