// Admin Panel — Enterprise Edition
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Shield, Lock, Eye, EyeOff, LogOut, Database, Users,
  Key, ArrowLeft, Loader2, CheckCircle, XCircle,
  AlertTriangle, Server, HardDrive, Clock, Megaphone,
  UserPlus, TimerReset, SlidersHorizontal, LayoutDashboard,
  ChevronLeft, ChevronRight, Bell, Activity, Menu, X,
  Fingerprint, ShieldCheck, Wifi, WifiOff,
  Sun, Moon, Palette, RotateCcw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { SipenaLogo } from "@/components/SipenaLogo";
import { EDGE_FUNCTIONS_URL, SUPABASE_EXTERNAL_ANON_KEY } from "@/core/repositories/supabase-compat.repository";
import { DeletionRequestsManager } from "@/components/admin/DeletionRequestsManager";
import { DatabaseManagementPanel } from "@/components/admin/DatabaseManagementPanel";
import { DatabaseOverviewPanel } from "@/components/admin/DatabaseOverviewPanel";
import { InlineAccountStats } from "@/components/admin/InlineAccountStats";
import { AdminNotificationsPanel } from "@/components/admin/AdminNotificationsPanel";
import { MaintenanceAlertPanel } from "@/components/admin/MaintenanceAlertPanel";
import { useAdminSessionTimeout } from "@/hooks/useAdminSessionTimeout";
import { TeamManagementPanel } from "@/components/admin/TeamManagementPanel";
import { AuthLockoutResetRequestsManager } from "@/components/admin/AuthLockoutResetRequestsManager";
import { FeatureAccessPanel } from "@/components/admin/FeatureAccessPanel";
import { useThemes, themes } from "@/hooks/useThemes";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// Admin session storage keys - must match Auth.tsx
const ADMIN_SESSION_TOKEN_KEY = "admin_session_token";
const ADMIN_BACKEND_KEY = "admin_backend_key";

// ─── Navigation Structure ────────────────────────────────────────────────────
type NavItem = {
  id: string;
  label: string;
  icon: React.ElementType;
  group: string;
  badge?: string;
};

const NAV_ITEMS: NavItem[] = [
  { id: "overview",     label: "Overview",             icon: LayoutDashboard,    group: "Dashboard" },
  { id: "maintenance",  label: "Maintenance Alert",    icon: Megaphone,          group: "Komunikasi" },
  { id: "database",     label: "Database",             icon: HardDrive,          group: "Data" },
  { id: "accounts",     label: "Manajemen Akun",       icon: Users,              group: "Pengguna" },
  { id: "team",         label: "Tim",                  icon: UserPlus,           group: "Pengguna" },
  { id: "deletion",     label: "Permintaan Hapus",     icon: AlertTriangle,      group: "Permintaan" },
  { id: "auth-reset",   label: "Auth Reset",           icon: TimerReset,         group: "Permintaan" },
  { id: "features",     label: "Feature Flags",        icon: SlidersHorizontal,  group: "Sistem" },
  { id: "credentials",  label: "Kredensial",           icon: Key,                group: "Sistem" },
];

const NAV_GROUPS = ["Dashboard", "Komunikasi", "Data", "Pengguna", "Permintaan", "Sistem"];

// ─── Session Timer Hook ───────────────────────────────────────────────────────
function useSessionClock(isAuthenticated: boolean) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!isAuthenticated) return;
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [isAuthenticated]);

  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  return `${h > 0 ? `${h}j ` : ""}${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}d`;
}

