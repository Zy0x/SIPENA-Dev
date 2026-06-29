import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { attendanceV2Api } from "../api/attendanceV2Api";
import { Loader2, RefreshCw, AlertTriangle, CheckCircle, ShieldAlert } from "lucide-react";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { AttendanceDatasetCanonical } from "../../canonical/canonical.types";

interface AttendanceV2ShadowReportPanelProps {
  dataset: AttendanceDatasetCanonical | null;
}

export const AttendanceV2ShadowReportPanel: React.FC<AttendanceV2ShadowReportPanelProps> = ({ dataset }) => {
  const { session } = useAuth();
  const token = session?.access_token ?? "";
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await attendanceV2Api.getShadowReport(token);
      setReport(res.data);
    } catch (err) {
      console.error("Failed to load shadow report:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [token]);

  if (loading && !report) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600 mb-2" />
        <span className="text-xs">Memuat laporan shadow compare...</span>
      </div>
    );
  }

  const mismatchCount = report?.mismatchCount ?? 0;
  const isHealthy = mismatchCount === 0;

  return (
    <div className="space-y-4">
      {/* Header and Sync */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Shadow Engine Comparison Dashboard</h3>
          <p className="text-xs text-slate-500">Hasil verifikasi integritas data presensi V1 (Produksi) vs V2 (Aturan Baru).</p>
        </div>
        <button
          onClick={fetchReport}
          disabled={loading}
          className="flex items-center space-x-1 text-xs text-purple-600 hover:text-purple-700 font-medium border border-purple-100 rounded-lg px-2.5 py-1 hover:bg-purple-50 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Segarkan</span>
        </button>
      </div>

      {/* Summary Alert */}
      <div className={`p-4 border rounded-xl flex items-start space-x-3 ${
        isHealthy
          ? "bg-emerald-50/50 border-emerald-100 text-emerald-800 dark:bg-emerald-950/10 dark:border-emerald-900/30"
          : "bg-rose-50/50 border-rose-100 text-rose-800 dark:bg-rose-950/10 dark:border-rose-900/30"
      }`}>
        {isHealthy ? (
          <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5" />
        ) : (
          <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 mt-0.5" />
        )}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider">
            {isHealthy ? "Paritas Data 100% Cocok" : "Terjadi Pergeseran Data (Data Drift)"}
          </h4>
          <p className="text-xs mt-1 text-slate-600 dark:text-slate-400 leading-relaxed">
            {isHealthy
              ? "Seluruh penulisan dan evaluasi status kehadiran pada modul V2 identik dengan data produksi V1. Sistem berjalan dengan aman."
              : `Ditemukan ${mismatchCount} perbedaan antara V1 dan V2. Hal ini menunjukkan penolakan aturan bisnis baru V2 terhadap penulisan V1.`}
          </p>
        </div>
      </div>

      {/* Mismatch List */}
      {!isHealthy && report?.reports && (
        <div className="border rounded-xl bg-white dark:bg-slate-950 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                  <th className="p-3 font-semibold text-slate-600 dark:text-slate-400">Murid</th>
                  <th className="p-3 font-semibold text-slate-600 dark:text-slate-400">Tanggal</th>
                  <th className="p-3 text-center font-semibold text-slate-600 dark:text-slate-400">Status V1 (Prod)</th>
                  <th className="p-3 text-center font-semibold text-slate-600 dark:text-slate-400">Status V2 (New)</th>
                  <th className="p-3 font-semibold text-slate-600 dark:text-slate-400">Pemicu Drift</th>
                </tr>
              </thead>
              <tbody>
                {report.reports.flatMap((r: any, idx: number) =>
                  r.mismatches.map((m: any, mIdx: number) => {
                    const studentName = dataset?.students.find((s) => s.id === m.studentId)?.name || m.studentId;
                    const dateFormatted = format(parseISO(m.date), "dd MMMM yyyy", { locale: idLocale });
                    return (
                      <tr
                        key={`${idx}-${mIdx}`}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 border-b border-slate-100 dark:border-slate-800/50"
                      >
                        <td className="p-3 font-medium text-slate-800 dark:text-slate-200">{studentName}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-400">{dateFormatted}</td>
                        <td className="p-3 text-center font-semibold text-rose-600">{m.v1Status || "-"}</td>
                        <td className="p-3 text-center font-semibold text-emerald-600">{m.v2Status || "-"}</td>
                        <td className="p-3 text-slate-500 font-mono text-[10px]">
                          V2 Rule Engine Blocked ({m.v2Status === null ? "REJECTED_BY_V2_RULES" : "DIVERGED"})
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isHealthy && (
        <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 border border-dashed rounded-xl">
          <AlertTriangle className="w-8 h-8 text-slate-300 mb-2" />
          <p className="text-xs">Tidak ada data drift terdeteksi.</p>
        </div>
      )}
    </div>
  );
};
