import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { supabaseExternal as supabase } from "@/core/repositories/supabase-compat.repository";
import { Loader2, History, Trash2, Edit3, PlusCircle } from "lucide-react";

interface AuditLog {
  id: string;
  action: string;
  created_at: string;
  previous_state: any;
  new_state: any;
}

interface AuditTrailTimelineProps {
  classId: string;
  studentId: string;
  dateStr: string; // 'yyyy-MM-dd'
}

export function AuditTrailTimeline({ classId, studentId, dateStr }: AuditTrailTimelineProps) {
  const { data: logs, isLoading, error } = useQuery({
    queryKey: ["attendance_audit_logs", classId, studentId, dateStr],
    queryFn: async () => {
      // Kita fetch semua logs untuk student ini di kelas ini
      // lalu filter di client berdasarkan date, ATAU kita filter di server
      // karena JSON querying di Supabase bisa dilakukan tapi lebih aman di client jika data sedikit
      const { data, error } = await (supabase as any)
        .from("attendance_v2_audit_logs")
        .select("*")
        .eq("class_id", classId)
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      
      // Filter logs by date stored in new_state or previous_state
      return (data as AuditLog[]).filter(log => {
        const d1 = log.new_state?.date;
        const d2 = log.previous_state?.date;
        return d1 === dateStr || d2 === dateStr;
      });
    },
    enabled: !!classId && !!studentId && !!dateStr
  });

  if (isLoading) {
    return <div className="flex justify-center p-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  if (error || !logs) {
    return <div className="text-xs text-destructive p-2 text-center">Gagal memuat jejak aktivitas.</div>;
  }

  if (logs.length === 0) {
    return <div className="text-xs text-muted-foreground text-center p-4">Belum ada jejak aktivitas untuk tanggal ini.</div>;
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'inserted': return <PlusCircle className="w-4 h-4 text-emerald-500" />;
      case 'updated': return <Edit3 className="w-4 h-4 text-blue-500" />;
      case 'deleted': return <Trash2 className="w-4 h-4 text-destructive" />;
      default: return <History className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getActionDescription = (log: AuditLog) => {
    if (log.action === 'inserted') {
      return `Presensi ditambahkan: ${log.new_state?.status || '-'}`;
    }
    if (log.action === 'deleted') {
      return `Presensi dihapus (sebelumnya ${log.previous_state?.status || '-'})`;
    }
    if (log.action === 'updated') {
      const oldStatus = log.previous_state?.status;
      const newStatus = log.new_state?.status;
      const oldNote = log.previous_state?.note;
      const newNote = log.new_state?.note;

      if (oldStatus !== newStatus) {
        return `Status diubah dari ${oldStatus || '-'} menjadi ${newStatus || '-'}`;
      }
      if (oldNote !== newNote) {
        return `Catatan diperbarui`;
      }
      return `Diperbarui`;
    }
    return `Dimodifikasi`;
  };

  return (
    <div className="space-y-4 mt-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
      {logs.map((log) => (
        <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
          {/* Icon */}
          <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-100 group-[.is-active]:bg-white group-[.is-active]:border-slate-200 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
            {getActionIcon(log.action)}
          </div>
          
          {/* Content */}
          <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-3 rounded border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-slate-800 text-[11px] capitalize">{log.action}</span>
              <time className="text-[10px] text-muted-foreground font-mono">{format(new Date(log.created_at), "HH:mm:ss", { locale: idLocale })}</time>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">{getActionDescription(log)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
