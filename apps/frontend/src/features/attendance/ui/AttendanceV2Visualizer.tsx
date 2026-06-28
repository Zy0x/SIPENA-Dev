import React, { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from "date-fns";
import { useClasses } from "@/hooks/useClasses";
import { useStudents } from "@/hooks/useStudents";
import { useAttendance } from "@/hooks/useAttendance";
import { AttendanceV2Service } from "../v2/attendanceV2.service";
import { mapV1RecordToCanonical, mapV1HolidayToCanonical, mapV1DayEventToCanonical, mapV1LockToCanonical } from "../canonical/canonical.mappers";
import { getStatusDefinition } from "../v2/rules/statusEngine";
import { useAttendanceRuntime } from "../runtime/useAttendanceRuntime";

const v2Service = new AttendanceV2Service({ enableWrite: false, runtimeMode: "shadow" });

export const AttendanceV2Visualizer: React.FC = () => {
  const runtime = useAttendanceRuntime();
  const { classes } = useClasses();
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedCell, setSelectedCell] = useState<{ studentId: string; date: string } | null>(null);

  const activeClass = useMemo(() => classes.find(c => c.id === selectedClassId), [classes, selectedClassId]);

  // Load V1 data directly from useAttendance hook returns
  const {
    attendanceRecords: v1Records,
    holidays: v1Holidays,
    dayEvents: v1Events,
    isLocked: v1LockState,
  } = useAttendance(selectedClassId, currentMonth, "6days");

  const studentsResult = useStudents(selectedClassId);
  const students = studentsResult.students || [];

  // Build V2 Dataset via V2 Service
  const v2Dataset = useMemo(() => {
    if (!selectedClassId) return null;

    const canonicalStudents = students.map(s => ({ id: s.id, name: s.name, nisn: s.nisn }));
    const canonicalRecords = v1Records.map(mapV1RecordToCanonical);
    const canonicalHolidays = v1Holidays.map(mapV1HolidayToCanonical);
    const canonicalEvents = v1Events.map(mapV1DayEventToCanonical);
    const canonicalLocks = [{
      classId: selectedClassId,
      month: format(currentMonth, "yyyy-MM"),
      isLocked: v1LockState,
      lockedAt: null,
      lockedBy: null,
    }];

    return v2Service.buildDataset({
      classId: selectedClassId,
      month: format(currentMonth, "yyyy-MM"),
      students: canonicalStudents,
      records: canonicalRecords,
      holidays: canonicalHolidays,
      dayEvents: canonicalEvents,
      locks: canonicalLocks,
      workDayFormat: "6days",
    });
  }, [selectedClassId, currentMonth, students, v1Records, v1Holidays, v1Events, v1LockState]);

  // Dynamic summary from V2 Engine
  const summaryBundle = useMemo(() => {
    if (!v2Dataset) return null;
    return v2Service.computeSummary(v2Dataset);
  }, [v2Dataset]);

  const daysInMonth = useMemo(() => {
    return eachDayOfInterval({
      start: startOfMonth(currentMonth),
      end: endOfMonth(currentMonth),
    });
  }, [currentMonth]);

  // Rule explanation for the selected cell
  const cellExplanation = useMemo(() => {
    if (!selectedCell || !v2Dataset) return null;
    const student = v2Dataset.students.find(s => s.id === selectedCell.studentId);
    const record = v2Dataset.records.find(r => r.studentId === selectedCell.studentId && r.date === selectedCell.date);
    const resolvedDay = v2Dataset.days.find(d => d.date === selectedCell.date);

    if (!student || !resolvedDay) return null;

    const evaluation = v2Service.validateMutation(v2Dataset, {
      studentId: student.id,
      classId: v2Dataset.classId,
      date: selectedCell.date,
      status: record?.status ?? null,
    });

    return {
      studentName: student.name,
      date: selectedCell.date,
      dayName: resolvedDay.isEffective ? "Hari Sekolah (Efektif)" : "Libur / Akhir Pekan",
      isEffective: resolvedDay.isEffective,
      holidayName: resolvedDay.holidayName,
      eventName: resolvedDay.eventName,
      currentStatus: record?.status ?? "-",
      isWritable: resolvedDay.isEffective && !resolvedDay.lock?.isLocked,
      lockStatus: resolvedDay.lock?.isLocked ? "Terkunci" : "Terbuka",
      validationReason: evaluation.reasonCode,
      validationIssues: evaluation.issues,
    };
  }, [selectedCell, v2Dataset]);

  const toggleEngine = () => {
    const current = window.localStorage.getItem("attendance_engine_override");
    const next = current === "v2" ? "v1" : "v2";
    window.localStorage.setItem("attendance_engine_override", next);
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-800 dark:bg-slate-900 dark:text-slate-100 md:p-6">
      {/* Header Panel */}
      <header className="mb-6 rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-2xl font-bold text-transparent dark:from-blue-400 dark:to-indigo-400">
              SIPENA Presensi V2 Engine Visualizer
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Melihat & memverifikasi hasil kalkulasi mesin presensi baru secara real-time.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={toggleEngine}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-4 text-xs font-semibold text-blue-600 transition-all hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-400"
            >
              Mode: <span className="font-extrabold uppercase">{runtime.engine}</span> (Ubah)
            </button>
            <select
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value);
                setSelectedCell(null);
              }}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs shadow-sm dark:border-slate-800 dark:bg-slate-950"
            >
              <option value="">Pilih Kelas...</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  Kelas {c.name}
                </option>
              ))}
            </select>
            <input
              type="month"
              value={format(currentMonth, "yyyy-MM")}
              onChange={(e) => {
                if (e.target.value) {
                  setCurrentMonth(parseISO(e.target.value + "-01"));
                  setSelectedCell(null);
                }
              }}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs shadow-sm dark:border-slate-800 dark:bg-slate-950"
            />
          </div>
        </div>
      </header>

      {/* Main Sandbox Grid */}
      {!selectedClassId ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
            📭
          </div>
          <h3 className="mt-4 font-semibold">Silakan Pilih Kelas</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
            Pilih kelas dan bulan di bilah atas untuk memuat visualisasi model kanonik presensi V2.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* V2 Attendance Matrix */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 overflow-x-auto">
            <h3 className="mb-4 text-sm font-bold">Matriks Kehadiran Kanonik (V2 Engine)</h3>
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-900/50">
                  <th className="p-2 font-semibold">Nama Murid</th>
                  {daysInMonth.map((day) => {
                    const dateStr = format(day, "yyyy-MM-dd");
                    const calendarDay = v2Dataset?.days.find(d => d.date === dateStr);
                    const isEffective = calendarDay?.isEffective ?? true;
                    const hasEvent = !!calendarDay?.eventName;
                    const hasHoliday = !!calendarDay?.holidayName;

                    let bg = "bg-white dark:bg-slate-950";
                    if (!isEffective) bg = "bg-slate-100 dark:bg-slate-900/50 text-slate-400";
                    if (hasHoliday) bg = "bg-red-50 dark:bg-red-950/20 text-red-500";
                    if (hasEvent) bg = "bg-blue-50 dark:bg-blue-950/20 text-blue-500";

                    return (
                      <th
                        key={dateStr}
                        className={`p-1.5 text-center font-bold min-w-[28px] border border-slate-100 dark:border-slate-900 ${bg}`}
                        title={calendarDay?.holidayName || calendarDay?.eventName || format(day, "EEEE")}
                      >
                        {format(day, "d")}
                      </th>
                    );
                  })}
                  <th className="p-2 text-center font-semibold">Recap (H/S/I/A)</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const studentSummary = summaryBundle?.monthly.find(m => m.studentId === student.id);
                  return (
                    <tr key={student.id} className="border-b border-slate-100 dark:border-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                      <td className="p-2 font-medium max-w-[150px] truncate" title={student.name}>
                        {student.name}
                      </td>
                      {daysInMonth.map((day) => {
                        const dateStr = format(day, "yyyy-MM-dd");
                        const record = v2Dataset?.records.find(r => r.studentId === student.id && r.date === dateStr);
                        const calendarDay = v2Dataset?.days.find(d => d.date === dateStr);
                        const isEffective = calendarDay?.isEffective ?? true;
                        
                        let cellText = "-";
                        let cellClass = "text-slate-400";

                        if (record?.status) {
                          cellText = record.status;
                          const def = getStatusDefinition(record.status);
                          cellClass = def ? `font-extrabold text-${def.colorToken}-600 dark:text-${def.colorToken}-400` : "font-extrabold";
                        } else if (!isEffective) {
                          cellText = "L";
                          cellClass = "text-slate-400/60 dark:text-slate-700";
                        }

                        const isSelected = selectedCell?.studentId === student.id && selectedCell?.date === dateStr;

                        return (
                          <td
                            key={dateStr}
                            onClick={() => setSelectedCell({ studentId: student.id, date: dateStr })}
                            className={`p-1.5 text-center cursor-pointer border border-slate-100 dark:border-slate-900 ${cellClass} ${isSelected ? "ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-900/20" : ""}`}
                          >
                            {cellText}
                          </td>
                        );
                      })}
                      <td className="p-2 text-center font-semibold bg-slate-50/20 dark:bg-slate-900/10">
                        {studentSummary ? (
                          <span className="inline-flex gap-1 text-[10px]">
                            <span className="text-green-600 dark:text-green-400">{studentSummary.presentCount}H</span>
                            <span className="text-yellow-600 dark:text-yellow-400">{studentSummary.sickCount}S</span>
                            <span className="text-blue-600 dark:text-blue-400">{studentSummary.permissionCount}I</span>
                            <span className="text-red-600 dark:text-red-400">{studentSummary.absentCount}A</span>
                          </span>
                        ) : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Explainability & Rule Panel */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <h3 className="mb-4 text-sm font-bold">Analisis Kehadiran & Kalender (V2)</h3>

            {!cellExplanation ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                <span className="text-2xl">🖱️</span>
                <p className="mt-2 text-xs">Klik salah satu sel kehadiran pada tabel untuk melihat analisis validasi dan audit mesin V2.</p>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
                  <div className="font-semibold text-slate-500 dark:text-slate-400">Nama Murid</div>
                  <div className="text-sm font-bold mt-0.5">{cellExplanation.studentName}</div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
                    <div className="font-semibold text-slate-500 dark:text-slate-400">Tanggal</div>
                    <div className="font-bold mt-0.5">{cellExplanation.date}</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
                    <div className="font-semibold text-slate-500 dark:text-slate-400">Status Sel</div>
                    <div className="font-bold mt-0.5 uppercase">{cellExplanation.currentStatus}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-slate-400 border-b border-slate-100 dark:border-slate-950 pb-1">Konteks Kalender</h4>
                  <ul className="space-y-1.5">
                    <li className="flex justify-between">
                      <span className="text-slate-500">Tipe Hari:</span>
                      <span className="font-semibold">{cellExplanation.dayName}</span>
                    </li>
                    {cellExplanation.holidayName && (
                      <li className="flex justify-between text-red-500">
                        <span>Hari Libur:</span>
                        <span className="font-semibold">{cellExplanation.holidayName}</span>
                      </li>
                    )}
                    {cellExplanation.eventName && (
                      <li className="flex justify-between text-blue-500">
                        <span>Kegiatan Sekolah:</span>
                        <span className="font-semibold">{cellExplanation.eventName}</span>
                      </li>
                    )}
                    <li className="flex justify-between">
                      <span className="text-slate-500">Akses Tulis:</span>
                      <span className={`font-semibold ${cellExplanation.isWritable ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                        {cellExplanation.isWritable ? "Diizinkan" : "Diblokir"}
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-slate-400 border-b border-slate-100 dark:border-slate-950 pb-1">Validasi Mesin V2</h4>
                  <ul className="space-y-1.5">
                    <li className="flex justify-between">
                      <span className="text-slate-500">Kode Hasil:</span>
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{cellExplanation.validationReason}</span>
                    </li>
                    {cellExplanation.validationIssues.length > 0 && (
                      <li className="text-red-500 bg-red-50 dark:bg-red-950/20 p-2.5 rounded-xl mt-1">
                        <div className="font-bold">Isu Validasi:</div>
                        <ul className="list-disc pl-4 mt-1 space-y-0.5">
                          {cellExplanation.validationIssues.map((issue, idx) => (
                            <li key={idx}>{issue}</li>
                          ))}
                        </ul>
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceV2Visualizer;
