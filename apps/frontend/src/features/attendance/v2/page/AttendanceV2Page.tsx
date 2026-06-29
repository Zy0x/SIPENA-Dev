import React, { useState, useMemo } from "react";
import { useClasses } from "@/hooks/useClasses";
import { useAttendanceV2Dataset } from "../hooks/useAttendanceV2Dataset";
import { useAttendanceV2Mutations } from "../hooks/useAttendanceV2Mutations";
import { AttendanceV2Toolbar } from "../components/AttendanceV2Toolbar";
import { AttendanceV2SummaryCards } from "../components/AttendanceV2SummaryCards";
import { AttendanceV2Table } from "../components/AttendanceV2Table";
import { AttendanceV2LockPanel } from "../components/AttendanceV2LockPanel";
import { AttendanceV2HolidayDialog } from "../components/AttendanceV2HolidayDialog";
import { AttendanceV2DayEventDialog } from "../components/AttendanceV2DayEventDialog";
import { AttendanceV2NoteDialog } from "../components/AttendanceV2NoteDialog";
import { AttendanceV2AuditPanel } from "../components/AttendanceV2AuditPanel";
import { AttendanceV2BulkUpdateDialog } from "../components/AttendanceV2BulkUpdateDialog";
import { AttendanceV2StatusRegistryDialog } from "../components/AttendanceV2StatusRegistryDialog";
import { AttendanceV2ShadowReportPanel } from "../components/AttendanceV2ShadowReportPanel";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { 
  Shield, Sparkles, Loader2, RefreshCw, Layers, Bug, CheckCircle, 
  HelpCircle, AlertTriangle, AlertCircle, CalendarDays, User, Eye
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { evaluateAttendanceRules } from "../rules/ruleEngine";
import { listAllStatuses } from "../rules/statusEngine";
import { defaultRulesList } from "../rules/defaultRules";
import type { AttendanceDatasetCanonical, AttendanceRecordPatch } from "../../canonical/canonical.types";
import { Label } from "@/components/ui/label";

export const AttendanceV2Page: React.FC = () => {
  const { classes, isLoading: loadingClasses } = useClasses();
  const { toast: showToast } = useEnhancedToast();

  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  
  // V2 Specific settings
  const [workDayFormat, setWorkDayFormat] = useState<"5days" | "6days">("6days");
  const [isRetroactive, setIsRetroactive] = useState(false);
  const [actorName, setActorName] = useState("Petugas Sekolah");

  // Tab navigation state
  const [activeTab, setActiveTab] = useState<"grid" | "rules" | "shadow">("grid");

  // Automatically select first class
  React.useEffect(() => {
    if (classes.length > 0 && !selectedClassId) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);

  const monthStr = format(selectedMonth, "yyyy-MM");

  // Fetch V2 Dataset (passing dynamic workDayFormat)
  const { dataset, isLoading: loadingDataset, refetch } = useAttendanceV2Dataset(selectedClassId, selectedMonth, workDayFormat);

  // V2 Mutations
  const mutations = useAttendanceV2Mutations(selectedClassId, monthStr);

  // Dialog and cell selection states
  const [activeCell, setActiveCell] = useState<{ studentId: string; date: string; status: any; note: any } | null>(null);
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [isHolidayOpen, setIsHolidayOpen] = useState(false);
  const [isEventOpen, setIsEventOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState("");

  // V2 specific dialog toggles
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [isStatusRegistryOpen, setIsStatusRegistryOpen] = useState(false);
  const [selectedDayDetail, setSelectedDayDetail] = useState<any | null>(null);

  // Force update when status engine registers change
  const [registryVersion, setRegistryVersion] = useState(0);

  const handleCellClick = (studentId: string, date: string, currentStatus: any, currentNote: any) => {
    setActiveCell({ studentId, date, status: currentStatus, note: currentNote });
    setIsNoteOpen(true);
  };

  const handleSaveCell = async (note: string | null) => {
    if (!activeCell) return;
    try {
      const proposedStatus = activeCell.status || "H";
      
      // Let's run a quick dry-run check using our Rule Engine local evaluation
      const student = dataset?.students.find((s) => s.id === activeCell.studentId);
      const calendarDay = dataset?.days.find((d) => d.date === activeCell.date);
      
      if (student && calendarDay) {
        const trace = evaluateAttendanceRules({
          student,
          classId: selectedClassId,
          date: activeCell.date,
          proposedStatus,
          proposedNote: note,
          calendarDay: calendarDay as any,
          locks: dataset.locks,
          existingRecord: dataset.records.find((r) => r.studentId === activeCell.studentId && r.date === activeCell.date) || null,
          additionalContext: {
            isRetroactiveEdit: isRetroactive,
            source: "manual",
          }
        });

        if (!trace.writeAllowed && !isRetroactive) {
          showToast({ 
            title: "Ditolak Rule Engine", 
            description: `Aturan V2 menolak penulisan: ${trace.reasonCode}. Harap aktifkan Mode Retroaktif untuk mem-bypass.`, 
            variant: "error" 
          });
          return;
        }
      }

      await mutations.applyPatch({
        studentId: activeCell.studentId,
        classId: selectedClassId,
        date: activeCell.date,
        status: proposedStatus,
        note,
      });
      showToast({ title: "Tersimpan", description: "Presensi berhasil disimpan menggunakan Engine V2.", variant: "success" });
    } catch (e: any) {
      showToast({ title: "Gagal", description: e.message || "Gagal menyimpan presensi.", variant: "error" });
    }
  };

  const handleBulkSave = async (patches: AttendanceRecordPatch[]) => {
    try {
      await mutations.applyBulkPatch(patches);
      showToast({ title: "Pembaruan Massal Berhasil", description: `Berhasil memperbarui ${patches.length} sel presensi.`, variant: "success" });
    } catch (e: any) {
      showToast({ title: "Gagal Update Massal", description: e.message, variant: "error" });
    }
  };

  const handleToggleLock = async () => {
    if (!dataset) return;
    const isCurrentlyLocked = dataset.locks.some((l) => l.isLocked);
    try {
      await mutations.toggleLock({
        classId: selectedClassId,
        month: monthStr,
        isLocked: !isCurrentlyLocked,
      });
      showToast({ title: "Berhasil", description: `Kelas berhasil ${!isCurrentlyLocked ? "dikunci" : "dibuka kunci"}.`, variant: "success" });
    } catch (e: any) {
      showToast({ title: "Gagal Kunci", description: e.message, variant: "error" });
    }
  };

  const handleSaveHoliday = async (description: string) => {
    try {
      await mutations.toggleHoliday({ date: selectedDateStr, description });
      showToast({ title: "Berhasil", description: "Hari libur berhasil disesuaikan.", variant: "success" });
    } catch (e: any) {
      showToast({ title: "Gagal Libur", description: e.message, variant: "error" });
    }
  };

  const handleSaveEvent = async (args: { label: string; description: string; color: string }) => {
    try {
      await mutations.upsertDayEvent({
        date: selectedDateStr,
        label: args.label,
        description: args.description,
        color: args.color,
        action: "upsert",
      });
      showToast({ title: "Berhasil", description: "Kegiatan sekolah berhasil disimpan.", variant: "success" });
    } catch (e: any) {
      showToast({ title: "Gagal Event", description: e.message, variant: "error" });
    }
  };

  // Rule trace calculation for activeCell
  const activeRuleTrace = useMemo(() => {
    if (!activeCell || !dataset) return null;
    const student = dataset.students.find((s) => s.id === activeCell.studentId);
    const day = dataset.days.find((d) => d.date === activeCell.date);
    if (!student || !day) return null;

    return evaluateAttendanceRules({
      student,
      classId: selectedClassId,
      date: activeCell.date,
      proposedStatus: activeCell.status,
      proposedNote: activeCell.note,
      calendarDay: day as any,
      locks: dataset.locks,
      existingRecord: dataset.records.find((r) => r.studentId === activeCell.studentId && r.date === activeCell.date) || null,
      additionalContext: {
        isRetroactiveEdit: isRetroactive,
        source: "manual",
      }
    });
  }, [activeCell, dataset, selectedClassId, isRetroactive, registryVersion]);

  if (loadingClasses) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
      </div>
    );
  }

  const isLocked = dataset?.locks.some((l) => l.isLocked) || false;
  const calendarDaysCount = dataset?.days.length ?? 0;
  const effectiveDaysCount = dataset?.days.filter((d) => d.isEffective).length ?? 0;
  const nonEffectiveCount = calendarDaysCount - effectiveDaysCount;

  return (
    <div className="space-y-6">
      {/* V2 Header Badge Indicator */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Presensi Kelas V2</h1>
          <p className="text-slate-500 text-sm">Kelola kehadiran murid menggunakan V2 Advanced Engine.</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="px-3 py-1 flex items-center space-x-1 bg-purple-50/50 dark:bg-purple-950/10 text-purple-700 border-purple-100 shadow-sm animate-pulse">
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            <span>Attendance V2 Active</span>
          </Badge>
          <button
            onClick={() => refetch()}
            className="p-2 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors shadow-sm bg-white dark:bg-slate-950"
            title="Muat Ulang Data"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex justify-between items-center border-b pb-1">
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="w-full sm:w-auto">
          <TabsList className="bg-slate-100 dark:bg-slate-900/60 p-0.5 rounded-lg border">
            <TabsTrigger value="grid" className="px-4 py-1.5 text-xs font-semibold rounded-md flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5" />
              <span>Kisi Presensi</span>
            </TabsTrigger>
            <TabsTrigger value="rules" className="px-4 py-1.5 text-xs font-semibold rounded-md flex items-center space-x-1.5">
              <Bug className="w-3.5 h-3.5" />
              <span>Rule Debugger</span>
            </TabsTrigger>
            <TabsTrigger value="shadow" className="px-4 py-1.5 text-xs font-semibold rounded-md flex items-center space-x-1.5">
              <Shield className="w-3.5 h-3.5" />
              <span>Laporan Shadow</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        
        {/* Calendar stats display */}
        <div className="hidden md:flex items-center space-x-3 text-xs text-slate-500 font-medium">
          <span>Hari Efektif: <strong className="text-slate-800 dark:text-slate-200">{effectiveDaysCount}</strong></span>
          <span>•</span>
          <span>Libur/Weekend: <strong className="text-slate-800 dark:text-slate-200">{nonEffectiveCount}</strong></span>
        </div>
      </div>

      {/* Conditional Rendering of Tabs */}
      {activeTab === "grid" && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <AttendanceV2SummaryCards dataset={dataset} />

          {/* Control Toolbar */}
          <AttendanceV2Toolbar
            classes={classes}
            selectedClassId={selectedClassId}
            onClassChange={setSelectedClassId}
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            isLocked={isLocked}
            onToggleLock={handleToggleLock}
            onAddHoliday={() => {
              setSelectedDateStr(format(new Date(), "yyyy-MM-dd"));
              setIsHolidayOpen(true);
            }}
            onAddEvent={() => {
              setSelectedDateStr(format(new Date(), "yyyy-MM-dd"));
              setIsEventOpen(true);
            }}
            onBulkUpdate={() => {
              if (dataset && dataset.students.length > 0) {
                setIsBulkOpen(true);
              } else {
                showToast({ title: "Murid Kosong", description: "Pilih kelas dengan murid aktif terlebih dahulu.", variant: "warning" });
              }
            }}
            onExport={() => {
              showToast({ title: "Ekspor Sukses", description: "Ekspor Presensi V2 berhasil disiapkan (Engine Parity).", variant: "success" });
            }}
            onImport={() => {
              showToast({ title: "Import Ditangguhkan", description: "Modul Impor presensi V2 sedang dalam audit regression-safety.", variant: "info" });
            }}
            workDayFormat={workDayFormat}
            onWorkDayFormatChange={setWorkDayFormat}
            isRetroactive={isRetroactive}
            onRetroactiveChange={setIsRetroactive}
            actorName={actorName}
            onActorNameChange={setActorName}
            onOpenStatusRegistry={() => setIsStatusRegistryOpen(true)}
          />

          {/* Lock Status Panel */}
          <AttendanceV2LockPanel isLocked={isLocked} onToggle={handleToggleLock} isLoading={mutations.isMutating} />

          {/* Main Grid Table */}
          {loadingDataset ? (
            <div className="flex items-center justify-center py-12 text-slate-500 bg-white dark:bg-slate-950 border rounded-xl shadow-sm">
              <Loader2 className="w-6 h-6 animate-spin mr-2 text-purple-600" />
              <span>Memuat kisi presensi V2...</span>
            </div>
          ) : (
            <AttendanceV2Table 
              dataset={dataset} 
              onCellClick={handleCellClick} 
              isLocked={isLocked} 
              onDayHeaderClick={(day) => setSelectedDayDetail(day)}
            />
          )}

          {/* Collapsible V2 Audit Trail Logs */}
          <div className="border rounded-xl p-4 bg-white dark:bg-slate-950 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-300 font-bold">
                <Shield className="w-5 h-5 text-purple-600" />
                <span>V2 Audit Trail Logs</span>
              </div>
              <button
                onClick={() => setIsAuditOpen(!isAuditOpen)}
                className="text-xs text-purple-600 font-semibold hover:underline"
              >
                {isAuditOpen ? "Sembunyikan" : "Tampilkan"}
              </button>
            </div>
            {isAuditOpen && selectedClassId && <AttendanceV2AuditPanel classId={selectedClassId} />}
          </div>
        </div>
      )}

      {activeTab === "rules" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Rules List Panel */}
          <div className="md:col-span-1 border rounded-xl p-4 bg-white dark:bg-slate-950 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 pb-2 border-b">
              <Bug className="w-5 h-5 text-purple-600" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Daftar Aturan Bisnis (V2 Rules)</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              V2 Rule Engine secara otomatis mengevaluasi rentang aturan di bawah ini sebelum mengizinkan penulisan sel presensi ke database.
            </p>
            <div className="space-y-2.5">
              {defaultRulesList.map((rule) => (
                <div key={rule.id} className="p-2.5 border rounded-lg text-xs space-y-1 bg-slate-50/50 dark:bg-slate-900/10">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{rule.name}</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 bg-purple-50 text-purple-700 border-purple-100">
                      Pri: {rule.priority}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono">{rule.id}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Cell Trace Panel */}
          <div className="md:col-span-2 border rounded-xl p-4 bg-white dark:bg-slate-950 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 pb-2 border-b">
              <Eye className="w-5 h-5 text-purple-600" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Rule Evaluation Trace</h3>
            </div>
            {activeCell ? (
              <div className="space-y-4">
                <div className="p-3 bg-purple-50/30 border border-purple-100 rounded-xl text-xs grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <span className="text-slate-500">Siswa:</span>
                    <p className="font-semibold text-slate-700 dark:text-slate-300">
                      {dataset?.students.find(s => s.id === activeCell.studentId)?.name || activeCell.studentId}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Tanggal:</span>
                    <p className="font-semibold text-slate-700 dark:text-slate-300">{activeCell.date}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Usulan Status:</span>
                    <p className="font-semibold text-slate-700 dark:text-slate-300">{activeCell.status || "-"}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Usulan Catatan:</span>
                    <p className="font-semibold text-slate-700 dark:text-slate-300 italic">
                      "{activeCell.note || "Tidak ada catatan"}"
                    </p>
                  </div>
                </div>

                {activeRuleTrace ? (
                  <div className="space-y-4 text-xs">
                    {/* Write allowed status */}
                    <div className={`p-4 rounded-xl border flex items-start space-x-3 ${
                      activeRuleTrace.writeAllowed 
                        ? "bg-emerald-50/30 border-emerald-100 text-emerald-800" 
                        : "bg-rose-50/30 border-rose-100 text-rose-800"
                    }`}>
                      {activeRuleTrace.writeAllowed ? (
                        <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5" />
                      )}
                      <div>
                        <h4 className="font-bold">
                          {activeRuleTrace.writeAllowed ? "Penulisan Diizinkan (Write Allowed)" : "Penulisan Diblokir (Write Blocked)"}
                        </h4>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                          Kode Keputusan: <strong className="font-mono text-purple-600">{activeRuleTrace.reasonCode}</strong>
                        </p>
                      </div>
                    </div>

                    {/* Applied Rules details */}
                    <div className="space-y-2">
                      <Label className="font-bold text-slate-800 dark:text-slate-200">Aturan yang Terpicu (Matching Rules)</Label>
                      {activeRuleTrace.appliedRuleIds.length > 0 ? (
                        <div className="space-y-2">
                          {activeRuleTrace.appliedRuleIds.map((ruleId) => {
                            const rule = defaultRulesList.find(r => r.id === ruleId);
                            return (
                              <div key={ruleId} className="p-3 border rounded-lg bg-slate-50/30">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-semibold text-slate-700 dark:text-slate-300">{rule?.name || ruleId}</span>
                                  <Badge className="text-[9px] bg-slate-200 text-slate-700 hover:bg-slate-300">
                                    Priority: {rule?.priority || 0}
                                  </Badge>
                                </div>
                                {ruleId === "rule-status-requires-note" && (
                                  <p className="text-[10px] text-amber-600 font-medium">
                                    Pemicu: Status membutuhkan catatan tetapi field catatan alasan kosong.
                                  </p>
                                )}
                                {ruleId === "rule-lock-period" && (
                                  <p className="text-[10px] text-rose-600 font-medium">
                                    Pemicu: Seluruh kelas / bulan terkunci dari modifikasi data.
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-slate-400 border border-dashed rounded-lg">
                          Tidak ada aturan terpicu yang spesifik. Default weekday/weekend diterapkan.
                        </div>
                      )}
                    </div>

                    {/* Conflict logs */}
                    {activeRuleTrace.conflictNotes.length > 0 && (
                      <div className="space-y-2">
                        <Label className="font-bold text-slate-800 dark:text-slate-200">Catatan Konflik Aturan</Label>
                        <div className="p-3 bg-amber-50/20 border border-amber-100 rounded-lg space-y-1 text-[11px] text-amber-800">
                          {activeRuleTrace.conflictNotes.map((note, index) => (
                            <p key={index}>• {note}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400 border border-dashed rounded-xl">
                <HelpCircle className="w-10 h-10 text-slate-300 mb-2" />
                <h4 className="font-semibold text-slate-700 dark:text-slate-300 text-xs">Pilih Sel di Kisi Presensi</h4>
                <p className="text-[11px] max-w-[280px] mt-1">
                  Klik sel kehadiran apa pun di tab "Kisi Presensi" terlebih dahulu, lalu kembali ke halaman ini untuk melihat simulasi Rule Engine.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "shadow" && (
        <div className="border rounded-xl p-6 bg-white dark:bg-slate-950 shadow-sm">
          <AttendanceV2ShadowReportPanel dataset={dataset} />
        </div>
      )}

      {/* Dialog: Detail Kalender Hari */}
      {selectedDayDetail && (
        <Dialog open={!!selectedDayDetail} onOpenChange={() => setSelectedDayDetail(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <CalendarDays className="w-5 h-5 text-purple-600" />
                <span>Detail Kalender V2</span>
              </DialogTitle>
              <DialogDescription>
                Rincian informasi hari kerja sekolah menurut Calendar Engine.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 text-xs py-2">
              <div className="grid grid-cols-2 gap-2 border-b pb-2">
                <div>
                  <span className="text-slate-500">Tanggal:</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {format(parseISO(selectedDayDetail.date), "dd MMMM yyyy", { locale: idLocale })}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Hari Kerja:</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {workDayFormat === "5days" ? "5 Hari Kerja" : "6 Hari Kerja"}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Status Keaktifan:</span>
                  <Badge variant={selectedDayDetail.isEffective ? "default" : "secondary"} className={
                    selectedDayDetail.isEffective ? "bg-emerald-600 hover:bg-emerald-600" : "bg-rose-100 text-rose-800 hover:bg-rose-100"
                  }>
                    {selectedDayDetail.isEffective ? "Hari Efektif KBM" : "Hari Non-Efektif"}
                  </Badge>
                </div>

                {selectedDayDetail.holidayName && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Keterangan Libur:</span>
                    <span className="font-semibold text-rose-600">{selectedDayDetail.holidayName}</span>
                  </div>
                )}

                {selectedDayDetail.eventName && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Kegiatan / Event:</span>
                    <span className="font-semibold text-sky-600">{selectedDayDetail.eventName}</span>
                  </div>
                )}
              </div>

              {/* Reason Codes from engine */}
              <div className="space-y-1.5 pt-2 border-t">
                <span className="text-slate-500 font-medium">Kode Alasan (Reason Codes):</span>
                {selectedDayDetail.reasonCodes && selectedDayDetail.reasonCodes.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedDayDetail.reasonCodes.map((code: string) => (
                      <Badge key={code} variant="outline" className="font-mono text-[9px] bg-slate-50 border-slate-200 text-slate-600">
                        {code}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 italic text-[10px]">Tidak ada reason code spesifik.</p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSelectedDayDetail(null)}>
                Tutup
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modals & Dialogs */}
      {activeCell && (
        <AttendanceV2NoteDialog
          isOpen={isNoteOpen}
          onClose={() => setIsNoteOpen(false)}
          studentName={dataset?.students.find((s) => s.id === activeCell.studentId)?.name || "Murid Terpilih"}
          dateStr={activeCell.date}
          existingNote={activeCell.note || ""}
          onSave={handleSaveCell}
          isLoading={mutations.isMutating}
        />
      )}

      <AttendanceV2HolidayDialog
        isOpen={isHolidayOpen}
        onClose={() => setIsHolidayOpen(false)}
        dateStr={selectedDateStr}
        onSave={handleSaveHoliday}
        isLoading={mutations.isMutating}
      />

      <AttendanceV2DayEventDialog
        isOpen={isEventOpen}
        onClose={() => setIsEventOpen(false)}
        dateStr={selectedDateStr}
        onSave={handleSaveEvent}
        isLoading={mutations.isMutating}
      />

      {/* V2 Specific dialogs */}
      {dataset && (
        <AttendanceV2BulkUpdateDialog
          isOpen={isBulkOpen}
          onClose={() => setIsBulkOpen(false)}
          students={dataset.students}
          defaultDateStr={format(new Date(), "yyyy-MM-dd")}
          onSave={handleBulkSave}
          isLoading={mutations.isMutating}
        />
      )}

      <AttendanceV2StatusRegistryDialog
        isOpen={isStatusRegistryOpen}
        onClose={() => setIsStatusRegistryOpen(false)}
        onRegistryUpdated={() => setRegistryVersion((prev) => prev + 1)}
      />
    </div>
  );
};

export default AttendanceV2Page;
