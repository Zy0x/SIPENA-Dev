import React, { useRef } from "react";
import { Activity, Clock, Search, Filter } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { SectionIntro, InfoHelp, CompactMetric, EmptyState } from "./SettingsShared";
import { useAuditLogs } from "@/hooks/useAuditLogs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export interface AuditSectionProps {
  isLocked: boolean;
  classId: string;
}

export const AuditSection: React.FC<AuditSectionProps> = ({ isLocked, classId }) => {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useAuditLogs(classId);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [filterAction, setFilterAction] = React.useState("all");

  const logs = React.useMemo(() => data?.pages.flat() ?? [], [data]);

  const filteredLogs = React.useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = log.students?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           log.action.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesAction = filterAction === "all" || log.action === filterAction;
      return matchesSearch && matchesAction;
    });
  }, [logs, searchTerm, filterAction]);

  const parentRef = useRef<HTMLDivElement>(null);
  
  // Create an extra item for the loading indicator if hasNextPage is true
  const totalItems = hasNextPage ? filteredLogs.length + 1 : filteredLogs.length;
  
  const virtualizer = useVirtualizer({
    count: totalItems,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // Estimated height per row
  });

  const virtualItems = virtualizer.getVirtualItems();

  React.useEffect(() => {
    const lastItem = virtualItems[virtualItems.length - 1];
    if (!lastItem) return;

    if (lastItem.index >= filteredLogs.length - 1 && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [virtualItems, hasNextPage, isFetchingNextPage, fetchNextPage, filteredLogs.length]);

  return (
    <div className="space-y-4" data-tour="attendance-v2-settings-audit">
      <SectionIntro
        icon={Clock}
        title="Audit Riwayat Perubahan"
        description="Area monitoring transaksi presensi. Peninjauan menyeluruh terhadap log riwayat perubahan status kehadiran murid."
        help={
          <InfoHelp
            label="Audit Log"
            summary="Jejak digital pengubahan data kehadiran."
            detail="Setiap pengubahan, baik manual, import Excel, pemindaian OCR, maupun restore backup, akan dicatat secara transparan di database."
            example="Wali kelas mengubah status Alfa menjadi Sakit untuk murid A pada pukul 09:30."
            impact="Menjaga integritas data akademik dan transparansi pelaporan kehadiran."
          />
        }
      />
      
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden" data-tour="attendance-v2-settings-audit-history">
        <div className="p-4 border-b">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
            <CompactMetric label="Total Log" value={logs?.length ?? 0} />
            <CompactMetric label="Mode Bulan" value={isLocked ? "Terkunci" : "Dapat Diedit"} tone={isLocked ? "amber" : "green"} />
            <CompactMetric label="Filter Aktif" value={filteredLogs.length} tone="blue" />
          </div>

          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama murid..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 bg-muted/50 border-muted-foreground/20 focus-visible:ring-1"
              />
            </div>
            <div className="w-full sm:w-[180px]">
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger className="bg-muted/50 border-muted-foreground/20 focus:ring-1">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    <SelectValue placeholder="Filter Aksi" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Aksi</SelectItem>
                  <SelectItem value="update">Update Presensi</SelectItem>
                  <SelectItem value="insert">Insert Baru</SelectItem>
                  <SelectItem value="delete">Hapus Data</SelectItem>
                  <SelectItem value="restore">Restore Backup</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Activity}
              text={logs?.length === 0 ? "Belum ada riwayat aktivitas presensi di kelas ini." : "Tidak ada log yang cocok dengan filter pencarian."}
            />
          </div>
        ) : (
          <div 
            ref={parentRef} 
            className="h-[400px] overflow-auto custom-scrollbar p-2"
          >
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const log = filteredLogs[virtualItem.index];
                return (
                  <div
                    key={virtualItem.key}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualItem.size}px`,
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                    className="p-1"
                  >
                    <div className="flex flex-col p-3 rounded-xl border bg-background hover:bg-muted/30 transition-colors h-full">
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {log.students?.name || "Seluruh Kelas"}
                          </span>
                          <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-muted/50 capitalize">
                            {log.action}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                          {format(new Date(log.created_at), "dd MMM yyyy HH:mm", { locale: id })}
                        </span>
                      </div>
                      
                      <div className="text-xs text-muted-foreground flex items-center justify-between mt-auto">
                        <div className="truncate max-w-[200px]">
                          {log.before_data?.status ? (
                            <span>{log.before_data.status} → <span className="font-semibold text-foreground">{log.after_data?.status}</span></span>
                          ) : (
                            <span>Menjadi <span className="font-semibold text-foreground">{log.after_data?.status || '-'}</span></span>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-0.5">
                           {log.delegated_from && (
                             <Badge variant="secondary" className="text-[9px] h-4 px-1 bg-amber-500/10 text-amber-600 border-amber-200">
                               Delegasi
                             </Badge>
                           )}
                           <span className="text-[10px] opacity-70">
                             Oleh: {log.actor_id ? "Guru" : "Sistem"}
                           </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
