import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowRight,
  Bot,
  Download,
  FileSpreadsheet,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { cn } from "@/lib/utils";

import { ExportOptionCard } from "./import-export/ExportOptionCard";
import { ImportDropzone } from "./import-export/ImportDropzone";
import { ImportModeCard } from "./import-export/ImportModeCard";
import { ImportStepper } from "./import-export/ImportStepper";
import { ImportSummaryPanel } from "./import-export/ImportSummaryPanel";
import { RiskAlert } from "./import-export/RiskAlert";
import { StatusBadge } from "./import-export/StatusBadge";
import { WorkbookPreviewPanel } from "./import-export/WorkbookPreviewPanel";

export type GradeImportExportTab = "import" | "export";

interface GradeImportExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeTab: GradeImportExportTab;
  onTabChange: (tab: GradeImportExportTab) => void;
  classNameLabel: string;
  subjectName: string;
  semesterName?: string | null;
  studentCount: number;
  chapterCount: number;
  assignmentCount: number;
  canDownloadOfficialTemplate?: boolean;
  isDownloadingTemplate?: boolean;
  onDownloadOfficialTemplate?: () => void | Promise<void>;
  onOpenLegacyImport?: () => void;
}

type ImportMode = "official" | "smart";
type ExportMode = "official" | "current" | "backup";

const importSteps = ["Upload", "Analisis", "Pemetaan", "Konflik", "Preview", "Import"];

