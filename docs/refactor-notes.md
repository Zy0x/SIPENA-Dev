# Refactor Notes

Refactor ini memindahkan frontend existing ke `apps/frontend` dan menambahkan struktur target monorepo.

Catatan transisi:
- Banyak fitur existing masih memanggil Supabase melalui `core/repositories/supabase-compat.repository.ts`.
- Bridge tersebut menjaga behavior existing dan harus dikurangi feature-by-feature.
- Backend custom masih skeleton agar frontend bisa berpindah ke HTTP adapter tanpa rewrite UI besar.
- `apps/frontend/src/app/App.tsx` masih memegang route existing; `app/router.tsx` disiapkan sebagai titik pemisahan berikutnya.
