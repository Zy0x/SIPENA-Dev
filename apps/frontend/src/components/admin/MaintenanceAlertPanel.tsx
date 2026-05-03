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
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const alertTypeIcons: Record<string, React.ReactNode> = {
    info: <Info className="w-4 h-4" />,
    warning: <AlertTriangle className="w-4 h-4" />,
    critical: <XCircle className="w-4 h-4" />,
    maintenance: <Wrench className="w-4 h-4" />,
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-lg">Maintenance Reminder</CardTitle>
              <CardDescription>Kelola alert/pemberitahuan live ke semua pengguna</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="alert-active" className="text-sm font-medium">
              {alert.is_active ? "Aktif" : "Nonaktif"}
            </Label>
            <Switch
              id="alert-active"
              checked={alert.is_active}
              onCheckedChange={(v) => setAlert(prev => ({ ...prev, is_active: v }))}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Preview */}
        {showPreview && (
          <div
            className="rounded-lg overflow-hidden text-sm font-medium"
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
          onClick={() => setShowPreview(!showPreview)}
          className="gap-2"
        >
          {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {showPreview ? "Sembunyikan Preview" : "Tampilkan Preview"}
        </Button>

        <Separator />

        {/* Content */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Judul</Label>
            <Input
              value={alert.title}
              onChange={(e) => setAlert(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Pemberitahuan"
            />
          </div>

          <div className="space-y-2">
            <Label>Tipe Alert</Label>
            <Select value={alert.alert_type} onValueChange={(v) => setAlert(prev => ({ ...prev, alert_type: v }))}>
              <SelectTrigger>
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

        <div className="space-y-2">
          <Label>Pesan</Label>
          <Textarea
            value={alert.message}
            onChange={(e) => setAlert(prev => ({ ...prev, message: e.target.value }))}
            placeholder="Masukkan pesan maintenance/pemberitahuan..."
            rows={3}
          />
        </div>

        {/* Display Mode */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Monitor className="w-4 h-4" />
            Mode Tampilan
          </Label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setAlert(prev => ({ ...prev, display_mode: "flat" }))}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                alert.display_mode === "flat"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <p className="text-sm font-semibold">Flat</p>
              <p className="text-[10px] text-muted-foreground">Di atas header, mendorong konten ke bawah</p>
            </button>
            <button
              onClick={() => setAlert(prev => ({ ...prev, display_mode: "flyout" }))}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                alert.display_mode === "flyout"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <p className="text-sm font-semibold">Flyout</p>
              <p className="text-[10px] text-muted-foreground">Melayang di atas header dengan efek bernapas</p>
            </button>
          </div>
        </div>

        <Separator />

        {/* Styling */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Warna Preset
          </Label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(presetColors).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => handleColorPreset(key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all hover:scale-105"
                style={{ backgroundColor: preset.bg, color: preset.text, borderColor: preset.bg }}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Background</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={alert.bg_color}
                  onChange={(e) => setAlert(prev => ({ ...prev, bg_color: e.target.value }))}
                  className="w-8 h-8 rounded cursor-pointer"
                />
                <Input
                  value={alert.bg_color}
                  onChange={(e) => setAlert(prev => ({ ...prev, bg_color: e.target.value }))}
                  className="font-mono text-xs"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Teks</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={alert.text_color}
                  onChange={(e) => setAlert(prev => ({ ...prev, text_color: e.target.value }))}
                  className="w-8 h-8 rounded cursor-pointer"
                />
                <Input
                  value={alert.text_color}
                  onChange={(e) => setAlert(prev => ({ ...prev, text_color: e.target.value }))}
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Options */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Type className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Teks Berjalan (Marquee)</p>
                <p className="text-xs text-muted-foreground">Teks akan bergerak jika pesan panjang</p>
              </div>
            </div>
            <Switch
              checked={alert.is_marquee}
              onCheckedChange={(v) => setAlert(prev => ({ ...prev, is_marquee: v }))}
            />
          </div>
        </div>

        <Separator />

        {/* Time Window */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Jadwal Tampil (Opsional)
          </Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Mulai</Label>
              <Input
                type="datetime-local"
                value={alert.start_time}
                onChange={(e) => setAlert(prev => ({ ...prev, start_time: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Selesai</Label>
              <Input
                type="datetime-local"
                value={alert.end_time}
                onChange={(e) => setAlert(prev => ({ ...prev, end_time: e.target.value }))}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Kosongkan untuk tampil tanpa batas waktu selama aktif
          </p>
        </div>

        <Separator />

        {/* Save */}
        <div className="flex items-center justify-between">
          <Badge variant={alert.is_active ? "default" : "secondary"}>
            {alert.is_active ? "🟢 Alert akan ditampilkan" : "⚫ Alert tidak ditampilkan"}
          </Badge>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Simpan & Terapkan
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
