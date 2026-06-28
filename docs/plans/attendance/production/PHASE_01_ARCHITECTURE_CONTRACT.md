# PHASE 01: Architecture Contract - Attendance V2

Dokumen ini mendefinisikan kontrak arsitektur final, struktur data (DTO), kode error standar, mode runtime, alur sinkronisasi, dan mekanisme rollback untuk modul **Attendance V2** SIPENA.

---

## 1. Kode Error Standar (Standard Error Codes)

Untuk memastikan konsistensi antara frontend dan backend, berikut adalah daftar kode error yang wajib digunakan saat terjadi kegagalan validasi atau operasional pada V2:

| Kode Error | HTTP Status | Deskripsi |
| --- | --- | --- |
| `ATTENDANCE_V2_NOT_ENABLED` | 400 | Engine V2 tidak diaktifkan pada sistem (konfigurasi `allowV2` bernilai false). |
| `ATTENDANCE_V2_WRITE_DISABLED` | 403 | Jalur penulisan V2 dimatikan (writesEnabled is false). |
| `ATTENDANCE_INVALID_DATE` | 400 | Tanggal yang dikirimkan tidak valid atau tidak menggunakan format ISO `YYYY-MM-DD`. |
| `ATTENDANCE_INVALID_STATUS` | 400 | Kode status presensi tidak valid (bukan H/I/S/A/D atau status terdaftar). |
| `ATTENDANCE_NON_EFFECTIVE_DAY` | 400 | Tanggal tersebut merupakan hari non-efektif (libur/akhir pekan sempit) sehingga tidak dapat ditulis. |
| `ATTENDANCE_LOCKED_PERIOD` | 400 | Tanggal berada pada periode bulan yang telah dikunci oleh administrator. |
| `ATTENDANCE_STUDENT_SCOPE_MISMATCH` | 400 | Murid yang dituju tidak terdaftar di dalam kelas yang sedang diproses. |
| `ATTENDANCE_CLASS_SCOPE_MISMATCH` | 400 | ID kelas pada payload berbeda dengan ID kelas pada dataset yang aktif. |
| `ATTENDANCE_DUPLICATE_RECORD` | 400 | Ditemukan duplikasi baris presensi untuk murid dan tanggal yang sama. |
| `ATTENDANCE_PERSISTENCE_FAILED` | 500 | Kegagalan saat menulis perubahan data ke database Supabase. |
| `ATTENDANCE_SHADOW_MISMATCH` | 200 (Log) | Ditemukan perbedaan (drift) hasil evaluasi antara engine V1 dan V2 di shadow mode. |
| `ATTENDANCE_UNAUTHORIZED` | 401 | Header Authorization Bearer token tidak valid atau tidak dikirim. |

---

## 2. Mode Runtime Final (Runtime Modes)

SIPENA V2 mendukung 5 mode runtime operasional yang dapat diatur via konfigurasi backend & frontend secara dinamis:

1. **`v1 active` (Engine V1 - Mode Aktif)**
   - Engine V1 menjadi satu-satunya pembaca dan penulis data.
   - Fitur baru V2 (Dispensasi `'D'` dan catatan murid) dinonaktifkan di UI.
   - Database constraint `'D'` diabaikan secara fungsional.

2. **`v2 shadow` (Engine V1 - V2 Shadowing)**
   - Tulisan dari user diproses menggunakan aturan V1.
   - Evaluasi V2 dijalankan di latar belakang secara paralel.
   - Perbedaan hasil (drift) dicatat ke database `activity_logs` sebagai aksi `PRESENSI_SHADOW_MISMATCH` untuk audit.
   - User tidak merasakan dampak visual atau perubahan performa.

3. **`v2 read-only` (Engine V2 - Mode Baca Saja)**
   - Seluruh visualisasi grid menggunakan data hasil perhitungan calendar & rule engine V2.
   - Tombol simpan, mutasi cell, import, dan hapus dinonaktifkan (read-only UI).

4. **`v2 active` (Engine V2 - Produksi Aktif)**
   - Engine V2 sepenuhnya mengendalikan pembacaan dan penulisan.
   - Status Dispensasi `'D'` dan input catatan murid aktif di grid tabel.
   - Validasi lock bulanan dan hari libur diproses ketat oleh V2.