// ─── Main Component ──────────────────────────────────────────────────────────
const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentTheme, isDark, selectTheme, toggleDarkMode: toggleThemeDarkMode, resetToDefault } = useThemes();

  // Auth states
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Backend password for edge functions (stored in session memory only)
  const [backendPassword, setBackendPassword] = useState("");
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);

  // Navigation state
  const [activeSection, setActiveSection] = useState("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const sessionClock = useSessionClock(isAuthenticated);

  // Logout handler (moved up for session timeout)
  const handleLogout = useCallback(() => {
    localStorage.removeItem(ADMIN_SESSION_TOKEN_KEY);
    sessionStorage.removeItem(ADMIN_BACKEND_KEY);
    setIsAuthenticated(false);
    setBackendPassword("");
    navigate("/auth");
    toast({
      title: "Logout Berhasil",
      description: "Anda telah keluar dari panel admin",
    });
  }, [navigate, toast]);

  // Session timeout hook
  useAdminSessionTimeout({
    onTimeout: () => {
      setShowTimeoutWarning(false);
      handleLogout();
      toast({
        variant: "destructive",
        title: "Sesi Berakhir",
        description: "Anda telah logout otomatis karena tidak aktif",
      });
    },
    onWarning: () => {
      setShowTimeoutWarning(true);
      toast({
        title: "Peringatan Sesi",
        description: "Sesi akan berakhir dalam 2 menit karena tidak aktif",
      });
    },
    enabled: isAuthenticated,
  });

  // Decode password from storage
  const decodePassword = (encoded: string): string | null => {
    try {
      const parts = encoded.split(".");
      if (parts.length !== 2) return null;
      return decodeURIComponent(escape(atob(parts[1])));
    } catch {
      return null;
    }
  };

  // Helper to get backend password
  const getBackendPassword = useCallback(() => {
    if (backendPassword) return backendPassword;
    const stored = sessionStorage.getItem(ADMIN_BACKEND_KEY);
    if (stored) {
      const decoded = decodePassword(stored);
      if (decoded) {
        setBackendPassword(decoded);
        return decoded;
      }
    }
    return "";
  }, [backendPassword]);

  // Check existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const token = localStorage.getItem(ADMIN_SESSION_TOKEN_KEY);
        if (token) {
          const response = await fetch(`${EDGE_FUNCTIONS_URL}/admin-auth`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${SUPABASE_EXTERNAL_ANON_KEY}`,
            },
            body: JSON.stringify({ action: "verify", token }),
          });
          const result = await response.json();
          if (result.success && result.valid) {
            setIsAuthenticated(true);
            const storedKey = sessionStorage.getItem(ADMIN_BACKEND_KEY);
            if (storedKey) {
              const decoded = decodePassword(storedKey);
              if (decoded) setBackendPassword(decoded);
            }
          } else {
            localStorage.removeItem(ADMIN_SESSION_TOKEN_KEY);
            sessionStorage.removeItem(ADMIN_BACKEND_KEY);
          }
        }
      } catch (error) {
        console.error("Session check error:", error);
      } finally {
        setIsLoading(false);
      }
    };
    checkSession();
  }, []);

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Masukkan password admin" });
      return;
    }
    setLoginLoading(true);
    try {
      const response = await fetch(`${EDGE_FUNCTIONS_URL}/admin-auth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_EXTERNAL_ANON_KEY}`,
        },
        body: JSON.stringify({ action: "login", password }),
      });
      const result = await response.json();
      if (result.success) {
        localStorage.setItem(ADMIN_SESSION_TOKEN_KEY, result.token);
        const timestamp = Date.now().toString(36);
        const encoded = btoa(unescape(encodeURIComponent(password)));
        sessionStorage.setItem(ADMIN_BACKEND_KEY, `${timestamp}.${encoded}`);
        setBackendPassword(password);
        setIsAuthenticated(true);
        setPassword("");
        toast({ title: "Login Berhasil", description: "Selamat datang, Admin!" });
      } else {
        toast({ variant: "destructive", title: "Login Gagal", description: result.error || "Password salah" });
      }
    } catch (error) {
      console.error("Login error:", error);
      toast({ variant: "destructive", title: "Error", description: "Gagal terhubung ke server" });
    } finally {
      setLoginLoading(false);
    }
  };

  // ─── Loading State ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <Shield className="w-8 h-8 text-red-400" />
            </div>
            <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-background border border-border flex items-center justify-center">
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
            </span>
          </div>
          <p className="text-muted-foreground/85 text-sm">Memeriksa sesi...</p>
        </div>
      </div>
    );
  }

  // ─── LOGIN PAGE ────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-background">
        {/* Ambient background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-red-600/5 blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-muted/10 blur-[100px]" />
          {/* Grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative z-10 w-full max-w-md px-4"
        >
          {/* Back button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="mb-8 gap-2 text-muted-foreground hover:text-foreground hover:bg-muted"
            type="button"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Aplikasi
          </Button>

          {/* Card */}
          <div className="rounded-2xl border border-border bg-card/85 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden">
            {/* Top accent bar */}
            <div className="h-1 w-full bg-gradient-to-r from-red-600 via-rose-500 to-red-700" />

            <div className="p-8">
              {/* Header */}
              <div className="flex flex-col items-center gap-5 mb-8">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.15, duration: 0.4 }}
                  className="relative"
                >
                  <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                    <Shield className="w-8 h-8 text-red-400" />
                  </div>
                  {/* Pulse ring */}
                  <span className="absolute inset-0 rounded-2xl border border-red-500/30 animate-ping opacity-40" />
                </motion.div>

                <div className="text-center">
                  <h1 className="text-2xl font-bold text-foreground tracking-tight">
                    Admin Portal
                  </h1>
                  <p className="text-muted-foreground text-sm mt-1">
                    SIPENA System Administration
                  </p>
                </div>

                {/* Security indicators */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-xs text-emerald-500 dark:text-emerald-400">
                    <Wifi className="w-3 h-3" />
                    <span>Koneksi Aman</span>
                  </div>
                  <div className="w-px h-3 bg-border" />
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Fingerprint className="w-3 h-3" />
                    <span>Akses Terbatas</span>
                  </div>
                  <div className="w-px h-3 bg-border" />
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Terenkripsi</span>
                  </div>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="admin-password" className="text-foreground/90 text-sm font-medium">
                    Password Admin
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                    <Input
                      id="admin-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 bg-background border-border text-foreground placeholder:text-muted-foreground/45 focus:border-red-500/60 focus:ring-red-500/20 h-11"
                      disabled={loginLoading}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-semibold tracking-wide shadow-lg shadow-red-900/30 transition-all duration-200"
                  disabled={loginLoading}
                >
                  {loginLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Key className="w-4 h-4 mr-2" />
                  )}
                  {loginLoading ? "Memverifikasi..." : "Masuk ke Admin Panel"}
                </Button>
              </form>

              {/* Footer note */}
              <p className="text-center text-xs text-muted-foreground/50 mt-6">
                Akses tidak sah akan dicatat dan dilaporkan
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── Current nav item metadata ─────────────────────────────────────────────
  const currentNav = NAV_ITEMS.find(n => n.id === activeSection) ?? NAV_ITEMS[0];

  // ─── ADMIN DASHBOARD ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground flex transition-colors duration-200">
      {/* ── Sidebar (desktop) ── */}
      <aside
        className={`
          hidden lg:flex flex-col fixed top-0 left-0 h-screen z-40
          border-r border-border bg-card/95 backdrop-blur-xl
          transition-all duration-300 ease-in-out
          ${sidebarCollapsed ? "w-16" : "w-64"}
        `}
      >
        {/* Sidebar header */}
        <div className={`flex items-center h-16 px-4 border-b border-border shrink-0 ${sidebarCollapsed ? "justify-center" : "justify-between"}`}>
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              <SipenaLogo size="sm" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground leading-none">SIPENA</p>
                <p className="text-[10px] text-red-400 font-medium mt-0.5">Admin Console</p>
              </div>
            </div>
          )}
          {sidebarCollapsed && (
            <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <Shield className="w-4 h-4 text-red-400" />
            </div>
          )}
          <button
            type="button"
            onClick={() => setSidebarCollapsed(c => !c)}
            className={`p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ${sidebarCollapsed ? "ml-0" : ""}`}
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
          {NAV_GROUPS.map(group => {
            const items = NAV_ITEMS.filter(n => n.group === group);
            return (
              <div key={group} className="mb-3">
                {!sidebarCollapsed && (
                  <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                    {group}
                  </p>
                )}
                {items.map(item => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveSection(item.id)}
                      title={sidebarCollapsed ? item.label : undefined}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 select-none
                        ${sidebarCollapsed ? "justify-center" : ""}
                        ${isActive
                          ? "bg-red-500/10 text-red-400 border border-red-500/20"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/70 border border-transparent"
                        }
                      `}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-red-400" : ""}`} />
                      {!sidebarCollapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="shrink-0 p-3 border-t border-border">
          <button
            type="button"
            onClick={handleLogout}
            title={sidebarCollapsed ? "Logout" : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-all duration-150 select-none ${sidebarCollapsed ? "justify-center" : ""}`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* ── Mobile Nav Overlay ── */}
      <AnimatePresence>
        {mobileNavOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileNavOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed top-0 left-0 h-full w-72 z-50 bg-card border-r border-border flex flex-col lg:hidden"
            >
              {/* Mobile sidebar header */}
              <div className="flex items-center justify-between h-16 px-4 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-red-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">SIPENA Admin</p>
                    <p className="text-[10px] text-muted-foreground">{sessionClock} aktif</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mobile nav items */}
              <nav className="flex-1 overflow-y-auto py-4 px-2">
                {NAV_GROUPS.map(group => {
                  const items = NAV_ITEMS.filter(n => n.group === group);
                  return (
                    <div key={group} className="mb-3">
                      <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                        {group}
                      </p>
                      {items.map(item => {
                        const Icon = item.icon;
                        const isActive = activeSection === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => { setActiveSection(item.id); setMobileNavOpen(false); }}
                            className={`
                              w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 select-none
                              ${isActive
                                ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/70 border border-transparent"
                              }
                            `}
                          >
                            <Icon className="w-4 h-4 shrink-0" />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </nav>

              {/* Mobile logout */}
              <div className="p-3 border-t border-border">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-all select-none"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Main Content Area ── */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${sidebarCollapsed ? "lg:ml-16" : "lg:ml-64"}`}>
        {/* ── Top Header Bar ── */}
        <header className="sticky top-0 z-30 h-16 border-b border-border bg-background/95 backdrop-blur-xl flex items-center px-4 gap-4 shrink-0">
          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Page title breadcrumb */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-muted-foreground/60 text-sm hidden sm:inline">Admin</span>
            <span className="text-muted-foreground/30 hidden sm:inline">/</span>
            <div className="flex items-center gap-2">
              {(() => { const Icon = currentNav.icon; return <Icon className="w-4 h-4 text-muted-foreground shrink-0" />; })()}
              <h1 className="text-sm font-semibold text-foreground truncate">{currentNav.label}</h1>
            </div>
          </div>

          {/* Header right cluster */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Session timeout warning */}
            {showTimeoutWarning && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium"
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Sesi hampir habis
              </motion.div>
            )}

            {/* Session clock */}
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted border border-border text-muted-foreground text-xs font-mono">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>{sessionClock}</span>
            </div>

            {/* Backend password status */}
            <div
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors"
              style={{
                borderColor: backendPassword ? "rgba(52,211,153,0.3)" : "rgba(239,68,68,0.3)",
                background: backendPassword ? "rgba(52,211,153,0.08)" : "rgba(239,68,68,0.08)",
                color: backendPassword ? "#10b981" : "#f87171",
              }}
              onClick={() => setActiveSection("credentials")}
              title="Klik untuk ke tab Kredensial"
            >
              <Server className="w-3.5 h-3.5" />
              <span>{backendPassword ? "Backend OK" : "No Backend"}</span>
            </div>

            {/* Admin badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold">
              <Shield className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Admin</span>
            </div>

            {/* Theme switcher */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleThemeDarkMode}
              title={isDark ? "Ubah ke Mode Terang" : "Ubah ke Mode Gelap"}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-500" />}
            </Button>

            {/* Theme palette picker */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  title="Pilih Tema Warna"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <Palette className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-popover border border-border">
                <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">Palet Tema SIPENA</DropdownMenuLabel>
                <DropdownMenuSeparator className="border-border" />
                <div className="max-h-60 overflow-y-auto py-1">
                  {Object.entries(themes).map(([themeId, theme]) => (
                    <DropdownMenuItem
                      key={themeId}
                      onClick={() => selectTheme(themeId)}
                      className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer ${
                        currentTheme === themeId ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      }`}
                    >
                      <span>{theme.name}</span>
                      <div className="flex gap-0.5 rounded overflow-hidden shrink-0">
                        {theme.colors.slice(0, 3).map((color, idx) => (
                          <div
                            key={idx}
                            className="w-2.5 h-2.5"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </DropdownMenuItem>
                  ))}
                </div>
                {currentTheme !== "default" && (
                  <>
                    <DropdownMenuSeparator className="border-border" />
                    <DropdownMenuItem
                      onClick={resetToDefault}
                      className="flex items-center justify-center py-2 text-xs text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3 mr-1.5" />
                      Reset ke Default
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* ── Page Content ── */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="space-y-6"
              >
                {/* ── Overview ── */}
                {activeSection === "overview" && (
                  <>
                    {/* Summary metric strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <MetricCard
                        label="Status Backend"
                        value={backendPassword ? "Terhubung" : "Tidak Aktif"}
                        icon={Server}
                        status={backendPassword ? "ok" : "warn"}
                      />
                      <MetricCard
                        label="Sesi Aktif"
                        value={sessionClock}
                        icon={Clock}
                        status="neutral"
                      />
                      <MetricCard
                        label="Koneksi"
                        value="Aman"
                        icon={ShieldCheck}
                        status="ok"
                      />
                      <MetricCard
                        label="Mode"
                        value="Admin"
                        icon={Shield}
                        status="info"
                      />
                    </div>

                    {/* No backend warning */}
                    {!backendPassword && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5"
                      >
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-amber-300">Password Backend Belum Diatur</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Statistik database dan beberapa fitur memerlukan password backend.{" "}
                            <button
                              type="button"
                              onClick={() => setActiveSection("credentials")}
                              className="text-amber-400 underline underline-offset-2 hover:no-underline"
                            >
                              Buka Kredensial
                            </button>
                          </p>
                        </div>
                      </motion.div>
                    )}

                    {/* Notifications */}
                    <AdminNotificationsPanel adminPassword={getBackendPassword()} />

                    {/* DB Overview */}
                    <DatabaseOverviewPanel adminPassword={getBackendPassword()} />
                  </>
                )}

                {/* ── Maintenance ── */}
                {activeSection === "maintenance" && (
                  <>
                    <SectionHeader
                      icon={Megaphone}
                      title="Maintenance Alert"
                      description="Kelola banner pemberitahuan yang ditampilkan ke semua pengguna"
                    />
                    <MaintenanceAlertPanel adminPassword={getBackendPassword()} />
                  </>
                )}

                {/* ── Database ── */}
                {activeSection === "database" && (
                  <>
                    <SectionHeader
                      icon={HardDrive}
                      title="Manajemen Database"
                      description="Backup, restore, dan kelola data per tabel"
                    />
                    <DatabaseManagementPanel adminPassword={getBackendPassword()} />
                  </>
                )}

                {/* ── Accounts ── */}
                {activeSection === "accounts" && (
                  <>
                    <SectionHeader
                      icon={Users}
                      title="Manajemen Akun"
                      description="Kelola seluruh akun pengguna, statistik data, dan penghapusan"
                    />
                    <InlineAccountStats adminPassword={getBackendPassword()} />
                  </>
                )}

                {/* ── Team ── */}
                {activeSection === "team" && (
                  <>
                    <SectionHeader
                      icon={UserPlus}
                      title="Manajemen Tim"
                      description="Kelola profil anggota tim yang ditampilkan di halaman About"
                    />
                    <TeamManagementPanel adminPassword={getBackendPassword()} />
                  </>
                )}

                {/* ── Deletion Requests ── */}
                {activeSection === "deletion" && (
                  <>
                    <SectionHeader
                      icon={AlertTriangle}
                      title="Permintaan Penghapusan Akun"
                      description="Tinjau dan proses permintaan penghapusan akun dari pengguna"
                    />
                    <DeletionRequestsManager adminPassword={getBackendPassword()} />
                  </>
                )}

                {/* ── Auth Reset ── */}
                {activeSection === "auth-reset" && (
                  <>
                    <SectionHeader
                      icon={TimerReset}
                      title="Reset Waiting Time Login"
                      description="Kelola permintaan reset lockout autentikasi"
                    />
                    <AuthLockoutResetRequestsManager adminPassword={getBackendPassword()} />
                  </>
                )}

                {/* ── Features ── */}
                {activeSection === "features" && (
                  <>
                    <SectionHeader
                      icon={SlidersHorizontal}
                      title="Feature Access Control"
                      description="Aktifkan atau nonaktifkan fitur aplikasi secara global atau per pengguna"
                    />
                    <FeatureAccessPanel adminPassword={getBackendPassword()} />
                  </>
                )}

                {/* ── Credentials ── */}
                {activeSection === "credentials" && (
                  <>
                    <SectionHeader
                      icon={Key}
                      title="Kredensial Backend"
                      description="Atur password yang digunakan untuk mengakses Edge Functions admin"
                    />
                    <CredentialsPanel
                      backendPassword={backendPassword}
                      setBackendPassword={setBackendPassword}
                      showPassword={showPassword}
                      setShowPassword={setShowPassword}
                    />
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* ── Mobile Bottom Navigation ── */}
        <nav className="lg:hidden sticky bottom-0 z-30 border-t border-slate-800/70 bg-slate-950/95 backdrop-blur-xl">
          <div className="flex items-center justify-around px-2 py-1.5 overflow-x-auto gap-1 no-scrollbar">
            {NAV_ITEMS.slice(0, 5).map(item => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className={`
                    flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl min-w-[56px] transition-all duration-150 select-none
                    ${isActive ? "text-red-400 bg-red-500/10" : "text-slate-500 hover:text-slate-300"}
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium leading-none">{item.label.split(" ")[0]}</span>
                </button>
              );
            })}
            {/* More button */}
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl min-w-[56px] text-slate-500 hover:text-slate-300 transition-colors select-none"
            >
              <Menu className="w-5 h-5" />
              <span className="text-[10px] font-medium leading-none">Lainnya</span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
};

