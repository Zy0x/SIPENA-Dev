import { useEffect, useState, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Star, Edit, Trash2, Loader2, ArrowUpDown, ArrowUp, ArrowDown, NotebookText, Target, Users } from "lucide-react";
import { Class } from "@/hooks/useClasses";
import { useStudents, Student } from "@/hooks/useStudents";
import EditStudentDialog from "./EditStudentDialog";

interface ClassDetailDialogProps {
  classData: Class;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SortField = 'name' | 'nisn' | 'bookmark';
type SortOrder = 'asc' | 'desc';

export default function ClassDetailDialog({
  classData,
  open,
  onOpenChange,
}: ClassDetailDialogProps) {
  const { students, isLoading, toggleBookmark, deleteStudent } = useStudents(classData.id);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<Student | null>(null);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const classDescription = classData.description?.trim() || "Belum ada deskripsi kelas.";
  const shouldCollapseDescription = classDescription.length > 110;

  useEffect(() => {
    if (open) {
      setIsDescriptionExpanded(false);
      requestAnimationFrame(() => {
        if (tableScrollRef.current && tableScrollRef.current.scrollWidth > tableScrollRef.current.clientWidth) {
          tableScrollRef.current.scrollLeft = 1;
        }
      });
    }
  }, [classData.id, open]);

  const filteredAndSortedStudents = useMemo(() => {
    let result = [...students];
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.nisn.toLowerCase().includes(query)
      );
    }

    // Sort - use numerical comparison for NISN
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'nisn': {
          // Numerical sorting for NISN (handles mixed alphanumeric)
          const nisnA = parseInt(a.nisn.replace(/\D/g, '')) || 0;
          const nisnB = parseInt(b.nisn.replace(/\D/g, '')) || 0;
          comparison = nisnA - nisnB;
          // If numeric values are equal, fall back to string comparison
          if (comparison === 0) {
            comparison = a.nisn.localeCompare(b.nisn);
          }
          break;
        }
        case 'bookmark':
          comparison = (b.is_bookmarked ? 1 : 0) - (a.is_bookmarked ? 1 : 0);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [students, searchQuery, sortField, sortOrder]);

