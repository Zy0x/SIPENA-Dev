import React from "react";
import { useAttendanceCanonical } from "../provider/useAttendanceCanonical";

export const AttendanceDebugPanel: React.FC = () => {
  const canonical = useAttendanceCanonical();

  if (!canonical.isDebugEnabled) return null;

  return (
    <aside
      aria-label="Debug runtime Presensi"
      className="fixed bottom-3 right-3 z-[60] max-w-xs rounded-lg border border-blue-200 bg-white/95 p-3 text-xs text-slate-700 shadow-lg backdrop-blur dark:border-blue-900 dark:bg-slate-950/95 dark:text-slate-200"
    >
      <div className="font-semibold">Presensi Runtime Debug</div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
        <dt>Engine</dt>
        <dd>{canonical.runtime.engine}</dd>
        <dt>Mode</dt>
        <dd>{canonical.runtime.mode}</dd>
        <dt>Source</dt>
        <dd>{canonical.source}</dd>
        <dt>Status</dt>
        <dd>{canonical.status}</dd>
        <dt>Issues</dt>
        <dd>{canonical.issues.length}</dd>
      </dl>
    </aside>
  );
};

export default AttendanceDebugPanel;
