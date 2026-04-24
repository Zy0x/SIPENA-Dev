// Admin Panel Component
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Shield, Lock, Eye, EyeOff, LogOut, Database, Users, 
  Key, ArrowLeft, Loader2, CheckCircle, XCircle,
  AlertTriangle, Server, HardDrive, Clock, Megaphone, UserPlus
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { SipenaLogo } from "@/components/SipenaLogo";
import { EDGE_FUNCTIONS_URL, SUPABASE_EXTERNAL_ANON_KEY } from "@/lib/supabase-external";
import { DeletionRequestsManager } from "@/components/admin/DeletionRequestsManager";
import { DatabaseManagementPanel } from "@/components/admin/DatabaseManagementPanel";
import { DatabaseOverviewPanel } from "@/components/admin/DatabaseOverviewPanel";
import { InlineAccountStats } from "@/components/admin/InlineAccountStats";
import { AdminNotificationsPanel } from "@/components/admin/AdminNotificationsPanel";
import { MaintenanceAlertPanel } from "@/components/admin/MaintenanceAlertPanel";
import { useAdminSessionTimeout } from "@/hooks/useAdminSessionTimeout";
import { TeamManagementPanel } from "@/components/admin/TeamManagementPanel";

// Admin session storage keys - must match Auth.tsx
const ADMIN_SESSION_TOKEN_KEY = "admin_session_token";
const ADMIN_BACKEND_KEY = "admin_backend_key";

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Auth states
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  // Backend password for edge functions (stored in session memory only)
  const [backendPassword, setBackendPassword] = useState("");
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);

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
    // Try to get from sessionStorage (set by Auth.tsx)
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
        // Check for token from Auth.tsx login (stored in localStorage)
        const token = localStorage.getItem(ADMIN_SESSION_TOKEN_KEY);
        
        if (token) {
          // Verify token with backend
          const response = await fetch(`${EDGE_FUNCTIONS_URL}/admin-auth`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${SUPABASE_EXTERNAL_ANON_KEY}`,
            },
            body: JSON.stringify({
              action: "verify",
              token: token,
            }),
          });

          const result = await response.json();
          if (result.success && result.valid) {
            setIsAuthenticated(true);
            
            // Restore backend password from sessionStorage if available
            const storedKey = sessionStorage.getItem(ADMIN_BACKEND_KEY);
            if (storedKey) {
              const decoded = decodePassword(storedKey);
              if (decoded) {
                setBackendPassword(decoded);
              }
            }
          } else {
            // Token invalid or expired, remove it
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
      toast({
        variant: "destructive",
        title: "Error",
        description: "Masukkan password admin",
      });
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
        body: JSON.stringify({
          action: "login",
          password,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Save session token to localStorage (same as Auth.tsx)
        localStorage.setItem(ADMIN_SESSION_TOKEN_KEY, result.token);
        
        // Store encoded password in sessionStorage for backend operations
        const timestamp = Date.now().toString(36);
        const encoded = btoa(unescape(encodeURIComponent(password)));
        sessionStorage.setItem(ADMIN_BACKEND_KEY, `${timestamp}.${encoded}`);
        
        // Auto-set backend password from login
        setBackendPassword(password);
        
        setIsAuthenticated(true);
        setPassword("");
        
        toast({
          title: "Login Berhasil",
          description: "Selamat datang, Admin!",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Login Gagal",
          description: result.error || "Password salah",
        });
      }
    } catch (error) {
      console.error("Login error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal terhubung ke server",
      });
    } finally {
      setLoginLoading(false);
    }
  };

  // Note: handleLogout is defined above for session timeout

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Login form
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-destructive/5 p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="mb-6 gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali
          </Button>

          <Card className="shadow-xl border-destructive/20">
            <CardHeader className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="p-3 rounded-full bg-destructive/10">
                  <Shield className="w-8 h-8 text-destructive" />
                </div>
              </div>
              <div>
                <CardTitle className="text-2xl font-bold">Panel Admin</CardTitle>
                <CardDescription>
                  Masukkan password admin untuk melanjutkan
                </CardDescription>
              </div>
            </CardHeader>
            
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-password">Password Admin</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="admin-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10"
                      disabled={loginLoading}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full" variant="destructive" disabled={loginLoading}>
                  {loginLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Memverifikasi...
                    </>
                  ) : (
                    <>
                      <Key className="w-4 h-4 mr-2" />
                      Masuk Admin
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Admin dashboard
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <SipenaLogo size="sm" />
            <Badge variant="destructive" className="gap-1">
              <Shield className="w-3 h-3" />
              Admin Panel
            </Badge>
          </div>
          
          <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2">
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="container px-4 py-8">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-7 lg:w-auto lg:inline-flex">
            <TabsTrigger value="overview" className="gap-2">
              <Database className="w-4 h-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="maintenance" className="gap-2">
              <Megaphone className="w-4 h-4" />
              <span className="hidden sm:inline">Alert</span>
            </TabsTrigger>
            <TabsTrigger value="database" className="gap-2">
              <HardDrive className="w-4 h-4" />
              <span className="hidden sm:inline">Database</span>
            </TabsTrigger>
            <TabsTrigger value="accounts" className="gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Akun</span>
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-2">
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Tim</span>
            </TabsTrigger>
            <TabsTrigger value="deletion" className="gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span className="hidden sm:inline">Penghapusan</span>
            </TabsTrigger>
            <TabsTrigger value="credentials" className="gap-2">
              <Key className="w-4 h-4" />
              <span className="hidden sm:inline">Kredensial</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab - Now uses DatabaseOverviewPanel */}
          <TabsContent value="overview" className="space-y-6">
            {/* Admin Notifications */}
            <AdminNotificationsPanel adminPassword={getBackendPassword()} />
            
            {/* Database Overview */}
            <DatabaseOverviewPanel adminPassword={getBackendPassword()} />
            
            {!backendPassword && (
              <Card className="border-warning/50 bg-warning/5">
                <CardContent className="flex items-center gap-3 py-4">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                  <span className="text-sm">
                    Password backend belum diatur. Buka tab <strong>Kredensial</strong> untuk mengatur password backend agar statistik akurat.
                  </span>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Maintenance Alert Tab */}
          <TabsContent value="maintenance" className="space-y-6">
            <MaintenanceAlertPanel adminPassword={getBackendPassword()} />
          </TabsContent>

          {/* Database Management Tab */}
          <TabsContent value="database" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Manajemen Database</h2>
            </div>
            <p className="text-muted-foreground">
              Kelola database: backup, restore, dan hapus data per tabel.
            </p>
            <DatabaseManagementPanel adminPassword={getBackendPassword()} />
          </TabsContent>

          {/* Accounts Tab - Now uses InlineAccountStats */}
          <TabsContent value="accounts" className="space-y-6">
            <InlineAccountStats adminPassword={getBackendPassword()} />
          </TabsContent>

          {/* Team Management Tab */}
          <TabsContent value="team" className="space-y-6">
            <TeamManagementPanel adminPassword={getBackendPassword()} />
          </TabsContent>

          {/* Deletion Requests Tab */}
          <TabsContent value="deletion" className="space-y-6">
            <h2 className="text-2xl font-bold">Permintaan Penghapusan Akun</h2>
            <DeletionRequestsManager adminPassword={getBackendPassword()} />
          </TabsContent>

          {/* Credentials Tab */}
          <TabsContent value="credentials" className="space-y-6">
            <h2 className="text-2xl font-bold">Kredensial Backend</h2>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="w-5 h-5" />
                  Password Backend (ADMIN_DB_PASSWORD)
                </CardTitle>
                <CardDescription>
                  Password ini digunakan untuk mengakses Edge Functions yang memerlukan autentikasi admin.
                  Password disimpan di memori sesi saja dan tidak tersimpan permanen.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="backend-password">Password Backend</Label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="backend-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Masukkan ADMIN_DB_PASSWORD"
                      value={backendPassword}
                      onChange={(e) => setBackendPassword(e.target.value)}
                      className="pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ini adalah password yang diatur sebagai secret di Supabase Edge Functions
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {backendPassword ? (
                    <Badge variant="default" className="gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Password tersimpan di sesi
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1">
                      <XCircle className="w-3 h-3" />
                      Belum diatur
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
