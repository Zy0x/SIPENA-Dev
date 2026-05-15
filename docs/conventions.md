# Conventions

Naming:
- Folder: kebab-case
- Component React: PascalCase
- Hook: `useSomething.ts`
- Use case: `something.usecase.ts`
- Port: `something.port.ts`
- Adapter: `provider-name.adapter.ts`
- Test: `something.spec.ts`

Prinsip:
- Component tidak membuat Supabase client.
- Business logic tidak ditanam di adapter.
- Secret tidak masuk source code.
- File lama yang belum bisa dipindah total harus diberi catatan di `docs/refactor-notes.md`.
