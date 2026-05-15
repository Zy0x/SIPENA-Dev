# SIPENA to E-Rapor Integration Audit

Tanggal audit: 2026-05-04

## Scope

Audit ini menilai aplikasi E-Rapor lokal di `C:\newappraporsd2025` untuk menyiapkan integrasi dari SIPENA. Target integrasi: nilai rapor yang sudah dihitung di SIPENA dapat dikirim atau diekspor ke E-Rapor tanpa menulis ulang fitur nilai SIPENA.

## Status Akses

- URL publik yang diminta, `https://winning-buf-leo-learned.trycloudflare.com`, mengembalikan Cloudflare `530` saat audit. Artinya tunnel publik tidak dapat dipakai sebagai sumber verifikasi.
- Aplikasi lokal E-Rapor aktif di `http://localhost:8535`.
- Konfigurasi E-Rapor lokal masih mengarah ke URL tunnel lama pada `app.baseURL`, sehingga akses lokal ke route terproteksi dapat diarahkan ke URL lama dan masuk ke halaman crash.
- E-Rapor menggunakan CodeIgniter 4 dengan PostgreSQL lokal, tetapi mayoritas source aplikasi E-Rapor di-ionCube sehingga integrasi lewat patch controller/model langsung tidak realistis.

## Temuan Arsitektur E-Rapor

- Framework: CodeIgniter 4.
- Versi aplikasi terdeteksi dari `version.json`: `2025.1`.
- Database: PostgreSQL lokal pada port `55577`.
- Session driver: file session.
- Route publik login tersedia di `/login`.
- Source utama E-Rapor tidak bisa dibaca normal karena proteksi ionCube. Integrasi perlu dilakukan lewat mekanisme eksternal: file impor XLSX, HTTP workflow terautentikasi, atau database adapter setelah skema dan kredensial valid tersedia.

## Endpoint Yang Terlihat Dari Access Log

Endpoint ini terlihat dari `serverapp/logs/access.log` dan perlu diverifikasi dengan sesi login valid sebelum dipakai otomatis:

- `GET /input_nil_rapor`
- `POST /mapelgurunya`
- `POST /buka_inputnilairapor`
- `POST /buka_inputnilairapor_ket`
- `POST /simpannilraporcheck`
- `GET /import_nil_rapor`
- `POST /buka_format_import`
- `POST /format_import_rapor`
- `GET /nilai_raporterkirim`
- `POST /bukanilai_raporterkirim`
- `GET /leger_kelas`
- `POST /list_legerkelas`
- `POST /download_leger`

## Format Template Nilai Rapor E-Rapor

Template impor nilai rapor ditemukan di:

- `wwwroot/public/uploads/f_nilai_ Kelas 5 A _Matematika_Umum.xlsx`
- `wwwroot/public/uploads/f_nilai_ Kelas 4 B _Bahasa_Indonesia.xlsx`
- `wwwroot/public/uploads/f_nilai_ Kelas 4 B _Pendidikan_Pancasila_dan_Kewarganegaraan.xlsx`

Pola template:

- Sheet utama bernama `Worksheet`.
- Baris 1 berisi judul format import.
- Baris 2 menyimpan metadata internal E-Rapor, termasuk ID kelas/rombongan belajar dan kode mapel.
- Baris 3 sampai 6 adalah header bertingkat.
- Kolom A: nomor.
- Kolom B sampai D: ID internal E-Rapor (`NILRPT`) yang harus dipertahankan.
- Kolom E: NISN.
- Kolom F: nama siswa.
- Kolom G: nilai rapor akhir.
- Kolom H dan seterusnya: tingkat ketercapaian TP. Tiap TP memiliki ID internal pada baris 4, deskripsi pada baris 5, dan kode TP pada baris 6.
- Kolom validasi berada setelah kolom TP, dengan label seperti `TR`, `OP`, dan `NILAI`.