  const handleToggleBookmark = async (student: Student) => {
    await toggleBookmark.mutateAsync({
      id: student.id,
      is_bookmarked: !student.is_bookmarked,
    });
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    await deleteStudent.mutateAsync(deleteConfirm.id);
    setDeleteConfirm(null);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 ml-1" />
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="flex h-[min(calc(100dvh-0.75rem),44.5rem)] w-[calc(100vw-0.75rem)] max-w-4xl max-h-none flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:h-[min(calc(100dvh-2rem),47rem)] sm:w-[calc(100vw-2rem)]"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            requestAnimationFrame(() => titleRef.current?.focus());
          }}
        >
          <DialogHeader className="shrink-0 border-b border-border px-3.5 pb-2 pr-12 pt-3 sm:px-4 sm:pr-14">
            <DialogTitle ref={titleRef} tabIndex={-1} className="text-sm outline-none sm:text-base">
              Detail Kelas - {classData.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {students.length} siswa terdaftar
            </DialogDescription>
          </DialogHeader>

          <section className="shrink-0 border-b border-border bg-muted/20 px-3.5 py-2.5 sm:px-4" data-tour="class-detail-summary">
            <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <NotebookText className="h-3.5 w-3.5" />
                  Deskripsi Kelas
                </div>
                <p className={`break-words text-justify text-sm leading-5 text-foreground ${shouldCollapseDescription && !isDescriptionExpanded ? "line-clamp-2" : ""}`}>
                  {classDescription}
                </p>
                {shouldCollapseDescription && (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="mt-0.5 h-auto px-0 py-0 text-xs font-semibold"
                    onClick={() => setIsDescriptionExpanded((value) => !value)}
                  >
                    {isDescriptionExpanded ? "Tampilkan lebih sedikit" : "Lihat selengkapnya..."}
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:min-w-40 sm:grid-cols-1">
                <div className="rounded-xl border border-border/70 bg-background px-3 py-1.5">
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <Target className="h-3.5 w-3.5" />
                    KKM Kelas
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {classData.class_kkm ?? "Belum diisi"}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background px-3 py-1.5">
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    Siswa
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {students.length} terdaftar
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div className="flex shrink-0 flex-col gap-2 border-b border-border px-3.5 py-2.5 sm:flex-row sm:px-4" data-tour="class-detail-tools">
            <div className="sipena-search-field min-h-11 flex-1 rounded-xl px-3 py-1.5">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama atau NISN..."
                className="sipena-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select
              value={`${sortField}-${sortOrder}`}
              onValueChange={(value) => {
                const [field, order] = value.split('-') as [SortField, SortOrder];
                setSortField(field);
                setSortOrder(order);
              }}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Urutkan..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name-asc">Nama (A-Z)</SelectItem>
                <SelectItem value="name-desc">Nama (Z-A)</SelectItem>
                <SelectItem value="nisn-asc">NISN (Terkecil)</SelectItem>
                <SelectItem value="nisn-desc">NISN (Terbesar)</SelectItem>
                <SelectItem value="bookmark-desc">Bookmark Dulu</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div
            ref={tableScrollRef}
            className="sipena-class-detail-scroll sipena-scroll-chain-page min-h-0 flex-1 overflow-x-scroll overflow-y-auto overscroll-auto px-3.5 pb-3.5 scrollbar-thin sm:px-4"
            aria-label={`Daftar siswa kelas ${classData.name}`}
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filteredAndSortedStudents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {students.length === 0 ? "Belum ada siswa" : "Tidak ditemukan"}
              </div>
            ) : (
              <table className="w-full min-w-[40rem] table-fixed border-separate border-spacing-0 caption-bottom text-sm">
                <colgroup>
                  <col className="w-12" />
                  <col className="w-[17rem]" />
                  <col className="w-32" />
                  <col className="w-28" />
                </colgroup>
                <thead className="sticky top-0 z-20 bg-background shadow-[0_1px_0_hsl(var(--border))]">
                  <tr className="bg-background">
                    <th className="h-11 border-b px-2 text-center align-middle text-xs font-medium text-muted-foreground sm:px-4">
                      No
                    </th>
                    <th
                      className="h-11 cursor-pointer border-b px-2 text-center align-middle text-xs font-medium text-muted-foreground hover:bg-muted/50 sm:px-4 sm:text-sm"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center justify-center text-xs sm:text-sm">
                        Nama
                        <SortIcon field="name" />
                      </div>
                    </th>
                    <th
                      className="h-11 cursor-pointer border-b px-2 text-center align-middle text-xs font-medium text-muted-foreground hover:bg-muted/50 sm:px-4 sm:text-sm"
                      onClick={() => handleSort('nisn')}
                    >
                      <div className="flex items-center justify-center text-xs sm:text-sm">
                        NISN
                        <SortIcon field="nisn" />
                      </div>
                    </th>
                    <th className="sticky right-0 z-30 h-11 border-b bg-background px-2 text-center align-middle text-xs font-medium text-muted-foreground shadow-[-1px_0_0_hsl(var(--border))] sm:px-4 sm:text-sm">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedStudents.map((student, index) => (
                    <tr key={student.id} className="group border-b transition-colors hover:bg-muted/50">
                      <td className="border-b px-2 py-3 text-center align-middle sm:px-4">{index + 1}</td>
                      <td className="min-w-0 border-b px-2 py-3 pr-3 align-middle font-medium sm:px-4 sm:pr-5">
                        <div className="flex min-w-0 items-center gap-2">
                          {student.is_bookmarked && (
                            <Star className="h-4 w-4 shrink-0 fill-grade-warning text-grade-warning" />
                          )}
                          <span className="break-words leading-snug">{student.name}</span>
                        </div>
                      </td>
                      <td className="border-b px-2 py-3 text-center align-middle text-xs text-muted-foreground sm:px-4">
                        <span className="block break-all leading-snug">{student.nisn}</span>
                      </td>
                      <td className="sticky right-0 z-10 border-b bg-background px-2 py-3 align-middle shadow-[-1px_0_0_hsl(var(--border))] group-hover:bg-muted sm:px-4">
                        <div className="flex justify-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleToggleBookmark(student)}
                            title={student.is_bookmarked ? "Hapus bookmark" : "Bookmark"}
                            aria-label={student.is_bookmarked ? "Hapus bookmark siswa" : "Bookmark siswa"}
                          >
                            <Star className={`h-4 w-4 ${student.is_bookmarked ? "fill-grade-warning text-grade-warning" : ""}`} />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setEditStudent(student)}
                            title="Edit siswa"
                            aria-label="Edit siswa"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => setDeleteConfirm(student)}
                            title="Hapus siswa"
                            aria-label="Hapus siswa"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Student Dialog */}
      <EditStudentDialog
        student={editStudent}
        open={!!editStudent}
        onOpenChange={(open) => !open && setEditStudent(null)}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Siswa?</AlertDialogTitle>
            <AlertDialogDescription>
              Hapus <strong>{deleteConfirm?.name}</strong>? Data nilai akan ikut terhapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
