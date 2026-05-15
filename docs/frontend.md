# Frontend

Frontend berada di `apps/frontend`.

Command dari root:

```bash
npm run dev
npm run build
npm run test
```

Entry point:
- `apps/frontend/src/app/main.tsx`
- `apps/frontend/src/app/App.tsx`

Alias utama:
- `@/*` -> `apps/frontend/src/*`
- `@core/*` -> core entities, ports, use-cases, errors
- `@infra/*` -> adapter/provider
- `@shared/*` -> `packages/shared/src/*`
- `@ui/*` -> `packages/ui/src/*`
