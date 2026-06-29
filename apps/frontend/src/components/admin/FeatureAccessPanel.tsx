import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFeatureFlags } from "@/app/providers/useFeatureFlags";
import { useToast } from "@/hooks/use-toast";
import {
  EDGE_FUNCTIONS_URL,
  SUPABASE_EXTERNAL_ANON_KEY,
} from "@/core/repositories/supabase-compat.repository";

type FeatureType = "page" | "feature" | "runtime";
type RiskLevel = "low" | "medium" | "high" | "critical";
type AudienceTargetType = "all_users" | "role" | "user";
type FeatureStatusFilter = "all" | "active_all" | "role" | "user" | "default" | "off";

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

interface FeatureStatusMeta {
  label: string;
  filter: Exclude<FeatureStatusFilter, "all">;
  variant: "default" | "secondary" | "destructive" | "outline";
}

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "teacher", label: "Guru" },
  { value: "beta_user", label: "Beta User" },
];

const DEFAULT_USER_ROLE = "teacher";

const EMPTY_DRAFT: FeatureDraft = {
  defaultEnabled: false,
  globalKillSwitch: true,
  allUsers: false,
  roles: [],
  userIds: [],
};

const TYPE_LABELS: Record<FeatureType, string> = {
  page: "Halaman",
  feature: "Fitur",
  runtime: "Runtime",
};

const RISK_LABELS: Record<RiskLevel, string> = {
  low: "Rendah",
  medium: "Sedang",
  high: "Tinggi",
  critical: "Kritis",
};

function includesRole(roles: string[], role: string) {
  return roles.includes(role);
}

function getUserLabel(user: AdminUserRow) {
  return user.name || user.email || user.id;
}

