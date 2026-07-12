# Monitoring Produksi SIPENA

Monitoring memakai dua lapisan ringan:

1. Better Stack memeriksa `version.json`, homepage, dan `synthetic-health`.
2. GitHub Actions menjalankan `scripts/synthetic-monitor.mjs` setiap 15 menit.

Telegram dikonfigurasi dari **Admin > Monitoring Sistem**. Bot Token, Chat ID,
dan webhook HMAC key disimpan di Supabase Vault. Mengganti Telegram dari Admin
langsung berlaku tanpa build atau deploy ulang.

## Konfigurasi awal

1. Buka Admin > Monitoring Sistem.
2. Isi Bot Token, Chat ID, dan buat Webhook HMAC Key minimal 32 karakter.
3. Simpan, lalu tekan **Uji Telegram**.
4. Salin key yang baru dibuat sebelum menyimpan ke GitHub secret
   `SYNTHETIC_WEBHOOK_KEY`. Nilai tersimpan tidak dapat dibaca kembali.
5. Tambahkan secrets `SYNTHETIC_SUPABASE_URL`,
   `SYNTHETIC_SUPABASE_ANON_KEY`, `SYNTHETIC_CANARY_EMAIL`, dan
   `SYNTHETIC_CANARY_PASSWORD` pada repository source.
6. Tambahkan variable `SYNTHETIC_SITE_URL` bila URL bukan
   `https://sipenadev.netlify.app`.

Canary harus berupa akun guru khusus tanpa kelas atau data murid. Monitor hanya
melakukan login dan pembacaan minimal; tidak ada insert/update data aplikasi.

## Better Stack

- Homepage: setiap 3 menit, status 200.
- `/version.json`: setiap 1 menit, status 200.
- `/functions/v1/synthetic-health`: setiap 5 menit dengan header
  `x-sipena-monitor-key` berisi webhook key yang sama.
- Alert webhook diarahkan ke `/functions/v1/monitoring-alert` dengan HMAC. Jika
  penyedia tidak dapat membentuk HMAC, gunakan GitHub Actions sebagai pengirim
  alert dan Better Stack sebagai sumber uptime/recovery terpisah.

Jangan menaruh Bot Token, Chat ID, service role, JWT, atau webhook key pada file
repo, workflow YAML, URL query, maupun log.
