# Netlify to VPS

1. Build `npm run build`.
2. Upload `apps/frontend/dist` ke web root.
3. Pakai `platforms/vps/nginx.conf`.
4. Set HTTPS dan cache static asset.
5. Jika backend aktif, proxy `/api` ke service backend.
