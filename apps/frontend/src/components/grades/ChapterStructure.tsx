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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
          <div className="space-y-3">
            {chapters.map((chapter, chapterIndex) => {
              const chapterAssignments = assignments[chapter.id] || [];
              const isExpanded = expandedChapters.has(chapter.id);
              const isEditingChapter = editingChapter === chapter.id;
              const chapterAccent = [
                "border-l-blue-500 bg-blue-500/[0.03]",
                "border-l-emerald-500 bg-emerald-500/[0.03]",
                "border-l-amber-500 bg-amber-500/[0.03]",
                "border-l-violet-500 bg-violet-500/[0.03]",
              ][chapterIndex % 4];

              return (
                <Collapsible
                  key={chapter.id}
                  open={isExpanded}
                  onOpenChange={() => toggleChapter(chapter.id)}
                >
                  <div
                    className={cn("overflow-hidden rounded-lg border border-l-4", chapterAccent)}
                    data-tour={chapterIndex === 0 ? "grade-chapter-card" : undefined}
                  >
                    {isEditingChapter ? (
                      <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-2 bg-muted/50 p-3 max-[420px]:grid-cols-1 sm:gap-3">
                        <ChevronDown className="mt-3 h-4 w-4 shrink-0 text-muted-foreground max-[420px]:hidden" />
                        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 max-[820px]:grid-cols-1">
                          <Input
                            value={editValue}
                            onChange={(event) => setEditValue(event.target.value)}
                            className="h-10 min-w-0 w-full px-3"
                            autoFocus
                            aria-label="Nama BAB"
                            onKeyDown={(event) => {
                              if (event.key === "Enter") handleSaveChapter(chapter.id);
                              if (event.key === "Escape") handleCancelChapter();
                            }}
                          />
                          <div className="flex shrink-0 justify-end gap-1 max-[820px]:border-t max-[820px]:pt-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 shrink-0"
                              onClick={() => handleSaveChapter(chapter.id)}
                              aria-label="Simpan nama BAB"
                              title="Simpan"
                            >
                              <Check className="h-4 w-4 text-grade-pass" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 shrink-0"
                              onClick={handleCancelChapter}
                              aria-label="Batal mengedit nama BAB"
                              title="Batal"
                            >
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 bg-muted/35 p-2 transition-colors hover:bg-muted/55 max-[420px]:grid-cols-1 sm:p-3">
                        <CollapsibleTrigger asChild>
                          <button
                            type="button"
                            className="flex min-h-10 min-w-0 items-center gap-2 rounded-md px-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:gap-3"
                            aria-label={`${isExpanded ? "Tutup" : "Buka"} ${chapter.name}`}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                            )}
                            <Badge variant="outline" className="shrink-0 border-primary/30 bg-background/80 text-[10px] font-semibold uppercase text-primary">
                              BAB
                            </Badge>
                            <span className="min-w-0 flex-1 break-words font-medium">{chapter.name}</span>
                            <Badge variant="secondary" className="shrink-0 text-xs">
                              {chapterAssignments.length} tugas
                            </Badge>
                          </button>
                        </CollapsibleTrigger>

                        <div
                          className="flex shrink-0 justify-end gap-1 rounded-md bg-background/75 p-0.5 max-[420px]:border-t max-[420px]:pt-2"
                          role="group"
                          aria-label={`Aksi BAB ${chapter.name}`}
                          data-tour={chapterIndex === 0 ? "grade-chapter-actions" : undefined}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 sm:h-9 sm:w-9"
                            onClick={() => handleEditChapter(chapter)}
                            aria-label="Edit nama BAB"
                            title="Edit nama BAB"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 text-destructive hover:text-destructive sm:h-9 sm:w-9"
                                aria-label="Hapus BAB"
                                title="Hapus BAB"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Hapus BAB?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Menghapus "{chapter.name}" akan menghapus semua tugas dan nilai terkait.
                                  Tindakan ini tidak dapat dibatalkan.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => onDeleteChapter(chapter.id)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  Hapus
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    )}

                    <CollapsibleContent>
                      <div className="space-y-2 bg-background p-2 sm:p-3">
                        {chapterAssignments.map((assignment) => {
                          const isEditingAssignment = editingAssignment === assignment.id;

                          return (
                            <div
                              key={assignment.id}
                              className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md border-l-2 border-l-muted-foreground/25 bg-muted/20 p-2 transition-colors hover:bg-muted/40 max-[420px]:grid-cols-1"
                              data-tour={chapterIndex === 0 && chapterAssignments[0]?.id === assignment.id ? "grade-assignment-row" : undefined}
                            >
                              <div className="flex min-w-0 items-start gap-2">
                                <FileText
                                  className={cn(
                                    "h-4 w-4 shrink-0 text-muted-foreground",
                                    isEditingAssignment ? "mt-3 max-[420px]:hidden" : "mt-2.5",
                                  )}
                                />
                                {isEditingAssignment ? (
                                  <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 max-[820px]:grid-cols-1">
                                    <Input
                                      value={editValue}
                                      onChange={(event) => setEditValue(event.target.value)}
                                      className="h-10 min-w-0 w-full px-3"
                                      autoFocus
                                      aria-label="Nama tugas"
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter") handleSaveAssignment(assignment.id);
                                        if (event.key === "Escape") handleCancelAssignment();
                                      }}
                                    />
                                    <div className="flex shrink-0 justify-end gap-1 max-[820px]:border-t max-[820px]:pt-2">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-10 w-10 shrink-0"
                                        onClick={() => handleSaveAssignment(assignment.id)}
                                        aria-label="Simpan nama tugas"
                                        title="Simpan"
                                      >
                                        <Check className="h-4 w-4 text-grade-pass" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-10 w-10 shrink-0"
                                        onClick={handleCancelAssignment}
                                        aria-label="Batal mengedit nama tugas"
                                        title="Batal"
                                      >
                                        <X className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="min-w-0 flex-1 py-1.5">
                                    <span className="mb-0.5 block text-[10px] font-semibold uppercase text-muted-foreground">Tugas</span>
                                    <span className="block min-w-0 break-words text-sm">{assignment.name}</span>
                                  </div>
                                )}
                              </div>

                              {!isEditingAssignment && (
                                <div
                                  className="flex shrink-0 justify-end gap-1 rounded-md border border-border/70 bg-background/80 p-0.5 max-[420px]:border-t max-[420px]:pt-2"
                                  role="group"
                                  aria-label={`Aksi tugas ${assignment.name}`}
                                >
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-10 w-10 sm:h-9 sm:w-9"
                                    onClick={() => handleEditAssignment(assignment)}
                                    aria-label="Edit nama tugas"
                                    title="Edit nama tugas"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-10 w-10 text-destructive hover:text-destructive sm:h-9 sm:w-9"
                                        aria-label="Hapus tugas"
                                        title="Hapus tugas"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Hapus Tugas?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Menghapus "{assignment.name}" akan menghapus semua nilai terkait.
                                          Tindakan ini tidak dapat dibatalkan.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Batal</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => onDeleteAssignment(assignment.id)}
                                          className="bg-destructive hover:bg-destructive/90"
                                        >
                                          Hapus
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 min-h-10 w-full gap-2"
                          onClick={() => handleAddAssignment(chapter)}
                        >
                          <Plus className="h-4 w-4" />
                          Tambah Tugas
                        </Button>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        )}
      </CardContent>

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
