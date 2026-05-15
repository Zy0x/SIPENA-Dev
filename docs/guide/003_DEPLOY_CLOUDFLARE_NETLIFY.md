# Panduan Deploy SIPENA ke Cloudflare Pages / Netlify

## Build Command & Output

| Setting | Nilai |
|---------|-------|
| **Build command** | `npm run build` |
| **Output directory** | `dist` |
| **Node version** | `18` atau `20` |

## Environment Variables (wajib di Netlify/Cloudflare)

| Variable | Nilai | Keterangan |
|----------|-------|------------|
| `VITE_SUPABASE_PROJECT_ID` | `jdncrsmjvbweyxcbtnou` | Project ID Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | anon key | Anon/public key |
| `VITE_SUPABASE_URL` | `https://jdncrsmjvbweyxcbtnou.supabase.co` | URL Supabase |
| `VITE_RECAPTCHA_SITE_KEY` | Site key v3 | reCAPTCHA v3 |
| `VITE_RECAPTCHA_V2_SITE_KEY` | Site key v2 | reCAPTCHA v2 checkbox |

## File Lovable vs Netlify

### Wajib untuk build (sama di keduanya):
- `src/`, `public/`, `index.html`, `vite.config.ts`, `tailwind.config.ts`, `tsconfig*.json`, `postcss.config.js`, `package.json`

### TIDAK perlu di Netlify (dev/infra only):
- `supabase/` → deploy terpisah via CLI
- `docs/` → dokumentasi internal
- `.env*` → set di dashboard Netlify
- `eslint.config.js`, `vitest.config.ts`, `src/test/` → dev only
- `components.json` → shadcn dev config

### Khusus Lovable (tidak berpengaruh):
- `src/integrations/supabase/client.ts` → auto-generated, app pakai `supabase-external.ts`

## Deploy

1. Push ke GitHub dari Lovable
2. Netlify: New Site → Import Git → `npm run build` → output `dist`
3. Set env vars di dashboard
4. Deploy edge functions: `supabase functions deploy --project-ref jdncrsmjvbweyxcbtnou`

## Auth URLs (wajib set di Supabase)

- Site URL: `https://sipenaid.netlify.app`
- Redirect URLs: `https://sipenaid.netlify.app/**`
- Google OAuth redirect: `https://jdncrsmjvbweyxcbtnou.supabase.co/auth/v1/callback`
- Google JS origins: `https://sipenaid.netlify.app`