export default function GradeImportExportDialog({
  open,
  onOpenChange,
  activeTab,
  onTabChange,
  classNameLabel,
  subjectName,
  semesterName,
  studentCount,
  chapterCount,
  assignmentCount,
  canDownloadOfficialTemplate = true,
  isDownloadingTemplate = false,
  onDownloadOfficialTemplate,
  onOpenLegacyImport,
}: GradeImportExportDialogProps) {
  const { info } = useEnhancedToast();
  const [tab, setTab] = useState<GradeImportExportTab>(activeTab);
  const [importMode, setImportMode] = useState<ImportMode>("official");
  const [exportMode, setExportMode] = useState<ExportMode>("official");
  const [fileName, setFileName] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (open) setTab(activeTab);
  }, [activeTab, open]);

  const contextLabel = useMemo(() => (
    [classNameLabel, subjectName, semesterName || "Semester aktif"].filter(Boolean).join(" / ")
  ), [classNameLabel, semesterName, subjectName]);

  const handleTabChange = useCallback((value: string) => {
    const nextTab = value === "export" ? "export" : "import";
    setTab(nextTab);
    onTabChange(nextTab);
  }, [onTabChange]);

  const showPlaceholder = useCallback((title: string, description: string) => {
    info(title, description);
  }, [info]);

  const handleFileSelected = useCallback((file: File) => {
    setFileName(file.name);
    setStepIndex(1);
    info("Preview import disiapkan", "Tahap ini hanya menyiapkan UI. Parser dan penyimpanan akan masuk tahap berikutnya.");
  }, [info]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handlePrimaryAction = useCallback(async () => {
    if (tab === "import") {
      showPlaceholder("ImportPlan belum dijalankan", "Tahap berikutnya akan menambahkan parser, preview konflik, dan konfirmasi final.");
      return;
    }

    if (exportMode === "official" && onDownloadOfficialTemplate) {
      await onDownloadOfficialTemplate();
      return;
    }

    showPlaceholder(
      exportMode === "current" ? "Export nilai saat ini belum dijalankan" : "Backup lengkap belum dijalankan",
      "Tahap berikutnya akan menambahkan export nilai terisi dan backup lengkap tanpa mengganggu input nilai manual.",
    );
  }, [exportMode, onDownloadOfficialTemplate, showPlaceholder, tab]);

  const modeLabel = exportMode === "official"
    ? "Template Resmi SIPENA"
    : exportMode === "current"
      ? "Export Nilai Saat Ini"
      : "Backup Lengkap";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[calc(100dvh-1rem)] max-h-[860px] w-[calc(100vw-1rem)] max-w-[1120px] grid-rows-none flex-col gap-0 overflow-hidden rounded-[24px] border-white/80 bg-white p-0 shadow-2xl dark:border-slate-800 dark:bg-slate-950 sm:h-[min(92dvh,860px)] sm:w-[calc(100vw-2rem)]">
        <header className="sticky top-0 z-20 shrink-0 border-b border-border bg-white/95 px-4 py-4 backdrop-blur dark:bg-slate-950/95 sm:px-6">
          <div className="flex min-w-0 items-start gap-3 pr-8">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 dark:bg-emerald-950/30 dark:ring-emerald-900/70">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-lg font-semibold tracking-normal text-slate-950 dark:text-slate-50">
                  Export/Import Nilai SIPENA
                </DialogTitle>
                <StatusBadge tone="safe">Mode aman aktif</StatusBadge>
              </div>
              <DialogDescription className="mt-1 truncate text-sm text-muted-foreground">
                {contextLabel || "Pilih kelas, mapel, dan semester terlebih dahulu"}
              </DialogDescription>
            </div>
          </div>
        </header>

        <Tabs value={tab} onValueChange={handleTabChange} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b border-border bg-white px-4 py-3 dark:bg-slate-950 sm:px-6">
            <TabsList className="grid h-11 w-full max-w-md grid-cols-2 rounded-full bg-slate-100 p-1 dark:bg-slate-900">
              <TabsTrigger value="import" className="h-9 rounded-full text-xs sm:text-sm">
                Import Nilai
              </TabsTrigger>
              <TabsTrigger value="export" className="h-9 rounded-full text-xs sm:text-sm">
                Export Nilai
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-slate-50/70 px-4 py-4 dark:bg-slate-950 sm:px-6">
            <TabsContent value="import" className="m-0 min-w-0">
              <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                <main className="min-w-0 space-y-4">
                  <section className="min-w-0 rounded-[24px] border border-border bg-white p-4 shadow-sm dark:bg-slate-950">
                    <ImportStepper steps={importSteps} currentIndex={stepIndex} />
                  </section>

                  <div className="grid min-w-0 gap-3 md:grid-cols-2">
                    <ImportModeCard
                      title="Template Resmi SIPENA"
                      description="Gunakan template dari struktur web aktif untuk import paling terarah."
                      details={["Siswa dan NISN mengikuti data web", "Cocok untuk BAB, tugas, STS, dan SAS", "Sel kosong tidak menghapus nilai lama"]}
                      selected={importMode === "official"}
                      tone="official"
                      icon={<FileSpreadsheet className="h-5 w-5" />}
                      onClick={() => setImportMode("official")}
                    />
                    <ImportModeCard
                      title="Smart Import"
                      description="Untuk Excel bebas yang perlu dianalisis dan dipetakan dulu."
                      details={["Mapping ambigu wajib dikonfirmasi", "AI hanya sebagai saran", "Tidak membuat BAB/tugas tanpa persetujuan"]}
                      selected={importMode === "smart"}
                      tone="smart"
                      icon={<Bot className="h-5 w-5" />}
                      onClick={() => setImportMode("smart")}
                    />
                  </div>

                  <ImportDropzone fileName={fileName} onFileSelected={handleFileSelected} />

                  <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                    <RiskAlert title="Data tidak akan ditimpa tanpa konfirmasi" tone="safe">
                      Default import adalah isi nilai kosong saja. Nilai lama akan muncul sebagai konflik sebelum tahap simpan.
                    </RiskAlert>
                    <RiskAlert title="BAB dan tugas baru butuh persetujuan" tone="warning">
                      Header baru hanya menjadi kandidat. Sistem tidak membuat struktur baru secara otomatis.
                    </RiskAlert>
                  </div>
                </main>

                <ImportSummaryPanel
                  studentCount={studentCount}
                  chapterCount={chapterCount}
                  assignmentCount={assignmentCount}
                  fileName={fileName}
                />
              </div>
            </TabsContent>

            <TabsContent value="export" className="m-0 min-w-0">
              <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <main className="min-w-0 space-y-3">
                  <ExportOptionCard
                    title="Template Resmi SIPENA"
                    description="Workbook kosong berbasis struktur kelas, mapel, semester, siswa, BAB, dan tugas aktif."
                    meta="Paling aman untuk input nilai baru"
                    selected={exportMode === "official"}
                    tone="official"
                    icon={<FileSpreadsheet className="h-5 w-5" />}
                    onClick={() => setExportMode("official")}
                  />
                  <ExportOptionCard
                    title="Export Nilai Saat Ini"
                    description="Membawa nilai yang sedang tersimpan agar guru dapat mengecek atau melengkapi data."
                    meta="Termasuk STS dan SAS"
                    selected={exportMode === "current"}
                    tone="current"
                    icon={<Download className="h-5 w-5" />}
                    onClick={() => setExportMode("current")}
                  />
                  <ExportOptionCard
                    title="Backup Lengkap"
                    description="Paket workbook untuk arsip kelas dan mapel aktif sebelum perubahan besar."
                    meta="Disarankan sebelum import massal"
                    selected={exportMode === "backup"}
                    tone="backup"
                    icon={<Archive className="h-5 w-5" />}
                    onClick={() => setExportMode("backup")}
                  />

                  <RiskAlert title="Export tahap ini masih placeholder" tone="info">
                    Template Resmi SIPENA sudah dapat diunduh. Export nilai saat ini dan backup lengkap akan masuk tahap berikutnya.
                  </RiskAlert>
                </main>

                <WorkbookPreviewPanel
                  classNameLabel={classNameLabel}
                  subjectName={subjectName}
                  semesterName={semesterName}
                  studentCount={studentCount}
                  chapterCount={chapterCount}
                  assignmentCount={assignmentCount}
                  modeLabel={modeLabel}
                />
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <footer className="sticky bottom-0 z-20 shrink-0 border-t border-border bg-white/95 px-4 py-3 backdrop-blur dark:bg-slate-950/95 sm:px-6">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="hidden min-w-0 items-center gap-2 text-xs text-muted-foreground sm:flex">
              <ShieldCheck className="h-4 w-4 shrink-0 text-blue-600" />
              <span className="truncate">Data tidak akan ditimpa tanpa konfirmasi.</span>
            </div>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
              {tab === "import" && onOpenLegacyImport ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full rounded-full sm:h-10 sm:w-auto"
                  onClick={onOpenLegacyImport}
                >
                  Import lama
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-full sm:h-10 sm:w-auto"
                onClick={handleClose}
              >
                Tutup
              </Button>
              <Button
                type="button"
                disabled={tab === "export" && exportMode === "official" && (!canDownloadOfficialTemplate || isDownloadingTemplate)}
                className={cn(
                  "h-11 w-full gap-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 sm:h-10 sm:w-auto",
                  tab === "import" && importMode === "smart" && "bg-violet-600 hover:bg-violet-700",
                )}
                onClick={handlePrimaryAction}
              >
                {tab === "import" ? (
                  <>
                    <UploadCloud className="h-4 w-4" />
                    Lanjut Preview
                  </>
                ) : exportMode === "official" ? (
                  <>
                    <Download className="h-4 w-4" />
                    {isDownloadingTemplate ? "Menyiapkan..." : "Download Template Resmi"}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Siapkan Export
                  </>
                )}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
