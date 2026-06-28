import React from "react";
import type { AttendanceDatasetCanonical } from "../../canonical/canonical.types";
import { computeMonthlyClassRecap } from "../attendanceV2.engine";
import { CheckCircle2, XCircle, Info, Clock, AlertCircle } from "lucide-react";

interface AttendanceV2SummaryCardsProps {
  dataset: AttendanceDatasetCanonical | null;
}

export const AttendanceV2SummaryCards: React.FC<AttendanceV2SummaryCardsProps> = ({ dataset }) => {
  const recap = React.useMemo(() => {
    if (!dataset) {
      return { presentCount: 0, sickCount: 0, permissionCount: 0, absentCount: 0, dispensationCount: 0, leaveCount: 0, totalCount: 0 };
    }
    return computeMonthlyClassRecap(dataset);
  }, [dataset]);

  const cards = [
    {
      label: "Hadir / Dispen",
      value: recap.presentCount,
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
      bg: "bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/30",
      textColor: "text-emerald-700 dark:text-emerald-400",
    },
    {
      label: "Sakit",
      value: recap.sickCount,
      icon: <Clock className="w-5 h-5 text-amber-500" />,
      bg: "bg-amber-50/50 dark:bg-amber-950/10 border-amber-100 dark:border-amber-900/30",
      textColor: "text-amber-700 dark:text-amber-400",
    },
    {
      label: "Izin",
      value: recap.permissionCount,
      icon: <Info className="w-5 h-5 text-sky-500" />,
      bg: "bg-sky-50/50 dark:bg-sky-950/10 border-sky-100 dark:border-sky-900/30",
      textColor: "text-sky-700 dark:text-sky-400",
    },
    {
      label: "Mangkir (Alpha)",
      value: recap.absentCount,
      icon: <XCircle className="w-5 h-5 text-rose-500" />,
      bg: "bg-rose-50/50 dark:bg-rose-950/10 border-rose-100 dark:border-rose-900/30",
      textColor: "text-rose-700 dark:text-rose-400",
    },
    {
      label: "Total Rasio",
      value: recap.totalCount > 0 ? `${Math.round((recap.presentCount / recap.totalCount) * 100)}%` : "0%",
      icon: <AlertCircle className="w-5 h-5 text-purple-500" />,
      bg: "bg-purple-50/50 dark:bg-purple-950/10 border-purple-100 dark:border-purple-900/30",
      textColor: "text-purple-700 dark:text-purple-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {cards.map((card, idx) => (
        <div key={idx} className={`p-4 border rounded-xl flex items-center space-x-3 ${card.bg}`}>
          {card.icon}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">{card.label}</p>
            <p className={`text-xl font-bold ${card.textColor}`}>{card.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
};