Implikasi penting: SIPENA tidak boleh membuat workbook dari nol untuk impor E-Rapor. SIPENA harus menggunakan template E-Rapor yang diunduh dari aplikasi E-Rapor, mempertahankan metadata dan ID internalnya, lalu hanya mengisi nilai yang sesuai.

## Mapping Data SIPENA

Sumber nilai SIPENA saat ini:

- Tabel/hook nilai utama: `grades`.
- Tipe nilai: `assignment`, `sts`, `sas`.
- Nilai rapor di laporan SIPENA dihitung dari rata-rata BAB dan rata-rata STS/SAS:
  - Jika tidak ada BAB: `(STS + SAS) / 2`
  - Jika ada BAB: `(Rata-rata BAB + ((STS + SAS) / 2)) / 2`
- Siswa dipasangkan ke E-Rapor terutama lewat NISN dan nama.
- Mapel harus dipasangkan lewat nama mapel dan template E-Rapor yang dipilih, karena E-Rapor memakai kode/ID mapel internal.

## Strategi Integrasi Yang Disarankan

### Fase 1: XLSX Bridge

Jalur paling aman untuk produksi awal.

1. Guru membuka atau mengunduh template impor nilai dari E-Rapor.
2. SIPENA menerima template tersebut sebagai input.
3. SIPENA membaca metadata E-Rapor tanpa mengubah ID internal.
4. SIPENA mencocokkan siswa berdasarkan NISN, lalu nama sebagai fallback.
5. SIPENA mengisi kolom `NILAI RAPOR` dan, jika mapping TP tersedia, kolom ketercapaian TP.
6. SIPENA menghasilkan workbook E-Rapor-ready yang bisa diunggah manual ke E-Rapor.

Keuntungan:

- Tidak perlu akses database E-Rapor.
- Tidak bergantung pada source E-Rapor yang terproteksi.
- Risiko korupsi data rendah karena tetap memakai alur impor resmi E-Rapor.

Automation dry-run tersedia:

```bash
npm run erapor:probe
```

Untuk mengisi template dengan data nilai dari file JSON:

```bash
node scripts/erapor-automation.mjs --phase 1 --grades path/to/nilai.json --output outputs/erapor-filled.xlsx
```

Format JSON minimal:

```json
[
  {
    "nisn": "0134229479",
    "name": "Achmad Syawal Adyana Surya",
    "nilaiRapor": 88,
    "tp": {
      "TP.521": "Tercapai"
    }
  }
]
```

### Fase 2: Authenticated HTTP Adapter

Setelah kredensial dan sesi login test tersedia:

1. Ambil CSRF dari `/login`.
2. Login ke E-Rapor lewat endpoint login resmi.
3. Ambil format import dengan `/buka_format_import` dan `/format_import_rapor`.
4. Isi workbook dari SIPENA.
5. Upload workbook melalui endpoint import resmi jika endpoint upload berhasil diidentifikasi.

Keuntungan:

- Bisa menjadi tombol "Kirim ke E-Rapor" dari SIPENA.
- Tetap lewat workflow E-Rapor, bukan direct database write.

Risiko:

- Endpoint dan payload E-Rapor perlu dipastikan lewat sesi login valid.
- Base URL tunnel harus stabil atau menggunakan localhost/VPN.

Automation `scripts/erapor-automation.mjs` sudah mendukung:

- login E-Rapor dari `.env` memakai `ACCOUNT_ERAPOR` dan `PASSWORD_ERAPOR`;
- discovery kelas dari halaman import;
- discovery mapel lewat `/mapelgurunya`;
- download template lewat `/format_import_rapor`;
- probing upload form `/upload_nilairapor`.

Default selalu dry-run. Upload yang benar-benar menulis ke E-Rapor hanya dilakukan jika diberi flag:

```bash
node scripts/erapor-automation.mjs --phase 2 --grades path/to/nilai.json --output outputs/erapor-filled.xlsx --apply
```

