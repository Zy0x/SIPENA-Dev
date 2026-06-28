# PROPOSAL PARADIGMA DOMAIN: Dari "Holiday System" Menuju "Academic Calendar Engine" (ACE) SIPENA

Dokumen ini merangkum pergeseran paradigma domain model untuk tata kelola kalender dan presensi di SIPENA. Alih-alih memperlakukan hari libur sebagai "tempelan di kalender", proposal ini mendesain ulang model domain presensi dengan memperkenalkan **Academic Calendar Engine (ACE)**—sebuah mesin kalender akademik terpadu berbasis Google Calendar Model yang menjadi sumber kebenaran tunggal (*source of truth*) untuk menentukan hari efektif, kegiatan sekolah, dan status presensi murid secara otomatis.

---

## 1. Pergeseran Paradigma: Mengapa "Holiday System" Runtuh?

Pada sistem tradisional, hari libur disimpan sebagai data pasif (`attendance_holidays`) yang terpisah dari kegiatan sekolah (`attendance_day_events`). Paradigma ini runtuh ketika dihadapkan pada skenario nyata sekolah yang sangat dinamis:

*   **Kegiatan khusus tidak selalu berarti libur** (misalnya P5 atau Ujian Akhir, murid tetap masuk dan presensi tetap dicatat).
*   **Lingkup (*Scope*) yang sangat bervariasi**: Libur atau kegiatan bisa berlaku hanya untuk satu murid (dispensasi khusus), satu kelas (study tour), satu tingkat kelas (asesmen nasional), atau seluruh sekolah (libur nasional).
*   **Tumpang Tindih & Bentrokan**: Pada tanggal yang sama, bisa terdapat beberapa aturan kalender yang bertabrakan. Tanpa adanya sistem prioritas yang jelas, perhitungan hari efektif akan menjadi tidak deterministik.

---

## 2. Struktur Domain Model Baru: `CalendarEvent`

Sebagai solusi struktural, kita menghapus tabel `attendance_holidays` dan `attendance_day_events` secara bertahap, lalu menggantikannya dengan satu entitas tunggal bernama `CalendarEvent`.

### Skema Tabel Basis Data `calendar_events`:

| Nama Kolom | Tipe Data | Keterangan |
| :--- | :--- | :--- |
| `id` | `uuid` (PK) | Identifier unik event |
| `title` | `varchar` | Nama kegiatan/libur |
| `description` | `text` | Deskripsi detail kegiatan |
| `event_type` | `enum` | `HOLIDAY \| EXAM \| P5 \| MEETING \| ASSEMBLY \| STUDY_TOUR \| FIELD_TRIP \| SPORT \| CUSTOM` |
| `scope` | `enum` | `GLOBAL \| SCHOOL \| GRADE \| CLASS \| STUDENT \| TEACHER` |
| `target` | `varchar` | Nilai target scope (misal: ID kelas, ID murid, angka tingkat 1-6, atau NULL jika global) |
| `priority` | `int` | Bobot prioritas (makin tinggi angka, makin memenangkan konflik) |
| `start_date` | `date` | Tanggal mulai event (mendukung rentang hari) |
| `end_date` | `date` | Tanggal selesai event (Nullable) |
| `repeat_rule` | `varchar` | Aturan pengulangan kegiatan (misal: `weekly`, `monthly`, atau NULL) |
| `is_working_day` | `boolean` | Menentukan apakah hari tersebut wajib mencatat presensi (`true` = hari masuk, `false` = hari libur) |
| `color` | `varchar` | Kode warna visual di kalender |
| `created_by` | `uuid` (FK) | ID Pembuat |

---

## 3. Resolusi 8 Skenario Sekolah dengan `CalendarEvent`

Model domain baru ini menyelesaikan seluruh skenario kompleks sekolah dengan sangat elegan:

### Skenario 1: Hari Libur per Kelas (Study Tour Kelas 5A)
*   **Konfigurasi**: `scope = CLASS`, `target = "id_kelas_5A"`, `is_working_day = false`, `event_type = STUDY_TOUR`.
*   **Hasil**: Kelas 5A non-efektif (tidak mencatat presensi), sementara Kelas 5B dan 5C tetap belajar seperti biasa.

### Skenario 2: Libur Seluruh Sekolah (Hari Raya)
*   **Konfigurasi**: `scope = SCHOOL`, `target = NULL`, `is_working_day = false`, `event_type = HOLIDAY`.
*   **Hasil**: Berlaku global untuk semua murid di sekolah tersebut.

