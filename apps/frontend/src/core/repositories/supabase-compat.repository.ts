/**
 * Temporary compatibility bridge for the legacy Supabase-heavy code path.
 *
 * New code must depend on explicit ports/use-cases instead of importing this
 * module. Existing features are migrated incrementally so behaviour stays
 * unchanged while the monorepo architecture is introduced.
 */
export {
  EDGE_FUNCTIONS_URL,
  SUPABASE_EXTERNAL_ANON_KEY,
  SUPABASE_EXTERNAL_PROJECT_ID,
  SUPABASE_EXTERNAL_URL,
  adminLogin,
  supabaseExternal,
  validateAdminPassword,
  verifyAdminToken,
} from "@/infrastructure/supabase/supabase.client";
