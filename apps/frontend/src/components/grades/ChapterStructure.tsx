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
}: ChapterStructureProps) {
  const [addChapterOpen, setAddChapterOpen] = useState(false);
  const [addAssignmentOpen, setAddAssignmentOpen] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [editingChapter, setEditingChapter] = useState<string | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  };

  const handleEditChapter = (chapter: Chapter) => {
    setEditingChapter(chapter.id);
    setEditValue(chapter.name);
  };

  const handleSaveChapter = (id: string) => {
    if (editValue.trim()) {
      onUpdateChapter(id, editValue.trim());
    }
    setEditingChapter(null);
    setEditValue("");
  };

  const handleEditAssignment = (assignment: Assignment) => {
    setEditingAssignment(assignment.id);
    setEditValue(assignment.name);
  };

  const handleSaveAssignment = (id: string) => {
    if (editValue.trim()) {
      onUpdateAssignment(id, editValue.trim());
    }
    setEditingAssignment(null);
    setEditValue("");
  };

  const handleAddAssignment = (chapter: Chapter) => {
    setSelectedChapter(chapter);
    setAddAssignmentOpen(true);
  };

  const totalAssignments = Object.values(assignments).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Struktur BAB & Tugas</CardTitle>
              <p className="text-sm text-muted-foreground">
                {chapters.length} BAB • {totalAssignments} Tugas
              </p>
            </div>
          </div>
          <Button onClick={() => setAddChapterOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Tambah BAB
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {chapters.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">Belum ada BAB</p>
            <p className="text-sm">Tambahkan BAB untuk mulai input nilai tugas</p>
          </div>
        ) : (
          <div className="space-y-3">
            {chapters.map((chapter) => (
              <Collapsible
                key={chapter.id}
                open={expandedChapters.has(chapter.id)}
                onOpenChange={() => toggleChapter(chapter.id)}
              >
                <div className="border rounded-lg overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-3 bg-muted/50 hover:bg-muted/80 cursor-pointer transition-colors">
                      <div className="flex items-center gap-3">
                        {expandedChapters.has(chapter.id) ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                        {editingChapter === chapter.id ? (
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <Input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="h-8 w-40"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveChapter(chapter.id);
                                if (e.key === "Escape") setEditingChapter(null);
                              }}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleSaveChapter(chapter.id)}
                            >
                              <Check className="w-4 h-4 text-grade-pass" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setEditingChapter(null)}
                            >
                              <X className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        ) : (
                          <span className="font-medium">{chapter.name}</span>
                        )}
                        <Badge variant="secondary" className="text-xs">
                          {assignments[chapter.id]?.length || 0} tugas
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEditChapter(chapter)}
                          aria-label="Edit nama BAB"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              aria-label="Hapus BAB"
                            >
                              <Trash2 className="w-4 h-4" />
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
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="p-3 space-y-2 bg-background">
                      {(assignments[chapter.id] || []).map((assignment) => (
                        <div
                          key={assignment.id}
                          className="flex items-center justify-between p-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-muted-foreground" />
                            {editingAssignment === assignment.id ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="h-7 w-32"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSaveAssignment(assignment.id);
                                    if (e.key === "Escape") setEditingAssignment(null);
                                  }}
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleSaveAssignment(assignment.id)}
                                >
                                  <Check className="w-3 h-3 text-grade-pass" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => setEditingAssignment(null)}
                                >
                                  <X className="w-3 h-3 text-destructive" />
                                </Button>
                              </div>
                            ) : (
                              <span className="text-sm">{assignment.name}</span>
                            )}
                          </div>
                          {editingAssignment !== assignment.id && (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleEditAssignment(assignment)}
                                aria-label="Edit nama tugas"
                              >
                                <Edit2 className="w-3 h-3" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                    aria-label="Hapus tugas"
                                  >
                                    <Trash2 className="w-3 h-3" />
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
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2 mt-2"
                        onClick={() => handleAddAssignment(chapter)}
                      >
                        <Plus className="w-4 h-4" />
                        Tambah Tugas
                      </Button>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
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
