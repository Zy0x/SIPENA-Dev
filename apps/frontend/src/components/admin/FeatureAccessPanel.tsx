import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  EDGE_FUNCTIONS_URL,
  SUPABASE_EXTERNAL_ANON_KEY,
} from "@/core/repositories/supabase-compat.repository";
import { useFeatureFlags } from "@/app/providers/useFeatureFlags";

type FeatureType = "page" | "feature" | "runtime";
type RiskLevel = "low" | "medium" | "high" | "critical";
type AudienceTargetType = "all_users" | "role" | "user";

interface FeatureFlagRow {
  id: string;
  feature_key: string;
  name: string;
  description: string;
  feature_type: FeatureType;
  default_enabled: boolean;
  global_kill_switch: boolean;
  risk_level: RiskLevel;
  metadata: Record<string, unknown>;
  updated_at: string;
}

interface FeatureAudienceRow {
  id: string;
  feature_key: string;
  target_type: AudienceTargetType;
  target_value: string | null;
  enabled: boolean;
}

interface UserRoleRow {
  user_id: string;
  role: string;
  assigned_at: string;
}

interface AdminUserRow {
  id: string;
  email: string | null;
  name: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmed: boolean;
}

interface AuditRow {
  id: string;
  feature_key: string | null;
  action: string;
  actor_email: string | null;
  created_at: string;
}

interface FeatureAccessPayload {
  success: boolean;
  flags?: FeatureFlagRow[];
  audiences?: FeatureAudienceRow[];
  roles?: UserRoleRow[];
  audits?: AuditRow[];
  users?: AdminUserRow[];
  error?: string;
}

interface FeatureDraft {
  defaultEnabled: boolean;
  globalKillSwitch: boolean;
  allUsers: boolean;
  roles: string[];
  userIds: string[];
}

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "teacher", label: "Guru" },
  { value: "tester", label: "Tester" },
  { value: "beta_user", label: "Beta User" },
];

const EMPTY_DRAFT: FeatureDraft = {
  defaultEnabled: false,
  globalKillSwitch: true,
  allUsers: false,
  roles: [],
  userIds: [],
};

function getAudienceDraft(feature: FeatureFlagRow, audiences: FeatureAudienceRow[]): FeatureDraft {
  const featureAudiences = audiences.filter(
    (audience) => audience.feature_key === feature.feature_key && audience.enabled,
  );

  return {
    defaultEnabled: feature.default_enabled,
    globalKillSwitch: feature.global_kill_switch,
    allUsers: featureAudiences.some((audience) => audience.target_type === "all_users"),
    roles: featureAudiences
      .filter((audience) => audience.target_type === "role" && audience.target_value)
      .map((audience) => audience.target_value as string),
    userIds: featureAudiences
      .filter((audience) => audience.target_type === "user" && audience.target_value)
      .map((audience) => audience.target_value as string),
  };
}

function getFeatureBadge(feature: FeatureFlagRow, audiences: FeatureAudienceRow[]) {
  if (!feature.global_kill_switch) return { label: "Nonaktif", variant: "destructive" as const };
  const draft = getAudienceDraft(feature, audiences);
  if (draft.allUsers || feature.default_enabled) return { label: "Aktif Semua", variant: "default" as const };
  if (draft.roles.length > 0) return { label: "Role", variant: "secondary" as const };
  if (draft.userIds.length > 0) return { label: "User Khusus", variant: "outline" as const };
  return { label: "Nonaktif", variant: "secondary" as const };
}

function includesRole(roles: string[], role: string) {
  return roles.includes(role);
}

interface FeatureAccessPanelProps {
  adminPassword: string;
}

