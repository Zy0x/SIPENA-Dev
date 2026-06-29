import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { useEnhancedToast } from "@/contexts/ToastContext";
import {
  listAuthLockoutResetRequests,
  processAuthLockoutResetRequest,
  processExpiredAuthLockoutResetRequests,
  updateAuthLockoutResetSettings,
  type AuthLockoutResetRequest,
  type AuthLockoutResetSettings,
} from "@/lib/authLockoutResetRequests";
import { CheckCircle2, Clock, Loader2, RefreshCcw, ShieldAlert, TimerReset, XCircle } from "lucide-react";

interface AuthLockoutResetRequestsManagerProps {
  adminPassword: string;
}

function getTimeRemaining(target: string): string {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return "siap auto-approve";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.ceil((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}j ${minutes}m lagi`;
  return `${minutes}m lagi`;
}

function statusBadge(status: AuthLockoutResetRequest["status"]) {
  switch (status) {
    case "pending":
      return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" />Menunggu</Badge>;
    case "approved":
      return <Badge className="gap-1 bg-emerald-600"><CheckCircle2 className="w-3 h-3" />Disetujui</Badge>;
    case "auto_approved":
      return <Badge className="gap-1 bg-sky-600"><CheckCircle2 className="w-3 h-3" />Auto approve</Badge>;
    case "rejected":
      return <Badge variant="outline" className="gap-1"><XCircle className="w-3 h-3" />Ditolak</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function AuthLockoutResetRequestsManager({ adminPassword }: AuthLockoutResetRequestsManagerProps) {
  const { toast } = useEnhancedToast();
  const [requests, setRequests] = useState<AuthLockoutResetRequest[]>([]);
  const [settings, setSettings] = useState<AuthLockoutResetSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const pendingRequests = useMemo(() => requests.filter((request) => request.status === "pending"), [requests]);
  const historyRequests = useMemo(() => requests.filter((request) => request.status !== "pending"), [requests]);

  const fetchRequests = useCallback(async () => {
    if (!adminPassword) return;

    setIsLoading(true);
    try {
      const result = await listAuthLockoutResetRequests(adminPassword);
      setRequests(result.requests);
      setSettings(result.settings);
    } catch (error) {
      toast({
        title: "Gagal memuat request",
        description: error instanceof Error ? error.message : "Tidak dapat memuat request reset waiting time.",
        variant: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }, [adminPassword, toast]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const processRequest = async (requestId: string, decision: "approve" | "reject") => {
    if (!adminPassword) {
      toast({
        title: "Password backend diperlukan",
        description: "Isi Password Backend di tab Kredensial sebelum memproses request.",
        variant: "error",
      });
      return;
    }

    setIsProcessing(true);
    try {
      await processAuthLockoutResetRequest({
        requestId,
        adminPassword,
        decision,
      });
      toast({
        title: decision === "approve" ? "Request disetujui" : "Request ditolak",
        description: "Status reset waiting time sudah diperbarui.",
        variant: "success",
      });
      fetchRequests();
    } catch (error) {
      toast({
        title: "Gagal memproses request",
        description: error instanceof Error ? error.message : "Terjadi kesalahan.",
        variant: "error",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const processExpired = async () => {
    if (!adminPassword) {
      toast({ title: "Password backend diperlukan", variant: "error" });
      return;
    }

    setIsProcessing(true);
    try {
      const result = await processExpiredAuthLockoutResetRequests(adminPassword);
      setSettings(result.settings);
      toast({
        title: "Auto approve diproses",
        description: `${result.processed} request diproses.`,
        variant: "success",
      });
      fetchRequests();
    } catch (error) {
      toast({
        title: "Gagal memproses auto approve",
        description: error instanceof Error ? error.message : "Terjadi kesalahan.",
        variant: "error",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const updateAutoApprove = async (enabled: boolean) => {
    if (!adminPassword) {
      toast({ title: "Password backend diperlukan", variant: "error" });
      return;
    }

    setIsProcessing(true);
    try {
      const result = await updateAuthLockoutResetSettings({
        adminPassword,
        autoApproveEnabled: enabled,
      });
      setSettings(result.settings);
      toast({
        title: enabled ? "Auto approve aktif" : "Auto approve dinonaktifkan",
        description: "Pengaturan reset waiting time diperbarui secara massal.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Gagal memperbarui pengaturan",
        description: error instanceof Error ? error.message : "Terjadi kesalahan.",
        variant: "error",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="border-border bg-card/50">
      <CardHeader className="border-b border-border bg-card/85">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <TimerReset className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold text-foreground">
                Request Reset Waiting Time Login
              </CardTitle>
              <CardDescription className="mt-0.5 text-xs">
                Review request pengguna yang terkunci pada level 6 jam atau lebih.
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={processExpired}
              disabled={isProcessing || !adminPassword}
              className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Proses auto approve"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchRequests}
              disabled={isLoading || !adminPassword}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <RefreshCcw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-5">
        <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/30 p-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">Auto approve 1x24 jam</p>
            <p className="text-xs text-muted-foreground">
              Jika aktif, request pending otomatis disetujui setelah {settings?.auto_approve_hours || 24} jam.
            </p>
          </div>
          <Switch
            checked={settings?.auto_approve_enabled ?? true}
            onCheckedChange={updateAutoApprove}
            disabled={isProcessing || !adminPassword}
            aria-label="Toggle auto approve reset waiting time"
          />
        </div>

        {!adminPassword && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-200">
            Isi Password Backend di tab Kredensial untuk memuat dan memproses request.
          </div>
        )}

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <h3 className="font-medium">Menunggu keputusan</h3>
            <Badge variant="secondary" className="ml-auto">{pendingRequests.length}</Badge>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : pendingRequests.length === 0 ? (
            <p className="rounded-xl border bg-muted/20 py-8 text-center text-sm text-muted-foreground">
              Tidak ada request pending.
            </p>
          ) : (
            <ScrollArea className="h-80 pr-3">
              <div className="space-y-3">
                {pendingRequests.map((request) => (
                  <div key={request.id} className="rounded-xl border bg-card p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <p className="font-medium">{request.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Level {request.lockout_level} | {request.failure_count} kegagalan | auto approve {getTimeRemaining(request.auto_approve_at)}
                        </p>
                        <p className="text-sm text-muted-foreground">"{request.reason}"</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {statusBadge(request.status)}
                        <Button size="sm" onClick={() => processRequest(request.id, "approve")} disabled={isProcessing}>
                          Setujui
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => processRequest(request.id, "reject")}
                          disabled={isProcessing}
                        >
                          Tolak
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="font-medium">Riwayat</h3>
          {historyRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada riwayat request.</p>
          ) : (
            <div className="space-y-2">
              {historyRequests.slice(0, 10).map((request) => (
                <div key={request.id} className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{request.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {request.processed_at ? new Date(request.processed_at).toLocaleString("id-ID") : new Date(request.created_at).toLocaleString("id-ID")}
                      {request.admin_response && ` | ${request.admin_response}`}
                    </p>
                  </div>
                  {statusBadge(request.status)}
                </div>
              ))}
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
