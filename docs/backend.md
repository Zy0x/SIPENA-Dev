# Backend

`apps/backend` saat ini skeleton API custom. Endpoint awal yang disiapkan:

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/users/me`
- `PATCH /api/users/me`
- `POST /api/files/upload`
- `GET /api/notifications`

Jangan pindahkan secret backend ke frontend. Gunakan `.env` backend dan simpan service role Supabase hanya di server.
