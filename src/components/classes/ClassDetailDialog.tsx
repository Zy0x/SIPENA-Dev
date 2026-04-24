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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
        case 'nisn':
          // Numerical sorting for NISN (handles mixed alphanumeric)
          const nisnA = parseInt(a.nisn.replace(/\D/g, '')) || 0;
          const nisnB = parseInt(b.nisn.replace(/\D/g, '')) || 0;
          comparison = nisnA - nisnB;
          // If numeric values are equal, fall back to string comparison
          if (comparison === 0) {
            comparison = a.nisn.localeCompare(b.nisn);
          }
          break;
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
        {/* max-h-[90dvh] agar dialog muat di semua layar termasuk mobile */}
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-3xl max-h-[90dvh] overflow-hidden flex flex-col p-0 rounded-2xl">
          {/* Header fixed — tidak ikut scroll */}
          <DialogHeader className="px-4 pt-4 pb-3 flex-shrink-0 border-b border-border">
            <DialogTitle className="text-sm sm:text-base">
              Detail Kelas — {classData.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {students.length} siswa terdaftar
            </DialogDescription>
          </DialogHeader>

          {/* Search and Filter Controls — fixed di bawah header */}
          <div className="flex flex-col sm:flex-row gap-2 px-4 py-3 flex-shrink-0 border-b border-border">
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

          <div className="flex-1 overflow-auto min-h-0 px-4 pb-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filteredAndSortedStudents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {students.length === 0 ? "Belum ada siswa" : "Tidak ditemukan"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {/* No: lebar fixed kecil */}
                    <TableHead className="w-10 text-center">No</TableHead>
                    {/* Nama: flex mengisi sisa ruang, tidak ada min-width paksa */}
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center text-xs sm:text-sm">
                        Nama
                        <SortIcon field="name" />
                      </div>
                    </TableHead>
                    {/* NISN: whitespace-nowrap, lebar mengikuti konten */}
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 whitespace-nowrap"
                      onClick={() => handleSort('nisn')}
                    >
                      <div className="flex items-center text-xs sm:text-sm">
                        NISN
                        <SortIcon field="nisn" />
                      </div>
                    </TableHead>
                    {/* Aksi: lebar fixed cukup untuk 3 tombol icon */}
                    <TableHead className="w-28 text-center">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedStudents.map((student, index) => (
                    <TableRow key={student.id}>
                      <TableCell className="text-center w-10 flex-shrink-0">{index + 1}</TableCell>
                      <TableCell className="font-medium min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          {student.is_bookmarked && (
                            <Star className="w-4 h-4 text-grade-warning fill-grade-warning flex-shrink-0" />
                          )}
                          {/* Pola sama dengan Attendance.tsx: break-words, bukan truncate */}
                          <span className="break-words leading-snug">{student.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{student.nisn}</TableCell>
                      <TableCell className="w-28 flex-shrink-0">
                        <div className="flex justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleToggleBookmark(student)}
                            title={student.is_bookmarked ? "Hapus bookmark" : "Bookmark"}
                          >
                            <Star className={`w-4 h-4 ${student.is_bookmarked ? "fill-grade-warning text-grade-warning" : ""}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setEditStudent(student)}
                            title="Edit siswa"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => setDeleteConfirm(student)}
                            title="Hapus siswa"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