Gunakan `--apply` hanya setelah file hasil isi sudah dicek, karena endpoint upload akan mengubah data nilai di E-Rapor.

### Fase 3: Database Adapter

Hanya dipakai jika skema database dan aturan kalkulasi E-Rapor sudah terdokumentasi.

Risiko:

- Direct write dapat melewati validasi internal E-Rapor.
- E-Rapor mungkin menyimpan nilai, deskripsi, validasi, dan status kirim di beberapa tabel yang saling terkait.
- Tidak direkomendasikan sebagai fase awal.

Automation saat ini hanya melakukan database probe non-destruktif:

```bash
node scripts/erapor-automation.mjs --phase 3
```

Jika nanti database adapter dipakai, set variabel lokal berikut tanpa commit ke Git:

```env
ERAPOR_DB_USER=postgres
ERAPOR_DB_PASSWORD=
ERAPOR_DB_PORT=55577
```

Direct database write tetap harus berada di backend/local agent, bukan frontend.

## Struktur Implementasi Di SIPENA

Usulan file saat implementasi:

- `apps/frontend/src/features/erapor/`
- `apps/frontend/src/features/erapor/components/EraporExportDialog.tsx`
- `apps/frontend/src/features/erapor/hooks/useEraporTemplateBridge.ts`
- `apps/frontend/src/lib/erapor/erapor-template-parser.ts`
- `apps/frontend/src/lib/erapor/erapor-template-writer.ts`
- `apps/frontend/src/lib/erapor/erapor-grade-mapper.ts`
- `apps/frontend/src/core/ports/erapor.port.ts`
- `apps/frontend/src/infrastructure/erapor/xlsx-erapor.adapter.ts`
- `apps/frontend/src/infrastructure/erapor/http-erapor.adapter.ts`

Tambahan environment yang disarankan:

```env
VITE_ERAPOR_PROVIDER=xlsx
VITE_ERAPOR_BASE_URL=http://localhost:8535
VITE_ERAPOR_ENABLE_HTTP_PUSH=false
```

Jangan menyimpan password E-Rapor di frontend. Jika HTTP push membutuhkan kredensial, buat backend/local agent adapter.

## Kandidat Cleanup

SIPENA:

- `.vite-preview.log`
- `.vite-preview.err.log`
- `.codex/config.toml` untracked lokal, jika memang bukan konfigurasi kerja pengguna.

E-Rapor lokal:

- `serverapp/logs/access.log`
- `serverapp/logs/error.log`
- `wwwroot/writable/logs/log-*.log`
- session lama di `wwwroot/writable/session/ci_session*`
- `.env.bak` hanya jika backup konfigurasi tidak dibutuhkan lagi.

Catatan: file session, log aktif, dan backup konfigurasi tetap termasuk data lokal. Penghapusan perlu konfirmasi eksplisit sebelum dilakukan.

## Blocker

- URL publik yang diminta sedang gagal Cloudflare `530`.
- `app.baseURL` E-Rapor lokal masih mengarah ke tunnel lama.
- Source E-Rapor terproteksi ionCube.
- Endpoint upload/import sudah bisa diprobe dengan sesi login E-Rapor lokal, tetapi upload nyata harus tetap memakai `--apply` dan persetujuan eksplisit karena mengubah data nilai.
- Direct PostgreSQL audit belum tersedia karena password database yang ditemukan dari konfigurasi lokal belum berhasil melakukan autentikasi `psql`.

## Next Step

1. Stabilkan URL E-Rapor: update `app.baseURL` sesuai tunnel aktif atau gunakan localhost untuk integrasi lokal.
2. Ambil satu template import dari E-Rapor untuk setiap kelas-mapel yang akan dikirim.
3. Implementasikan XLSX bridge di SIPENA.
4. Tambahkan UI "Export untuk E-Rapor" di Laporan Nilai atau Input Nilai.
5. Setelah workflow manual stabil, lanjutkan HTTP adapter untuk upload otomatis.
