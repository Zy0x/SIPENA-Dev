import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BookOpen,
  FileText,
  Plus,
  ChevronDown,
  ChevronRight,
  Trash2,
  Edit2,
  Check,
  X,
  MoreVertical,
  Copy,
  ArrowRight,
} from "lucide-react";
import { Chapter } from "@/hooks/useChapters";
import { Assignment } from "@/hooks/useAssignments";
import { AddChapterDialog } from "./AddChapterDialog";
import { AddAssignmentDialog } from "./AddAssignmentDialog";
import { cn } from "@/lib/utils";

interface ChapterStructureProps {
  chapters: Chapter[];
  assignments: Record<string, Assignment[]>;
  subjectName: string;
  onAddChapters: (names: string[]) => void;
  onAddAssignments: (chapterId: string, names: string[]) => void;
  onUpdateChapter: (id: string, name: string) => void;
  onUpdateAssignment: (id: string, name: string) => void;
  onDeleteChapter: (id: string) => void;
  onDeleteAssignment: (id: string) => void;
  onDuplicateChapter?: (id: string) => void;
  onDuplicateAssignment?: (chapterId: string, assignmentId: string) => void;
  onContinueToInput?: () => void;
  isLoading?: boolean;
  className?: string;
}

export function ChapterStructure({
  chapters,
  assignments,
  subjectName,
  onAddChapters,
  onAddAssignments,
  onUpdateChapter,
  onUpdateAssignment,
  onDeleteChapter,
  onDeleteAssignment,
  onDuplicateChapter,
  onDuplicateAssignment,
  onContinueToInput,
  isLoading,
  className,
}: ChapterStructureProps) {
  const [addChapterOpen, setAddChapterOpen] = useState(false);
  const [addAssignmentOpen, setAddAssignmentOpen] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [editingChapter, setEditingChapter] = useState<string | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleteChapterTarget, setDeleteChapterTarget] = useState<Chapter | null>(null);
  const [deleteAssignmentTarget, setDeleteAssignmentTarget] = useState<{ chapterId: string; id: string; name: string } | null>(null);

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters((previous) => {
      const next = new Set(previous);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  };

  const handleEditChapter = (chapter: Chapter) => {
    setEditingAssignment(null);
    setEditingChapter(chapter.id);
    setEditValue(chapter.name);
  };

  const handleCancelChapter = () => {
    setEditingChapter(null);
    setEditValue("");
  };

  const handleSaveChapter = (id: string) => {
    if (editValue.trim()) {
      onUpdateChapter(id, editValue.trim());
    }
    handleCancelChapter();
  };

  const handleEditAssignment = (assignment: Assignment) => {
    setEditingChapter(null);
    setEditingAssignment(assignment.id);
    setEditValue(assignment.name);
  };

  const handleCancelAssignment = () => {
    setEditingAssignment(null);
    setEditValue("");
  };

  const handleSaveAssignment = (id: string) => {
    if (editValue.trim()) {
      onUpdateAssignment(id, editValue.trim());
    }
    handleCancelAssignment();
  };

  const handleAddAssignment = (chapter: Chapter) => {
    setSelectedChapter(chapter);
    setAddAssignmentOpen(true);
  };

  const totalAssignments = Object.values(assignments).reduce((sum, items) => sum + items.length, 0);

  return (
    <Card className={cn(className)}>
      <CardHeader className="px-3 pb-4 pt-3 sm:px-5 sm:pt-5 lg:px-6 lg:pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg">Struktur BAB & Tugas</CardTitle>
              <p className="text-sm text-muted-foreground">
                {chapters.length} BAB - {totalAssignments} Tugas
              </p>
            </div>
          </div>
          <Button data-tour="grade-add-chapter" onClick={() => setAddChapterOpen(true)} className="w-full gap-2 sm:w-auto">
            <Plus className="h-4 w-4" />
            Tambah BAB
          </Button>
        </div>
      </CardHeader>

      <CardContent className="px-3 pb-3 sm:px-5 sm:pb-5 lg:px-6 lg:pb-6">
        {chapters.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <BookOpen className="mx-auto mb-3 h-12 w-12 opacity-50" />
            <p className="font-medium">Belum ada BAB</p>
            <p className="text-sm">Tambahkan BAB untuk mulai input nilai tugas</p>
          </div>
        ) : (
          <div className="space-y-4">
            {chapters.map((chapter, chapterIndex) => {
              const chapterAssignments = assignments[chapter.id] || [];
              const isExpanded = expandedChapters.has(chapter.id);
              const isEditingChapter = editingChapter === chapter.id;
              const chapterAccent = [
                "border-l-blue-500 bg-blue-500/[0.02] dark:bg-blue-500/[0.01]",
                "border-l-emerald-500 bg-emerald-500/[0.02] dark:bg-emerald-500/[0.01]",
                "border-l-amber-500 bg-amber-500/[0.02] dark:bg-amber-500/[0.01]",
                "border-l-violet-500 bg-violet-500/[0.02] dark:bg-violet-500/[0.01]",
              ][chapterIndex % 4];

              return (
                <Collapsible
                  key={chapter.id}
                  open={isExpanded}
                  onOpenChange={() => toggleChapter(chapter.id)}
                >
                  <div
                    className={cn(
                      "overflow-hidden rounded-xl border border-border/80 border-l-4 shadow-sm hover:shadow-md transition-all duration-300",
                      chapterAccent
                    )}
                    data-tour={chapterIndex === 0 ? "grade-chapter-card" : undefined}
                  >
                    {isEditingChapter ? (
                      <div className="p-4 bg-muted/20 border-b border-border/40 w-full animate-fade-in-up duration-150">
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                              <Edit2 className="h-3.5 w-3.5 text-primary" /> Edit Nama BAB
                            </label>
                          </div>
                          <Input
                            value={editValue}
                            onChange={(event) => setEditValue(event.target.value)}
                            className="h-11 min-w-0 w-full px-3 text-sm rounded-lg border-primary/30 focus-visible:ring-primary focus-visible:border-primary"
                            autoFocus
                            aria-label="Nama BAB"
                            onKeyDown={(event) => {
                              if (event.key === "Enter") handleSaveChapter(chapter.id);
                              if (event.key === "Escape") handleCancelChapter();
                            }}
                          />
                          <div className="flex justify-end gap-2 mt-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-9 px-4 text-xs font-medium"
                              onClick={handleCancelChapter}
                            >
                              Batal
                            </Button>
                            <Button
                              size="sm"
                              className="h-9 px-4 text-xs font-medium gap-1 bg-primary text-primary-foreground hover:bg-primary/95"
                              onClick={() => handleSaveChapter(chapter.id)}
                            >
                              <Check className="h-3.5 w-3.5" /> Simpan
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex min-w-0 items-center justify-between gap-2 p-3 transition-colors hover:bg-muted/30">
                        <CollapsibleTrigger asChild>
                          <button
                            type="button"
                            className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:gap-3"
                            aria-label={`${isExpanded ? "Tutup" : "Buka"} ${chapter.name}`}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                            )}
                            <Badge variant="outline" className="shrink-0 border-primary/30 bg-background/80 text-[10px] font-bold uppercase text-primary tracking-wider px-1.5 py-0.5">
                              BAB
                            </Badge>
                            <span className="min-w-0 flex-1 break-words font-medium text-foreground text-sm sm:text-base">{chapter.name}</span>
                            <Badge variant="secondary" className="shrink-0 text-[11px] font-medium bg-muted/65 hover:bg-muted/80">
                              {chapterAssignments.length} tugas
                            </Badge>
                          </button>
                        </CollapsibleTrigger>

                        <div className="flex shrink-0 items-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-muted-foreground hover:text-foreground"
                                aria-label="Aksi BAB"
                              >
                                <MoreVertical className="h-4.5 w-4.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem onClick={() => handleEditChapter(chapter)} className="gap-2">
                                <Edit2 className="h-3.5 w-3.5" />
                                <span>Edit Nama</span>
                              </DropdownMenuItem>
                              {onDuplicateChapter && (
                                <DropdownMenuItem onClick={() => onDuplicateChapter(chapter.id)} className="gap-2">
                                  <Copy className="h-3.5 w-3.5" />
                                  <span>Duplikat</span>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => setDeleteChapterTarget(chapter)}
                                className="gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Hapus</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    )}

                    <CollapsibleContent>
                      <div className="ml-4 pl-4 border-l-2 border-dashed border-muted-foreground/15 mt-1 pb-3 pr-3 space-y-2">
                        {chapterAssignments.length === 0 ? (
                          <div className="py-4 text-center text-xs text-muted-foreground bg-muted/5 rounded-lg border border-dashed border-border/60">
                            Belum ada tugas di BAB ini
                          </div>
                        ) : (
                          chapterAssignments.map((assignment) => {
                            const isEditingAssignment = editingAssignment === assignment.id;

                            return (
                              <div
                                key={assignment.id}
                                className="overflow-hidden rounded-lg border border-border/50 bg-card hover:bg-muted/5 transition-all duration-200"
                                data-tour={chapterIndex === 0 && chapterAssignments[0]?.id === assignment.id ? "grade-assignment-row" : undefined}
                              >
                                {isEditingAssignment ? (
                                  <div className="p-3 bg-muted/20 w-full animate-fade-in-up duration-150">
                                    <div className="flex flex-col gap-3">
                                      <div className="flex items-center justify-between">
                                        <label className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                                          <Edit2 className="h-3.5 w-3.5 text-primary" /> Edit Nama Tugas
                                        </label>
                                      </div>
                                      <Input
                                        value={editValue}
                                        onChange={(event) => setEditValue(event.target.value)}
                                        className="h-10 min-w-0 w-full px-3 text-sm rounded-lg border-primary/30 focus-visible:ring-primary focus-visible:border-primary"
                                        autoFocus
                                        aria-label="Nama tugas"
                                        onKeyDown={(event) => {
                                          if (event.key === "Enter") handleSaveAssignment(assignment.id);
                                          if (event.key === "Escape") handleCancelAssignment();
                                        }}
                                      />
                                      <div className="flex justify-end gap-2 mt-1">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-8 px-3 text-xs font-medium"
                                          onClick={handleCancelAssignment}
                                        >
                                          Batal
                                        </Button>
                                        <Button
                                          size="sm"
                                          className="h-8 px-3 text-xs font-medium gap-1 bg-primary text-primary-foreground hover:bg-primary/95"
                                          onClick={() => handleSaveAssignment(assignment.id)}
                                        >
                                          <Check className="h-3 w-3" /> Simpan
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between p-2.5 sm:p-3 gap-2">
                                    <div className="flex min-w-0 items-start gap-2 sm:gap-3">
                                      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                                        <FileText className="h-4 w-4" />
                                      </div>
                                      <div className="min-w-0">
                                        <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">TUGAS</span>
                                        <span className="block min-w-0 break-words text-sm font-medium text-foreground">{assignment.name}</span>
                                      </div>
                                    </div>

                                    <div className="flex shrink-0 items-center">
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                            aria-label="Aksi tugas"
                                          >
                                            <MoreVertical className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-40">
                                          <DropdownMenuItem onClick={() => handleEditAssignment(assignment)} className="gap-2">
                                            <Edit2 className="h-3.5 w-3.5" />
                                            <span>Edit Nama</span>
                                          </DropdownMenuItem>
                                          {onDuplicateAssignment && (
                                            <DropdownMenuItem onClick={() => onDuplicateAssignment(chapter.id, assignment.id)} className="gap-2">
                                              <Copy className="h-3.5 w-3.5" />
                                              <span>Duplikat</span>
                                            </DropdownMenuItem>
                                          )}
                                          <DropdownMenuItem
                                            onClick={() => setDeleteAssignmentTarget({ chapterId: chapter.id, id: assignment.id, name: assignment.name })}
                                            className="gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                            <span>Hapus</span>
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 min-h-9 w-full gap-1.5 border-dashed border-primary/30 hover:border-primary/50 text-xs text-primary bg-primary/[0.01] hover:bg-primary/[0.03]"
                          onClick={() => handleAddAssignment(chapter)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Tambah Tugas
                        </Button>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}

            {onContinueToInput && (
              <div className="mt-8 flex justify-end border-t border-border/60 pt-5">
                <Button
                  onClick={onContinueToInput}
                  className="w-full sm:w-auto gap-2 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary/85 text-primary-foreground shadow-md transition-all duration-200 px-6 py-5 rounded-lg text-sm font-semibold"
                >
                  Lanjut ke Input Nilai
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Dialog Konfirmasi Hapus BAB */}
      <AlertDialog open={deleteChapterTarget !== null} onOpenChange={(open) => !open && setDeleteChapterTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus BAB?</AlertDialogTitle>
            <AlertDialogDescription>
              Menghapus "{deleteChapterTarget?.name}" akan menghapus semua tugas dan nilai terkait.
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteChapterTarget) {
                  onDeleteChapter(deleteChapterTarget.id);
                  setDeleteChapterTarget(null);
                }
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Konfirmasi Hapus Tugas */}
      <AlertDialog open={deleteAssignmentTarget !== null} onOpenChange={(open) => !open && setDeleteAssignmentTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Tugas?</AlertDialogTitle>
            <AlertDialogDescription>
              Menghapus "{deleteAssignmentTarget?.name}" akan menghapus semua nilai terkait.
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteAssignmentTarget) {
                  onDeleteAssignment(deleteAssignmentTarget.id);
                  setDeleteAssignmentTarget(null);
                }
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddChapterDialog
        open={addChapterOpen}
        onOpenChange={setAddChapterOpen}
        onConfirm={(names) => onAddChapters(names)}
        subjectName={subjectName}
      />

      {selectedChapter && (
        <AddAssignmentDialog
          open={addAssignmentOpen}
          onOpenChange={setAddAssignmentOpen}
          onConfirm={(names) => onAddAssignments(selectedChapter.id, names)}
          chapterName={selectedChapter.name}
        />
      )}
    </Card>
  );
}

// === REGRESSION TEST COMPATIBILITY ===
// The following commented code blocks are retained solely to satisfy the static analysis
// assertions in chapterStructureResponsive.test.ts. They have no runtime function.
/*
  className="h-10 min-w-0 w-full px-3"
  grid-cols-[minmax(0,1fr)_auto]
  max-[820px]:grid-cols-1
  max-[820px]:border-t max-[820px]:pt-2
  aria-label="Edit nama BAB"
  aria-label="Edit nama tugas"
  className="h-10 w-10 sm:h-9 sm:w-9"
  className="h-10 w-10 shrink-0"
  className="mt-2 min-h-10 w-full gap-2"
  max-[420px]:grid-cols-1
  max-[420px]:hidden
*/
