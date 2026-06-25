import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  School,
  Users,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
  UserPlus,
  Eye,
  FileSpreadsheet,
  BookOpen,
  Target,
  AlertCircle,
} from "lucide-react";
import { Class, useClasses } from "@/hooks/useClasses";
import EditClassDialog from "./EditClassDialog";
import AddStudentDialog from "./AddStudentDialog";
import ClassDetailDialog from "./ClassDetailDialog";

interface ClassCardProps {
  classData: Class;
  subjectCount?: number;
  isSubjectCountLoading?: boolean;
}

export default function ClassCard({ classData, subjectCount = 0, isSubjectCountLoading = false }: ClassCardProps) {
  const navigate = useNavigate();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAddStudentDialog, setShowAddStudentDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showMissingSubjectDialog, setShowMissingSubjectDialog] = useState(false);
  const { deleteClass, duplicateClass } = useClasses();
  const hasSubjects = subjectCount > 0;

  const handleDelete = async () => {
    await deleteClass.mutateAsync(classData.id);
    setShowDeleteDialog(false);
  };

  const handleDuplicate = async () => {
    await duplicateClass.mutateAsync(classData.id);
  };

  const handleInputNilai = () => {
    if (isSubjectCountLoading || hasSubjects) {
      navigate(`/grades?classId=${encodeURIComponent(classData.id)}`);
      return;
    }

    setShowMissingSubjectDialog(true);
  };

  const handleTambahMapel = () => {
    const subjectUrl = `/subjects?classId=${encodeURIComponent(classData.id)}`;
    navigate(hasSubjects ? subjectUrl : `${subjectUrl}&action=add-subject`);
  };

  return (
    <>
      <Card className="group overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
        <CardContent className="flex h-full flex-col gap-2.5 p-3">
          <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/10 sm:h-11 sm:w-11">
              <School className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
            </div>

            <div className="flex min-h-10 min-w-0 items-center sm:min-h-11">
              <h3 className="truncate text-base font-bold leading-snug text-foreground sm:text-lg">
                {classData.name}
              </h3>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-full border border-border/70 bg-background/80 text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
                  aria-label={`Menu aksi kelas ${classData.name}`}
                  data-tour="class-card-menu"
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-popover">
                <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Kelas
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDuplicate}>
                  <Copy className="w-4 h-4 mr-2" />
                  Duplikasi
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Hapus Kelas
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="space-y-1 px-1.5 sm:px-2">
            <div className="flex items-center gap-2 text-foreground">
              <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="text-xs font-semibold sm:text-sm">
                {classData.student_count || 0} murid
              </span>
            </div>
            <div className="flex items-center gap-2 text-foreground">
              {classData.class_kkm !== null ? (
                <>
                  <Target className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-xs font-semibold sm:text-sm">KKM Kelas: {classData.class_kkm}</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-grade-warning" />
                  <span className="text-xs font-semibold text-grade-warning sm:text-sm">KKM kelas belum diisi</span>
                </>
              )}
            </div>
            {classData.description && (
              <p className="line-clamp-2 break-words text-justify text-xs leading-5 text-muted-foreground sm:text-sm">
                {classData.description}
              </p>
            )}
          </div>

          <div className="mt-auto grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2" data-tour="class-card-actions">
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 sm:h-9 text-[10px] sm:text-xs px-1 sm:px-2 gap-0.5 sm:gap-1"
              onClick={() => setShowDetailDialog(true)}
            >
              <Eye className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">Detail</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 sm:h-9 text-[10px] sm:text-xs px-1 sm:px-2 gap-0.5 sm:gap-1"
              onClick={() => setShowAddStudentDialog(true)}
            >
              <UserPlus className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">Murid</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 sm:h-9 text-[10px] sm:text-xs px-1 sm:px-2 gap-0.5 sm:gap-1"
              onClick={handleTambahMapel}
            >
              <BookOpen className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">Mapel</span>
            </Button>
            <Button
              size="sm"
              className="w-full h-8 sm:h-9 text-[10px] sm:text-xs px-1 sm:px-2 gap-0.5 sm:gap-1"
              onClick={handleInputNilai}
            >
              <FileSpreadsheet className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">Nilai</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Kelas?</AlertDialogTitle>
            <AlertDialogDescription>
              Anda yakin ingin menghapus kelas <strong>{classData.name}</strong>?
              Semua data murid dan nilai dalam kelas ini akan ikut terhapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showMissingSubjectDialog} onOpenChange={setShowMissingSubjectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tambahkan Mapel Terlebih Dahulu</AlertDialogTitle>
            <AlertDialogDescription>
              Kelas <strong>{classData.name}</strong> belum memiliki mata pelajaran. Tambahkan mapel agar halaman Input Nilai bisa dibuka sesuai kelas ini.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleTambahMapel}>
              Tambah Mapel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <EditClassDialog
        classData={classData}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />

      {/* Add Student Dialog */}
      <AddStudentDialog
        classId={classData.id}
        className={classData.name}
        open={showAddStudentDialog}
        onOpenChange={setShowAddStudentDialog}
      />

      {/* Class Detail Dialog */}
      <ClassDetailDialog
        classData={classData}
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
      />
    </>
  );
}
