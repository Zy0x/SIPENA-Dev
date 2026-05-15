# Testing

Command:

```bash
npm run test
npm run typecheck
npm run build
```

Target test bertahap:
- provider factory memilih adapter sesuai env.
- env config menolak provider invalid.
- auth use-case memanggil AuthPort.
- Supabase adapter memetakan error ke AppError.
- HTTP adapter membaca `VITE_API_BASE_URL`.
- ErrorBoundary menangkap runtime error.
- offline queue menyimpan write saat offline.
