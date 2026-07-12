import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Bot, CheckCircle2, Eye, EyeOff, History, KeyRound, Loader2, RefreshCw, Save, Send, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { EDGE_FUNCTIONS_URL, SUPABASE_EXTERNAL_ANON_KEY } from "@/core/repositories/supabase-compat.repository";

interface MonitoringConfig {
  environment: string;
  enabled: boolean;
  minimumSeverity: "p1" | "p2" | "p3";
  sendRecovery: boolean;
  telegramBotConfigured: boolean;
  telegramChatConfigured: boolean;
  webhookConfigured: boolean;
  telegramChatMasked: string | null;
  botUsername: string | null;
  lastTestAt: string | null;
  lastTestSuccess: boolean | null;
  lastTestMessage: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
}

interface MonitoringAudit {
  id: number;
  actor: string;
  action: string;
  success: boolean;
  created_at: string;
}

interface MonitoringResponse {
  success?: boolean;
  error?: string;
  message?: string;
  config?: MonitoringConfig;
  audits?: MonitoringAudit[];
}

interface MonitoringSystemPanelProps { adminPassword: string }

function formatDate(value: string | null) {
  if (!value) return "Belum pernah";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function createWebhookKey() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function MonitoringSystemPanel({ adminPassword }: MonitoringSystemPanelProps) {
  const { toast } = useToast();
  const [config, setConfig] = useState<MonitoringConfig | null>(null);
  const [audits, setAudits] = useState<MonitoringAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [minimumSeverity, setMinimumSeverity] = useState<"p1" | "p2" | "p3">("p1");
  const [sendRecovery, setSendRecovery] = useState(true);
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [webhookKey, setWebhookKey] = useState("");
  const [showBotToken, setShowBotToken] = useState(false);
  const [showWebhookKey, setShowWebhookKey] = useState(false);

  const request = useCallback(async (action: string, payload: Record<string, unknown> = {}) => {
    const response = await fetch(`${EDGE_FUNCTIONS_URL}/admin-monitoring-config`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_EXTERNAL_ANON_KEY}`,
        apikey: SUPABASE_EXTERNAL_ANON_KEY,
        "x-admin-session-token": localStorage.getItem("admin_session_token") || "",
      },
      body: JSON.stringify({ action, password: adminPassword, ...payload }),
    });
    const result = (await response.json().catch(() => ({}))) as MonitoringResponse;
    if (!response.ok || !result.success) throw new Error(result.error || "Aksi monitoring gagal");
    return result;
  }, [adminPassword]);

  const applyConfig = useCallback((next: MonitoringConfig) => {
    setConfig(next);
    setEnabled(next.enabled);
    setMinimumSeverity(next.minimumSeverity);
    setSendRecovery(next.sendRecovery);
  }, []);

  const loadData = useCallback(async () => {
    if (!adminPassword) { setLoading(false); return; }
    setLoading(true);
    try {
      const result = await request("get-config");
      if (result.config) applyConfig(result.config);
      setAudits(result.audits || []);
    } catch (error) {
      toast({ variant: "destructive", title: "Monitoring tidak dapat dimuat", description: error instanceof Error ? error.message : "Terjadi kesalahan" });
    } finally { setLoading(false); }
  }, [adminPassword, applyConfig, request, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const telegramReady = !!config?.telegramBotConfigured && !!config?.telegramChatConfigured;
  const configChanged = useMemo(() => !!config && (
    enabled !== config.enabled || minimumSeverity !== config.minimumSeverity || sendRecovery !== config.sendRecovery || !!botToken || !!chatId || !!webhookKey
  ), [botToken, chatId, config, enabled, minimumSeverity, sendRecovery, webhookKey]);

  const handleSave = async () => {
    const effectiveTelegramReady = telegramReady || (!!botToken && !!chatId);
    const effectiveWebhookReady = !!config?.webhookConfigured || !!webhookKey;
    if (enabled && (!effectiveTelegramReady || !effectiveWebhookReady)) {
      toast({ variant: "destructive", title: "Konfigurasi belum lengkap", description: "Bot Token, Chat ID, dan Webhook Key wajib tersedia sebelum monitoring diaktifkan." });
      return;
    }
    setSaving(true);
    try {
      const result = await request("save-config", { enabled, minimumSeverity, sendRecovery, botToken: botToken || undefined, chatId: chatId || undefined, webhookKey: webhookKey || undefined });
      if (result.config) applyConfig(result.config);
      setBotToken(""); setChatId(""); setWebhookKey("");
      toast({ title: "Monitoring diperbarui", description: "Konfigurasi aktif langsung tanpa build atau deploy ulang." });
      await loadData();
    } catch (error) {
      toast({ variant: "destructive", title: "Konfigurasi tidak disimpan", description: error instanceof Error ? error.message : "Terjadi kesalahan" });
    } finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await request("test-telegram");
      if (result.config) applyConfig(result.config);
      toast({ title: "Telegram terhubung", description: result.message || "Pesan uji berhasil dikirim." });
      await loadData();
    } catch (error) {
      toast({ variant: "destructive", title: "Pengujian Telegram gagal", description: error instanceof Error ? error.message : "Terjadi kesalahan" });
    } finally { setTesting(false); }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const result = await request("disconnect-telegram", { confirmation: "PUTUSKAN TELEGRAM" });
      if (result.config) applyConfig(result.config);
      setBotToken(""); setChatId("");
      toast({ title: "Telegram diputuskan", description: "Token dan Chat ID telah dihapus dari Vault." });
      await loadData();
    } catch (error) {
      toast({ variant: "destructive", title: "Gagal memutuskan Telegram", description: error instanceof Error ? error.message : "Terjadi kesalahan" });
    } finally { setDisconnecting(false); }
  };

  if (!adminPassword) return <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">Buka menu Kredensial dan aktifkan password backend terlebih dahulu.</div>;
  if (loading) return <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Memuat konfigurasi monitoring...</div>;

  return (
    <div className="space-y-5" data-testid="admin-monitoring-system-panel">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatusCell label="Status Monitoring" value={config?.enabled ? "Aktif" : "Nonaktif"} ok={!!config?.enabled} />
        <StatusCell label="Telegram" value={config?.botUsername ? `@${config.botUsername}` : "Belum dikonfigurasi"} ok={telegramReady} />
        <StatusCell label="Pengujian Terakhir" value={formatDate(config?.lastTestAt || null)} ok={config?.lastTestSuccess === true} neutral={config?.lastTestSuccess == null} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Bot className="h-5 w-5 text-primary" /> Telegram dan Kebijakan Alert</CardTitle>
            <CardDescription>Secret baru divalidasi sebelum menggantikan konfigurasi aktif. Kolom kosong mempertahankan nilai lama.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <SettingSwitch id="monitoring-enabled" label="Aktifkan monitoring" description="Incident tetap tercatat saat notifikasi dinonaktifkan." checked={enabled} onCheckedChange={setEnabled} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="monitoring-severity">Alert minimum</Label>
                <Select value={minimumSeverity} onValueChange={(value) => setMinimumSeverity(value as "p1" | "p2" | "p3")}>
                  <SelectTrigger id="monitoring-severity"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="p1">P1 - Kritis saja</SelectItem><SelectItem value="p2">P1 dan P2</SelectItem><SelectItem value="p3">Semua alert</SelectItem></SelectContent>
                </Select>
              </div>
              <SettingSwitch id="monitoring-recovery" label="Notifikasi pemulihan" description="Kirim pesan saat layanan kembali normal." checked={sendRecovery} onCheckedChange={setSendRecovery} />
            </div>
            <SecretInput id="telegram-bot-token" label="Telegram Bot Token" value={botToken} onChange={setBotToken} visible={showBotToken} onToggle={() => setShowBotToken((value) => !value)} placeholder={config?.telegramBotConfigured ? "Tersimpan di Vault - isi untuk mengganti" : "Masukkan token dari BotFather"} />
            <div className="space-y-2">
              <Label htmlFor="telegram-chat-id">Telegram Chat ID</Label>
              <Input id="telegram-chat-id" inputMode="numeric" value={chatId} onChange={(event) => setChatId(event.target.value)} placeholder={config?.telegramChatConfigured ? `${config.telegramChatMasked || "Tersimpan"} - isi untuk mengganti` : "Contoh: -1001234567890"} />
              <p className="text-xs text-muted-foreground">Mendukung chat pribadi dan grup Telegram.</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3"><Label htmlFor="monitoring-webhook-key">Webhook HMAC Key</Label><Button type="button" variant="ghost" size="sm" onClick={() => setWebhookKey(createWebhookKey())}><KeyRound className="mr-2 h-4 w-4" /> Buat Key</Button></div>
              <SecretInput id="monitoring-webhook-key" label="" value={webhookKey} onChange={setWebhookKey} visible={showWebhookKey} onToggle={() => setShowWebhookKey((value) => !value)} placeholder={config?.webhookConfigured ? "Tersimpan di Vault - isi untuk merotasi" : "Minimal 32 karakter"} />
              <p className="text-xs text-muted-foreground">Gunakan nilai yang sama pada GitHub Actions dan webhook Better Stack.</p>
            </div>
            <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:flex-wrap">
              <Button onClick={handleSave} disabled={saving || !configChanged} className="min-h-11 sm:min-w-36">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Simpan</Button>
              <Button variant="outline" onClick={handleTest} disabled={testing || !telegramReady} className="min-h-11 sm:min-w-36">{testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Uji Telegram</Button>
              <Button variant="ghost" onClick={loadData} className="min-h-11"><RefreshCw className="mr-2 h-4 w-4" /> Muat Ulang</Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-5 w-5 text-emerald-500" /> Status Keamanan</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><SecurityRow label="Bot Token" configured={!!config?.telegramBotConfigured} /><SecurityRow label="Chat ID" configured={!!config?.telegramChatConfigured} /><SecurityRow label="Webhook Key" configured={!!config?.webhookConfigured} /><p className="border-t pt-3 text-xs leading-relaxed text-muted-foreground">Secret tersimpan di Supabase Vault dan tidak pernah dikirim kembali ke browser.</p></CardContent></Card>
          {config?.lastTestMessage && <div className={`rounded-lg border p-4 ${config.lastTestSuccess ? "border-emerald-500/30 bg-emerald-500/10" : "border-destructive/30 bg-destructive/10"}`}><div className="flex items-start gap-3">{config.lastTestSuccess ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500" /> : <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />}<div><p className="text-sm font-medium">Hasil pengujian terakhir</p><p className="mt-1 break-words text-xs text-muted-foreground">{config.lastTestMessage}</p></div></div></div>}
          <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" className="min-h-11 w-full" disabled={!telegramReady || disconnecting}><Trash2 className="mr-2 h-4 w-4" /> Putuskan Telegram</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Putuskan Telegram?</AlertDialogTitle><AlertDialogDescription>Bot Token dan Chat ID akan dihapus dari Supabase Vault. Monitoring dinonaktifkan, tetapi histori incident tetap disimpan.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={handleDisconnect} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{disconnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Putuskan</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
        </div>
      </div>

      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><History className="h-5 w-5 text-primary" /> Audit Konfigurasi</CardTitle><CardDescription>Nilai secret tidak pernah dicatat dalam audit.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto rounded-lg border"><Table className="min-w-[680px]"><TableHeader><TableRow><TableHead>Waktu</TableHead><TableHead>Aksi</TableHead><TableHead>Admin</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{audits.length === 0 ? <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Belum ada perubahan monitoring.</TableCell></TableRow> : audits.map((audit) => <TableRow key={audit.id}><TableCell className="whitespace-nowrap text-xs">{formatDate(audit.created_at)}</TableCell><TableCell className="font-medium">{audit.action.replace(/_/g, " ")}</TableCell><TableCell className="font-mono text-xs">{audit.actor}</TableCell><TableCell><Badge variant={audit.success ? "default" : "destructive"}>{audit.success ? "Berhasil" : "Gagal"}</Badge></TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
    </div>
  );
}

function StatusCell({ label, value, ok, neutral = false }: { label: string; value: string; ok: boolean; neutral?: boolean }) {
  return <div className="rounded-lg border bg-card p-4"><div className="flex items-center justify-between gap-3"><span className="text-sm font-medium">{label}</span>{neutral ? <Activity className="h-5 w-5 text-muted-foreground" /> : ok ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <XCircle className="h-5 w-5 text-muted-foreground" />}</div><p className="mt-2 truncate text-xs text-muted-foreground">{value}</p></div>;
}

function SettingSwitch({ id, label, description, checked, onCheckedChange }: { id: string; label: string; description: string; checked: boolean; onCheckedChange: (value: boolean) => void }) {
  return <div className="flex min-h-20 items-center justify-between gap-4 rounded-lg border p-3"><div><Label htmlFor={id}>{label}</Label><p className="mt-1 text-xs text-muted-foreground">{description}</p></div><Switch id={id} checked={checked} onCheckedChange={onCheckedChange} /></div>;
}

function SecretInput({ id, label, value, onChange, visible, onToggle, placeholder }: { id: string; label: string; value: string; onChange: (value: string) => void; visible: boolean; onToggle: () => void; placeholder: string }) {
  return <div className="space-y-2">{label && <Label htmlFor={id}>{label}</Label>}<div className="relative"><Input id={id} type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} autoComplete="new-password" className="pr-11" /><Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 h-8 w-8" onClick={onToggle} aria-label={visible ? "Sembunyikan secret" : "Tampilkan secret"}>{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button></div></div>;
}

function SecurityRow({ label, configured }: { label: string; configured: boolean }) {
  return <div className="flex items-center justify-between gap-3"><span>{label}</span><Badge variant={configured ? "default" : "secondary"}>{configured ? "Terenkripsi" : "Kosong"}</Badge></div>;
}

export default MonitoringSystemPanel;
