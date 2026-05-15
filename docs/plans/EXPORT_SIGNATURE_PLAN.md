# Rencana: Tanda Tangan Resmi pada Ekspor

## Tujuan
Menambahkan blok tanda tangan resmi (seperti format surat resmi Indonesia) pada semua hasil ekspor (PDF, Excel, CSV).

## Format Tanda Tangan

```
                                        [Kota], [Tanggal Lengkap]
                                        [Jabatan / Keterangan]



                                        ___________________________
                                        [Nama Penanda Tangan]
                                        NIP. [Nomor jika ada]
```

### Contoh:
```
                                        Bandung, 14 Maret 2026
                                        Guru Mata Pelajaran



                                        ___________________________
                                        Ahmad Fauzi, S.Pd.
                                        NIP. 198501012010011001
```

## Data yang Diperlukan (Pengaturan)

| Field | Tipe | Keterangan |
|-------|------|------------|
| `signature_city` | text | Kota lokasi tanda tangan |
| `signature_name` | text | Nama lengkap penanda tangan |
| `signature_title` | text | Jabatan (Guru Mata Pelajaran / Kepala Sekolah / dll) |
| `signature_nip` | text (opsional) | NIP jika ada |
| `signature_school` | text (opsional) | Nama sekolah |

## Implementasi

### Fase 1: Pengaturan Tanda Tangan
1. Tambah form pengaturan tanda tangan di halaman **Pengaturan** (section baru)
2. Simpan di tabel `user_preferences` atau tabel baru `signature_settings`
3. Kolom: `user_id`, `city`, `name`, `title`, `nip`, `school_name`

### Fase 2: Integrasi Export PDF
1. Di `src/lib/exportReports.ts`, tambahkan fungsi `addSignatureBlock(doc, config)`
2. Posisi: di bawah tabel data, rata kanan
3. Jarak dari tabel: ~30mm
4. Format:
   - Kota + tanggal (auto dari tanggal export)
   - Jabatan
   - Spasi untuk tanda tangan (~25mm)
   - Garis bawah + nama
   - NIP (jika ada)

### Fase 3: Integrasi Export Excel
1. Tambahkan baris tanda tangan di bawah data sheet
2. Gunakan merge cells untuk rata kanan
3. Format serupa dengan PDF

### Fase 4: Toggle On/Off
1. Tambahkan checkbox "Sertakan tanda tangan" pada dialog export
2. Default: aktif jika data tanda tangan sudah diisi

## SQL Schema

```sql
CREATE TABLE IF NOT EXISTS public.signature_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  city TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT 'Guru Mata Pelajaran',
  nip TEXT DEFAULT '',
  school_name TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.signature_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own signature"
  ON public.signature_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

## Estimasi
| Task | Kompleksitas |
|------|-------------|
| SQL + form pengaturan | Rendah |
| PDF signature block | Sedang |
| Excel signature block | Sedang |
| Toggle on export dialog | Rendah |
| **Total** | **~1-2 iterasi** |
