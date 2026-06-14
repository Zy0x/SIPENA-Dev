import { useState, useMemo } from "react";
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
import { Search, Star, Edit, Trash2, Loader2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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
        <DialogContent className="flex h-[min(calc(100dvh-1rem),44rem)] w-[calc(100vw-1rem)] max-w-3xl max-h-none flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:h-[min(calc(100dvh-3rem),46rem)] sm:w-[calc(100vw-3rem)]">
          <DialogHeader className="shrink-0 border-b border-border px-4 pb-3 pr-16 pt-4 sm:px-5 sm:pr-16">
            <DialogTitle className="text-sm sm:text-base">
              Detail Kelas - {classData.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {students.length} siswa terdaftar
            </DialogDescription>
          </DialogHeader>

          <div className="flex shrink-0 flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:px-5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama atau NISN..."
                className="pl-9"
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
            className="sipena-class-detail-scroll sipena-scroll-chain-page min-h-0 flex-1 overflow-y-auto overscroll-auto px-4 pb-4 pt-3 scrollbar-thin sm:px-5"
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
              <table className="w-full table-fixed caption-bottom text-sm">
                <colgroup>
                  <col className="w-12" />
                  <col />
                  <col className="w-24 sm:w-32" />
                  <col className="w-28" />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-background shadow-[0_1px_0_hsl(var(--border))]">
                  <tr>
                    <th className="h-11 px-2 text-center align-middle text-xs font-medium text-muted-foreground sm:px-4">
                      No
                    </th>
                    <th
                      className="h-11 cursor-pointer px-2 text-left align-middle text-xs font-medium text-muted-foreground hover:bg-muted/50 sm:px-4 sm:text-sm"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center text-xs sm:text-sm">
                        Nama
                        <SortIcon field="name" />
                      </div>
                    </th>
                    <th
                      className="h-11 cursor-pointer px-2 text-left align-middle text-xs font-medium text-muted-foreground hover:bg-muted/50 sm:px-4 sm:text-sm"
                      onClick={() => handleSort('nisn')}
                    >
                      <div className="flex items-center text-xs sm:text-sm">
                        NISN
                        <SortIcon field="nisn" />
                      </div>
                    </th>
                    <th className="h-11 px-2 text-center align-middle text-xs font-medium text-muted-foreground sm:px-4 sm:text-sm">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedStudents.map((student, index) => (
                    <tr key={student.id} className="border-b transition-colors hover:bg-muted/50">
                      <td className="px-2 py-3 text-center align-middle sm:px-4">{index + 1}</td>
                      <td className="min-w-0 px-2 py-3 align-middle font-medium sm:px-4">
                        <div className="flex min-w-0 items-center gap-2">
                          {student.is_bookmarked && (
                            <Star className="h-4 w-4 shrink-0 fill-grade-warning text-grade-warning" />
                          )}
                          <span className="break-words leading-snug">{student.name}</span>
                        </div>
                      </td>
                      <td className="px-2 py-3 align-middle text-xs text-muted-foreground sm:px-4">
                        <span className="block break-words leading-snug">{student.nisn}</span>
                      </td>
                      <td className="px-2 py-3 align-middle sm:px-4">
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
