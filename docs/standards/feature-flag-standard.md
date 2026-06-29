# Standar Teknis: Integrasi & Manajemen Feature Flags SIPENA

Dokumen ini mendefinisikan standar wajib bagi pengembang (AI maupun manusia) dalam merilis halaman, rute, atau fitur baru di SIPENA. Seluruh fungsionalitas baru wajib dikontrol melalui sistem **Feature Flags** demi keamanan data akademik, stabilitas produksi, serta kemudahan audit.

---

## 1. Alur Pendaftaran Feature Flag Baru

Setiap kali membuat halaman atau fitur baru:

### Langkah 1: Daftarkan Key di Frontend
Tambahkan entri key baru pada objek `FEATURE_KEYS` di [featureAccess.ts](file:///E:/Data/GitHub/SIPENA/tessipena3-f7e2575d/apps/frontend/src/app/providers/featureAccess.ts):

```typescript
export const FEATURE_KEYS = {
  // ... key existing ...
  myNewFeature: "feature.my-new-feature", // Gunakan prefix 'page.' untuk halaman, 'feature.' untuk tombol/aksi
} as const;
```

Daftarkan pula definisi default-nya di array `DEFAULT_FEATURE_DEFINITIONS` dalam file yang sama:

```typescript
export const DEFAULT_FEATURE_DEFINITIONS: FeatureFlagDefinition[] = [
  // ...
  { 
    key: FEATURE_KEYS.myNewFeature, 
    name: "Nama Fitur Baru", 
    type: "feature", // "page" | "feature" | "runtime"
    defaultEnabled: false, // Selalu set false untuk rilis aman/tahap uji coba
    globalKillSwitch: true, 
    riskLevel: "low", // "low" | "medium" | "high" | "critical"
    metadata: { description: "Penjelasan singkat fitur baru" }
  }
];
```

### Langkah 2: Daftarkan di Database Supabase
Buat migration script SQL (atau jalankan di SQL Editor Supabase) untuk menyisipkan baris flag baru ke tabel `public.feature_flags` agar tersinkronisasi di backend:

```sql
INSERT INTO public.feature_flags (feature_key, name, description, feature_type, default_enabled, global_kill_switch, risk_level)
VALUES (
  'feature.my-new-feature',
  'Nama Fitur Baru',
  'Deskripsi kegunaan fitur baru.',
  'feature',
  false,
  true,
  'low'
) ON CONFLICT (feature_key) DO NOTHING;
```

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

## 4. Ketentuan Rilis & Stabilitas (Batas Risiko)
1. **Risiko Tinggi / Kritis**: Jika fitur menyentuh formula nilai, kalkulasi ranking, ekspor rapor, atau mutasi database krusial, set `riskLevel: "critical"` atau `"high"`. Flag ini memerlukan konfirmasi visual ekstra di panel Admin.
2. **Rollback Instan**: Jika terjadi crash atau kegagalan di produksi, admin dapat menonaktifkan fitur secara real-time dengan mengubah status flag menjadi **Mati Total (Offline)** pada panel admin tanpa perlu melakukan build atau deploy ulang kode frontend.
