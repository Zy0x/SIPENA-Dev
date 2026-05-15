# Debugging

Frontend:
1. Jalankan `npm run dev`.
2. Cek console browser untuk error env/provider.
3. Cek `apps/frontend/src/config/env.ts` jika variable tidak terbaca.
4. Trace dari UI ke hook, use-case, port, lalu adapter.

Auth:
1. Pastikan `VITE_AUTH_PROVIDER` sesuai.
2. Jika Supabase, cek `VITE_SUPABASE_URL` dan `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Jika HTTP, cek `VITE_API_BASE_URL` dan endpoint `/api/auth/me`.

Supabase:
1. Cek migration dan RLS di `supabase/`.
2. Cek edge function di `supabase/functions`.
3. Jangan gunakan service role key di frontend.

PWA/offline:
1. Cek `public/sw.js`.
2. Cek cache browser.
3. Clear cache dengan `scripts/clean.mjs` hanya untuk build output lokal.
