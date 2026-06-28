import React from "react";
import { Button } from "@/components/ui/button";
import { Lock, Unlock } from "lucide-react";

interface AttendanceV2LockPanelProps {
  isLocked: boolean;
  onToggle: () => Promise<void>;
  isLoading: boolean;
}

export const AttendanceV2LockPanel: React.FC<AttendanceV2LockPanelProps> = ({
  isLocked,
  onToggle,
  isLoading,
}) => {
  return (
    <div className="flex items-center justify-between p-4 border rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800">
      <div className="flex items-center space-x-3">
        {isLocked ? (
          <div className="p-2 bg-rose-100 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-lg">
            <Lock className="w-5 h-5" />
          </div>
        ) : (
          <div className="p-2 bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
            <Unlock className="w-5 h-5" />
          </div>
        )}
        <div>
          <p className="text-sm font-semibold">Status Kunci Bulanan</p>
          <p className="text-xs text-slate-500">
            {isLocked
              ? "Semua penulisan dikunci. Data presensi bersifat final."
              : "Periode terbuka. Penulisan dan penyuntingan data diizinkan."}
          </p>
        </div>
      </div>
      <Button
        variant={isLocked ? "outline" : "destructive"}
        size="sm"
        onClick={onToggle}
        disabled={isLoading}
      >
        {isLocked ? "Buka Kunci" : "Kunci Periode"}
      </Button>
    </div>
  );
};
