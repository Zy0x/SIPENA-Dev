import React, { useState } from "react";
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
import { useEnhancedToast } from "@/contexts/ToastContext";
import { format } from "date-fns";
import { Shield, Sparkles, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const AttendanceV2Page: React.FC = () => {
  const { classes, isLoading: loadingClasses } = useClasses();
  const { toast: showToast } = useEnhancedToast();

  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  // Automatically select first class
  React.useEffect(() => {
    if (classes.length > 0 && !selectedClassId) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);

  const monthStr = format(selectedMonth, "yyyy-MM");

  // Fetch V2 Dataset
  const { dataset, isLoading: loadingDataset, refetch } = useAttendanceV2Dataset(selectedClassId, selectedMonth);

  // V2 Mutations
  const mutations = useAttendanceV2Mutations(selectedClassId, monthStr);

  // Dialog and cell selection states
  const [activeCell, setActiveCell] = useState<{ studentId: string; date: string; status: any; note: any } | null>(null);
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [isHolidayOpen, setIsHolidayOpen] = useState(false);
  const [isEventOpen, setIsEventOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState("");

  const handleCellClick = (studentId: string, date: string, currentStatus: any, currentNote: any) => {
    setActiveCell({ studentId, date, status: currentStatus, note: currentNote });
    setIsNoteOpen(true);
  };

  const handleSaveCell = async (note: string | null) => {
    if (!activeCell) return;
    try {
      // Cycle through status or keep same (H is default when note is added)
      const proposedStatus = activeCell.status || "H";
      await mutations.applyPatch({
        studentId: activeCell.studentId,
        classId: selectedClassId,
        date: activeCell.date,
        status: proposedStatus,
        note,
      });
      showToast({ title: "Tersimpan", description: "Presensi berhasil disimpan.", variant: "success" });
    } catch (e: any) {
      showToast({ title: "Gagal", description: e.message || "Gagal menyimpan presensi.", variant: "error" });
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

  if (loadingClasses) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
      </div>
    );
  }

  const isLocked = dataset?.locks.some((l) => l.isLocked) || false;

  return (
    <div className="space-y-6">
      {/* V2 Header Badge Indicator */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Presensi Kelas</h1>
          <p className="text-slate-500 text-sm">Kelola daftar kehadiran siswa bulanan sekolah.</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="px-3 py-1 flex items-center space-x-1 bg-purple-50/50 dark:bg-purple-950/10 text-purple-700 border-purple-100">
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            <span>Attendance V2 Engine</span>
          </Badge>
          <button
            onClick={() => refetch()}
            className="p-2 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

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
          showToast({ title: "Fitur V2", description: "Pilih sel di tabel untuk memperbarui status.", variant: "info" });
        }}
        onExport={() => {
          showToast({ title: "Fitur V2", description: "Mengekspor presensi V2 kelas...", variant: "success" });
        }}
        onImport={() => {
          showToast({ title: "Fitur V2", description: "Import dinonaktifkan sementara di V2.", variant: "info" });
        }}
      />

      {/* Lock Status Panel */}
      <AttendanceV2LockPanel isLocked={isLocked} onToggle={handleToggleLock} isLoading={mutations.isMutating} />

      {/* Main Grid Table */}
      {loadingDataset ? (
        <div className="flex items-center justify-center py-12 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span>Memuat kisi presensi V2...</span>
        </div>
      ) : (
        <AttendanceV2Table dataset={dataset} onCellClick={handleCellClick} isLocked={isLocked} />
      )}

      {/* Collapsible V2 Audit Trail Logs */}
      <div className="border rounded-xl p-4 bg-white dark:bg-slate-950 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b pb-2">
          <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-300 font-bold">
            <Shield className="w-5 h-5 text-slate-500" />
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

      {/* Modals & Dialogs */}
      {activeCell && (
        <AttendanceV2NoteDialog
          isOpen={isNoteOpen}
          onClose={() => setIsNoteOpen(false)}
          studentName="Murid Terpilih"
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
    </div>
  );
};

export default AttendanceV2Page;
