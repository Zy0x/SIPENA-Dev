# Solusi Integrasi Scroll: Single Flow Behavior

Dokumen ini menjelaskan solusi teknis untuk mengatasi konflik scroll antara halaman utama (window/page scroll) dan elemen tabel (inner scroll container) pada aplikasi Anda. Solusi ini dirancang untuk menciptakan pengalaman scroll yang *seamless* dan natural, dengan memprioritaskan interaksi pada tabel saat kursor berada di atasnya.

## 1. Analisis Masalah dan Pendekatan Solusi

Konflik scroll umumnya terjadi ketika dua elemen *scrollable* bertumpuk (misalnya, tabel di dalam halaman). Browser secara *default* akan mencoba melakukan scroll pada elemen yang di-*hover*, dan jika elemen tersebut mencapai batasnya, scroll akan diteruskan ke elemen induk (halaman). Namun, perilaku ini sering kali tidak konsisten, terutama saat menggunakan *trackpad* atau perangkat sentuh, yang dapat menyebabkan "dead scroll" atau scroll yang terputus-putus.

Untuk mengatasi masalah ini, kita menerapkan pendekatan **Single Flow Behavior**. Pendekatan ini mengintegrasikan kedua scroll menjadi satu alur yang kohesif dengan mencegat (*intercept*) *event* `wheel` pada kontainer tabel. 

Logika utama yang diterapkan adalah sebagai berikut:
- **Prioritas Horizontal:** Jika pengguna melakukan scroll horizontal (misalnya dengan *trackpad* atau `Shift + Scroll`), tabel akan di-scroll secara horizontal. Jika tabel sudah mencapai batas kiri atau kanan, *event* akan dibiarkan (*bubble up*) sehingga halaman dapat merespons (jika ada scroll horizontal pada halaman).
- **Prioritas Vertikal:** Jika pengguna melakukan scroll vertikal, tabel akan di-scroll terlebih dahulu hingga mencapai batas atas atau bawah. Setelah batas tercapai, *event* akan dibiarkan sehingga halaman utama dapat melanjutkan scroll.
- **Pencegahan Konflik:** Dengan menggunakan `e.preventDefault()` secara selektif pada *event* `wheel`, kita mencegah browser melakukan scroll ganda atau memicu perilaku *overscroll* yang tidak diinginkan.

## 2. Implementasi Teknis

Solusi ini diimplementasikan menggunakan pendekatan modular di React dengan membuat *custom hook* `useScrollIntegration`. *Hook* ini kemudian diintegrasikan ke dalam komponen `SmartScrollTable`.

### A. Custom Hook: `useScrollIntegration`

*Hook* ini bertanggung jawab untuk menangani logika intersepsi *event* `wheel`. Dengan memisahkan logika ini ke dalam *hook*, Anda dapat menggunakannya kembali pada komponen *scrollable* lainnya di masa mendatang.

```typescript
// src/hooks/useScrollIntegration.ts
import { useEffect, useRef } from "react";

/**
 * Custom hook untuk mengintegrasikan inner scroll (tabel) dengan page scroll.
 * Mengimplementasikan "Single Flow Behavior" di mana inner scroll diprioritaskan.
 */
export function useScrollIntegration<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      const { deltaX, deltaY } = e;
      const { scrollLeft, scrollTop, scrollWidth, scrollHeight, clientWidth, clientHeight } = el;

      // 1. Prioritas Scroll Horizontal
      // Jika pergerakan horizontal lebih dominan daripada vertikal
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        const isAtLeft = scrollLeft <= 0;
        const isAtRight = scrollLeft + clientWidth >= scrollWidth - 1;

        // Jika belum mencapai batas, scroll tabel dan cegah scroll halaman
        if ((deltaX > 0 && !isAtRight) || (deltaX < 0 && !isAtLeft)) {
          el.scrollLeft += deltaX;
          e.preventDefault();
          return;
        }
      }

      // 2. Prioritas Scroll Vertikal
      const isAtTop = scrollTop <= 0;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;

      // Jika scroll ke bawah dan belum mencapai batas bawah,
      // atau scroll ke atas dan belum mencapai batas atas
      if ((deltaY > 0 && !isAtBottom) || (deltaY < 0 && !isAtTop)) {
        el.scrollTop += deltaY;
        e.preventDefault();
      }
      // Jika sudah mencapai batas, jangan lakukan preventDefault()
      // Biarkan event bubble up ke halaman utama
    };

    // Gunakan passive: false agar preventDefault() dapat berfungsi
    el.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      el.removeEventListener("wheel", handleWheel);
    };
  }, []);

  return ref;
}
```

