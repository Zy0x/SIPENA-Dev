# Deployment Netlify

SIPENA dideploy dari root monorepo. Jangan set `Base directory` ke `apps/frontend`
di dashboard Netlify karena dependency dan lockfile berada di root.

## Build Settings

Gunakan nilai berikut di Netlify:

| Field | Value |
| --- | --- |
| Base directory | kosong atau `.` |
| Build command | `npm run build` |
| Publish directory | `apps/frontend/dist` |
| Node version | `22` |
| Package manager | `npm` |

Root `netlify.toml` sudah memuat:

```toml
[build]
  base = "."
  command = "npm run build"
  publish = "apps/frontend/dist"

[build.environment]
  NODE_VERSION = "22"
  NPM_VERSION = "10"
  NETLIFY_USE_YARN = "false"
  VITE_APP_ENV = "production"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

`bun.lock` dan `bun.lockb` tidak dipakai untuk Netlify. Netlify dapat
mendeteksi Bun dari `bun.lockb`; karena build resmi SIPENA memakai npm,
lock Bun tidak boleh berada di root deploy.

## Environment Variables

Isi variable berikut di Netlify UI:

| Variable | Keterangan |
| --- | --- |
| `VITE_APP_NAME` | `SIPENA` |
| `VITE_APP_ENV` | `production` |
| `VITE_AUTH_PROVIDER` | `supabase` |
| `VITE_DATA_PROVIDER` | `supabase` |
| `VITE_STORAGE_PROVIDER` | `supabase` |
| `VITE_REALTIME_PROVIDER` | `supabase` |
| `VITE_FUNCTION_PROVIDER` | `netlify` |
| `VITE_API_BASE_URL` | kosong jika belum memakai backend custom |
| `VITE_SUPABASE_URL` | URL project Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | anon/publishable key Supabase |
| `VITE_FEATURE_PWA_INSTALL` | `true` |
| `VITE_FEATURE_OFFLINE_MODE` | `true` |
| `VITE_FEATURE_REALTIME` | `true` |
| `VITE_FEATURE_ANALYTICS` | `false` |
| `VITE_FEATURE_PAYMENTS` | `false` |
| `VITE_FEATURE_BETA_DASHBOARD` | `false` |

Jangan isi `SUPABASE_SERVICE_ROLE_KEY` di frontend/Netlify site variable untuk
aplikasi statis. Key tersebut hanya untuk backend/serverless yang benar-benar
membutuhkan akses admin.

## One Command Deploy Lokal

Untuk deploy dari mesin lokal atau automation agent:

1. Install Netlify CLI sekali di mesin:

   ```bash
   npm install -g netlify-cli
   ```

2. Simpan credential sebagai environment lokal, bukan di Git:

   ```bash
   NETLIFY_SITE_ID=...
   NETLIFY_AUTH_TOKEN=...
   ```

3. Jalankan:

   ```bash
   npm run deploy:netlify
   ```

Untuk preview deploy:

```bash
npm run deploy:netlify:preview
```

Jika binary Netlify CLI tidak bernama `netlify`, set:

```bash
NETLIFY_CLI_BIN=/path/to/netlify
```

## Yang Perlu Disiapkan

- Akun Netlify.
- Project/site Netlify yang terhubung ke repository GitHub ini.
- `NETLIFY_SITE_ID` dari Netlify project settings.
- `NETLIFY_AUTH_TOKEN` dari Netlify Personal access tokens.
- Variable `VITE_*` Supabase di Netlify UI.
- Di Supabase Auth, tambahkan domain Netlify ke Site URL / Redirect URLs agar login OAuth dan email redirect aman.