// ─── Helper Components ─────────────────────────────────────────────────────

type MetricStatus = "ok" | "warn" | "error" | "neutral" | "info";

function MetricCard({
  label,
  value,
  icon: Icon,
  status,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  status: MetricStatus;
}) {
  const colors: Record<MetricStatus, { bg: string; border: string; icon: string; value: string }> = {
    ok:      { bg: "bg-emerald-500/5",  border: "border-emerald-500/15", icon: "text-emerald-400", value: "text-emerald-500 dark:text-emerald-300" },
    warn:    { bg: "bg-amber-500/5",    border: "border-amber-500/15",   icon: "text-amber-500",   value: "text-amber-500 dark:text-amber-300"   },
    error:   { bg: "bg-red-500/5",      border: "border-red-500/15",     icon: "text-red-500",     value: "text-red-500 dark:text-red-300"     },
    neutral: { bg: "bg-muted/40",       border: "border-border",         icon: "text-muted-foreground", value: "text-foreground"   },
    info:    { bg: "bg-blue-500/5",     border: "border-blue-500/15",    icon: "text-blue-500",    value: "text-blue-500 dark:text-blue-300"    },
  };
  const c = colors[status];

  return (
    <div className={`rounded-xl border p-4 ${c.bg} ${c.border}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="w-8 h-8 rounded-lg bg-card/60 flex items-center justify-center">
          <Icon className={`w-4 h-4 ${c.icon}`} />
        </div>
      </div>
      <p className={`text-base font-bold tabular-nums leading-tight ${c.value}`}>{value}</p>
      <p className="text-xs text-muted-foreground/80 mt-0.5">{label}</p>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-4 pb-2">
      <div className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-foreground" />
      </div>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

function CredentialsPanel({
  backendPassword,
  setBackendPassword,
  showPassword,
  setShowPassword,
}: {
  backendPassword: string;
  setBackendPassword: (v: string) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-card/80">
        <div className="w-9 h-9 rounded-lg bg-muted border border-border flex items-center justify-center">
          <Server className="w-4 h-4 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Password Backend (ADMIN_DB_PASSWORD)</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Digunakan untuk Edge Functions admin. Disimpan di memori sesi saja — tidak tersimpan permanen.
          </p>
        </div>
      </div>

      <div className="p-6 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="backend-password" className="text-foreground text-sm font-medium">
            Password Backend
          </Label>
          <div className="relative">
            <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/75" />
            <Input
              id="backend-password"
              type={showPassword ? "text" : "password"}
              placeholder="Masukkan ADMIN_DB_PASSWORD"
              value={backendPassword}
              onChange={(e) => setBackendPassword(e.target.value)}
              className="pl-10 pr-10 bg-background border-border text-foreground placeholder:text-muted-foreground/50 focus:border-primary h-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Secret yang diatur di Supabase Edge Functions → Secrets sebagai <code className="text-foreground bg-muted px-1.5 py-0.5 rounded text-[11px]">ADMIN_DB_PASSWORD</code>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {backendPassword ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium">
              <CheckCircle className="w-4 h-4" />
              Password tersimpan di sesi ini
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted border border-border text-muted-foreground text-sm">
              <XCircle className="w-4 h-4" />
              Belum diatur — statistik tidak akan dimuat
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Admin;
