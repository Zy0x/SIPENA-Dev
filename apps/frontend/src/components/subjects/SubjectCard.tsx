import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BookOpen, Edit, Trash2, FileSpreadsheet, Link2, MoreVertical } from "lucide-react";
import { Subject, useSubjects } from "@/hooks/useSubjects";
import EditSubjectDialog from "./EditSubjectDialog";
import { ShareLinkDialog } from "./ShareLinkDialog";

interface SubjectCardProps {
  subject: Subject;
  showClassName?: boolean;
  className?: string;
}

export default function SubjectCard({ subject, showClassName, className }: SubjectCardProps) {
  const navigate = useNavigate();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const { deleteSubject } = useSubjects(subject.class_id);

  const handleDelete = async () => {
    await deleteSubject.mutateAsync(subject.id);
    setShowDeleteDialog(false);
  };

  const handleInputGrades = () => {
    navigate(`/grades?classId=${subject.class_id}&subjectId=${subject.id}`);
  };

  // Determine KKM badge variant
  const getKkmVariant = (kkm: number) => {
    if (kkm >= 75) return "pass";
    if (kkm >= 65) return "warning";
    return "fail";
  };

  return (
    <>
      <Card className="group hover:shadow-lg transition-all duration-300 overflow-hidden h-full">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-start gap-2 sm:gap-3">
            {/* Icon */}
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            </div>

            {/* Content - responsive text sizing */}
            <div className="flex-1 min-w-0 overflow-hidden">
              <h3 className="font-semibold text-foreground text-sm sm:text-base leading-tight line-clamp-2 break-words">
                {subject.name}
              </h3>
              {showClassName && className && (
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate mt-0.5">{className}</p>
              )}
              <div className="flex items-center gap-1.5 sm:gap-2 mt-1 sm:mt-1.5 flex-wrap">
                <span className="text-[10px] sm:text-xs text-muted-foreground">KKM:</span>
                <Badge variant={getKkmVariant(subject.kkm)} className="text-[10px] sm:text-xs px-1.5 py-0">
                  {subject.kkm}
                </Badge>
                {subject.is_custom && (
                  <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 py-0">Custom</Badge>
                )}
              </div>
            </div>

            {/* Actions - Mobile Dropdown + Desktop Buttons */}
            <div className="flex-shrink-0">
              {/* Desktop: Individual buttons (hidden on mobile) */}
              <div className="hidden sm:flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-primary hover:bg-primary/10"
                  onClick={handleInputGrades}
                  title="Input Nilai"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  onClick={() => setShowShareDialog(true)}
                  title="Bagikan Link"
                >
                  <Link2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setShowEditDialog(true)}
                  title="Edit"
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  title="Hapus"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              {/* Mobile: Dropdown menu (visible on mobile) */}
              <div className="sm:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={handleInputGrades} className="gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-primary" />
                      <span>Input Nilai</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowShareDialog(true)} className="gap-2">
                      <Link2 className="w-4 h-4 text-blue-600" />
                      <span>Bagikan Link</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowEditDialog(true)} className="gap-2">
                      <Edit className="w-4 h-4" />
                      <span>Edit Mapel</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => setShowDeleteDialog(true)} 
                      className="gap-2 text-destructive focus:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Hapus Mapel</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Mata Pelajaran?</AlertDialogTitle>
            <AlertDialogDescription>
              Anda yakin ingin menghapus mata pelajaran <strong>{subject.name}</strong>?
              Semua data BAB dan nilai terkait akan ikut terhapus.
              Tindakan ini tidak dapat dibatalkan.
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
      <EditSubjectDialog
        subject={subject}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />

      {/* Share Link Dialog */}
      <ShareLinkDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        subjectId={subject.id}
        subjectName={subject.name}
        classId={subject.class_id}
        className={className || ""}
      />
    </>
  );
}
