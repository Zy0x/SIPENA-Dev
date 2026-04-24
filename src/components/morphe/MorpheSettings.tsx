import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Settings2, MessageSquare, Database, Trash2, Shield,
  BookOpen, History, AlertTriangle, ChevronRight, Info,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MorpheSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeSession: any;
  sessions: any[];
  onUpdateSystemPrompt: (sessionId: string, prompt: string) => void;
  onDeleteAllSessions: () => void;
  deepDataConsent: boolean | null;
  onDeepDataConsentChange: (consent: boolean) => void;
}

type SettingsSection = "general" | "knowledge" | "history" | "sipena" | "advanced";

const sections: { id: SettingsSection; label: string; icon: React.ElementType; desc: string }[] = [
  { id: "general", label: "Umum", icon: Settings2, desc: "Pengaturan dasar Morphe AI" },
  { id: "knowledge", label: "Knowledge", icon: BookOpen, desc: "Instruksi & panduan kustom" },
  { id: "history", label: "Histori", icon: History, desc: "Kelola riwayat percakapan" },
  { id: "sipena", label: "Akses SIPENA", icon: Database, desc: "Kontrol akses data akademik" },
  { id: "advanced", label: "Lanjutan", icon: Shield, desc: "Pengaturan lanjutan" },
];

