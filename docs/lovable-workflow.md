# Lovable Hybrid Workflow

Tujuan file ini adalah menjaga SIPENA tetap nyaman dipakai di Lovable AI dan tetap rapi sebagai monorepo production.

## Prinsip

- Source of truth frontend ada di `apps/frontend`.
- File root `index.html`, `vite.config.ts`, `postcss.config.js`, `components.json`, dan `src/*` hanya compatibility layer untuk Lovable/deteksi Vite.
- Jangan menggandakan logic aplikasi di root `src`.
- Netlify tetap build dari `apps/frontend/dist`.
- Root `dist` dibuat otomatis setelah `npm run build` untuk Lovable publish/dist-check.
- Supabase client hanya boleh dibuat di `apps/frontend/src/infrastructure/supabase`.

## Cara Kerja Hybrid

1. Lovable membaca root project seperti Vite biasa.
2. Root `src/main.tsx` meneruskan entrypoint ke `apps/frontend/src/app/main.tsx`.
3. Root `vite.config.ts` meneruskan config ke `apps/frontend/vite.config.ts`.
4. `npm run build` menghasilkan `apps/frontend/dist`, lalu menyalinnya ke root `dist`.
5. Developer lokal tetap menjalankan command root:

```bash
npm run dev
npm run build
npm run test
npm run typecheck
```

## Prompt Aman Untuk Lovable

Gunakan instruksi ini saat meminta Lovable mengubah UI:

```text
Project ini memakai monorepo. Source frontend utama ada di apps/frontend.
Jangan pindahkan folder apps, packages, supabase, platforms, infra, atau docs.
Jika mengubah UI, edit file di apps/frontend/src.
Jangan membuat Supabase client baru di component/page.
Gunakan adapter/provider existing.
Jangan mengubah netlify.toml.
Jangan menaruh secret di source code.
```

## Jika Lovable Membuat File Di Root

Jika Lovable menambahkan component/hook/page baru di root `src`, pindahkan ke lokasi yang benar:

- Component umum: `apps/frontend/src/components`
- Page: `apps/frontend/src/pages`
- Hook: `apps/frontend/src/hooks`
- Feature baru: `apps/frontend/src/features`
- Adapter/provider: `apps/frontend/src/infrastructure`
- Business rule: `apps/frontend/src/core/use-cases`

Lalu hapus file root hasil duplikasi, kecuali `src/main.tsx`, `src/App.tsx`, dan `src/index.css`.

## Jika Compatibility Layer Dihapus

Project utama tetap aman selama folder `apps/frontend` tidak dihapus. Command root `npm run dev`, `npm run build`, `npm run test`, dan `npm run typecheck` memakai config di `apps/frontend`.

File root berikut hanya membantu Lovable/generic Vite detection:

- `index.html`
- `vite.config.ts`
- `postcss.config.js`
- `components.json`
- `src/main.tsx`
- `src/App.tsx`
- `src/index.css`

Jika file-file itu dihapus, local monorepo dan Netlify masih bisa memakai `apps/frontend`, tetapi Lovable kemungkinan tidak lagi otomatis mengenali project sebagai app Vite root. Untuk hybrid Lovable, pertahankan file compatibility root tersebut.

## Branch Strategy

Untuk perubahan kecil, Lovable bisa sync langsung ke `main` selama diff direview.

Untuk perubahan besar:

1. Buat branch `lovable`.
2. Prompt/edit di Lovable.
3. Review diff lokal.
4. Merge/cherry-pick ke `main`.
5. Push `main`; Netlify auto deploy.

## Deploy

Netlify:

- Build command: `npm run build`
- Publish directory: `apps/frontend/dist`
- Production branch: `main`

Environment production disimpan di Netlify Dashboard, bukan di repository.

Lovable:

- Build command: `npm run build`
- Output directory: `dist`
- Source frontend tetap di `apps/frontend/src`