### Skenario 3: Libur Tingkat (Field Trip Tingkat 1)
*   **Konfigurasi**: `scope = GRADE`, `target = "1"`, `is_working_day = false`, `event_type = FIELD_TRIP`.
*   **Hasil**: Seluruh kelas di tingkat 1 (1A, 1B, 1C) menjadi non-efektif.

### Skenario 4: Kegiatan Khusus Mapel / Pengisi Jam
*   **Konfigurasi**: Diatasi dengan integrasi event ke tingkat jadwal pelajaran (*schedule integration*) tanpa harus membuat pengecualian manual di grid kehadiran harian.

### Skenario 5: Kegiatan Individual (Dispensasi Murid Ahmad mengikuti O2SN)
*   **Konfigurasi**: `scope = STUDENT`, `target = "id_murid_ahmad"`, `is_working_day = true`, `event_type = SPORT`.
*   **Hasil**: Hanya murid Ahmad yang otomatis tercatat dalam tugas luar/dispensasi pada hari tersebut tanpa memengaruhi murid lain di kelasnya.

### Skenario 6: Libur/Kegiatan Berulang (Senam Jumat Pagi)
*   **Konfigurasi**: `repeat_rule = "weekly"`, `start_date = "2026-07-03"` (hari Jumat).
*   **Hasil**: Sistem otomatis memetakan kegiatan senam setiap hari Jumat tanpa membuat record berulang di database.

### Skenario 7: Rentang Hari (Pesantren Ramadan)
*   **Konfigurasi**: `start_date = "2026-03-01"`, `end_date = "2026-03-18"`, `is_working_day = true` (kegiatan wajib masuk).
*   **Hasil**: Sistem menghasilkan rentang 18 hari efektif bermerek Pesantren Ramadan hanya dari **1 baris record** database.

### Skenario 8: Konflik Tanggal (Bentrokan Libur Nasional vs Study Tour)
*   **Konfigurasi**:
    - Event A: Hari Libur Nasional (`priority = 100`, `is_working_day = false`)
    - Event B: Study Tour Kelas 5 (`priority = 80`, `is_working_day = true`)
*   **Hasil**: Rule engine memilih prioritas tertinggi (Event A: `100`), sehingga hari tersebut tetap libur sekolah.

---

## 4. Desain Logika Rule Engine Kalender Akademik

Generator presensi tidak lagi melakukan kueri langsung ke tabel libur secara ad-hoc, melainkan berkonsultasi kepada **Academic Calendar Engine (ACE)** untuk mendapatkan status hari efektif:

```
                  [ Permintaan Cek Tanggal & Murid ]
                                  ↓
                  [ Cari Semua Event yang Aktif ]
                 (Cocokkan Tanggal, Kelas, & Murid)
                                  ↓
                [ Filter Berdasarkan Prioritas ]
                 (Urutkan priority: Tinggi -> Rendah)
                                  ↓
                  [ Ambil Event Pemenang Teratas ]
                                  ↓
                    [ Baca is_working_day ]
                   /                      \
               [ true ]                [ false ]
                 /                          \
   [ Hari Efektif Masuk ]           [ Hari Non-Efektif (Libur) ]
  (Presensi Wajib Dicatat)            (Sel Grid Diarsir / Skip)
```

### Penanganan Masalah "Terlalu Banyak Hari Libur" (1000 Custom Holidays):
Dengan memisahkan model domain menjadi `CalendarEvent`, penumpukan record libur diatasi secara cerdas:
1.  **Event Bulanan**: Sistem membatasi penayangan kalender hanya untuk rentang bulan/tahun ajaran aktif menggunakan indeks `start_date` dan `end_date`.
2.  **Rentang & Pengulangan**: 1000 hari libur yang sebelumnya dibuat satu per satu kini diringkas menggunakan `repeat_rule` dan `end_date` (misal 1 record mencakup libur semester 2 minggu), mengurangi jumlah baris data hingga 95%.

---

## 5. Rencana Transisi & Dekopling Bertahap

Untuk mengubah sistem tanpa merusak fungsionalitas Attendance V1 yang sedang aktif di produksi:

*   **Langkah 1**: Buat tabel baru `calendar_events` dan `calendar_event_rules`.
*   **Langkah 2**: Buat adapter pembaca V1 (`HolidayV1Adapter`) yang secara transparan membaca data dari tabel `calendar_events` (tipe `HOLIDAY`) dan menyajikannya dalam format lama `HolidayRecord[]` agar V1 tetap berjalan normal.
*   **Langkah 3**: Lakukan migrasi data dari tabel lama `attendance_holidays` ke `calendar_events` dengan tipe `'HOLIDAY'` dan `scope = 'SCHOOL'`.
*   **Langkah 4**: Alihkan hook presensi secara bertahap untuk murni mendengarkan keputusan dari mesin ACE.
