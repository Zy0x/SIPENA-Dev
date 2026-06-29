import React from "react";
import type { AttendanceDatasetCanonical, AttendanceRecordCanonical, AttendanceStatusCode } from "../../canonical/canonical.types";
import { AttendanceV2Cell } from "./AttendanceV2Cell";
import { format, parseISO } from "date-fns";

interface AttendanceV2TableProps {
  dataset: AttendanceDatasetCanonical | null;
  onCellClick: (studentId: string, date: string, currentStatus: AttendanceStatusCode | null, currentNote: string | null) => void;
  isLocked: boolean;
}

export const AttendanceV2Table: React.FC<AttendanceV2TableProps> = ({
  dataset,
  onCellClick,
  isLocked,
}) => {
  if (!dataset || dataset.students.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 border rounded-xl bg-white dark:bg-slate-950">
        Pilih kelas terlebih dahulu atau tidak ada murid terdaftar di kelas ini.
      </div>
    );
  }

  const { students, records, days, holidays, dayEvents, locks } = dataset;
  const lockedState = locks.some((l) => l.isLocked) || isLocked;

  return (
    <div className="border rounded-xl bg-white dark:bg-slate-950 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
              <th className="p-3 font-semibold text-slate-600 dark:text-slate-400 min-w-[150px] sticky left-0 bg-slate-50 dark:bg-slate-900 z-10">
                Nama Murid
              </th>
              {days.map((day) => {
                const dateObj = parseISO(day.date);
                const dayNum = format(dateObj, "d");
                const dayName = format(dateObj, "eee");
                const isNonEffective = !day.isEffective;
                return (
                  <th
                    key={day.date}
                    className={`p-2 text-center font-medium border-l border-slate-100 dark:border-slate-800 min-w-[44px] ${
                      isNonEffective ? "bg-slate-100/50 dark:bg-slate-900/50 text-slate-400" : "text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <div>{dayNum}</div>
                    <div className="text-[9px] uppercase tracking-wider">{dayName}</div>
                  </th>
                );
              })}
              <th className="p-3 text-center font-semibold text-slate-600 dark:text-slate-400 min-w-[80px]">
                Rekap (H/S/I/A/D)
              </th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const studentSummary = dataset.monthlySummary?.find((s) => s.studentId === student.id) || {
                presentCount: 0,
                sickCount: 0,
                permissionCount: 0,
                absentCount: 0,
                dispensationCount: 0,
              };

              return (
                <tr
                  key={student.id}
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 border-b border-slate-100 dark:border-slate-800/50"
                >
                  <td className="p-3 font-medium text-slate-800 dark:text-slate-200 sticky left-0 bg-white dark:bg-slate-950 z-10 border-r border-slate-100 dark:border-slate-800">
                    {student.name}
                  </td>
                  {days.map((day) => {
                    const record = records.find((r) => r.studentId === student.id && r.date === day.date);
                    const holiday = holidays.find((h) => h.date === day.date);
                    const event = dayEvents.find((e) => e.date === day.date);

                    return (
                      <td key={day.date} className="p-0 border-l border-slate-100 dark:border-slate-800">
                        <AttendanceV2Cell
                          date={day.date}
                          status={record ? record.status : null}
                          note={record ? record.note : null}
                          isEffective={day.isEffective}
                          holidayName={holiday?.description || (day.dayOfWeek === 0 ? "Hari Minggu" : day.dayOfWeek === 6 ? "Sabtu (Libur)" : undefined)}
                          eventName={event?.label}
                          isLocked={lockedState}
                          record={record}
                          onClick={() =>
                            onCellClick(
                              student.id,
                              day.date,
                              record ? record.status : null,
                              record ? record.note : null
                            )
                          }
                        />
                      </td>
                    );
                  })}
                  <td className="p-3 text-center font-bold text-slate-700 dark:text-slate-300">
                    {studentSummary.presentCount}/{studentSummary.sickCount}/{studentSummary.permissionCount}/
                    {studentSummary.absentCount}/{studentSummary.dispensationCount}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
