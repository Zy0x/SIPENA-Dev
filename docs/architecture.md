# Architecture

Repo ini disusun sebagai monorepo non-destruktif:

- `apps/frontend`: React + Vite + PWA SIPENA existing.
- `apps/backend`: skeleton API custom untuk migrasi bertahap dari Supabase.
- `packages/shared`: kontrak API, DTO, schema, role, permission, dan tipe bersama.
- `packages/ui`: tempat komponen UI reusable lintas app.
- `platforms`: konfigurasi deploy per platform.
- `infra`: konfigurasi operasional VPS, Docker, PostgreSQL, dan monitoring.

Root juga menyimpan compatibility layer untuk Lovable AI:

- `index.html`
- `vite.config.ts`
- `postcss.config.js`
- `components.json`
- `src/main.tsx`
- `src/App.tsx`
- `src/index.css`

File-file root tersebut hanya menunjuk ke `apps/frontend` dan bukan source of truth aplikasi.

Alur target:

UI/Page -> Feature Hook -> Use Case -> Port -> Adapter Provider -> Supabase/HTTP/Mock.

`src/infrastructure/provider.factory.ts` memilih provider berdasarkan environment. Untuk menjaga aplikasi tetap berjalan, sebagian fitur existing masih memakai bridge `src/core/repositories/supabase-compat.repository.ts`. Bridge ini harus dikurangi bertahap saat setiap feature dipindah ke use-case dan adapter.

Strategi migrasi provider:
1. Tambahkan kontrak endpoint di `packages/shared/src/contracts`.
2. Implementasikan backend di `apps/backend/src/modules`.
3. Implementasikan HTTP adapter di `apps/frontend/src/infrastructure/http`.
4. Ubah `VITE_*_PROVIDER` dari `supabase` ke `http`.
5. Jalankan smoke test dan monitor error.
