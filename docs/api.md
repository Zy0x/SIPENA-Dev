# API

Kontrak API disimpan di `packages/shared/src/contracts`.

Backend custom harus mengembalikan bentuk:

```ts
interface ApiResponse<T> {
  data: T;
  error?: { code: string; message: string };
  meta?: Record<string, unknown>;
}
```

Frontend HTTP adapter membaca endpoint berdasarkan `VITE_API_BASE_URL`.
