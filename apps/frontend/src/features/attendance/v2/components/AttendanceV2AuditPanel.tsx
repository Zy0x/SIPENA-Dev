import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { attendanceV2Api } from "../api/attendanceV2Api";
import { Loader2, ShieldAlert, Clock, ArrowRight, User } from "lucide-react";
import { format } from "date-fns";

interface AttendanceV2AuditPanelProps {
  classId: string;
}

export const AttendanceV2AuditPanel: React.FC<AttendanceV2AuditPanelProps> = ({ classId }) => {
  const { session } = useAuth();
  const token = session?.access_token ?? "";
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchLogs = async () => {
      if (!classId || !token) return;
      setLoading(true);
      try {
        const res = await attendanceV2Api.getAuditLogs(classId, token);
        setLogs(res.data || []);
      } catch (err) {
        console.error("Failed to load V2 audit logs:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [classId, token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span>Memuat log audit V2...</span>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400 text-sm">
        Tidak ada log perubahan untuk periode kelas ini.
      </div>
    );
  }

  const getStatusBadge = (status: string | null) => {
    if (!status || status === "-") return <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono">-</span>;
    
    const colors: Record<string, string> = {
      H: "bg-emerald-100 text-emerald-800 border-emerald-200",
      D: "bg-purple-100 text-purple-800 border-purple-200",
      S: "bg-amber-100 text-amber-800 border-amber-200",
      I: "bg-sky-100 text-sky-800 border-sky-200",
      A: "bg-rose-100 text-rose-800 border-rose-200",
      L: "bg-slate-100 text-slate-800 border-slate-200"
    };

    return (
      <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold font-mono ${colors[status] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
      {logs.map((log) => {
        const dateStr = format(new Date(log.created_at || log.timestamp || new Date()), "dd MMM yyyy HH:mm:ss");
        const isShadowMismatch = log.action === "PRESENSI_SHADOW_MISMATCH";
        
        // Extract before/after
        const before = log.before_data || log.beforeState;
        const after = log.after_data || log.afterState;

        return (
          <div 
            key={log.id} 
            className={`p-3 border rounded-xl text-xs space-y-2 bg-white dark:bg-slate-950 shadow-sm transition-colors border-slate-150 ${
              isShadowMismatch 
                ? "border-rose-200 bg-rose-50/10 dark:border-rose-950/20" 
                : "border-slate-100 dark:border-slate-800/40"
            }`}
          >
            {/* Header info */}
            <div className="flex justify-between items-center text-[10px] text-slate-500 font-medium">
              <span className="flex items-center">
                <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
                {dateStr}
              </span>
              <span className={`px-2 py-0.5 rounded font-bold uppercase ${
                isShadowMismatch 
                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400" 
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
              }`}>
                {log.action}
              </span>
            </div>

            {/* Operator and Reason */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-600 dark:text-slate-400">
              <span className="flex items-center">
                <User className="w-3.5 h-3.5 mr-1 text-slate-400" />
                Petugas: <span className="font-semibold text-slate-700 dark:text-slate-300 ml-1">{log.actor_id || log.user_id || "System"}</span>
              </span>
              {log.reason_code && (
                <span>
                  Alasan: <span className="font-semibold text-purple-600 dark:text-purple-400">{log.reason_code}</span>
                </span>
              )}
            </div>

            {/* Target item */}
            {log.date && (
              <div className="text-[10px] text-slate-500">
                Target: <span className="font-medium text-slate-700 dark:text-slate-300">{log.date}</span> 
                {log.student_id && (
                  <> | Murid ID: <span className="font-medium text-slate-700 dark:text-slate-300 font-mono">{log.student_id.slice(-6)}</span></>
                )}
              </div>
            )}

            {/* State Comparison Display */}
            {before || after ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-100/50 dark:border-slate-800/20 text-[11px]">
                {/* Status change */}
                <div className="flex items-center space-x-2 bg-slate-50/50 dark:bg-slate-900/10 p-1.5 rounded-lg border border-slate-100/30">
                  <span className="text-slate-500 font-medium">Status:</span>
                  <div className="flex items-center space-x-1.5">
                    {getStatusBadge(before?.status)}
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                    {getStatusBadge(after?.status)}
                  </div>
                </div>

                {/* Note change */}
                <div className="flex flex-col justify-center bg-slate-50/50 dark:bg-slate-900/10 p-1.5 rounded-lg border border-slate-100/30">
                  <span className="text-slate-500 font-medium mb-0.5">Catatan Alasan:</span>
                  <div className="text-[10px] italic text-slate-600 dark:text-slate-400 truncate">
                    {before?.note || "-"} <span className="font-bold font-sans not-italic text-slate-400 mx-1">→</span> {after?.note || "-"}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Shadow Report Alert details */}
            {isShadowMismatch && log.metadata?.report?.mismatches?.[0] && (
              <div className="flex items-center space-x-1.5 bg-rose-50/30 border border-rose-100 rounded-lg p-2 mt-1 text-[10px] text-rose-700">
                <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
                <span>
                  Pergeseran data terdeteksi pada murid {log.metadata.report.mismatches[0].studentId} untuk tanggal {log.metadata.report.mismatches[0].date}.
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
export default AttendanceV2AuditPanel;