export function MorpheSettings({
  open, onOpenChange, activeSession, sessions,
  onUpdateSystemPrompt, onDeleteAllSessions,
  deepDataConsent, onDeepDataConsentChange,
}: MorpheSettingsProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("general");
  const [defaultPrompt, setDefaultPrompt] = useState(() => 
    localStorage.getItem("morphe_default_prompt") || "Kamu adalah Morphe, asisten AI cerdas. Gunakan Bahasa Indonesia yang jelas dan profesional."
  );
  const [knowledgeText, setKnowledgeText] = useState(() =>
    localStorage.getItem("morphe_knowledge") || ""
  );
  const [autoSummarize, setAutoSummarize] = useState(() =>
    localStorage.getItem("morphe_auto_summarize") !== "false"
  );
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const handleSaveDefaultPrompt = useCallback(() => {
    localStorage.setItem("morphe_default_prompt", defaultPrompt);
  }, [defaultPrompt]);

  const handleSaveKnowledge = useCallback(() => {
    localStorage.setItem("morphe_knowledge", knowledgeText);
  }, [knowledgeText]);

  const handleToggleAutoSummarize = useCallback((val: boolean) => {
    setAutoSummarize(val);
    localStorage.setItem("morphe_auto_summarize", String(val));
  }, []);

  const handleDeleteAll = useCallback(() => {
    onDeleteAllSessions();
    setShowConfirmDelete(false);
  }, [onDeleteAllSessions]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Settings2 className="w-4 h-4 text-primary" />
            Pengaturan Morphe AI
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row min-h-0 flex-1">
          {/* Sidebar */}
          <nav className="sm:w-48 sm:border-r border-b sm:border-b-0 border-border shrink-0 overflow-x-auto sm:overflow-x-visible">
            <div className="flex sm:flex-col gap-0.5 p-2 sm:py-3">
              {sections.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
                    activeSection === s.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <s.icon className="w-3.5 h-3.5 shrink-0" />
                  {s.label}
                </button>
              ))}
            </div>
          </nav>

          {/* Content */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4 space-y-5">
              {activeSection === "general" && (
                <>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">System Prompt Default</h3>
                    <p className="text-[10px] text-muted-foreground mb-3">
                      Instruksi identitas & kepribadian dasar AI. Menentukan <strong>siapa</strong> Morphe dan <strong>bagaimana</strong> ia merespons (bahasa, nada, format).
                      Berlaku untuk semua sesi baru.
                    </p>
                    <Textarea
                      value={defaultPrompt}
                      onChange={(e) => setDefaultPrompt(e.target.value)}
                      rows={4}
                      className="resize-y min-h-[80px] text-xs"
                      placeholder="Masukkan system prompt default..."
                    />
                    <Button size="sm" className="mt-2 text-xs h-8" onClick={handleSaveDefaultPrompt}>
                      Simpan Default
                    </Button>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Auto-Summarize</p>
                      <p className="text-[10px] text-muted-foreground">Ringkas judul sesi otomatis dari percakapan</p>
                    </div>
                    <Switch checked={autoSummarize} onCheckedChange={handleToggleAutoSummarize} />
                  </div>

                  <Separator />

                  {/* Perbedaan System Prompt vs Knowledge */}
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <div className="flex items-start gap-2">
                      <HelpCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <div className="text-[10px] text-muted-foreground space-y-1.5">
                        <p className="font-semibold text-foreground text-xs">Apa bedanya System Prompt & Knowledge?</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-md border border-border bg-background p-2">
                            <p className="font-medium text-foreground text-[10px] mb-0.5">🤖 System Prompt</p>
                            <p>Identitas & kepribadian AI. Menentukan <em>siapa</em> Morphe (guru, developer, dll) dan cara merespons.</p>
                          </div>
                          <div className="rounded-md border border-border bg-background p-2">
                            <p className="font-medium text-foreground text-[10px] mb-0.5">📚 Knowledge</p>
                            <p>Konteks & fakta tambahan. Berisi info tentang <em>Anda</em> (mapel, level siswa, aturan khusus) agar jawaban lebih relevan.</p>
                          </div>
                        </div>
                        <p className="text-[9px]">💡 System Prompt = "siapa AI-nya", Knowledge = "apa yang AI perlu tahu tentang Anda"</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeSection === "knowledge" && (
                <>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">Knowledge & Guidelines</h3>
                    <p className="text-[10px] text-muted-foreground mb-3">
                      Tambahkan konteks tentang <strong>diri Anda</strong> (mata pelajaran, tingkat siswa, aturan sekolah) agar Morphe memberikan jawaban yang lebih relevan dan akurat.
                      Berbeda dengan System Prompt yang mengatur kepribadian AI, Knowledge berisi <strong>fakta & aturan</strong> yang perlu diketahui AI.
                    </p>
                    <Textarea
                      value={knowledgeText}
                      onChange={(e) => setKnowledgeText(e.target.value)}
                      rows={8}
                      className="resize-y min-h-[120px] text-xs font-mono"
                      placeholder="Contoh: Saya adalah guru Matematika kelas 5 SD. Siswa saya rata-rata berusia 10-11 tahun..."
                    />
                    <Button size="sm" className="mt-2 text-xs h-8" onClick={handleSaveKnowledge}>
                      Simpan Knowledge
                    </Button>
                  </div>

                  <Separator />

                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <div className="text-[10px] text-muted-foreground space-y-1">
                        <p className="font-medium text-foreground text-xs">Tips Knowledge</p>
                        <ul className="list-disc pl-3 space-y-0.5">
                          <li>Deskripsikan konteks Anda (mata pelajaran, level siswa)</li>
                          <li>Tambahkan gaya bahasa yang diinginkan</li>
                          <li>Sertakan aturan khusus (format jawaban, bahasa, dll)</li>
                          <li>Semakin detail, semakin relevan jawaban Morphe</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeSection === "history" && (
                <>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">Riwayat Percakapan</h3>
                    <p className="text-[10px] text-muted-foreground mb-3">
                      Total {sessions.length} sesi tersimpan
                    </p>
                    <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                      {sessions.slice(0, 5).map((s: any) => (
                        <div key={s.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <MessageSquare className="w-3 h-3 shrink-0" />
                          <span className="truncate flex-1">{s.title}</span>
                          {s.is_pinned && <Badge variant="secondary" className="text-[8px] px-1 py-0">📌</Badge>}
                        </div>
                      ))}
                      {sessions.length > 5 && (
                        <p className="text-[10px] text-muted-foreground">...dan {sessions.length - 5} sesi lainnya</p>
                      )}
                    </div>
                  </div>

                  <Separator />

                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                    <h4 className="text-xs font-semibold text-destructive flex items-center gap-1.5 mb-2">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Zona Berbahaya
                    </h4>
                    <p className="text-[10px] text-muted-foreground mb-3">
                      Menghapus semua histori percakapan. Tindakan ini tidak dapat dibatalkan.
                    </p>
                    {!showConfirmDelete ? (
                      <Button variant="destructive" size="sm" className="text-xs h-8" onClick={() => setShowConfirmDelete(true)}>
                        <Trash2 className="w-3 h-3 mr-1.5" /> Hapus Semua Histori
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button variant="destructive" size="sm" className="text-xs h-8" onClick={handleDeleteAll}>
                          Ya, Hapus Semua
                        </Button>
                        <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => setShowConfirmDelete(false)}>
                          Batal
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              )}

              {activeSection === "sipena" && (
                <>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">Akses Data SIPENA</h3>
                    <p className="text-[10px] text-muted-foreground mb-3">
                      Kontrol akses Morphe AI terhadap data akademik Anda.
                    </p>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <p className="text-sm font-medium flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5 text-primary" />
                        Akses Data Penuh
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Morphe dapat membaca nilai, presensi, dan data siswa
                      </p>
                    </div>
                    <Switch
                      checked={deepDataConsent === true}
                      onCheckedChange={(val) => onDeepDataConsentChange(val)}
                    />
                  </div>

                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-xs font-medium mb-2">Data yang diakses saat mode SIPENA:</p>
                    <ul className="text-[10px] text-muted-foreground space-y-1 list-disc pl-3">
                      <li>Daftar kelas dan jumlah siswa</li>
                      <li>Mata pelajaran dan KKM</li>
                      <li>Nilai per siswa per tugas (jika akses penuh)</li>
                      <li>Rekap presensi per kelas</li>
                      <li>Struktur BAB dan tugas</li>
                    </ul>
                  </div>
                </>
              )}

              {activeSection === "advanced" && (
                <>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">Pengaturan Lanjutan</h3>
                    <p className="text-[10px] text-muted-foreground mb-3">
                      Konfigurasi teknis dan reset.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs font-medium mb-1">Estimasi Token</p>
                      <p className="text-[10px] text-muted-foreground">
                        Batas konteks: ~6,000 token per sesi. Pesan lama akan otomatis dipangkas.
                      </p>
                    </div>

                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs font-medium mb-1">Model Default</p>
                      <p className="text-[10px] text-muted-foreground">
                        Auto (Otomatis) — model dipilih secara cerdas berdasarkan jenis prompt (kode, analisis, gambar, umum).
                      </p>
                    </div>

                    <Separator />

                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 w-full"
                      onClick={() => {
                        localStorage.removeItem("morphe_default_prompt");
                        localStorage.removeItem("morphe_knowledge");
                        localStorage.removeItem("morphe_auto_summarize");
                        setDefaultPrompt("Kamu adalah Morphe, asisten AI cerdas. Gunakan Bahasa Indonesia yang jelas dan profesional.");
                        setKnowledgeText("");
                        setAutoSummarize(true);
                      }}
                    >
                      Reset Semua Pengaturan ke Default
                    </Button>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
