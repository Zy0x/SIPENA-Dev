import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  Megaphone, Save, Loader2, Eye, EyeOff, AlertTriangle,
  Info, Wrench, XCircle, Palette, Clock, Type, Monitor
} from "lucide-react";
import { EDGE_FUNCTIONS_URL, SUPABASE_EXTERNAL_ANON_KEY } from "@/core/repositories/supabase-compat.repository";
import { supabaseExternal as supabase } from "@/core/repositories/supabase-compat.repository";
import { useToast } from "@/hooks/use-toast";

interface MaintenanceAlert {
  id?: string;
  title: string;
  message: string;
  alert_type: string;
  is_active: boolean;
  is_marquee: boolean;
  display_mode: string;
  bg_color: string;
  text_color: string;
  icon: string;
  start_time: string;
  end_time: string;
}

const defaultAlert: MaintenanceAlert = {
  title: "Pemberitahuan",
  message: "",
  alert_type: "info",
  is_active: false,
  is_marquee: false,
  display_mode: "flat",
  bg_color: "#3b82f6",
  text_color: "#ffffff",
  icon: "info",
  start_time: "",
  end_time: "",
};

const presetColors: Record<string, { bg: string; text: string; label: string }> = {
  blue: { bg: "#3b82f6", text: "#ffffff", label: "Biru (Info)" },
  yellow: { bg: "#f59e0b", text: "#1a1a1a", label: "Kuning (Warning)" },
  red: { bg: "#ef4444", text: "#ffffff", label: "Merah (Critical)" },
  green: { bg: "#22c55e", text: "#ffffff", label: "Hijau (Sukses)" },
  purple: { bg: "#8b5cf6", text: "#ffffff", label: "Ungu" },
  dark: { bg: "#1e293b", text: "#f8fafc", label: "Gelap" },
};

interface Props {
  adminPassword: string;
}

