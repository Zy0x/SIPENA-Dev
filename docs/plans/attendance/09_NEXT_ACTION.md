# NEXT ACTION

Phase: 07 (BACKEND INTEGRATION)

## What Comes Next

Phase 07 will connect the V2 engine to Supabase backend infrastructure.

### Goals
1. Create V2-specific Supabase tables (isolated from V1 tables).
2. Implement Edge Functions for V2 attendance mutation (server-side rule enforcement).
3. Wire V2 canonical output to Supabase persistence layer.
4. Provide migration compatibility layer from V1 schema.
5. Keep RLS policies strict — V2 data must not expose V1 data and vice versa.

### Hard Rules
- Do not modify V1 Supabase tables.
- Do not modify V1 Edge Functions.
- V2 backend must be independently toggled via runtime switch.
- All secrets accessed via Deno.env.get() only.

### Preconditions Required
- Phase 06 implementation reviewed and committed.
- Architecture docs for Phase 07 provided.