export function FeatureAccessPanel({ adminPassword }: FeatureAccessPanelProps) {
  const { toast } = useToast();
  const featureFlags = useFeatureFlags();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [flags, setFlags] = useState<FeatureFlagRow[]>([]);
  const [audiences, setAudiences] = useState<FeatureAudienceRow[]>([]);
  const [roles, setRoles] = useState<UserRoleRow[]>([]);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [selectedFeatureKey, setSelectedFeatureKey] = useState<string>("");
  const [draft, setDraft] = useState<FeatureDraft>(EMPTY_DRAFT);
  const [selectedRoleUserId, setSelectedRoleUserId] = useState<string>("");
  const [userRoleDraft, setUserRoleDraft] = useState<string[]>([]);

  const selectedFeature = flags.find((flag) => flag.feature_key === selectedFeatureKey) || null;

  const requestAdminFeatureAccess = useCallback(
    async (action: string, payload?: unknown): Promise<FeatureAccessPayload> => {
      const response = await fetch(`${EDGE_FUNCTIONS_URL}/admin-feature-access`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_EXTERNAL_ANON_KEY}`,
          apikey: SUPABASE_EXTERNAL_ANON_KEY,
        },
        body: JSON.stringify({
          action,
          password: adminPassword,
          payload,
        }),
      });

      const result = (await response.json().catch(() => ({}))) as FeatureAccessPayload;
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Aksi kontrol fitur gagal");
      }
      return result;
    },
    [adminPassword],
  );

  const loadData = useCallback(async () => {
    if (!adminPassword) return;
    setLoading(true);
    try {
      const result = await requestAdminFeatureAccess("get-admin-data");
      const nextFlags = result.flags || [];
      setFlags(nextFlags);
      setAudiences(result.audiences || []);
      setRoles(result.roles || []);
      setUsers(result.users || []);
      setAudits(result.audits || []);
      setSelectedFeatureKey((current) => current || nextFlags[0]?.feature_key || "");
      setSelectedRoleUserId((current) => current || result.users?.[0]?.id || "");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Gagal memuat kontrol fitur",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
      });
    } finally {
      setLoading(false);
    }
  }, [adminPassword, requestAdminFeatureAccess, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!selectedFeature) return;
    setDraft(getAudienceDraft(selectedFeature, audiences));
  }, [audiences, selectedFeature]);

  useEffect(() => {
    if (!selectedRoleUserId) return;
    setUserRoleDraft(roles.filter((role) => role.user_id === selectedRoleUserId).map((role) => role.role));
  }, [roles, selectedRoleUserId]);

  const filteredFlags = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return flags;
    return flags.filter((flag) =>
      [flag.name, flag.feature_key, flag.description].some((value) => value.toLowerCase().includes(needle)),
    );
  }, [flags, search]);

  const previewCount = useMemo(() => {
    if (draft.allUsers || draft.defaultEnabled) return users.length;

    const granted = new Set(draft.userIds);
    for (const row of roles) {
      if (draft.roles.includes(row.role)) {
        granted.add(row.user_id);
      }
    }
    return granted.size;
  }, [draft.allUsers, draft.defaultEnabled, draft.roles, draft.userIds, roles, users.length]);

  const selectedUser = users.find((user) => user.id === selectedRoleUserId) || null;

  const toggleDraftRole = (role: string) => {
    setDraft((current) => ({
      ...current,
      roles: includesRole(current.roles, role)
        ? current.roles.filter((item) => item !== role)
        : [...current.roles, role],
    }));
  };

  const toggleDraftUser = (userId: string) => {
    setDraft((current) => ({
      ...current,
      userIds: current.userIds.includes(userId)
        ? current.userIds.filter((item) => item !== userId)
        : [...current.userIds, userId],
    }));
  };

  const toggleUserRole = (role: string) => {
    setUserRoleDraft((current) =>
      current.includes(role) ? current.filter((item) => item !== role) : [...current, role],
    );
  };

  const saveFeature = async () => {
    if (!selectedFeature) return;

    const opensCriticalFeature =
      selectedFeature.risk_level === "critical" &&
      selectedFeature.feature_key.includes("attendance.v2") &&
      draft.globalKillSwitch &&
      (draft.defaultEnabled || draft.allUsers || draft.roles.length > 0 || draft.userIds.length > 0);

    if (
      opensCriticalFeature &&
      !window.confirm(
        "Presensi V2 adalah fitur berisiko tinggi. Aktifkan hanya untuk akun/role yang benar-benar siap menguji?",
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      await requestAdminFeatureAccess("save-feature", {
        featureKey: selectedFeature.feature_key,
        defaultEnabled: draft.defaultEnabled,
        globalKillSwitch: draft.globalKillSwitch,
        allUsers: draft.allUsers,
        roles: draft.roles,
        userIds: draft.userIds,
      });
      await loadData();
      await featureFlags.refresh();
      toast({
        title: "Kontrol fitur tersimpan",
        description: `${selectedFeature.name} diperbarui untuk ${previewCount} akun.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Gagal menyimpan fitur",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveUserRoles = async () => {
    if (!selectedRoleUserId) return;
    setSaving(true);
    try {
      await requestAdminFeatureAccess("save-user-roles", {
        userId: selectedRoleUserId,
        roles: userRoleDraft,
      });
      await loadData();
      await featureFlags.refresh();
      toast({
        title: "Role akun tersimpan",
        description: selectedUser?.email ? `Role ${selectedUser.email} diperbarui.` : "Role akun diperbarui.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Gagal menyimpan role",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!adminPassword) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Password backend belum tersedia. Buka tab Kredensial atau login ulang agar admin dapat mengelola kontrol fitur.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Kontrol Fitur</h2>
          <p className="text-sm text-muted-foreground">
            Atur akses halaman, fitur, dan runtime untuk semua akun, role, atau akun tertentu.
          </p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(280px,420px)_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5" />
              Daftar Fitur
            </CardTitle>
            <CardDescription>Cari dan pilih fitur yang ingin diatur.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari fitur atau halaman..."
                className="pl-9"
              />
            </div>

            <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {loading && flags.length === 0 ? (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memuat fitur...
                </div>
              ) : filteredFlags.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Tidak ada fitur yang cocok.
                </div>
              ) : (
                filteredFlags.map((flag) => {
                  const badge = getFeatureBadge(flag, audiences);
                  const active = flag.feature_key === selectedFeatureKey;
                  return (
                    <button
                      key={flag.feature_key}
                      type="button"
                      onClick={() => setSelectedFeatureKey(flag.feature_key)}
                      className={`w-full rounded-xl border p-3 text-left transition-colors touch-manipulation ${
                        active
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-card hover:bg-muted/60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{flag.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{flag.feature_key}</p>
                        </div>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{flag.description}</p>
                    </button>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                {selectedFeature?.name || "Pilih Fitur"}
                {selectedFeature && <Badge variant="outline">{selectedFeature.risk_level}</Badge>}
              </CardTitle>
              <CardDescription>
                {selectedFeature?.description || "Pilih fitur di daftar kiri untuk mengatur akses."}
              </CardDescription>
            </CardHeader>
            {selectedFeature && (
              <CardContent className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Label className="text-base">Kill Switch Aktif</Label>
                        <p className="text-xs text-muted-foreground">
                          Jika dimatikan, fitur tertutup untuk semua target.
                        </p>
                      </div>
                      <Switch
                        checked={draft.globalKillSwitch}
                        onCheckedChange={(checked) => setDraft((current) => ({ ...current, globalKillSwitch: checked }))}
                      />
                    </div>
                  </div>
                  <div className="rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Label className="text-base">Default Aktif</Label>
                        <p className="text-xs text-muted-foreground">
                          Cocok untuk halaman lama. Fitur eksperimen sebaiknya tetap mati.
                        </p>
                      </div>
                      <Switch
                        checked={draft.defaultEnabled}
                        onCheckedChange={(checked) => setDraft((current) => ({ ...current, defaultEnabled: checked }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Label className="text-base">Aktif untuk semua pengguna</Label>
                      <p className="text-xs text-muted-foreground">
                        Membuka fitur untuk semua akun login. Gunakan hati-hati untuk fitur beta.
                      </p>
                    </div>
                    <Switch
                      checked={draft.allUsers}
                      onCheckedChange={(checked) => setDraft((current) => ({ ...current, allUsers: checked }))}
                    />
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border p-4">
                    <Label className="text-base">Role yang mendapat akses</Label>
                    <div className="mt-3 grid gap-2">
                      {ROLE_OPTIONS.map((role) => (
                        <label key={role.value} className="flex min-h-[44px] items-center gap-3 rounded-lg border px-3 py-2">
                          <Checkbox
                            checked={draft.roles.includes(role.value)}
                            onCheckedChange={() => toggleDraftRole(role.value)}
                          />
                          <span className="text-sm font-medium">{role.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border p-4">
                    <Label className="text-base">Akun khusus</Label>
                    <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                      {users.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                          Belum ada daftar akun. Tekan Refresh atau periksa akses admin.
                        </div>
                      ) : (
                        users.map((user) => (
                          <label key={user.id} className="flex min-h-[44px] items-center gap-3 rounded-lg border px-3 py-2">
                            <Checkbox
                              checked={draft.userIds.includes(user.id)}
                              onCheckedChange={() => toggleDraftUser(user.id)}
                            />
                            <span className="min-w-0 text-sm">
                              <span className="block truncate font-medium">{user.name || user.email || user.id}</span>
                              <span className="block truncate text-xs text-muted-foreground">{user.email || user.id}</span>
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <Alert className="border-primary/30 bg-primary/5">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Preview dampak: <strong>{previewCount} akun</strong> akan mendapat akses berdasarkan aturan saat ini.
                  </AlertDescription>
                </Alert>

                <div className="flex justify-end">
                  <Button onClick={saveFeature} disabled={saving} className="gap-2">
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Simpan Kontrol Fitur
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCog className="h-5 w-5" />
                Role Pengguna
              </CardTitle>
              <CardDescription>
                Role digunakan untuk membuka fitur kepada kelompok akun, misalnya tester Presensi V2.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {users.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                  Belum ada akun yang bisa dipilih. Tekan Refresh atau periksa Edge Function admin.
                </div>
              ) : (
                <>
                  <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)]">
                    <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                      {users.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => setSelectedRoleUserId(user.id)}
                          className={`w-full rounded-xl border p-3 text-left text-sm transition-colors touch-manipulation ${
                            selectedRoleUserId === user.id ? "border-primary bg-primary/10" : "hover:bg-muted/60"
                          }`}
                        >
                          <span className="block truncate font-medium">{user.name || user.email || user.id}</span>
                          <span className="block truncate text-xs text-muted-foreground">{user.email || user.id}</span>
                        </button>
                      ))}
                    </div>
                    <div className="rounded-xl border p-4">
                      <p className="mb-3 text-sm font-semibold">
                        {selectedUser?.email || "Pilih akun"}
                      </p>
                      <div className="grid gap-2">
                        {ROLE_OPTIONS.map((role) => (
                          <label key={role.value} className="flex min-h-[44px] items-center gap-3 rounded-lg border px-3 py-2">
                            <Checkbox
                              checked={userRoleDraft.includes(role.value)}
                              onCheckedChange={() => toggleUserRole(role.value)}
                            />
                            <span className="text-sm font-medium">{role.label}</span>
                          </label>
                        ))}
                      </div>
                      <Button onClick={saveUserRoles} disabled={saving || !selectedRoleUserId} className="mt-4 w-full gap-2">
                        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                        Simpan Role Akun
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Audit Perubahan</CardTitle>
              <CardDescription>Catatan perubahan terbaru dari Kontrol Fitur.</CardDescription>
            </CardHeader>
            <CardContent>
              {audits.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada audit perubahan.</p>
              ) : (
                <div className="space-y-3">
                  {audits.map((audit) => (
                    <div key={audit.id} className="rounded-xl border p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{audit.action}</span>
                        <Badge variant="outline">{audit.feature_key || "role"}</Badge>
                      </div>
                      <Separator className="my-2" />
                      <p className="text-xs text-muted-foreground">
                        {audit.actor_email || "admin-panel"} - {new Date(audit.created_at).toLocaleString("id-ID")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
