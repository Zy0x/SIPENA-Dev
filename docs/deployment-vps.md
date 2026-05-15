# Deployment VPS

Build frontend:

```bash
npm run build
```

Copy `apps/frontend/dist` ke root web server. Gunakan `platforms/vps/nginx.conf` sebagai baseline.

Jika backend custom aktif, jalankan API di port `3000` dan proxy `/api/` ke backend.
