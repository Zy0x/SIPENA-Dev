# Deployment

Frontend saat ini dideploy ke Netlify dari root dengan:

```bash
npm run build
```

Output berada di `apps/frontend/dist`.

Konfigurasi platform:
- Netlify: `netlify.toml`
- Cloudflare Pages: `platforms/cloudflare/wrangler.toml`
- Vercel: `platforms/vercel/vercel.json`
- VPS: `platforms/vps`
