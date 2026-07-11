import type { ComponentType } from "react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { AlertCircle, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type AttendanceStatusValue = "H" | "I" | "S" | "A" | "D";
type BulkAttendanceStatus = AttendanceStatusValue | null;

type StatusVisualConfig = {
  label: string;
  bgActive: string;
  icon: ComponentType<{ className?: string }>;
};

interface BulkAttendanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
  studentCount: number;
  selectedStatus: BulkAttendanceStatus;
  onStatusChange: (status: BulkAttendanceStatus) => void;
  statusConfig: Record<AttendanceStatusValue, StatusVisualConfig>;
  statusLabels: Record<string, string>;
  isSaving: boolean;
  showConfirm: boolean;
  existingStudents: Array<{ name: string; status: string }>;
  onCancelConfirm: () => void;
  onApply: (onlyEmpty: boolean) => void;
  onClear: () => void;
}

const statuses: AttendanceStatusValue[] = ["H", "S", "I", "A", "D"];

export function BulkAttendanceDialog({
  open,
  onOpenChange,
  selectedDate,
  studentCount,
  selectedStatus,
  onStatusChange,
  statusConfig,
  statusLabels,
  isSaving,
  showConfirm,
  existingStudents,
  onCancelConfirm,
  onApply,
  onClear,
}: BulkAttendanceDialogProps) {
  const closeDialog = () => onOpenChange(false);
  const emptyCount = Math.max(0, studentCount - existingStudents.length);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        motionProfile="adaptive"
        className="sipena-bulk-attendance-dialog flex max-h-[min(92dvh,46rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
      >
        <DialogHeader className="shrink-0 border-b border-border/80 bg-background px-4 pb-3 pt-4 pr-14 text-left sm:px-5 sm:pb-4 sm:pt-5">
          <DialogTitle className="text-base">Presensi Massal</DialogTitle>
          <DialogDescription className="text-xs leading-relaxed sm:text-sm">
            Terapkan presensi untuk semua murid pada {format(selectedDate, "d MMMM yyyy", { locale: idLocale })}.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {showConfirm && existingStudents.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2 rounded-xl border border-grade-warning/30 bg-grade-warning/10 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-grade-warning" />
                <div className="text-xs">
                  <p className="font-semibold text-grade-warning">Data presensi sudah ada</p>
                  <p className="mt-0.5 leading-relaxed text-muted-foreground">
                    {existingStudents.length} dari {studentCount} murid sudah memiliki data pada tanggal ini.
                  </p>
                </div>
              </div>

              <div className="max-h-[min(34dvh,13rem)] overflow-auto rounded-xl border border-border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10 bg-background shadow-[0_1px_0_hsl(var(--border))]">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Nama Murid</th>
                      <th className="px-3 py-2 text-center font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {existingStudents.map((student, index) => (
                      <tr key={`${student.name}-${index}`} className="border-t border-border/50">
                        <td className="px-3 py-2">{student.name}</td>
                        <td className="px-3 py-2 text-center font-medium">{student.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs leading-relaxed text-muted-foreground">
                Pilih data yang ingin diisi. Menimpa semua akan mengganti status lama menjadi <strong>{statusLabels[selectedStatus ?? "null"]}</strong>.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
              {statuses.map((status) => {
                const config = statusConfig[status];
                const Icon = config.icon;
                const selected = selectedStatus === status;
                return (
                  <button
                    key={status}
                    type="button"
                    data-selected={selected ? "true" : "false"}
                    aria-pressed={selected}
                    onClick={() => onStatusChange(status)}
                    className={cn(
                      "sipena-choice-button sipena-bulk-option-btn flex min-h-14 select-none items-center gap-3 rounded-xl border border-transparent p-3 text-left touch-manipulation",
                      selected ? cn(config.bgActive, "shadow-sm") : "bg-muted/55 text-foreground",
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span>
                      <span className="block text-sm font-bold">{status}</span>
                      <span className="block text-[11px] opacity-75">{config.label}</span>
                    </span>
                  </button>
                );
              })}

              <button
                type="button"
                data-selected={selectedStatus === null ? "true" : "false"}
                aria-pressed={selectedStatus === null}
                onClick={() => onStatusChange(null)}
                className={cn(
                  "sipena-choice-button sipena-bulk-option-btn flex min-h-14 select-none items-center gap-3 rounded-xl border border-dashed p-3 text-left touch-manipulation min-[360px]:col-span-2",
                  selectedStatus === null
                    ? "border-muted-foreground bg-muted-foreground text-background shadow-sm"
                    : "border-border bg-muted/55 text-foreground",
                )}
              >
                <X className="h-5 w-5 shrink-0" />
                <span>
                  <span className="block text-sm font-bold">Kosongkan</span>
                  <span className="block text-[11px] opacity-75">Hapus seluruh presensi pada tanggal ini</span>
                </span>
              </button>
            </div>
          )}
        </div>

        <footer className="sipena-safe-area-bottom shrink-0 border-t border-border/80 bg-background px-4 py-3 sm:px-5 sm:py-4">
          {showConfirm && existingStudents.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-3">
              <Button variant="outline" className="min-h-11 touch-manipulation" onClick={onCancelConfirm} disabled={isSaving}>
                Kembali
              </Button>
              <Button
                variant="outline"
                className="min-h-11 touch-manipulation text-amber-700 dark:text-amber-300"
                onClick={() => onApply(true)}
                disabled={isSaving || emptyCount === 0}
              >
                Isi Kosong ({emptyCount})
              </Button>
              <Button variant="destructive" className="min-h-11 touch-manipulation" onClick={() => onApply(false)} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Timpa Semua ({studentCount})
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="min-h-11 touch-manipulation" onClick={closeDialog} disabled={isSaving}>
                Batal
              </Button>
              <Button
                className="min-h-11 touch-manipulation"
                variant={selectedStatus === null ? "destructive" : "default"}
                onClick={selectedStatus === null ? onClear : () => onApply(false)}
                disabled={isSaving}
              >
                {isSaving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                {selectedStatus === null ? `Kosongkan (${studentCount})` : `Terapkan (${studentCount})`}
              </Button>
            </div>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
}
