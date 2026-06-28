# PHASE 04: Business Logic Verification - Attendance V2

Dokumen ini merangkum penyempurnaan, verifikasi, dan cakupan pengujian (test coverage) pada mesin logika bisnis (**Business Logic Engine**) untuk modul **Attendance V2** SIPENA agar siap dirilis ke tingkat produksi secara deterministik.

---

## 1. Calendar Engine & Conflict Resolvers

Kalender V2 mendukung kalkulasi hari efektif sekolah secara dinamis dengan menyelesaikan pertentangan aturan (*conflict priority resolution*) berdasarkan urutan prioritas spesifik berikut:

1. **Administrative Closure (Penutupan Sekolah Darurat)** (Prioritas 1 - Tertinggi)
   - Diberlakukan oleh Administrator secara global atau per kelas. Menolak segala penulisan presensi.
2. **Lock Period (Penguncian Bulanan)** (Prioritas 1)
   - Mengunci input presensi kelas untuk rekapitulasi bulanan resmi.
3. **Forced Overrides (Paksaan Tanggal)** (Prioritas 2)
   - `FORCED_EFFECTIVE` (Memaksa hari masuk pengganti, misal hari Sabtu masuk).
   - `FORCED_HOLIDAY` (Memaksa hari libur kustom di luar kalender biasa).
4. **Class Specific Events (Kegiatan Khusus Kelas)** (Prioritas 3)
5. **School Wide Events (Kegiatan Umum Sekolah)** (Prioritas 4)
6. **Holidays (Hari Libur Nasional / Kalender)** (Prioritas 5)
7. **Weekend Rules (Sabtu/Minggu)** (Prioritas 6)
   - Format 5 Hari Sekolah: Sabtu & Minggu libur.
   - Format 6 Hari Sekolah: Hanya Minggu yang libur.
8. **Default School Days (Hari Masuk Biasa)** (Prioritas 7 - Terendah)

---

## 2. Status & Rule Engine

### Status Presensi Canonical:
- **`H` (Hadir)**: Dihitung sebagai Kehadiran (bobot 1.0).
- **`I` (Izin)**: Dihitung sebagai Ketidakhadiran dengan alasan (bobot 0.0, **wajib menyertakan catatan note**).
- **`S` (Sakit)**: Dihitung sebagai Ketidakhadiran karena medis (bobot 0.0, **wajib menyertakan catatan note**).
- **`A` (Alpha)**: Dihitung sebagai Mangkir tanpa keterangan (bobot 0.0).
- **`D` (Dispensasi)**: Dihitung sebagai Kehadiran Resmi (bobot 1.0, **wajib menyertakan catatan note**).
- **`L` (Libur)**: Penanda hari libur efektif (bobot 0.0).
- **`-` (Belum Diisi)**: Status placeholder.

### Aturan Bisnis (Rule Engine Verification):
- **Note Validation Check**: Klien V2 menolak mutasi status `I`, `S`, atau `D` jika kolom catatan `note` kosong atau hanya berupa spasi.
- **Locked Period & Non-Effective Day Block**: Penulisan pada periode yang terkunci atau pada hari libur efektif secara otomatis diblokir oleh Rule Engine.

---

## 3. Summary Engine

Kalkulasi persentase dan rekapitulasi presensi berjalan secara deterministik:
- **Dispensasi (`'D'`)**: Dihitung sebagai status presensi yang setara dengan **Hadir** dalam kalkulasi presentasi bulanan/tahunan (menambah `presentCount`).
- **Kalkulasi Persentase Tahunan**:
  $$\text{Persentase Kehadiran} = \left( \frac{\text{presentCount}}{\text{totalDays}} \right) \times 100$$
  *(Dibulatkan ke bilangan bulat terdekat)*

---

## 4. Pengujian Logika Bisnis (Unit & Regression Tests)

Semua logika di atas dicakup oleh unit test mandiri di [attendanceBusinessV2.test.ts](file:///E:/Data/GitHub/SIPENA/tessipena3-f7e2575d/apps/frontend/src/features/attendance/testing/attendanceBusinessV2.test.ts):

- **Calendar Engine Tests**: Memverifikasi pembuatan hari kalender yang tepat untuk 5 hari dan 6 hari sekolah.
- **Conflict Resolver Tests**: Memastikan skenario pertikaian aturan (misalnya libur vs event vs closure) diselesaikan sesuai hierarki prioritas.
- **Status Engine Tests**: Memastikan Dispensasi (`'D'`) memerlukan alasan catatan dan bernilai hadir.
- **Rule Engine Tests**: Memastikan penolakan penulisan pada hari libur dan periode terkunci.
- **Summary Engine Tests**: Memverifikasi keakuratan rekap harian, bulanan murid, dan perhitungan persentase tahunan.
- **Regression Tests**: Menjamin output pemetaan canonical V1 dan V2 terhindar dari kebocoran data (*data leakage*) atau korupsi struktur.