5. **`v2 disabled` (Sistem Presensi Nonaktif)**
   - Seluruh fungsionalitas presensi dimatikan secara total.
   - User diarahkan ke halaman pemeliharaan atau info pembatasan akses.

---

## 3. Sumber Kebenaran Data & Alur Integrasi

### Sumber Kebenaran (Source of Truth)
- **Database Utama**: Supabase PostgreSQL milik pengguna.
- **Tabel Sumber**:
  - `attendance_records` -> Menyimpan status presensi murid dan kolom `note` tambahan.
  - `attendance_holidays` -> Menyimpan daftar libur kustom dan libur nasional.
  - `attendance_locks` -> Menyimpan status kunci kelas per bulan.
  - `attendance_day_events` -> Menyimpan custom label untuk hari tertentu.

---

### Alur Kerja Transisi & Fallback
```
                   +------------------------------+
                   |  Request Mutasi Dari Client  |
                   +--------------+---------------+
                                  |
                                  v
                   +--------------+---------------+
                   |    Evaluasi Runtime Engine    |
                   +-------+--------------+-------+
                           |              |
                +----------+              +----------+
                | Engine V1                          | Engine V2
                v                                    v
   +------------+------------+          +------------+------------+
   |   Tulis Menggunakan     |          |  Validasi Via V2 Rules  |
   |      Aturan V1          |          +------------+------------+
   +------------+------------+                       |
                |                                    v
                v                       +------------+------------+
     [Apakah Shadow Mode?]              |  Tulis Menggunakan      |
                |                       |      Aturan V2          |
          YA +--+--+ TIDAK              +------------+------------+
             |     |                                 |
             v     v                                 v
     +-------+--+  +-----------+               +-----+-----+
     | Kirim ke |  | Selesai   |               | Kirim ke  |
     | Shadow   |  | (V1 Only) |               | Audit Log |
     | Engine   |  +-----------+               +-----------+
     +---+------+
         |
         v
  [Bandingkan Hasil]
         |
   MISMATCH / DRIFT
         |
         v
+--------+--------+
| Catat Audit     |
| Shadow Mismatch |
+-----------------+
```

- **V1 Fallback**: Jika engine V2 mendeteksi inkonsistensi fatal pada calendar day (misal: prasyarat data murid kosong atau data libur corrupt), mutasi akan ditolak dengan kode `ATTENDANCE_V2_VALIDATION_PRECONDITIONS_FAILED` dan sistem mengarahkan administrator untuk memverifikasi data referensi.
- **Audit Logging**: Setiap mutasi pada V2 menghasilkan berkas log audit terstruktur yang ditulis ke tabel `activity_logs`.
- **Mekanisme Rollback**: Jika terjadi kendala pada mode `v2 active`, admin dapat langsung mengubah nilai environment variable backend ke `ATTENDANCE_BACKEND_ENGINE=v1` atau mengirimkan parameter override `/attendance/runtime` untuk mematikan engine V2 seketika (< 1 menit). Klien V1 akan membaca status `'D'` sebagai `'I'` (Izin) secara gracefully melalui mapper adaptif di frontend.

---

## 4. Spesifikasi Kontrak DTO & API

### Request DTOs

#### 1. Mutation Patch (Single Save)
- **Path**: `POST /attendance`
- **Body**:
  ```json
  {
    "studentId": "3491f868-6d8b-4a8e-a039-494b3fc54c40",
    "classId": "f7e2575d-3741-4a4e-a039-494b3fc54c40",
    "date": "2026-06-01",
    "status": "D",
    "note": "Dispensasi Lomba FLS2N"
  }
  ```

#### 2. Bulk Patch (Mass Save)
- **Path**: `POST /attendance/bulk`
- **Body**:
  ```json
  {
    "patches": [
      {
        "studentId": "3491f868-6d8b-4a8e-a039-494b3fc54c40",
        "classId": "f7e2575d-3741-4a4e-a039-494b3fc54c40",
        "date": "2026-06-01",
        "status": "H"
      }
    ]
  }
  ```