### B. Integrasi pada `SmartScrollTable`

Komponen `SmartScrollTable` diperbarui untuk menggunakan *hook* `useScrollIntegration`. Selain itu, penanganan *event* sentuh (`touch`) tetap dipertahankan untuk memastikan kompatibilitas dengan perangkat *mobile*.

```tsx
// src/components/attendance/SmartScrollTable.tsx
import { useRef, useCallback, useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SmartScrollTableProps {
  children: ReactNode;
  className?: string;
}

export function SmartScrollTable({ children, className }: SmartScrollTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const scrollingHorizontalRef = useRef(false);

  // Integrasi logika wheel event langsung di dalam komponen
  // (Bisa juga menggunakan custom hook useScrollIntegration yang telah dibuat)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      const { deltaX, deltaY } = e;
      const { scrollLeft, scrollTop, scrollWidth, scrollHeight, clientWidth, clientHeight } = el;

      // 1. Prioritas Scroll Horizontal
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        const isAtLeft = scrollLeft <= 0;
        const isAtRight = scrollLeft + clientWidth >= scrollWidth - 1;

        if ((deltaX > 0 && !isAtRight) || (deltaX < 0 && !isAtLeft)) {
          el.scrollLeft += deltaX;
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      // 2. Prioritas Scroll Vertikal
      const isAtTop = scrollTop <= 0;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;

      if ((deltaY > 0 && !isAtBottom) || (deltaY < 0 && !isAtTop)) {
        el.scrollTop += deltaY;
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // passive: false diperlukan untuk preventDefault()
    el.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      el.removeEventListener("wheel", handleWheel);
    };
  }, []);

  // Logika touch event untuk perangkat mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
    scrollingHorizontalRef.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (!el) return;

    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    const deltaX = touchStartRef.current.x - touchX;
    const deltaY = touchStartRef.current.y - touchY;

    if (!scrollingHorizontalRef.current && Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 5) {
      scrollingHorizontalRef.current = true;
    }

    if (scrollingHorizontalRef.current) {
      const hasHorizontalScroll = el.scrollWidth > el.clientWidth;
      const isAtLeft = el.scrollLeft <= 0;
      const isAtRight = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;

      if (hasHorizontalScroll) {
        if ((deltaX > 0 && !isAtRight) || (deltaX < 0 && !isAtLeft)) {
          if (e.cancelable) e.preventDefault();
          e.stopPropagation();
        }
      }
    }

    touchStartRef.current = { x: touchX, y: touchY };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        // Pastikan overflow-auto untuk mengaktifkan scroll vertikal dan horizontal
        // overscroll-contain mencegah efek "bounce" pada browser tertentu
        "overflow-auto overscroll-contain",
        className
      )}
      style={{ WebkitOverflowScrolling: "touch" }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      {children}
    </div>
  );
}
```

### C. Penyesuaian CSS

Pada komponen `SmartScrollTable`, kelas CSS `overflow-x-auto overflow-y-hidden` diubah menjadi `overflow-auto`. Hal ini penting agar tabel dapat di-scroll secara vertikal maupun horizontal. Selain itu, penambahan kelas `overscroll-contain` (atau `overscroll-behavior: contain` di CSS murni) membantu mencegah efek *scroll chaining* bawaan browser yang sering kali menyebabkan "dead scroll" atau efek *bounce* yang mengganggu.

## 3. Kesimpulan

Dengan mengimplementasikan *event listener* `wheel` yang memiliki opsi `{ passive: false }`, kita mendapatkan kontrol penuh atas perilaku scroll. Logika yang diterapkan memastikan bahwa:
1. Scroll horizontal pada tabel selalu diselesaikan terlebih dahulu.
2. Scroll vertikal pada tabel diprioritaskan hingga mencapai batas atas atau bawah.
3. Setelah batas tercapai, *event* dibiarkan mengalir ke halaman utama, menciptakan transisi yang mulus tanpa "dead scroll".
4. Jika kursor berada di luar tabel, *event listener* pada tabel tidak akan terpicu, sehingga halaman utama akan merespons scroll secara normal.

Pendekatan ini efisien, kompatibel dengan browser modern, dan memberikan pengalaman pengguna yang jauh lebih baik saat berinteraksi dengan tabel data yang besar.
