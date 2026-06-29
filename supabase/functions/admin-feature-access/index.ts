import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type TargetType = "all_users" | "role" | "user";

const DEFAULT_USER_ROLE = "teacher";
const VALID_ROLES = new Set(["admin", DEFAULT_USER_ROLE, "beta_user"]);

interface FeatureFlagRow {
  id: string;
  feature_key: string;
  name: string;
  description: string;
  feature_type: "page" | "feature" | "runtime";
  default_enabled: boolean;
  global_kill_switch: boolean;
  risk_level: "low" | "medium" | "high" | "critical";
  metadata: Record<string, unknown>;
  updated_at: string;
}

interface FeatureAudienceRow {
  id: string;
  feature_key: string;
  target_type: TargetType;
  target_value: string | null;
  enabled: boolean;
}

interface FeatureCatalogEntry {
  featureKey: string;
  name: string;
  description: string;
  featureType: "page" | "feature" | "runtime";
  defaultEnabled: boolean;
  globalKillSwitch: boolean;
  riskLevel: "low" | "medium" | "high" | "critical";
  metadata: Record<string, unknown>;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean),
    ),
  );
}

function normalizeRoles(value: unknown, options: { includeDefaultTeacher?: boolean } = {}): string[] {
  const roles = normalizeList(value).filter((role) => VALID_ROLES.has(role));
  if (options.includeDefaultTeacher && !roles.includes(DEFAULT_USER_ROLE)) {
    roles.unshift(DEFAULT_USER_ROLE);
  }
  return Array.from(new Set(roles));
}