#### 3. Note Patch (Update Catatan)
- **Path**: `PATCH /attendance/note`
- **Body**:
  ```json
  {
    "studentId": "3491f868-6d8b-4a8e-a039-494b3fc54c40",
    "classId": "f7e2575d-3741-4a4e-a039-494b3fc54c40",
    "date": "2026-06-01",
    "note": "Terlambat karena ban bocor"
  }
  ```

#### 4. Lock Patch (Toggle Lock Bulanan)
- **Path**: `POST /attendance/lock`
- **Body**:
  ```json
  {
    "classId": "f7e2575d-3741-4a4e-a039-494b3fc54c40",
    "month": "2026-06",
    "isLocked": true
  }
  ```

#### 5. Holiday Patch (Toggle Hari Libur)
- **Path**: `POST /attendance/holiday`
- **Body**:
  ```json
  {
    "date": "2026-06-15",
    "description": "Tahun Baru Islam"
  }
  ```

#### 6. Day Event Patch (CRUD Event Hari)
- **Path**: `POST /attendance/day-event`
- **Body**:
  ```json
  {
    "date": "2026-06-20",
    "label": "Classmeeting Semester Genap",
    "description": "Lomba futsal antarkelas",
    "color": "green",
    "action": "upsert" // atau "delete"
  }
  ```

---

### Response DTOs

#### 1. Success Response (Dataset V2)
```json
{
  "data": {
    "classId": "f7e2575d-3741-4a4e-a039-494b3fc54c40",
    "month": "2026-06",
    "students": [
      { "id": "student-1", "name": "Budi", "nisn": "12345" }
    ],
    "records": [
      {
        "id": "v2-rec-1",
        "studentId": "student-1",
        "classId": "f7e2575d-3741-4a4e-a039-494b3fc54c40",
        "date": "2026-06-01",
        "status": "D",
        "note": "Dispen OSN",
        "createdAt": "2026-06-28T04:00:00.000Z",
        "updatedAt": "2026-06-28T04:00:00.000Z"
      }
    ],
    "days": [
      {
        "date": "2026-06-01",
        "isEffective": true,
        "dayOfWeek": 1
      }
    ],
    "holidays": [],
    "dayEvents": [],
    "locks": []
  }
}
```

#### 2. Error Response
```json
{
  "error": {
    "code": "ATTENDANCE_LOCKED_PERIOD",
    "message": "Aturan bisnis presensi V2 menolak perubahan ini.",
    "details": [
      {
        "severity": "error",
        "code": "LOCKED_WRITE_ATTEMPT",
        "message": "Writes are blocked for '2026-06-01' because the period is locked.",
        "field": "date"
      }
    ]
  }
}
```

#### 3. Shadow Comparison Report Response
```json
{
  "data": {
    "enabled": true,
    "mismatchCount": 1,
    "reports": [
      {
        "match": false,
        "dateChecked": "2026-06-28T12:00:00.000Z",
        "mismatchCount": 1,
        "mismatches": [
          {
            "studentId": "student-1",
            "date": "2026-06-01",
            "v1Status": "H",
            "v2Status": "D",
            "mismatchFields": ["status"]
          }
        ]
      }
    ]
  }
}
```

---

## 5. Sinkronisasi Environment Variables & Migrasi

### Environment Variables
Backend membaca konfigurasi runtime melalui variabel lingkungan berikut:
```env
# Menentukan default engine ("v1" atau "v2")
ATTENDANCE_BACKEND_ENGINE=v1

# Menentukan default mode ("active", "shadow", atau "disabled")
ATTENDANCE_BACKEND_MODE=shadow

# Mengizinkan V2 dimuat oleh sistem
ATTENDANCE_BACKEND_ALLOW_V2=true

# Mengizinkan penulisan mutasi V2 ke database
ATTENDANCE_BACKEND_ENABLE_WRITES=false

# Key keamanan untuk mengesampingkan config (override) khusus admin
ATTENDANCE_RUNTIME_ADMIN_KEY=secure-admin-passkey
```

### Prosedur Migrasi
1. Jalankan naskah SQL `001_ATTENDANCE_V2_MIGRATION.sql` via Supabase SQL Editor.
2. Restart backend server agar variabel lingkungan baru termuat.
3. Lakukan verifikasi runtime melalui `GET /api/attendance/runtime`.
