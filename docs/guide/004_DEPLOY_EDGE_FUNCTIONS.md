# Panduan Deploy Edge Functions ke Supabase Eksternal

## Prasyarat

1. **Install Supabase CLI** di komputer Anda:
   ```bash
   # Menggunakan npm
   npm install -g supabase
   
   # Atau menggunakan Homebrew (macOS/Linux)
   brew install supabase/tap/supabase
   ```

2. **Login ke Supabase CLI**:
   ```bash
   supabase login
   ```
   Ini akan membuka browser untuk autentikasi dengan akun Supabase Anda.

3. **Link proyek** (opsional tapi direkomendasikan):
   ```bash
   supabase link --project-ref jdncrsmjvbweyxcbtnou
   ```

## Struktur Edge Functions

Edge functions berada di folder `supabase/functions/`:

```
supabase/functions/
├── admin-auth/
│   └── index.ts        # Autentikasi admin database
├── admin-database/
│   └── index.ts        # Backup, restore, dan delete database
├── admin-account-stats/
│   └── index.ts        # Statistik akun admin
├── delete-auth-user/
│   └── index.ts        # KRITIS: Hapus user dari Auth + list users (WAJIB DEPLOY!)
├── delete-semester-data/
│   └── index.ts        # BARU: Hapus data semester/tahun ajaran secara reliabel
├── predict-grades/
│   └── index.ts        # Prediksi nilai menggunakan AI (Groq)
├── process-account-deletion/
│   └── index.ts        # Proses penghapusan akun
├── send-otp-email/
│   └── index.ts        # Kirim OTP email via Resend
└── verify-recaptcha/
    └── index.ts        # Verifikasi reCAPTCHA v3 token (server-side)
```

## Deploy Edge Functions

### 1. Deploy Semua Functions

```bash
# Deploy semua edge functions ke proyek eksternal
supabase functions deploy --project-ref jdncrsmjvbweyxcbtnou
```

### 2. Deploy Function Tertentu

```bash
# Deploy admin-database
supabase functions deploy admin-database --project-ref jdncrsmjvbweyxcbtnou

# KRITIS: Deploy delete-auth-user (WAJIB untuk panel admin!)
supabase functions deploy delete-auth-user --project-ref jdncrsmjvbweyxcbtnou

# Deploy predict-grades  
supabase functions deploy predict-grades --project-ref jdncrsmjvbweyxcbtnou

# Deploy process-account-deletion
supabase functions deploy process-account-deletion --project-ref jdncrsmjvbweyxcbtnou

# Deploy send-otp-email
supabase functions deploy send-otp-email --project-ref jdncrsmjvbweyxcbtnou

# Deploy verify-recaptcha
supabase functions deploy verify-recaptcha --project-ref jdncrsmjvbweyxcbtnou
```

## Konfigurasi Secrets

Setelah deploy, Anda perlu menambahkan secrets yang diperlukan:

```bash
# Set semua secrets sekaligus
supabase secrets set \
  ADMIN_DB_PASSWORD="$ADMIN_DB_PASSWORD" \
  SBASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  GROQ_API_KEY="groq_api_key_anda" \
  RESEND_OTP_KEY="resend_api_key_anda" \
  RECAPTCHA_SECRET_KEY="recaptcha_secret_anda" \
  VITE_RECAPTCHA_SITE_KEY="recaptcha_site_key_anda" \
  --project-ref jdncrsmjvbweyxcbtnou
```

### Secrets yang Diperlukan per Function:

| Function | Secrets Diperlukan |
|----------|-------------------|
| `admin-auth` | `ADMIN_DB_PASSWORD` |
| `admin-database` | `ADMIN_DB_PASSWORD`, `SBASE_SERVICE_ROLE_KEY` |
| `admin-account-stats` | `SBASE_SERVICE_ROLE_KEY` |
| `delete-auth-user` | `ADMIN_DB_PASSWORD`, `SBASE_SERVICE_ROLE_KEY` |
| `delete-semester-data` | `SBASE_URL`, `SBASE_SERVICE_ROLE_KEY` |
| `predict-grades` | `GROQ_API_KEY`, `SBASE_SERVICE_ROLE_KEY` |
| `process-account-deletion` | `ADMIN_DB_PASSWORD`, `SBASE_SERVICE_ROLE_KEY` |
| `send-otp-email` | `RESEND_OTP_KEY`, `SBASE_SERVICE_ROLE_KEY` |
| `verify-recaptcha` | `RECAPTCHA_SECRET_KEY` |

## Verifikasi Deployment

```bash
# Lihat daftar functions yang sudah di-deploy
supabase functions list --project-ref jdncrsmjvbweyxcbtnou

# Lihat logs function tertentu
supabase functions logs admin-database --project-ref jdncrsmjvbweyxcbtnou
```

## Troubleshooting

### Error "Function not found"
- Pastikan folder function memiliki file `index.ts`
- Pastikan tidak ada error syntax di kode

### Error "Secret not found"
- Jalankan `supabase secrets list --project-ref jdncrsmjvbweyxcbtnou`
- Set secret yang belum ada dengan perintah `supabase secrets set`

### Error CORS
- Semua functions sudah dikonfigurasi dengan CORS headers
- Pastikan origin request valid

## Catatan Penting

1. **Jangan gunakan Lovable Cloud** - Functions ini harus di-deploy manual ke Supabase eksternal
2. **Backup secrets** - Simpan semua secrets di tempat aman (password manager)
3. **Test setelah deploy** - Verifikasi setiap function bekerja dengan benar
4. **Monitor logs** - Gunakan `supabase functions logs` untuk debugging

## URL Edge Functions

Setelah deploy, functions dapat diakses di:
```
https://jdncrsmjvbweyxcbtnou.supabase.co/functions/v1/{nama-function}
```

Contoh:
- `https://jdncrsmjvbweyxcbtnou.supabase.co/functions/v1/admin-database`
- `https://jdncrsmjvbweyxcbtnou.supabase.co/functions/v1/delete-auth-user` ← KRITIS untuk statistik akun!
- `https://jdncrsmjvbweyxcbtnou.supabase.co/functions/v1/predict-grades`
- `https://jdncrsmjvbweyxcbtnou.supabase.co/functions/v1/process-account-deletion`
- `https://jdncrsmjvbweyxcbtnou.supabase.co/functions/v1/send-otp-email`

## ⚠️ LANGKAH KRITIS - Deploy delete-auth-user

Function `delete-auth-user` adalah **WAJIB** untuk:
- ✅ Melihat jumlah akun Auth di statistik admin
- ✅ Melihat daftar semua user di "Statistik Per Akun"
- ✅ Menghapus user dari Supabase Auth saat admin approve penghapusan akun

**Deploy segera dengan:**
```bash
supabase functions deploy delete-auth-user --project-ref jdncrsmjvbweyxcbtnou
```

**Set secrets yang diperlukan:**
```bash
supabase secrets set ADMIN_DB_PASSWORD="$ADMIN_DB_PASSWORD" SBASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" --project-ref jdncrsmjvbweyxcbtnou
```

Setelah deploy, akun akan muncul di panel admin.
