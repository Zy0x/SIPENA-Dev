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
  Settings,
  Layers,
  Terminal,
  Zap,
  ShieldAlert,
  UserCheck,
  ChevronRight,
  UserPlus,
  Trash2,
  ArrowRight,
  Info,
  Check,
  X,
  FileText,
  AlertCircle,
  ToggleLeft
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
import { FEATURE_CATALOG_SYNC_PAYLOAD } from "@/app/providers/featureAccess";
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

  const accessMode = useMemo(() => {
    if (!draft.globalKillSwitch) return "off";
    if (draft.allUsers || draft.defaultEnabled) return "public";
    return "restricted";
  }, [draft.globalKillSwitch, draft.allUsers, draft.defaultEnabled]);

  const handleAccessModeChange = (mode: "off" | "public" | "restricted") => {
    setDraft((current) => {
      switch (mode) {
        case "off":
          return {
            ...current,
            globalKillSwitch: false,
            defaultEnabled: false,
            allUsers: false,
          };
        case "public":
          return {
            ...current,
            globalKillSwitch: true,
            defaultEnabled: true,
            allUsers: true,
          };
        case "restricted":
          return {
            ...current,
            globalKillSwitch: true,
            defaultEnabled: false,
            allUsers: false,
          };
      }
    });
  };

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
      await requestAdminFeatureAccess("sync-feature-catalog", {
        catalog: FEATURE_CATALOG_SYNC_PAYLOAD,
      });
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

  const getFeatureIcon = (type: FeatureType) => {
    switch (type) {
      case "page":
        return <Layers className="h-4 w-4 text-sky-500" />;
      case "feature":
        return <Settings className="h-4 w-4 text-indigo-500" />;
      case "runtime":
        return <Terminal className="h-4 w-4 text-amber-500 animate-pulse" />;
    }
  };

  const resetFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setRiskFilter("all");
    setStatusFilter("all");
  };

  const isFilterActive = search || typeFilter !== "all" || riskFilter !== "all" || statusFilter !== "all";

  if (!adminPassword) {
    return (
      <Alert className="border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-400">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <AlertDescription className="text-sm font-medium">
          Password backend belum tersedia. Buka tab Kredensial atau login ulang agar admin dapat mengelola kontrol fitur.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-primary" />
            Kontrol Akses & Feature Flags
          </h2>
          <p className="text-xs text-muted-foreground">
            Kelola halaman dinamis, runtime, role pengguna, dan whitelist akun penguji (beta-testing) dari pusat kendali terintegrasi.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={loading}
          className="h-10 px-4 gap-2 text-muted-foreground hover:text-foreground self-start sm:self-center transition-all min-h-[44px]"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="text-xs font-semibold">Muat Ulang Data</span>
        </Button>
      </div>

      {/* Grid Dashboard KPI */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary/5 via-card to-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Total Flags</p>
            <SlidersHorizontal className="h-4 w-4 text-primary/70" />
          </div>
          <p className="mt-2 text-3xl font-extrabold text-foreground tracking-tight tabular-nums">{featureStats.total}</p>
          <div className="absolute -bottom-2 -right-2 h-16 w-16 bg-primary/5 rounded-full blur-xl" />
        </div>

        <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-emerald-500/5 via-card to-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Aktif Umum</p>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight tabular-nums">{featureStats.activeAll}</p>
          <div className="absolute -bottom-2 -right-2 h-16 w-16 bg-emerald-500/5 rounded-full blur-xl" />
        </div>

        <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-indigo-500/5 via-card to-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Targeted (Role/User)</p>
            <Users className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="mt-2 text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 tracking-tight tabular-nums">{featureStats.role + featureStats.user}</p>
          <div className="absolute -bottom-2 -right-2 h-16 w-16 bg-indigo-500/5 rounded-full blur-xl" />
        </div>

        <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-rose-500/5 via-card to-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Off / Kill Switched</p>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </div>
          <p className="mt-2 text-3xl font-extrabold text-rose-600 dark:text-rose-400 tracking-tight tabular-nums">{featureStats.off}</p>
          <div className="absolute -bottom-2 -right-2 h-16 w-16 bg-rose-500/5 rounded-full blur-xl" />
        </div>
      </div>

      <Tabs defaultValue="features" className="space-y-6">
        <TabsList className="flex h-auto w-full justify-start rounded-xl border border-border bg-muted/30 p-1 md:w-auto md:inline-flex">
          <TabsTrigger value="features" className="min-h-[44px] gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Fitur & Halaman
          </TabsTrigger>
          <TabsTrigger value="roles" className="min-h-[44px] gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm">
            <Users className="h-3.5 w-3.5" />
            Role Pengguna
          </TabsTrigger>
          <TabsTrigger value="audit" className="min-h-[44px] gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm">
            <Clock3 className="h-3.5 w-3.5" />
            Timeline Audit
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Fitur & Halaman */}
        <TabsContent value="features" className="space-y-6 outline-none">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(380px,0.85fr)]">
            {/* Tabel Fitur */}
            <Card className="rounded-xl border border-border shadow-sm">
              <CardHeader className="space-y-4">
                <div>
                  <CardTitle className="text-base font-bold text-foreground">Daftar Fitur & Flags</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Pilih baris pada tabel untuk menyesuaikan aturan target audience atau mengaktifkan kill-switch.
                  </CardDescription>
                </div>
                {/* Search & Filter Bar */}
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 w-full">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Cari nama, key, atau deskripsi..."
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
                {isFilterActive && (
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetFilters}
                      className="h-8 gap-1.5 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/5"
                    >
                      <X className="h-3 w-3" />
                      Reset Filter
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto border-t border-border">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="min-w-[200px] text-xs font-bold text-muted-foreground uppercase">Fitur</TableHead>
                        <TableHead className="min-w-[180px] text-xs font-bold text-muted-foreground uppercase">Key</TableHead>
                        <TableHead className="text-center text-xs font-bold text-muted-foreground uppercase">Tipe</TableHead>
                        <TableHead className="text-center text-xs font-bold text-muted-foreground uppercase">Risiko</TableHead>
                        <TableHead className="min-w-[130px] text-center text-xs font-bold text-muted-foreground uppercase">Status</TableHead>
                        <TableHead className="min-w-[160px] text-xs font-bold text-muted-foreground uppercase">Target</TableHead>
                        <TableHead className="text-right text-xs font-bold text-muted-foreground uppercase pr-6">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading && flags.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="h-40 text-center text-muted-foreground">
                            <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-primary" />
                            <p className="text-sm font-medium">Menghubungkan ke server...</p>
                          </TableCell>
                        </TableRow>
                      ) : filteredFlags.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                            <Info className="mx-auto mb-2 h-6 w-6 text-muted-foreground/60" />
                            <p className="text-sm font-medium">Tidak ada fitur yang cocok dengan filter aktif.</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredFlags.map((flag) => {
                          const status = getFeatureStatus(flag, audiences);
                          const active = flag.feature_key === selectedFeatureKey;
                          
                          let riskBadgeStyle = "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20";
                          if (flag.risk_level === "medium") riskBadgeStyle = "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20";
                          if (flag.risk_level === "high") riskBadgeStyle = "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20";
                          if (flag.risk_level === "critical") riskBadgeStyle = "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20 animate-pulse font-extrabold";

                          let statusBadgeVariant: "default" | "secondary" | "destructive" | "outline" = "outline";
                          if (status.variant === "default") statusBadgeVariant = "default";
                          else if (status.variant === "secondary") statusBadgeVariant = "secondary";
                          else if (status.variant === "destructive") statusBadgeVariant = "destructive";

                          return (
                            <TableRow
                              key={flag.feature_key}
                              data-state={active ? "selected" : undefined}
                              className={`cursor-pointer group transition-colors ${
                                active ? "bg-primary/5 hover:bg-primary/5 border-l-2 border-l-primary" : ""
                              }`}
                              onClick={() => setSelectedFeatureKey(flag.feature_key)}
                            >
                              <TableCell className="pl-6">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    {getFeatureIcon(flag.feature_type)}
                                    <span className="font-bold text-foreground group-hover:text-primary transition-colors">
                                      {flag.name}
                                    </span>
                                  </div>
                                  <p className="line-clamp-2 text-xs text-muted-foreground font-normal max-w-[280px]">
                                    {flag.description}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-xs font-semibold text-muted-foreground/80">
                                <span className="bg-muted/60 px-1.5 py-0.5 rounded border border-border">
                                  {flag.feature_key}
                                </span>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider">
                                  {TYPE_LABELS[flag.feature_type]}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-wider ${riskBadgeStyle}`}>
                                  {RISK_LABELS[flag.risk_level]}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant={statusBadgeVariant} className="text-xs px-2 py-0.5 font-semibold">
                                  {status.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs font-semibold text-muted-foreground">
                                {getTargetSummary(flag, audiences)}
                              </TableCell>
                              <TableCell className="text-right pr-6">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={active ? "default" : "outline"}
                                  className="h-8 text-xs font-bold transition-all"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setSelectedFeatureKey(flag.feature_key);
                                  }}
                                >
                                  Kelola
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Panel Editor Pengaturan */}
            <Card className="rounded-xl border border-border shadow-sm h-fit">
              <CardHeader className="bg-muted/10 border-b border-border/80">
                <CardTitle className="flex flex-wrap items-center gap-2 text-base font-bold">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  {selectedFeature?.name || "Pilih Fitur Flags"}
                  {selectedFeature && (
                    <Badge variant={selectedFeature.risk_level === "critical" ? "destructive" : "outline"} className="text-[10px] font-bold uppercase tracking-wider">
                      {RISK_LABELS[selectedFeature.risk_level]}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  {selectedFeature ? (
                    <span className="font-mono text-xs block truncate bg-muted/60 p-1.5 rounded border border-border mt-1">
                      {selectedFeature.feature_key}
                    </span>
                  ) : (
                    "Pilih salah satu flag di tabel untuk mulai menyesuaikan whitelist access rules."
                  )}
                </CardDescription>
              </CardHeader>
              
              {selectedFeature ? (
                <CardContent className="p-5 space-y-6">
                  {selectedFeature.risk_level === "critical" && (
                    <Alert className="border-red-500/20 bg-red-500/5 text-red-700 dark:text-red-400">
                      <ShieldAlert className="h-4 w-4 text-red-600 animate-bounce" />
                      <AlertDescription className="text-xs font-medium pl-1 leading-relaxed">
                        <strong>Perhatian:</strong> Ini adalah flag runtime berisiko kritis. Pengaktifan yang salah dapat memengaruhi stabilitas core akademik sekolah secara luas.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Mode Akses (Access Mode) Selector */}
                  <div className="space-y-3">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Mode Akses Fitur</Label>
                    <div className="grid gap-3 grid-cols-1">
                      {/* Opsi 1: Mati Total */}
                      <div
                        onClick={() => handleAccessModeChange("off")}
                        className={`flex cursor-pointer items-start gap-3 p-3.5 rounded-xl border transition-all ${
                          accessMode === "off"
                            ? "border-red-500 bg-red-500/5 text-red-700 dark:text-red-400"
                            : "border-border hover:bg-muted/40 text-foreground bg-card/20"
                        }`}
                      >
                        <div className={`mt-0.5 p-1.5 rounded-lg border ${
                          accessMode === "off" ? "bg-red-500/10 border-red-500/20" : "bg-muted border-border"
                        }`}>
                          <X className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold">Mati Total (Offline)</span>
                            {accessMode === "off" && <Check className="h-4 w-4" />}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-normal">
                            Fitur dinonaktifkan sepenuhnya dari server. Tidak ada pengguna yang dapat mengaksesnya.
                          </p>
                        </div>
                      </div>

                      {/* Opsi 2: Terbuka Umum */}
                      <div
                        onClick={() => handleAccessModeChange("public")}
                        className={`flex cursor-pointer items-start gap-3 p-3.5 rounded-xl border transition-all ${
                          accessMode === "public"
                            ? "border-emerald-500 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                            : "border-border hover:bg-muted/40 text-foreground bg-card/20"
                        }`}
                      >
                        <div className={`mt-0.5 p-1.5 rounded-lg border ${
                          accessMode === "public" ? "bg-emerald-500/10 border-emerald-500/20" : "bg-muted border-border"
                        }`}>
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold">Terbuka Umum (Public)</span>
                            {accessMode === "public" && <Check className="h-4 w-4" />}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-normal">
                            Aktif untuk semua pengguna terdaftar secara default tanpa ada batasan akses khusus.
                          </p>
                        </div>
                      </div>

                      {/* Opsi 3: Akses Terbatas */}
                      <div
                        onClick={() => handleAccessModeChange("restricted")}
                        className={`flex cursor-pointer items-start gap-3 p-3.5 rounded-xl border transition-all ${
                          accessMode === "restricted"
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border hover:bg-muted/40 text-foreground bg-card/20"
                        }`}
                      >
                        <div className={`mt-0.5 p-1.5 rounded-lg border ${
                          accessMode === "restricted" ? "bg-primary/10 border-primary/20" : "bg-muted border-border"
                        }`}>
                          <ShieldCheck className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold">Akses Terbatas (Restricted)</span>
                            {accessMode === "restricted" && <Check className="h-4 w-4" />}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-normal">
                            Hanya mengizinkan role tertentu atau daftar akun khusus (whitelist) yang dipilih di bawah.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {accessMode === "restricted" ? (
                    <>
                      <Separator />

                      {/* Target Role Selector */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-1 text-sm font-bold text-foreground">
                          <Users className="h-4 w-4 text-primary" />
                          Target Role Pengguna
                        </div>
                        <div className="grid gap-2 sm:grid-cols-1">
                          {ROLE_OPTIONS.map((role) => {
                            const isChecked = draft.roles.includes(role.value);
                            return (
                              <div
                                key={role.value}
                                onClick={() => toggleDraftRole(role.value)}
                                className={`flex cursor-pointer items-center justify-between p-3 rounded-lg border transition-all ${
                                  isChecked
                                    ? "border-primary bg-primary/5 text-primary"
                                    : "border-border hover:bg-muted/40 text-foreground bg-card/20"
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={() => {}} // handled by div onClick
                                    className="pointer-events-none"
                                  />
                                  <div>
                                    <span className="text-sm font-bold">{role.label}</span>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      Berikan akses kepada pengguna dengan role {role.label}
                                    </p>
                                  </div>
                                </div>
                                {isChecked && <Check className="h-4 w-4 text-primary shrink-0" />}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <Separator />

                      {/* Whitelist User Khusus */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-1 text-sm font-bold text-foreground">
                            <UserCheck className="h-4 w-4 text-primary" />
                            Target Akun Khusus (Whitelist)
                          </div>
                          <Badge variant="outline" className="text-xs font-bold px-2 py-0.5">
                            {draft.userIds.length} dipilih
                          </Badge>
                        </div>

                        {/* Selected Users Pills */}
                        {draft.userIds.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 p-2 rounded-xl border border-dashed border-border bg-muted/20">
                            {draft.userIds.map((uid) => {
                              const u = users.find((user) => user.id === uid);
                              return (
                                <Badge
                                  key={uid}
                                  variant="secondary"
                                  className="gap-1 px-2 py-1 text-xs bg-card hover:bg-card border border-border"
                                >
                                  <span className="truncate max-w-[120px] font-medium">{u ? getUserLabel(u) : uid}</span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleDraftUser(uid);
                                    }}
                                    className="rounded-full hover:bg-muted p-0.5 text-muted-foreground hover:text-foreground"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              );
                            })}
                          </div>
                        )}

                        {/* Search & List */}
                        <div className="space-y-2">
                          <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              value={userSearch}
                              onChange={(event) => setUserSearch(event.target.value)}
                              placeholder="Cari email atau ID akun..."
                              className="min-h-[44px] pl-9"
                            />
                          </div>
                          <div className="max-h-60 overflow-y-auto space-y-1 rounded-xl border border-border p-2 bg-muted/10 scrollbar-thin">
                            {filteredSpecialUsers.length === 0 ? (
                              <p className="p-4 text-center text-xs text-muted-foreground">Tidak ada akun yang ditemukan.</p>
                            ) : (
                              filteredSpecialUsers.map((user) => {
                                const isSelected = draft.userIds.includes(user.id);
                                return (
                                  <div
                                    key={user.id}
                                    onClick={() => toggleDraftUser(user.id)}
                                    className={`flex cursor-pointer items-center justify-between p-2.5 rounded-lg transition-all ${
                                      isSelected
                                        ? "bg-primary/5 border border-primary/20"
                                        : "hover:bg-muted/40 border border-transparent"
                                    }`}
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={() => {}} // handled by div onClick
                                        className="pointer-events-none"
                                      />
                                      <div className="min-w-0">
                                        <span className="block truncate text-xs font-bold text-foreground">
                                          {getUserLabel(user)}
                                        </span>
                                        <span className="block truncate text-[10px] text-muted-foreground mt-0.5">
                                          {getUserSubLabel(user)}
                                        </span>
                                      </div>
                                    </div>
                                    {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border p-4 bg-muted/20 text-center space-y-1">
                      <p className="text-xs font-bold text-foreground">Konfigurasi Target Ditangguhkan</p>
                      <p className="text-[10px] text-muted-foreground leading-normal max-w-xs mx-auto">
                        Whitelist role dan user dinonaktifkan dalam mode akses saat ini karena fitur diatur ke Mati Total atau Terbuka Umum.
                      </p>
                    </div>
                  )}

                  <Alert className="border-primary/20 bg-primary/5 text-primary flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <AlertDescription className="text-xs font-semibold leading-relaxed">
                      Dampak Perubahan: Sebanyak {previewCount} akun pengguna akan mendapatkan akses aktif setelah disimpan.
                    </AlertDescription>
                  </Alert>

                  <Button
                    onClick={saveFeature}
                    disabled={saving}
                    className="min-h-[48px] w-full gap-2 text-xs font-bold shadow-sm shadow-primary/10"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    Simpan Aturan Feature Flag
                  </Button>
                </CardContent>
              ) : (
                <CardContent className="h-96 flex flex-col items-center justify-center text-center p-6">
                  <SlidersHorizontal className="h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-bold text-foreground">Belum Ada Flag Terpilih</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
                    Silakan pilih salah satu baris fitur pada tabel untuk melakukan konfigurasi akses.
                  </p>
                </CardContent>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: Role Pengguna */}
        <TabsContent value="roles" className="space-y-6 outline-none">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            {/* Tabel Role Pengguna */}
            <Card className="rounded-xl border border-border shadow-sm">
              <CardHeader className="space-y-4">
                <div>
                  <CardTitle className="text-base font-bold text-foreground">Pemetaan Role Pengguna</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Modifikasi penugasan role akun untuk menyesuaikan akses bersyarat yang didefinisikan pada flag.
                  </CardDescription>
                </div>
                <div className="relative max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={roleUserSearch}
                    onChange={(event) => setRoleUserSearch(event.target.value)}
                    placeholder="Cari nama atau email akun..."
                    className="min-h-[44px] pl-9"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto border-t border-border">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="pl-6 min-w-[220px] text-xs font-bold text-muted-foreground uppercase">Akun Pengguna</TableHead>
                        <TableHead className="min-w-[200px] text-xs font-bold text-muted-foreground uppercase">Role Terpasang</TableHead>
                        <TableHead className="min-w-[160px] text-xs font-bold text-muted-foreground uppercase">Sesi Login Terakhir</TableHead>
                        <TableHead className="text-right text-xs font-bold text-muted-foreground uppercase pr-6">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRoleUsers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                            <Info className="mx-auto mb-2 h-6 w-6 text-muted-foreground/60" />
                            <p className="text-sm font-medium">Tidak ada akun yang terdaftar.</p>
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
                              className={`cursor-pointer group transition-colors ${
                                active ? "bg-primary/5 hover:bg-primary/5 border-l-2 border-l-primary" : ""
                              }`}
                              onClick={() => setSelectedRoleUserId(user.id)}
                            >
                              <TableCell className="pl-6">
                                <div className="space-y-0.5">
                                  <span className="font-bold text-foreground group-hover:text-primary transition-colors">
                                    {getUserLabel(user)}
                                  </span>
                                  <span className="block text-xs text-muted-foreground font-mono font-normal">
                                    {getUserSubLabel(user)}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1.5">
                                  {userRoles.map((role) => {
                                    const isDefault = role === DEFAULT_USER_ROLE;
                                    return (
                                      <Badge
                                        key={role}
                                        variant={isDefault ? "outline" : "secondary"}
                                        className="text-xs px-2 py-0.5 font-semibold"
                                      >
                                        {ROLE_OPTIONS.find((option) => option.value === role)?.label || role}
                                      </Badge>
                                    );
                                  })}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs font-semibold text-muted-foreground">
                                {formatDateTime(user.lastSignInAt)}
                              </TableCell>
                              <TableCell className="text-right pr-6">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={active ? "default" : "outline"}
                                  className="h-8 text-xs font-bold transition-all"
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
                </div>
              </CardContent>
            </Card>

            {/* Editor Role */}
            <Card className="rounded-xl border border-border shadow-sm h-fit">
              <CardHeader className="bg-muted/10 border-b border-border/80">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-primary" />
                  Editor Role Akun
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  {selectedUser ? (
                    <span className="font-mono text-xs block truncate bg-muted/60 p-1.5 rounded border border-border mt-1">
                      {selectedUser.id}
                    </span>
                  ) : (
                    "Pilih akun pada tabel untuk mulai memperbarui role penugasan."
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 space-y-6">
                {selectedUser ? (
                  <>
                    <div className="rounded-xl border border-border bg-muted/10 p-3.5 space-y-1">
                      <p className="font-bold text-sm text-foreground">{getUserLabel(selectedUser)}</p>
                      <p className="text-xs text-muted-foreground">{selectedUser.email || "No Email Provided"}</p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pilih Role</Label>
                      <div className="grid gap-2">
                        {ROLE_OPTIONS.map((role) => {
                          const isDefault = role.value === DEFAULT_USER_ROLE;
                          const isChecked = isDefault || userRoleDraft.includes(role.value);
                          return (
                            <div
                              key={role.value}
                              onClick={() => {
                                if (!isDefault) toggleUserRole(role.value);
                              }}
                              className={`flex cursor-pointer items-center justify-between p-3 rounded-lg border transition-all ${
                                isDefault 
                                  ? "border-border bg-muted/30 text-muted-foreground cursor-not-allowed opacity-80"
                                  : isChecked
                                    ? "border-primary bg-primary/5 text-primary"
                                    : "border-border hover:bg-muted/40 text-foreground bg-card/20"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <Checkbox
                                  checked={isChecked}
                                  disabled={isDefault}
                                  onCheckedChange={() => {}} // handled by div onClick
                                  className="pointer-events-none"
                                />
                                <div>
                                  <span className="text-sm font-bold">
                                    {role.label}
                                    {isDefault && (
                                      <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">(bawaan)</span>
                                    )}
                                  </span>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    Izin role {role.label} untuk dipadukan dengan whitelist flags.
                                  </p>
                                </div>
                              </div>
                              {isChecked && <Check className="h-4 w-4 text-primary shrink-0" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <Alert className="border-primary/20 bg-primary/5 text-primary flex items-start gap-2">
                      <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <AlertDescription className="text-xs font-semibold leading-relaxed">
                        Role yang akan disimpan: <strong>{getRoleLabels(userRoleDraft)}</strong>
                      </AlertDescription>
                    </Alert>

                    <Button
                      onClick={saveUserRoles}
                      disabled={saving || !selectedRoleUserId}
                      className="min-h-[48px] w-full gap-2 text-xs font-bold shadow-sm shadow-primary/10"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                      Simpan Role Pengguna
                    </Button>
                  </>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-center p-6">
                    <Users className="h-10 w-10 text-muted-foreground/40 mb-3" />
                    <p className="text-sm font-bold text-foreground">Belum Ada Akun Terpilih</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
                      Silakan pilih salah satu akun pengguna pada tabel sebelah kiri untuk memperbarui akses role.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 3: Timeline Audit Perubahan */}
        <TabsContent value="audit" className="outline-none">
          <Card className="rounded-xl border border-border shadow-sm">
            <CardHeader className="border-b border-border/80">
              <CardTitle className="text-base font-bold text-foreground">Timeline Log Audit</CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Pemantauan riwayat log aktivitas perubahan status, whitelist target, dan otorisasi role pengguna secara real-time.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {audits.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-center">
                  <FileText className="h-10 w-10 text-muted-foreground/30 mb-2" />
                  <p className="text-sm font-bold text-foreground">Belum Ada Audit Perubahan</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Seluruh aktivitas modifikasi feature flag akan tercatat otomatis di linimasa ini.
                  </p>
                </div>
              ) : (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/80">
                  {audits.map((audit) => {
                    const isFlagAction = audit.action.includes("feature") || audit.action.includes("flag");
                    const isSaveFeature = audit.action === "save-feature";
                    const isSaveRoles = audit.action === "save-user-roles";
                    
                    let Icon = FileText;
                    let colorClass = "text-muted-foreground border-muted bg-muted/15";
                    
                    if (isSaveFeature) {
                      Icon = ShieldCheck;
                      colorClass = "text-primary border-primary bg-primary/10";
                    } else if (isSaveRoles) {
                      Icon = Users;
                      colorClass = "text-indigo-500 border-indigo-500 bg-indigo-500/10";
                    }

                    return (
                      <div key={audit.id} className="relative group transition-all">
                        {/* Bullet Marker */}
                        <div className={`absolute -left-[22px] top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-transform group-hover:scale-110 ${colorClass}`}>
                          <Icon className="h-3 w-3" />
                        </div>
                        
                        <div className="flex flex-col gap-2 p-4 rounded-xl border border-border bg-card shadow-sm hover:shadow transition-all max-w-4xl">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <span className="text-sm font-bold text-foreground capitalize flex items-center gap-1.5">
                              {audit.action.replace(/-/g, " ")}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium bg-muted/50 px-2 py-0.5 rounded border border-border">
                              <Clock3 className="h-3.5 w-3.5 text-muted-foreground/85" />
                              {formatDateTime(audit.created_at)}
                            </span>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground mt-1">
                            <span className="font-semibold text-foreground/80 flex items-center gap-1">
                              Oleh Admin:
                              <Badge variant="outline" className="font-mono text-[11px] bg-muted/40 font-medium border-border/80">
                                {audit.actor_email || "system-administrator"}
                              </Badge>
                            </span>
                            {audit.feature_key && (
                              <>
                                <span className="text-muted-foreground/60">•</span>
                                <span className="font-semibold text-foreground/80 flex items-center gap-1">
                                  Flag:
                                  <Badge variant="secondary" className="font-mono text-[10px] font-semibold bg-primary/5 text-primary border border-primary/10">
                                    {audit.feature_key}
                                  </Badge>
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
