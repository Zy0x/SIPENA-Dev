# Database

Provider saat ini adalah Supabase PostgreSQL. Migration existing tetap berada di `supabase/migrations`.

Untuk PostgreSQL sendiri:
1. Export schema dan data dari Supabase.
2. Restore ke PostgreSQL target.
3. Implementasikan repository backend.
4. Ganti frontend ke HTTP adapter.
5. Matikan akses langsung Supabase setelah smoke test aman.
