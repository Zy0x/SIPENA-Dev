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
import { BookOpen, Edit, Trash2, FileSpreadsheet, Link2 } from "lucide-react";
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
  const { deleteSubject } = useSubjects(subject.class_id, true, false);

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
      <Card
        data-tour="subject-card"
        role="button"
        tabIndex={0}
        onClick={handleInputGrades}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleInputGrades();
          }
        }}
        className="group h-full min-w-0 cursor-pointer overflow-hidden border-border/70 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <CardContent className="flex h-full min-h-[11.75rem] flex-col gap-3 p-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/10">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-2 break-words text-base font-semibold leading-tight text-foreground">
                {subject.name}
              </h3>
              {showClassName && className && (
                <p className="mt-1 truncate text-xs text-muted-foreground">{className}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">KKM</span>
                <Badge variant={getKkmVariant(subject.kkm)} className="px-2 py-0.5 text-xs">
                  {subject.kkm}
                </Badge>
                {subject.is_custom && <Badge variant="outline" className="px-2 py-0.5 text-xs">Custom</Badge>}
              </div>
            </div>
          </div>

          <div className="mt-auto grid min-w-0 gap-2">
            <Button
              type="button"
              className="h-11 w-full min-w-0 gap-2 rounded-xl px-3"
              onClick={(event) => {
                event.stopPropagation();
                handleInputGrades();
              }}
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span className="min-w-0 truncate">Input Nilai</span>
            </Button>
            <div data-tour="subject-card-actions" className="grid min-w-0 grid-cols-3 gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 min-w-0 gap-1.5 rounded-xl px-2 text-xs sm:text-sm"
                aria-label="Bagikan link mata pelajaran"
                onClick={(event) => {
                  event.stopPropagation();
                  setShowShareDialog(true);
                }}
              >
                <Link2 className="h-4 w-4 flex-shrink-0 text-blue-600" />
                <span className="min-w-0 truncate">Bagikan</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 min-w-0 gap-1.5 rounded-xl px-2 text-xs sm:text-sm"
                aria-label="Edit mata pelajaran"
                onClick={(event) => {
                  event.stopPropagation();
                  setShowEditDialog(true);
                }}
              >
                <Edit className="h-4 w-4 flex-shrink-0" />
                <span className="min-w-0 truncate">Edit</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 min-w-0 gap-1.5 rounded-xl border-destructive/30 px-2 text-xs text-destructive hover:bg-destructive/10 sm:text-sm"
                aria-label="Hapus mata pelajaran"
                onClick={(event) => {
                  event.stopPropagation();
                  setShowDeleteDialog(true);
                }}
              >
                <Trash2 className="h-4 w-4 flex-shrink-0" />
                <span className="min-w-0 truncate">Hapus</span>
              </Button>
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
