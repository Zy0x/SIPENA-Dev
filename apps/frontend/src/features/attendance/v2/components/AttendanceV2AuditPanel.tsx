import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { attendanceV2Api } from "../api/attendanceV2Api";
import { Loader2, ShieldAlert, Clock } from "lucide-react";
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
        <span>Memuat log audit...</span>
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

  return (
    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
      {logs.map((log) => {
        const dateStr = format(new Date(log.created_at), "dd MMM yyyy HH:mm:ss");
        return (
          <div key={log.id} className="p-3 border rounded-xl text-xs space-y-1 bg-slate-50/50 dark:bg-slate-900/10 border-slate-100 dark:border-slate-800/30">
            <div className="flex justify-between items-center text-[10px] text-slate-500 font-medium">
              <span className="flex items-center">
                <Clock className="w-3 h-3 mr-1" />
                {dateStr}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                Action: {log.action}
              </span>
            </div>
            <p className="text-slate-700 dark:text-slate-300">
              User: <span className="font-semibold">{log.user_id}</span>
            </p>
            <p className="text-slate-600 dark:text-slate-400">
              Kode Alasan: <span className="font-medium text-purple-600 dark:text-purple-400">{log.reason_code || "-"}</span>
            </p>
            <div className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded mt-1 overflow-x-auto text-slate-600 dark:text-slate-400">
              {JSON.stringify({ before: log.before_data, after: log.after_data })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