function getUserSubLabel(user: AdminUserRow) {
  return user.email || user.id;
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

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

function getFeatureStatus(feature: FeatureFlagRow, audiences: FeatureAudienceRow[]): FeatureStatusMeta {
  if (!feature.global_kill_switch) {
    return { label: "Kill Switch Off", filter: "off", variant: "destructive" };
  }

  const draft = getAudienceDraft(feature, audiences);
  if (draft.allUsers) {
    return { label: "Aktif Semua", filter: "active_all", variant: "default" };
  }
  if (draft.roles.length > 0) {
    return { label: "Role", filter: "role", variant: "secondary" };
  }
  if (draft.userIds.length > 0) {
    return { label: "User Khusus", filter: "user", variant: "outline" };
  }
  if (feature.default_enabled) {
    return { label: "Default", filter: "default", variant: "secondary" };
  }
  return { label: "Nonaktif", filter: "off", variant: "secondary" };
}

function getTargetSummary(feature: FeatureFlagRow, audiences: FeatureAudienceRow[]) {
  const draft = getAudienceDraft(feature, audiences);
  const parts: string[] = [];
  if (draft.allUsers) parts.push("Semua akun");
  if (draft.defaultEnabled) parts.push("Default aktif");
  if (draft.roles.length > 0) parts.push(`${draft.roles.length} role`);
  if (draft.userIds.length > 0) parts.push(`${draft.userIds.length} user`);
  return parts.length > 0 ? parts.join(" • ") : "Tidak ada target";
}

function getRoleLabels(roleValues: string[]) {
  const effectiveRoles = Array.from(new Set([DEFAULT_USER_ROLE, ...roleValues]));
  return effectiveRoles
    .map((role) => ROLE_OPTIONS.find((option) => option.value === role)?.label || role)
    .join(", ");
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
  const [userSearch, setUserSearch] = useState("");
  const [roleUserSearch, setRoleUserSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | FeatureType>("all");
  const [riskFilter, setRiskFilter] = useState<"all" | RiskLevel>("all");
  const [statusFilter, setStatusFilter] = useState<FeatureStatusFilter>("all");
  const [flags, setFlags] = useState<FeatureFlagRow[]>([]);
  const [audiences, setAudiences] = useState<FeatureAudienceRow[]>([]);
  const [roles, setRoles] = useState<UserRoleRow[]>([]);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [selectedFeatureKey, setSelectedFeatureKey] = useState("");
  const [draft, setDraft] = useState<FeatureDraft>(EMPTY_DRAFT);
  const [selectedRoleUserId, setSelectedRoleUserId] = useState("");
  const [userRoleDraft, setUserRoleDraft] = useState<string[]>([]);

  const selectedFeature = flags.find((flag) => flag.feature_key === selectedFeatureKey) || null;
  const selectedUser = users.find((user) => user.id === selectedRoleUserId) || null;

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
      const nextUsers = result.users || [];
      setFlags(nextFlags);
      setAudiences(result.audiences || []);
      setRoles(result.roles || []);
      setUsers(nextUsers);
      setAudits(result.audits || []);
      setSelectedFeatureKey((current) =>
        current && nextFlags.some((feature) => feature.feature_key === current)
          ? current
          : nextFlags[0]?.feature_key || "",
      );
      setSelectedRoleUserId((current) =>
        current && nextUsers.some((user) => user.id === current) ? current : nextUsers[0]?.id || "",
      );
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

  const roleMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const row of roles) {
      const current = map.get(row.user_id) || [];
      current.push(row.role);
      map.set(row.user_id, current);
    }
    return map;
  }, [roles]);

  const filteredFlags = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return flags.filter((flag) => {
      const status = getFeatureStatus(flag, audiences);
      const matchSearch =
        !needle ||
        [flag.name, flag.feature_key, flag.description].some((value) =>
          value.toLowerCase().includes(needle),
        );
      return (
        matchSearch &&
        (typeFilter === "all" || flag.feature_type === typeFilter) &&
        (riskFilter === "all" || flag.risk_level === riskFilter) &&
        (statusFilter === "all" || status.filter === statusFilter)
      );
    });
  }, [audiences, flags, riskFilter, search, statusFilter, typeFilter]);

  const filteredSpecialUsers = useMemo(() => {
    const needle = userSearch.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((user) =>
      [user.name || "", user.email || "", user.id].some((value) => value.toLowerCase().includes(needle)),
    );
  }, [userSearch, users]);

  const filteredRoleUsers = useMemo(() => {
    const needle = roleUserSearch.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((user) =>
      [user.name || "", user.email || "", user.id].some((value) => value.toLowerCase().includes(needle)),
    );
  }, [roleUserSearch, users]);

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

  const featureStats = useMemo(() => {
    const stats = {
      total: flags.length,
      activeAll: 0,
      role: 0,
      user: 0,
      off: 0,
    };

    for (const flag of flags) {
      const status = getFeatureStatus(flag, audiences).filter;
      if (status === "active_all" || status === "default") stats.activeAll += 1;
      if (status === "role") stats.role += 1;
      if (status === "user") stats.user += 1;
      if (status === "off") stats.off += 1;
    }
    return stats;
  }, [audiences, flags]);

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
    if (role === DEFAULT_USER_ROLE) return;
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
        roles: Array.from(new Set([DEFAULT_USER_ROLE, ...userRoleDraft])),
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
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground tracking-tight">Kontrol Fitur & Akses</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Kelola halaman, fitur, runtime, role, dan akses akun dari satu panel admin.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={loadData}
          disabled={loading}
          className="h-8 gap-2 text-muted-foreground hover:text-foreground hover:bg-muted min-h-[44px]"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="text-xs">Refresh</span>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-border bg-card/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Total Fitur</p>
          <p className="mt-1.5 text-2xl font-bold text-foreground tabular-nums">{featureStats.total}</p>
        </div>
        <div className="rounded-lg border border-border bg-card/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Aktif Umum</p>
          <p className="mt-1.5 text-2xl font-bold text-emerald-500 dark:text-emerald-400 tabular-nums">{featureStats.activeAll}</p>
        </div>
        <div className="rounded-lg border border-border bg-card/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Target Role/User</p>
          <p className="mt-1.5 text-2xl font-bold text-blue-500 dark:text-blue-400 tabular-nums">{featureStats.role + featureStats.user}</p>
        </div>
        <div className="rounded-lg border border-border bg-card/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Nonaktif</p>
          <p className="mt-1.5 text-2xl font-bold text-muted-foreground tabular-nums">{featureStats.off}</p>
        </div>
      </div>

      <Tabs defaultValue="features" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="features" className="min-h-[44px] gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Fitur & Halaman
          </TabsTrigger>
          <TabsTrigger value="roles" className="min-h-[44px] gap-2">
            <Users className="h-4 w-4" />
            Role Pengguna
          </TabsTrigger>
          <TabsTrigger value="audit" className="min-h-[44px] gap-2">
            <Clock3 className="h-4 w-4" />
            Audit
          </TabsTrigger>
        </TabsList>

        <TabsContent value="features" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.85fr)]">
            <Card className="rounded-lg">
              <CardHeader className="gap-4">
                <div>
                  <CardTitle>Tabel Fitur</CardTitle>
                  <CardDescription>
                    Pilih baris fitur untuk mengatur target aksesnya.
                  </CardDescription>
                </div>
                <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_160px_160px_170px]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Cari fitur, key, atau deskripsi..."
                      className="min-h-[44px] pl-9"
                    />
                  </div>
                  <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as "all" | FeatureType)}>
                    <SelectTrigger className="min-h-[44px]">
                      <SelectValue placeholder="Tipe" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Tipe</SelectItem>
                      <SelectItem value="page">Halaman</SelectItem>
                      <SelectItem value="feature">Fitur</SelectItem>
                      <SelectItem value="runtime">Runtime</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={riskFilter} onValueChange={(value) => setRiskFilter(value as "all" | RiskLevel)}>
                    <SelectTrigger className="min-h-[44px]">
                      <SelectValue placeholder="Risiko" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Risiko</SelectItem>
                      <SelectItem value="low">Rendah</SelectItem>
                      <SelectItem value="medium">Sedang</SelectItem>
                      <SelectItem value="high">Tinggi</SelectItem>
                      <SelectItem value="critical">Kritis</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={statusFilter}
                    onValueChange={(value) => setStatusFilter(value as FeatureStatusFilter)}
                  >
                    <SelectTrigger className="min-h-[44px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Status</SelectItem>
                      <SelectItem value="active_all">Aktif Semua</SelectItem>
                      <SelectItem value="role">Role</SelectItem>
                      <SelectItem value="user">User Khusus</SelectItem>
                      <SelectItem value="default">Default</SelectItem>
                      <SelectItem value="off">Nonaktif</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader className="bg-muted/60">
                    <TableRow>
                      <TableHead className="min-w-[220px]">Nama</TableHead>
                      <TableHead className="min-w-[220px]">Key</TableHead>
                      <TableHead className="text-center">Tipe</TableHead>
                      <TableHead className="text-center">Risiko</TableHead>
                      <TableHead className="min-w-[130px] text-center">Status</TableHead>
                      <TableHead className="min-w-[170px]">Target</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && flags.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                          Memuat kontrol fitur...
                        </TableCell>
                      </TableRow>
                    ) : filteredFlags.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-28 text-center text-muted-foreground">
                          Tidak ada fitur yang cocok dengan filter.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredFlags.map((flag) => {
                        const status = getFeatureStatus(flag, audiences);
                        const active = flag.feature_key === selectedFeatureKey;
                        return (
                          <TableRow
                            key={flag.feature_key}
                            data-state={active ? "selected" : undefined}
                            className="cursor-pointer"
                            onClick={() => setSelectedFeatureKey(flag.feature_key)}
                          >
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-semibold">{flag.name}</p>
                                <p className="line-clamp-1 text-xs text-muted-foreground">{flag.description}</p>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {flag.feature_key}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline">{TYPE_LABELS[flag.feature_type]}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant={flag.risk_level === "critical" ? "destructive" : "secondary"}>
                                {RISK_LABELS[flag.risk_level]}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant={status.variant}>{status.label}</Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {getTargetSummary(flag, audiences)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                size="sm"
                                variant={active ? "default" : "outline"}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedFeatureKey(flag.feature_key);
                                }}
                              >
                                Atur
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  {selectedFeature?.name || "Pilih Fitur"}
                  {selectedFeature && (
                    <Badge variant={selectedFeature.risk_level === "critical" ? "destructive" : "outline"}>
                      {RISK_LABELS[selectedFeature.risk_level]}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {selectedFeature?.description || "Pilih salah satu fitur di tabel untuk melihat pengaturan."}
                </CardDescription>
              </CardHeader>
              {selectedFeature && (
                <CardContent className="space-y-5">
                  <div className="grid gap-3">
                    <div className="flex min-h-[64px] items-center justify-between gap-3 rounded-lg border p-3">
                      <div>
                        <Label className="text-sm font-semibold">Kill Switch</Label>
                        <p className="text-xs text-muted-foreground">Off berarti fitur ditutup untuk semua akun.</p>
                      </div>
                      <Switch
                        checked={draft.globalKillSwitch}
                        onCheckedChange={(checked) =>
                          setDraft((current) => ({ ...current, globalKillSwitch: checked }))
                        }
                      />
                    </div>
                    <div className="flex min-h-[64px] items-center justify-between gap-3 rounded-lg border p-3">
                      <div>
                        <Label className="text-sm font-semibold">Default Aktif</Label>
                        <p className="text-xs text-muted-foreground">Untuk halaman stabil yang aman dibuka umum.</p>
                      </div>
                      <Switch
                        checked={draft.defaultEnabled}
                        onCheckedChange={(checked) =>
                          setDraft((current) => ({ ...current, defaultEnabled: checked }))
                        }
                      />
                    </div>
                    <div className="flex min-h-[64px] items-center justify-between gap-3 rounded-lg border p-3">
                      <div>
                        <Label className="text-sm font-semibold">Semua Pengguna</Label>
                        <p className="text-xs text-muted-foreground">Grant eksplisit untuk seluruh akun login.</p>
                      </div>
                      <Switch
                        checked={draft.allUsers}
                        onCheckedChange={(checked) => setDraft((current) => ({ ...current, allUsers: checked }))}
                      />
                    </div>
                  </div>

                  <Separator />

                  <section className="space-y-3">
                    <Label className="text-sm font-semibold">Target Role</Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {ROLE_OPTIONS.map((role) => (
                        <label
                          key={role.value}
                          className="flex min-h-[44px] items-center gap-3 rounded-lg border px-3 py-2"
                        >
                          <Checkbox
                            checked={draft.roles.includes(role.value)}
                            onCheckedChange={() => toggleDraftRole(role.value)}
                          />
                          <span className="text-sm font-medium">{role.label}</span>
                        </label>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <Label className="text-sm font-semibold">User Khusus</Label>
                      <Badge variant="outline">{draft.userIds.length} dipilih</Badge>
                    </div>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={userSearch}
                        onChange={(event) => setUserSearch(event.target.value)}
                        placeholder="Cari akun..."
                        className="min-h-[44px] pl-9"
                      />
                    </div>
                    <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border p-2">
                      {filteredSpecialUsers.length === 0 ? (
                        <p className="p-3 text-sm text-muted-foreground">Tidak ada akun yang cocok.</p>
                      ) : (
                        filteredSpecialUsers.map((user) => (
                          <label
                            key={user.id}
                            className="flex min-h-[44px] items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/60"
                          >
                            <Checkbox
                              checked={draft.userIds.includes(user.id)}
                              onCheckedChange={() => toggleDraftUser(user.id)}
                            />
                            <span className="min-w-0 text-sm">
                              <span className="block truncate font-medium">{getUserLabel(user)}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {getUserSubLabel(user)}
                              </span>
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  </section>

                  <Alert className="border-primary/30 bg-primary/5">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      Dampak saat disimpan: <strong>{previewCount} akun</strong> akan mendapat akses.
                    </AlertDescription>
                  </Alert>

                  <Button onClick={saveFeature} disabled={saving} className="min-h-[44px] w-full gap-2">
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Simpan Kontrol Fitur
                  </Button>
                </CardContent>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Card className="rounded-lg">
              <CardHeader className="gap-4">
                <div>
                  <CardTitle>Tabel Role Pengguna</CardTitle>
                  <CardDescription>
                    Pilih akun untuk mengubah role aplikasi yang dipakai oleh kontrol fitur.
                  </CardDescription>
                </div>
                <div className="relative max-w-xl">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={roleUserSearch}
                    onChange={(event) => setRoleUserSearch(event.target.value)}
                    placeholder="Cari nama atau email akun..."
                    className="min-h-[44px] pl-9"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader className="bg-muted/60">
                    <TableRow>
                      <TableHead className="min-w-[240px]">Akun</TableHead>
                      <TableHead className="min-w-[220px]">Role Aktif</TableHead>
                      <TableHead className="min-w-[160px]">Login Terakhir</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRoleUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-28 text-center text-muted-foreground">
                          Tidak ada akun yang cocok.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRoleUsers.map((user) => {
                        const userRoles = Array.from(new Set([DEFAULT_USER_ROLE, ...(roleMap.get(user.id) || [])]));
                        const active = selectedRoleUserId === user.id;
                        return (
                          <TableRow
                            key={user.id}
                            data-state={active ? "selected" : undefined}
                            className="cursor-pointer"
                            onClick={() => setSelectedRoleUserId(user.id)}
                          >
                            <TableCell>
                              <p className="font-semibold">{getUserLabel(user)}</p>
                              <p className="text-xs text-muted-foreground">{getUserSubLabel(user)}</p>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1.5">
                                {userRoles.map((role) => (
                                  <Badge key={role} variant="secondary">
                                    {ROLE_OPTIONS.find((option) => option.value === role)?.label || role}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDateTime(user.lastSignInAt)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                size="sm"
                                variant={active ? "default" : "outline"}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedRoleUserId(user.id);
                                }}
                              >
                                Edit Role
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle>Editor Role</CardTitle>
                <CardDescription>
                  {selectedUser ? getUserSubLabel(selectedUser) : "Pilih akun di tabel untuk mengatur role."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedUser ? (
                  <>
                    <div className="rounded-lg border p-3">
                      <p className="font-semibold">{getUserLabel(selectedUser)}</p>
                      <p className="text-xs text-muted-foreground">{selectedUser.id}</p>
                    </div>
                    <div className="grid gap-2">
                      {ROLE_OPTIONS.map((role) => (
                        <label
                          key={role.value}
                          className="flex min-h-[44px] items-center gap-3 rounded-lg border px-3 py-2"
                        >
                          <Checkbox
                            checked={role.value === DEFAULT_USER_ROLE || userRoleDraft.includes(role.value)}
                            disabled={role.value === DEFAULT_USER_ROLE}
                            onCheckedChange={() => toggleUserRole(role.value)}
                          />
                          <span className="text-sm font-medium">
                            {role.label}
                            {role.value === DEFAULT_USER_ROLE && (
                              <span className="ml-2 text-xs font-normal text-muted-foreground">(default)</span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                    <Alert>
                      <AlertDescription>
                        Role aktif: <strong>{getRoleLabels(userRoleDraft)}</strong>
                      </AlertDescription>
                    </Alert>
                    <Button
                      onClick={saveUserRoles}
                      disabled={saving || !selectedRoleUserId}
                      className="min-h-[44px] w-full gap-2"
                    >
                      {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                      Simpan Role Akun
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Belum ada akun yang dipilih.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="audit">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Audit Perubahan</CardTitle>
              <CardDescription>
                Riwayat perubahan terbaru dari fitur, audience, dan role pengguna.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader className="bg-muted/60">
                  <TableRow>
                    <TableHead className="min-w-[160px]">Aksi</TableHead>
                    <TableHead className="min-w-[220px]">Fitur / Target</TableHead>
                    <TableHead className="min-w-[220px]">Admin</TableHead>
                    <TableHead className="min-w-[180px]">Waktu</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audits.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-28 text-center text-muted-foreground">
                        Belum ada audit perubahan.
                      </TableCell>
                    </TableRow>
                  ) : (
                    audits.map((audit) => (
                      <TableRow key={audit.id}>
                        <TableCell className="font-medium">{audit.action}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{audit.feature_key || "role pengguna"}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {audit.actor_email || "admin-panel"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDateTime(audit.created_at)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
