# SIPENA — PWA Push Notification Setup

## Deskripsi

File `PWA_PUSH_NOTIFICATION_SETUP.sql` membuat infrastruktur untuk **push notification** pada PWA.

## Tabel yang Dibuat

| Tabel | Fungsi |
|---|---|
| `push_subscriptions` | Menyimpan endpoint push notification per user |

## Kolom Utama

- `user_id` — pemilik subscription
- `endpoint` — URL endpoint push service
- `p256dh` — public key untuk enkripsi
- `auth_key` — authentication key

## Integrasi

- **Service Worker** (`public/sw.js`) — menangani event `push` dan `notificationclick`
- **Component**: `PWAInstallBanner.tsx` — banner instalasi PWA
- **Manifest**: `public/manifest.json`

## Catatan

- Push notification memerlukan HTTPS (sudah otomatis di Lovable preview/publish)
- Untuk testing lokal, gunakan `localhost` (diizinkan oleh browser)
