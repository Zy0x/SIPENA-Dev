# Standar Teknis: Integrasi & Manajemen Feature Flags SIPENA

Dokumen ini mendefinisikan standar wajib bagi pengembang (AI maupun manusia) dalam merilis halaman, rute, atau fitur baru di SIPENA. Seluruh fungsionalitas baru wajib dikontrol melalui sistem **Feature Flags** demi keamanan data akademik, stabilitas produksi, serta kemudahan audit.

---

## 1. Alur Pendaftaran Feature Flag Baru

Setiap kali membuat halaman atau fitur indukan baru, daftarkan hanya di **Feature Registry**. Jangan membuat flag untuk tombol kecil, variasi visual, atau panel minor kecuali fitur tersebut berisiko tinggi atau perlu rollout terpisah.

### Langkah 1: Daftarkan di `FEATURE_REGISTRY`
Tambahkan satu entri baru pada `FEATURE_REGISTRY` di [featureAccess.ts](file:///E:/Data/GitHub/SIPENA/tessipena3-f7e2575d/apps/frontend/src/app/providers/featureAccess.ts):

```typescript
{
  id: "myNewPage",
  key: "page.my-new-page",
  name: "Nama Halaman Baru",
  description: "Deskripsi singkat yang mudah dipahami admin.",
  type: "page",
  defaultEnabled: false,
  globalKillSwitch: true,
  riskLevel: "medium",
  owner: "academic",
  isMajor: true,
  metadata: { route: "/my-new-page", owner: "academic", isMajor: true },
}
```

`FEATURE_KEYS`, `DEFAULT_FEATURE_DEFINITIONS`, dan payload sinkronisasi Admin Panel dihasilkan dari registry ini. Jangan menduplikasi key secara manual di tempat lain.

### Langkah 2: Sinkronisasi Otomatis Admin Panel
Saat admin membuka tab **Kontrol Fitur**, frontend mengirim `FEATURE_CATALOG_SYNC_PAYLOAD` ke Edge Function `admin-feature-access` dengan action `sync-feature-catalog`.

Sinkronisasi ini:
- menambahkan flag baru yang belum ada di `public.feature_flags`;
- memperbarui metadata aman seperti nama, deskripsi, tipe, risiko, dan metadata;
- tidak menghapus atau mengubah audience role/user yang sudah admin atur;
- tidak membutuhkan SQL manual untuk fitur indukan baru.

SQL/migration manual hanya diperlukan jika ada perubahan struktur tabel, bukan untuk mendaftarkan flag fitur indukan biasa.

---

## 2. Implementasi Guard (Penjagaan Akses)

### A. Penjagaan Rute Halaman (`App.tsx`)
Gunakan komponen `<FeatureRouteGuard>` untuk membungkus elemen rute baru Anda di [App.tsx](file:///E:/Data/GitHub/SIPENA/tessipena3-f7e2575d/apps/frontend/src/app/App.tsx):

```tsx
<Route 
  path="/my-new-page" 
  element={
    <FeatureRouteGuard featureKey={FEATURE_KEYS.myNewFeature}>
      <MyNewPage />
    </FeatureRouteGuard>
  } 
/>
```

### B. Penjagaan Menu Navigasi (`AppLayout.tsx`)
Sertakan parameter `featureKey` pada objek `navItems` di [AppLayout.tsx](file:///E:/Data/GitHub/SIPENA/tessipena3-f7e2575d/apps/frontend/src/components/AppLayout.tsx) agar menu otomatis disembunyikan/ditampilkan berdasarkan status flag:

```typescript
{ 
  href: "/my-new-page", 
  label: "Fitur Baru", 
  icon: Sparkles, 
  featureKey: FEATURE_KEYS.myNewFeature 
}
```

### C. Penjagaan Komponen UI / Inline Logic
Gunakan hook `useFeatureFlags()` untuk memeriksa izin akses secara dinamis di dalam komponen:

```tsx
import { useFeatureFlags } from "@/app/providers/useFeatureFlags";
import { FEATURE_KEYS } from "@/app/providers/featureAccess";

export function MyComponent() {
  const { getAccessStatus } = useFeatureFlags();
  const status = getAccessStatus(FEATURE_KEYS.myNewFeature);

  if (status !== "allowed") {
    return null; // atau render placeholder/fallback
  }

  return <button>Aksi Khusus Fitur Baru</button>;
}
```

---

## 3. Standar Penamaan dan Batasan Scope

Gunakan pola key berikut:
- `page.<slug>` untuk halaman utama.
- `feature.<slug>` untuk fitur indukan lintas halaman.
- `<domain>.<feature>.runtime` untuk runtime/engine yang berisiko tinggi.

Default:
- halaman lama/stabil boleh `defaultEnabled: true`;
- fitur baru, eksperimental, engine baru, atau rollout bertahap wajib `defaultEnabled: false`;
- Presensi V2 memakai `page.attendance-v2` dan `attendance.v2.runtime`, keduanya default mati.

Jangan membuat flag untuk:
- tombol kecil;
- tab kecil;
- variasi copy/warna;
- sub-panel yang tidak berdiri sebagai fitur indukan.

---

## 4. Ketentuan Rilis & Stabilitas (Batas Risiko)
1. **Risiko Tinggi / Kritis**: Jika fitur menyentuh formula nilai, kalkulasi ranking, ekspor rapor, atau mutasi database krusial, set `riskLevel: "critical"` atau `"high"`. Flag ini memerlukan konfirmasi visual ekstra di panel Admin.
2. **Rollback Instan**: Jika terjadi crash atau kegagalan di produksi, admin dapat menonaktifkan fitur secara real-time dengan mengubah status flag menjadi **Mati Total (Offline)** pada panel admin tanpa perlu melakukan build atau deploy ulang kode frontend.
