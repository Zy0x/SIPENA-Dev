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
  Target,
  AlertCircle,
} from "lucide-react";
import { Class, useClasses } from "@/hooks/useClasses";
import EditClassDialog from "./EditClassDialog";
import AddStudentDialog from "./AddStudentDialog";
import ClassDetailDialog from "./ClassDetailDialog";

interface ClassCardProps {
  classData: Class;
}

export default function ClassCard({ classData }: ClassCardProps) {
  const navigate = useNavigate();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAddStudentDialog, setShowAddStudentDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const { deleteClass, duplicateClass } = useClasses();

  const handleDelete = async () => {
    await deleteClass.mutateAsync(classData.id);
    setShowDeleteDialog(false);
  };

  const handleDuplicate = async () => {
    await duplicateClass.mutateAsync(classData.id);
  };

  const handleInputNilai = () => {
    navigate(`/grades?classId=${classData.id}`);
  };

  return (
    <>
      <Card className="group hover:shadow-lg transition-all duration-300">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <School className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-lg">
                  {classData.name}
                </h3>
                <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                  <Users className="w-4 h-4" />
                  <span className="text-sm">
                    {classData.student_count || 0} siswa
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                  {classData.class_kkm !== null ? (
                    <>
                      <Target className="w-4 h-4" />
                      <span className="text-sm">KKM Kelas: {classData.class_kkm}</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-grade-warning" />
                      <span className="text-sm text-grade-warning">KKM kelas belum diisi</span>
                    </>
                  )}
                </div>
                {classData.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                    {classData.description}
                  </p>
                )}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Menu aksi"
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-popover">
                <DropdownMenuItem onClick={() => setShowDetailDialog(true)}>
                  <Eye className="w-4 h-4 mr-2" />
                  Lihat Detail
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowAddStudentDialog(true)}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Tambah Siswa
                </DropdownMenuItem>
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

          <div className="mt-4 grid grid-cols-3 gap-1.5 sm:gap-2">
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
              <span className="truncate">Siswa</span>
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
              Semua data siswa dan nilai dalam kelas ini akan ikut terhapus.
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
