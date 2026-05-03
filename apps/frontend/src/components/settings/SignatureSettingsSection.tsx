import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useSignatureSettings } from "@/hooks/useSignatureSettings";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { PenTool, Loader2, Save, Eye } from "lucide-react";

export function SignatureSettingsSection() {
  const { signature, isLoading, saveSignature, isSaving, hasSignature } = useSignatureSettings();
  const { success, error: showError } = useEnhancedToast();

  const [form, setForm] = useState({
    city: "",
    name: "",
    title: "Guru Mata Pelajaran",
    nip: "",
    school_name: "",
  });
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (signature) {
      setForm({
        city: signature.city || "",
        name: signature.name || "",
        title: signature.title || "Guru Mata Pelajaran",
        nip: signature.nip || "",
        school_name: signature.school_name || "",
      });
    }
  }, [signature]);

  const handleSave = async () => {
    if (!form.name.trim() || !form.city.trim()) {
      showError("Validasi", "Kota dan nama wajib diisi");
      return;
    }
    try {
      await saveSignature(form);
      success("Pengaturan tanda tangan disimpan");
    } catch (err: any) {
      showError("Gagal menyimpan", err.message);
    }
  };

  const todayFormatted = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (isLoading) {
    return (
      <Card className="animate-fade-in-up border border-border shadow-sm">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="animate-fade-in-up border border-border shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <PenTool className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Tanda Tangan Ekspor</CardTitle>
            <CardDescription className="text-xs">
              Data tanda tangan resmi untuk laporan PDF & Excel
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Kota <span className="text-destructive">*</span></Label>
            <Input
              value={form.city}
              onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))}
              placeholder="Bandung"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Nama Lengkap <span className="text-destructive">*</span></Label>
            <Input
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ahmad Fauzi, S.Pd."
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Jabatan</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Guru Mata Pelajaran"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">NIP (opsional)</Label>
            <Input
              value={form.nip}
              onChange={(e) => setForm(f => ({ ...f, nip: e.target.value }))}
              placeholder="198501012010011001"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Nama Sekolah (opsional)</Label>
            <Input
              value={form.school_name}
              onChange={(e) => setForm(f => ({ ...f, school_name: e.target.value }))}
              placeholder="SMP Negeri 1 Bandung"
              className="h-9 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={isSaving} size="sm" className="gap-1.5">
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Simpan
          </Button>
          {hasSignature && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowPreview(!showPreview)}>
              <Eye className="w-3.5 h-3.5" />
              {showPreview ? "Sembunyikan" : "Preview"}
            </Button>
          )}
        </div>

        {/* Preview */}
        {showPreview && hasSignature && (
          <>
            <Separator />
            <div className="bg-muted/30 rounded-lg p-4 sm:p-6">
              <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wider font-medium">
                Preview Tanda Tangan
              </p>
              <div className="text-right space-y-0.5">
                <p className="text-sm font-medium text-foreground">
                  {form.city}, {todayFormatted}
                </p>
                <p className="text-sm text-foreground">{form.title}</p>
                {form.school_name && (
                  <p className="text-xs text-muted-foreground">{form.school_name}</p>
                )}
                <div className="h-12" /> {/* space for signature */}
                <div className="inline-block text-right">
                  <div className="border-b border-foreground w-48 mb-1" />
                  <p className="text-sm font-semibold text-foreground">{form.name}</p>
                  {form.nip && (
                    <p className="text-xs text-muted-foreground">NIP. {form.nip}</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
