# SIPENA — Activity Logs & Audit Trail Setup

## Deskripsi

File `ACTIVITY_LOGS_SETUP.sql` membuat sistem **pencatatan aktivitas** dan **notifikasi tamu**.

## Tabel yang Dibuat

| Tabel | Fungsi |
|---|---|
| `activity_logs` | Log setiap aksi CRUD (buat, edit, hapus kelas/mapel/nilai) |
| `guest_activity_logs` | Log akses tamu via shared link |
| `audit_trail_diffs` | Diff perubahan data (old_data vs new_data) |

## Kolom Utama `activity_logs`

- `user_id` — pemilik data
- `actor_type` — `owner` atau `guest`
- `action` — `create`, `update`, `delete`, `duplicate`
- `entity_type` — `class`, `subject`, `grade`, `attendance`
- `entity_name` — nama entitas yang berubah
- `metadata` — data tambahan dalam format JSON

## Digunakan Oleh

- **Dashboard** — menampilkan "Aktivitas Terakhir" (refresh 15 detik)
- **Admin Panel** — audit trail lengkap
- **Hook**: `useActivityLogs.ts`
- **Utility**: `src/lib/activityLogger.ts`

## Catatan

- File ini **menggantikan** `AUDIT_TRAIL_SETUP.sql` (sudah dihapus karena overlap)
