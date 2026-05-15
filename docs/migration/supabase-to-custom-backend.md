# Supabase to Custom Backend

Checklist:
1. Implementasikan backend endpoint sesuai contracts.
2. Ubah `VITE_AUTH_PROVIDER` dari `supabase` ke `http`.
3. Ubah `VITE_DATA_PROVIDER` dari `supabase` ke `http`.
4. Ubah `VITE_STORAGE_PROVIDER` jika perlu.
5. Set `VITE_API_BASE_URL`.
6. Jalankan test adapter HTTP.
7. Jalankan smoke test.
8. Deploy backend.
9. Monitor error.
10. Matikan akses Supabase langsung jika sudah tidak dipakai.
