import React from "react";
import { cn } from "@/lib/utils";
import { getStatusDefinition } from "../rules/statusEngine";
import type { AttendanceStatusCode, AttendanceRecordCanonical } from "../../canonical/canonical.types";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, MessageSquare, Info } from "lucide-react";

interface AttendanceV2CellProps {
  date: string;
  status: AttendanceStatusCode | null;
  note: string | null;
  isEffective: boolean;
  holidayName?: string;
  eventName?: string;
  isLocked: boolean;
  record?: AttendanceRecordCanonical;
  onClick: () => void;
}

export const AttendanceV2Cell: React.FC<AttendanceV2CellProps> = ({
  status,
  note,
  isEffective,
  holidayName,
  eventName,
  isLocked,
  record,
  onClick,
}) => {
  const statusDef = getStatusDefinition(status || "-");

  const cellBg = cn(
    "relative flex items-center justify-center w-10 h-10 border border-slate-100 dark:border-slate-800 text-sm font-semibold select-none cursor-pointer transition-colors duration-150",
    {
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400": status === "H",
      "bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400": status === "D",
      "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400": status === "S",
      "bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400": status === "I",
      "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400": status === "A",
      "bg-slate-100 text-slate-400 dark:bg-slate-900 dark:text-slate-600 cursor-not-allowed": !isEffective || isLocked,
      "hover:bg-slate-50 dark:hover:bg-slate-800": isEffective && !isLocked && !status,
    }
  );

  const displayChar = statusDef?.exportCode || "-";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cellBg} onClick={!isLocked && isEffective ? onClick : undefined}>
          <span>{displayChar}</span>
          
          {/* Icons/Indicators */}
          {note && (
            <MessageSquare className="absolute bottom-0.5 right-0.5 w-2 h-2 text-slate-400 dark:text-slate-500" />
          )}

          {eventName && holidayName && (
            <AlertCircle className="absolute top-0.5 right-0.5 w-2.5 h-2.5 text-amber-500" />
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-[280px]">
        <div className="space-y-1 text-xs">
          <p className="font-bold">Detail Presensi:</p>
          <p>Status: <span className="font-semibold">{statusDef?.label || "Belum Diisi"}</span></p>
          {note && <p>Catatan: <span className="italic">"{note}"</span></p>}
          {!isEffective && <p className="text-amber-500 font-semibold">Hari Non-Efektif ({holidayName || "Libur"})</p>}
          {isLocked && <p className="text-red-500 font-semibold">Periode Terkunci</p>}
          {eventName && <p className="text-sky-500 font-semibold">Event: {eventName}</p>}
          
          {/* V2 Rule Debugging Explanation */}
          {record?.debug && (
            <div className="pt-1 mt-1 border-t border-slate-200 dark:border-slate-700 text-[10px] text-slate-500">
              <p className="font-semibold text-slate-700 dark:text-slate-300">V2 Rule Engine Trace:</p>
              <p>Aturan: {(record.debug as any).rulesApplied.join(", ") || "None"}</p>
              <p>Kode: {(record.debug as any).message}</p>
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