function getBearerToken(req: Request): string | null {
  const authorization = req.headers.get("Authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function verifyAdminPassword(password: unknown): boolean {
  const adminPassword = Deno.env.get("ADMIN_DB_PASSWORD");
  return typeof password === "string" && !!adminPassword && password === adminPassword;
}

function evaluateFeature(flag: FeatureFlagRow, audiences: FeatureAudienceRow[], userId: string, roles: string[]) {
  if (!flag.global_kill_switch) {
    return { enabled: false, reason: "global_kill_switch_off" };
  }

  const userGrant = audiences.some(
    (audience) =>
      audience.enabled &&
      audience.target_type === "user" &&
      audience.target_value === userId,
  );
  if (userGrant) return { enabled: true, reason: "user" };

  const roleGrant = audiences.some(
    (audience) =>
      audience.enabled &&
      audience.target_type === "role" &&
      audience.target_value != null &&
      roles.includes(audience.target_value),
  );
  if (roleGrant) return { enabled: true, reason: "role" };

  const allUsersGrant = audiences.some(
    (audience) => audience.enabled && audience.target_type === "all_users",
  );
  if (allUsersGrant) return { enabled: true, reason: "all_users" };

  return {
    enabled: flag.default_enabled,
    reason: flag.default_enabled ? "default_enabled" : "default_disabled",
  };
}

function summarizeAudience(audiences: FeatureAudienceRow[]) {
  return {
    allUsers: audiences.some((audience) => audience.enabled && audience.target_type === "all_users"),
    roles: audiences
      .filter((audience) => audience.enabled && audience.target_type === "role" && audience.target_value)
      .map((audience) => audience.target_value),
    userIds: audiences
      .filter((audience) => audience.enabled && audience.target_type === "user" && audience.target_value)
      .map((audience) => audience.target_value),
  };
}

function normalizeCatalogEntry(value: unknown): FeatureCatalogEntry | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const featureKey = typeof item.featureKey === "string" ? item.featureKey.trim() : "";
  const name = typeof item.name === "string" ? item.name.trim() : "";
  const description = typeof item.description === "string" ? item.description.trim() : "";
  const featureType = item.featureType;
  const riskLevel = item.riskLevel;
  const metadata = item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata)
    ? item.metadata as Record<string, unknown>
    : {};

  if (!featureKey || !name) return null;
  if (!["page", "feature", "runtime"].includes(String(featureType))) return null;
  if (!["low", "medium", "high", "critical"].includes(String(riskLevel))) return null;

  return {
    featureKey,
    name,
    description,
    featureType: featureType as FeatureCatalogEntry["featureType"],
    defaultEnabled: Boolean(item.defaultEnabled),
    globalKillSwitch: item.globalKillSwitch !== false,
    riskLevel: riskLevel as FeatureCatalogEntry["riskLevel"],
    metadata,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL");
    const serviceRoleKey =
      Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ success: false, error: "Konfigurasi Supabase service role belum tersedia" }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "evaluate") {
      const token = getBearerToken(req);
      if (!token) return json({ success: false, error: "Sesi pengguna tidak ditemukan" }, 401);

      const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
      if (userError || !userData.user) {
        return json({ success: false, error: "Sesi pengguna tidak valid" }, 401);
      }

      const userId = userData.user.id;
      const [{ data: flags, error: flagsError }, { data: roleRows, error: rolesError }] = await Promise.all([
        supabaseAdmin.from("feature_flags").select("*").order("feature_key", { ascending: true }),
        supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
      ]);

      if (flagsError) return json({ success: false, error: flagsError.message }, 500);
      if (rolesError) return json({ success: false, error: rolesError.message }, 500);

      const featureKeys = (flags || []).map((flag: FeatureFlagRow) => flag.feature_key);
      const { data: audiences, error: audienceError } = featureKeys.length
        ? await supabaseAdmin.from("feature_audiences").select("*").in("feature_key", featureKeys)
        : { data: [], error: null };

      if (audienceError) return json({ success: false, error: audienceError.message }, 500);

      const roles = normalizeRoles((roleRows || []).map((row: { role: string }) => row.role), {
        includeDefaultTeacher: true,
      });
      const evaluated = (flags || []).map((flag: FeatureFlagRow) => {
        const flagAudiences = (audiences || []).filter(
          (audience: FeatureAudienceRow) => audience.feature_key === flag.feature_key,
        );
        const result = evaluateFeature(flag, flagAudiences, userId, roles);
        return {
          key: flag.feature_key,
          name: flag.name,
          type: flag.feature_type,
          enabled: result.enabled,
          reason: result.reason,
          riskLevel: flag.risk_level,
          defaultEnabled: flag.default_enabled,
          globalKillSwitch: flag.global_kill_switch,
          metadata: flag.metadata || {},
        };
      });

      return json({ success: true, roles, features: evaluated });
    }

    if (!verifyAdminPassword(body.password)) {
      return json({ success: false, error: "Password admin tidak valid" }, 401);
    }

    if (action === "get-admin-data") {
      const [{ data: flags, error: flagsError }, { data: audiences, error: audienceError }, { data: roles, error: rolesError }, { data: audits, error: auditError }, authResult] =
        await Promise.all([
          supabaseAdmin.from("feature_flags").select("*").order("feature_key", { ascending: true }),
          supabaseAdmin.from("feature_audiences").select("*").order("feature_key", { ascending: true }),
          supabaseAdmin.from("user_roles").select("*").order("assigned_at", { ascending: false }),
          supabaseAdmin.from("feature_audit_logs").select("*").order("created_at", { ascending: false }).limit(30),
          supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
        ]);

      if (flagsError) return json({ success: false, error: flagsError.message }, 500);
      if (audienceError) return json({ success: false, error: audienceError.message }, 500);
      if (rolesError) return json({ success: false, error: rolesError.message }, 500);
      if (auditError) return json({ success: false, error: auditError.message }, 500);
      if (authResult.error) return json({ success: false, error: authResult.error.message }, 500);

      const users = authResult.data.users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.user_metadata?.full_name || user.user_metadata?.name || null,
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at,
        emailConfirmed: !!user.email_confirmed_at,
      }));

      const validRoles = (roles || []).filter((row: { role: string }) => VALID_ROLES.has(row.role));
      const usersWithRoles = new Set(validRoles.map((row: { user_id: string }) => row.user_id));
      const defaultTeacherRoles = users
        .filter((user) => !usersWithRoles.has(user.id))
        .map((user) => ({
          user_id: user.id,
          role: DEFAULT_USER_ROLE,
          assigned_at: user.createdAt,
          metadata: { source: "default-teacher-fallback", virtual: true },
        }));

      return json({ success: true, flags, audiences, roles: [...validRoles, ...defaultTeacherRoles], audits, users });
    }

    if (action === "sync-feature-catalog") {
      const catalog = Array.isArray(body.payload?.catalog)
        ? body.payload.catalog.map(normalizeCatalogEntry).filter(Boolean) as FeatureCatalogEntry[]
        : [];

      if (!catalog.length) {
        return json({ success: false, error: "Katalog fitur kosong atau tidak valid" }, 400);
      }

      const { data: existingRows, error: existingError } = await supabaseAdmin
        .from("feature_flags")
        .select("feature_key, metadata")
        .in("feature_key", catalog.map((entry) => entry.featureKey));

      if (existingError) return json({ success: false, error: existingError.message }, 500);

      const existingMetadata = new Map(
        (existingRows || []).map((row: { feature_key: string; metadata: Record<string, unknown> | null }) => [
          row.feature_key,
          row.metadata || {},
        ]),
      );
      const existingKeys = new Set(existingMetadata.keys());
      const created: string[] = [];
      const updated: string[] = [];

      for (const entry of catalog) {
        if (existingKeys.has(entry.featureKey)) {
          const { error: updateError } = await supabaseAdmin
            .from("feature_flags")
            .update({
              name: entry.name,
              description: entry.description,
              feature_type: entry.featureType,
              risk_level: entry.riskLevel,
              metadata: { ...(existingMetadata.get(entry.featureKey) || {}), ...entry.metadata },
              updated_at: new Date().toISOString(),
            })
            .eq("feature_key", entry.featureKey);

          if (updateError) return json({ success: false, error: updateError.message }, 500);
          updated.push(entry.featureKey);
          continue;
        }

        const { error: insertError } = await supabaseAdmin.from("feature_flags").insert({
          feature_key: entry.featureKey,
          name: entry.name,
          description: entry.description,
          feature_type: entry.featureType,
          default_enabled: entry.defaultEnabled,
          global_kill_switch: entry.globalKillSwitch,
          risk_level: entry.riskLevel,
          metadata: entry.metadata,
        });

        if (insertError) return json({ success: false, error: insertError.message }, 500);
        created.push(entry.featureKey);
      }

      await supabaseAdmin.from("feature_audit_logs").insert({
        action: "sync-feature-catalog",
        actor_email: "admin-panel",
        before_state: { source: "feature-registry" },
        after_state: { created, updated },
      });

      return json({ success: true, created, updated });
    }

    if (action === "save-feature") {
      const payload = body.payload || {};
      const featureKey = typeof payload.featureKey === "string" ? payload.featureKey.trim() : "";
      if (!featureKey) return json({ success: false, error: "Feature key wajib diisi" }, 400);

      const roles = normalizeRoles(payload.roles);
      const userIds = normalizeList(payload.userIds);
      const allUsers = Boolean(payload.allUsers);

      const [{ data: beforeFlag }, { data: beforeAudiences }] = await Promise.all([
        supabaseAdmin.from("feature_flags").select("*").eq("feature_key", featureKey).maybeSingle(),
        supabaseAdmin.from("feature_audiences").select("*").eq("feature_key", featureKey),
      ]);

      const { error: updateError } = await supabaseAdmin
        .from("feature_flags")
        .update({
          default_enabled: Boolean(payload.defaultEnabled),
          global_kill_switch: Boolean(payload.globalKillSwitch),
          updated_at: new Date().toISOString(),
        })
        .eq("feature_key", featureKey);

      if (updateError) return json({ success: false, error: updateError.message }, 500);

      const { error: deleteError } = await supabaseAdmin
        .from("feature_audiences")
        .delete()
        .eq("feature_key", featureKey);

      if (deleteError) return json({ success: false, error: deleteError.message }, 500);

      const rows = [
        ...(allUsers ? [{ feature_key: featureKey, target_type: "all_users", target_value: null, enabled: true }] : []),
        ...roles.map((role) => ({ feature_key: featureKey, target_type: "role", target_value: role, enabled: true })),
        ...userIds.map((userId) => ({ feature_key: featureKey, target_type: "user", target_value: userId, enabled: true })),
      ];

      if (rows.length) {
        const { error: insertError } = await supabaseAdmin.from("feature_audiences").insert(rows);
        if (insertError) return json({ success: false, error: insertError.message }, 500);
      }

      const { data: afterFlag } = await supabaseAdmin
        .from("feature_flags")
        .select("*")
        .eq("feature_key", featureKey)
        .maybeSingle();
      const { data: afterAudiences } = await supabaseAdmin
        .from("feature_audiences")
        .select("*")
        .eq("feature_key", featureKey);

      await supabaseAdmin.from("feature_audit_logs").insert({
        feature_key: featureKey,
        action: "save-feature",
        actor_email: "admin-panel",
        before_state: { flag: beforeFlag, audiences: beforeAudiences || [] },
        after_state: { flag: afterFlag, audiences: afterAudiences || [] },
      });

      return json({
        success: true,
        feature: afterFlag,
        audience: summarizeAudience((afterAudiences || []) as FeatureAudienceRow[]),
      });
    }

    if (action === "save-user-roles") {
      const payload = body.payload || {};
      const userId = typeof payload.userId === "string" ? payload.userId.trim() : "";
      const roles = normalizeRoles(payload.roles, { includeDefaultTeacher: true });

      if (!userId) return json({ success: false, error: "User wajib dipilih" }, 400);

      const { data: beforeRoles } = await supabaseAdmin.from("user_roles").select("*").eq("user_id", userId);
      const { error: deleteError } = await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
      if (deleteError) return json({ success: false, error: deleteError.message }, 500);

      if (roles.length) {
        const { error: insertError } = await supabaseAdmin.from("user_roles").insert(
          roles.map((role) => ({
            user_id: userId,
            role,
            metadata: { source: "admin-feature-access" },
          })),
        );
        if (insertError) return json({ success: false, error: insertError.message }, 500);
      }

      const { data: afterRoles } = await supabaseAdmin.from("user_roles").select("*").eq("user_id", userId);
      await supabaseAdmin.from("feature_audit_logs").insert({
        action: "save-user-roles",
        actor_email: "admin-panel",
        before_state: { userId, roles: beforeRoles || [] },
        after_state: { userId, roles: afterRoles || [] },
      });

      return json({ success: true, userId, roles });
    }

    return json({ success: false, error: "Action tidak dikenal" }, 400);
  } catch (error) {
    console.error("admin-feature-access error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return json({ success: false, error: message }, 500);
  }
});
