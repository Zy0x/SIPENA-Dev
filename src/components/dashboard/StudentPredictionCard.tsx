import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, Sparkles, Zap, Clock, Infinity } from "lucide-react";
import { GradePrediction } from "@/components/grades/GradePrediction";
import { useClasses } from "@/hooks/useClasses";
import { useStudents } from "@/hooks/useStudents";
import { useSubjects } from "@/hooks/useSubjects";
import { MORPHE_MODELS } from "@/hooks/useMorpheChat";

// Hanya tampilkan model Production yang stabil untuk prediksi nilai
const PREDICTION_MODELS = MORPHE_MODELS.filter(
  (m) => m.group === "Production" || m.group === "Reasoning"
);

export function StudentPredictionCard() {
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>(
    "llama-3.3-70b-versatile"
  );
  const [isOpen, setIsOpen] = useState(false);

  const { classes } = useClasses();
  const { students } = useStudents(selectedClassId);
  const { subjects } = useSubjects(selectedClassId);

  const selectedStudent = students.find((s) => s.id === selectedStudentId);
  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);
  const currentModel = MORPHE_MODELS.find((m) => m.id === selectedModel);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setSelectedClassId("");
      setSelectedStudentId("");
      setSelectedSubjectId("");
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="p-3 sm:p-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
            <Brain className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-sm sm:text-lg truncate">
              Prediksi Nilai AI
            </CardTitle>
            <CardDescription className="text-[10px] sm:text-sm truncate">
              Powered by Morphe · Groq
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button className="w-full gap-2 text-xs sm:text-sm">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Buka Prediksi AI
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                Prediksi Nilai Siswa
              </DialogTitle>
              <DialogDescription>
                Pilih kelas, siswa, dan mata pelajaran untuk melihat prediksi
                nilai AI
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Model Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  Model AI
                </label>
                <Select
                  value={selectedModel}
                  onValueChange={setSelectedModel}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih model AI" />
                  </SelectTrigger>
                  <SelectContent>
                    {PREDICTION_MODELS.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        <div className="flex items-center gap-2">
                          <span>{model.label}</span>
                          {model.recommended && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-1"
                            >
                              ★
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {currentModel && (
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline" className="gap-1">
                      <Clock className="w-3 h-3" />
                      {currentModel.speed}
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <Infinity className="w-3 h-3" />
                      {currentModel.ctx}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Class Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Pilih Kelas</label>
                <Select
                  value={selectedClassId}
                  onValueChange={(v) => {
                    setSelectedClassId(v);
                    setSelectedStudentId("");
                    setSelectedSubjectId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kelas" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedClassId && (
                <div className="space-y-2 animate-fade-in">
                  <label className="text-sm font-medium">Pilih Siswa</label>
                  <Select
                    value={selectedStudentId}
                    onValueChange={setSelectedStudentId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih siswa" />
                    </SelectTrigger>
                    <SelectContent>
                      <ScrollArea className="h-48">
                        {students.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </ScrollArea>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedStudentId && (
                <div className="space-y-2 animate-fade-in">
                  <label className="text-sm font-medium">
                    Pilih Mata Pelajaran
                  </label>
                  <Select
                    value={selectedSubjectId}
                    onValueChange={setSelectedSubjectId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih mata pelajaran" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} (KKM: {s.kkm})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedStudentId &&
                selectedSubjectId &&
                selectedStudent &&
                selectedSubject && (
                  <div className="animate-fade-in pt-2">
                    <GradePrediction
                      studentId={selectedStudentId}
                      studentName={selectedStudent.name}
                      subjectId={selectedSubjectId}
                      subjectName={selectedSubject.name}
                      kkm={selectedSubject.kkm}
                      modelId={selectedModel}
                    />
                  </div>
                )}
            </div>
          </DialogContent>
        </Dialog>

        <div className="mt-3 sm:mt-4 flex items-center justify-center gap-2 text-xs sm:text-sm text-muted-foreground">
          <Badge
            variant="outline"
            className="gap-1 text-[10px] sm:text-xs"
          >
            <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            Powered by Morphe · Groq
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}