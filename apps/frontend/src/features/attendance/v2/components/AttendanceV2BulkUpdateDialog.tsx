import React, { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { eachDayOfInterval, parseISO, format, isValid } from "date-fns";
import type { AttendanceRecordPatch, AttendanceStatusCode } from "../../canonical/canonical.types";
import { listAllStatuses } from "../rules/statusEngine";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AttendanceV2BulkUpdateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  students: any[];
  defaultDateStr?: string;
  onSave: (patches: AttendanceRecordPatch[]) => Promise<void>;
  isLoading: boolean;
}

export const AttendanceV2BulkUpdateDialog: React.FC<AttendanceV2BulkUpdateDialogProps> = ({
  isOpen,
  onClose,
  students,
  defaultDateStr = "",
  onSave,
  isLoading,
}) => {
  const [startDateStr, setStartDateStr] = useState(defaultDateStr);
  const [endDateStr, setEndDateStr] = useState(defaultDateStr);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [statusCode, setStatusCode] = useState<AttendanceStatusCode>("H");
  const [note, setNote] = useState("");

  const statuses = listAllStatuses().filter((s) => s.code !== "-" && s.code !== "L");

  useEffect(() => {
    if (isOpen) {
      setStartDateStr(defaultDateStr);
      setEndDateStr(defaultDateStr);
      setSelectedStudentIds(students.map((s) => s.id));
      setStatusCode("H");
      setNote("");
    }
  }, [isOpen, defaultDateStr, students]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedStudentIds(students.map((s) => s.id));
    } else {
      setSelectedStudentIds([]);
    }
  };

  const handleToggleStudent = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDateStr || !endDateStr || selectedStudentIds.length === 0) return;

    try {
      const start = parseISO(startDateStr);
      const end = parseISO(endDateStr);

      if (!isValid(start) || !isValid(end) || start > end) {
        alert("Rentang tanggal tidak valid!");
        return;
      }

      const days = eachDayOfInterval({ start, end });
      const patches: AttendanceRecordPatch[] = [];

      days.forEach((day) => {
        const dateStr = format(day, "yyyy-MM-dd");
        selectedStudentIds.forEach((studentId) => {
          patches.push({
            studentId,
            classId: students[0]?.class_id || students[0]?.classId || "",
            date: dateStr,
            status: statusCode,
            note: note.trim() || null,
          });
        });
      });

      await onSave(patches);
      onClose();
    } catch (err) {
      console.error("Bulk update failed", err);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md md:max-w-lg">
        <DialogHeader>
          <DialogTitle>Pembaruan Massal Presensi</DialogTitle>
          <DialogDescription>
            Isi kehadiran untuk beberapa murid dan rentang tanggal sekaligus menggunakan aturan V2.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="startDate">Tanggal Mulai</Label>
              <Input
                id="startDate"
                type="date"
                value={startDateStr}
                onChange={(e) => setStartDateStr(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Tanggal Selesai</Label>
              <Input
                id="endDate"
                type="date"
                value={endDateStr}
                onChange={(e) => setEndDateStr(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Pilih Murid ({selectedStudentIds.length} terpilih)</Label>
              <div className="flex items-center space-x-1.5">
                <Checkbox
                  id="select-all"
                  checked={selectedStudentIds.length === students.length && students.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <Label htmlFor="select-all" className="text-xs cursor-pointer select-none">
                  Pilih Semua
                </Label>
              </div>
            </div>
            <div className="border rounded-lg p-2 bg-slate-50/50 dark:bg-slate-900/20">
              <ScrollArea className="h-32">
                <div className="space-y-2 pr-2">
                  {students.map((student) => (
                    <div key={student.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`student-${student.id}`}
                        checked={selectedStudentIds.includes(student.id)}
                        onCheckedChange={() => handleToggleStudent(student.id)}
                      />
                      <Label
                        htmlFor={`student-${student.id}`}
                        className="text-xs font-normal cursor-pointer select-none text-slate-700 dark:text-slate-300"
                      >
                        {student.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="status">Status Presensi</Label>
              <Select value={statusCode} onValueChange={(val) => setStatusCode(val as AttendanceStatusCode)}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Pilih Status" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s.code} value={s.code}>
                      {s.label} ({s.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bulk-note">Catatan Alasan</Label>
              <Input
                id="bulk-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Contoh: Lomba sekolah / Sakit demam"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 col-span-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Batal
            </Button>
            <Button type="submit" disabled={isLoading || selectedStudentIds.length === 0}>
              Terapkan Massal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