export function MaintenanceAlertPanel({ adminPassword }: Props) {
  const { toast } = useToast();
  const [alert, setAlert] = useState<MaintenanceAlert>(defaultAlert);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await (supabase as any)
          .from("maintenance_alerts")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data) {
          setAlert({
            id: data.id,
            title: data.title || "",
            message: data.message || "",
            alert_type: data.alert_type || "info",
            is_active: data.is_active || false,
            is_marquee: data.is_marquee || false,
            display_mode: data.display_mode || "flat",
            bg_color: data.bg_color || "#3b82f6",
            text_color: data.text_color || "#ffffff",
            icon: data.icon || "info",
            start_time: data.start_time || "",
            end_time: data.end_time || "",
          });
        }
      } catch (err) {
        console.error("Failed to load maintenance alert:", err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = useCallback(async () => {
    if (!alert.message.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Pesan tidak boleh kosong" });
      return;
    }

    if (!adminPassword) {
      toast({ variant: "destructive", title: "Error", description: "Password backend belum diatur. Buka tab Kredensial." });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`${EDGE_FUNCTIONS_URL}/manage-maintenance-alert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_EXTERNAL_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: "upsert",
          password: adminPassword,
          id: alert.id || null,
          payload: {
            title: alert.title,
            message: alert.message,
            alert_type: alert.alert_type,
            is_active: alert.is_active,
            is_marquee: alert.is_marquee,
            display_mode: alert.display_mode,
            bg_color: alert.bg_color,
            text_color: alert.text_color,
            icon: alert.icon,
            start_time: alert.start_time || null,
            end_time: alert.end_time || null,
          },
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Gagal menyimpan alert");
      }

      if (result.data?.id) {
        setAlert(prev => ({ ...prev, id: result.data.id }));
      }

      toast({
        title: "Berhasil",
        description: alert.is_active
          ? "Alert aktif dan ditampilkan ke semua pengguna"
          : "Alert disimpan (tidak aktif)",
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal menyimpan", description: err.message });
    } finally {
      setIsSaving(false);
    }
  }, [alert, adminPassword, toast]);

  const handleColorPreset = (key: string) => {
    const preset = presetColors[key];
    setAlert(prev => ({ ...prev, bg_color: preset.bg, text_color: preset.text }));
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-800/70 bg-slate-900/50">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
        </div>
      </div>
    );
  }

  const alertTypeIcons: Record<string, React.ReactNode> = {
    info: <Info className="w-4 h-4" />,
    warning: <AlertTriangle className="w-4 h-4" />,
    critical: <XCircle className="w-4 h-4" />,
    maintenance: <Wrench className="w-4 h-4" />,
  };

  return (
    <div className="rounded-xl border border-slate-800/70 bg-slate-900/50 overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/70 bg-slate-900/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Megaphone className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-100">Maintenance Alert</p>
            <p className="text-xs text-slate-500 mt-0.5">Kelola banner pemberitahuan live ke semua pengguna</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium px-2 py-1 rounded-full border ${
            alert.is_active
              ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
              : "text-slate-500 bg-slate-800/60 border-slate-700/50"
          }`}>
            {alert.is_active ? "● Aktif" : "○ Nonaktif"}
          </span>
          <Switch
            id="alert-active"
            checked={alert.is_active}
            onCheckedChange={(v) => setAlert(prev => ({ ...prev, is_active: v }))}
          />
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Live Preview */}
        {showPreview && (
          <div
            className="rounded-lg overflow-hidden text-sm font-medium shadow-lg"
            style={{ backgroundColor: alert.bg_color, color: alert.text_color }}
          >
            <div className="flex items-center gap-2 px-4 py-2.5">
              {alertTypeIcons[alert.alert_type]}
              {alert.title && <span className="font-bold">{alert.title}:</span>}
              <div className="flex-1 overflow-hidden">
                {alert.is_marquee ? (
                  <div className="whitespace-nowrap animate-marquee">
                    <span className="inline-block pr-16">{alert.message || "Pesan preview..."}</span>
                  </div>
                ) : (
                  <span>{alert.message || "Pesan preview..."}</span>
                )}
              </div>
            </div>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className="gap-2 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600"
        >
          {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {showPreview ? "Sembunyikan Preview" : "Tampilkan Preview"}
        </Button>

        {/* ── Konten Section ── */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-600 mb-3">Konten</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-slate-300 text-sm">Judul</Label>
              <Input
                value={alert.title}
                onChange={(e) => setAlert(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Pemberitahuan"
                className="bg-slate-800/60 border-slate-700 text-slate-100 placeholder:text-slate-600"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 text-sm">Tipe Alert</Label>
              <Select value={alert.alert_type} onValueChange={(v) => setAlert(prev => ({ ...prev, alert_type: v }))}>
                <SelectTrigger className="bg-slate-800/60 border-slate-700 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">ℹ️ Info</SelectItem>
                  <SelectItem value="warning">⚠️ Warning</SelectItem>
                  <SelectItem value="critical">🚨 Critical</SelectItem>
                  <SelectItem value="maintenance">🔧 Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2 mt-4">
            <Label className="text-slate-300 text-sm">Pesan</Label>
            <Textarea
              value={alert.message}
              onChange={(e) => setAlert(prev => ({ ...prev, message: e.target.value }))}
              placeholder="Masukkan pesan maintenance/pemberitahuan..."
              rows={3}
              className="bg-slate-800/60 border-slate-700 text-slate-100 placeholder:text-slate-600 resize-none"
            />
          </div>
        </div>

        <div className="border-t border-slate-800/70" />

        {/* ── Mode Tampilan ── */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-600 mb-3">Mode Tampilan</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setAlert(prev => ({ ...prev, display_mode: "flat" }))}
              className={`p-3.5 rounded-xl border-2 text-left transition-all ${
                alert.display_mode === "flat"
                  ? "border-amber-500/40 bg-amber-500/5 text-slate-100"
                  : "border-slate-700/50 hover:border-slate-600 text-slate-400"
              }`}
            >
              <p className="text-sm font-semibold">Flat</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Di atas header, mendorong konten ke bawah</p>
            </button>
            <button
              type="button"
              onClick={() => setAlert(prev => ({ ...prev, display_mode: "flyout" }))}
              className={`p-3.5 rounded-xl border-2 text-left transition-all ${
                alert.display_mode === "flyout"
                  ? "border-amber-500/40 bg-amber-500/5 text-slate-100"
                  : "border-slate-700/50 hover:border-slate-600 text-slate-400"
              }`}
            >
              <p className="text-sm font-semibold">Flyout</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Melayang di atas header dengan efek bernapas</p>
            </button>
          </div>
        </div>

        <div className="border-t border-slate-800/70" />

        {/* ── Styling Section ── */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-600 mb-3">Warna & Styling</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(presetColors).map(([key, preset]) => (
              <button
                key={key}
                type="button"
                onClick={() => handleColorPreset(key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all hover:scale-105 active:scale-95"
                style={{ backgroundColor: preset.bg, color: preset.text, borderColor: preset.bg }}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-slate-400">Warna Background</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={alert.bg_color}
                  onChange={(e) => setAlert(prev => ({ ...prev, bg_color: e.target.value }))}
                  className="w-9 h-9 rounded-lg cursor-pointer border border-slate-700 bg-slate-800"
                />
                <Input
                  value={alert.bg_color}
                  onChange={(e) => setAlert(prev => ({ ...prev, bg_color: e.target.value }))}
                  className="font-mono text-xs bg-slate-800/60 border-slate-700 text-slate-200"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-slate-400">Warna Teks</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={alert.text_color}
                  onChange={(e) => setAlert(prev => ({ ...prev, text_color: e.target.value }))}
                  className="w-9 h-9 rounded-lg cursor-pointer border border-slate-700 bg-slate-800"
                />
                <Input
                  value={alert.text_color}
                  onChange={(e) => setAlert(prev => ({ ...prev, text_color: e.target.value }))}
                  className="font-mono text-xs bg-slate-800/60 border-slate-700 text-slate-200"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800/70" />

        {/* ── Opsi & Jadwal ── */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-600 mb-3">Opsi & Jadwal</p>
          <div className="flex items-center justify-between p-3.5 rounded-lg bg-slate-800/40 border border-slate-700/40 mb-4">
            <div className="flex items-center gap-2">
              <Type className="w-4 h-4 text-slate-500" />
              <div>
                <p className="text-sm font-medium text-slate-200">Teks Berjalan (Marquee)</p>
                <p className="text-xs text-slate-500">Teks bergerak horizontal jika pesan panjang</p>
              </div>
            </div>
            <Switch
              checked={alert.is_marquee}
              onCheckedChange={(v) => setAlert(prev => ({ ...prev, is_marquee: v }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Mulai Tampil
              </Label>
              <Input
                type="datetime-local"
                value={alert.start_time}
                onChange={(e) => setAlert(prev => ({ ...prev, start_time: e.target.value }))}
                className="bg-slate-800/60 border-slate-700 text-slate-200 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Selesai Tampil
              </Label>
              <Input
                type="datetime-local"
                value={alert.end_time}
                onChange={(e) => setAlert(prev => ({ ...prev, end_time: e.target.value }))}
                className="bg-slate-800/60 border-slate-700 text-slate-200 text-sm"
              />
            </div>
          </div>
          <p className="text-xs text-slate-600 mt-2">
            Kosongkan untuk tampil tanpa batas waktu selama aktif
          </p>
        </div>

        <div className="border-t border-slate-800/70" />

        {/* ── Save Section ── */}
        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium ${
            alert.is_active
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-slate-800/40 border-slate-700/40 text-slate-500"
          }`}>
            <span className={`w-2 h-2 rounded-full ${alert.is_active ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
            {alert.is_active ? "Alert akan ditampilkan" : "Alert tidak ditampilkan"}
          </div>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="gap-2 bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-900/20"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Simpan & Terapkan
          </Button>
        </div>
      </div>
    </div>
  );
}
