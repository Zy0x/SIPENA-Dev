import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Trophy,
  Medal,
  Award,
  Download,
  FileSpreadsheet,
  FileText,
  Crown,
  TrendingUp,
  Star,
} from "lucide-react";
import { useEnhancedToast } from "@/contexts/ToastContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface Student {
  id: string;
  name: string;
  nisn: string;
}

interface Subject {
  id: string;
  name: string;
  kkm: number;
}

interface Grade {
  id: string;
  student_id: string;
  subject_id: string;
  grade_type: string;
  value: number | null;
  assignment_id?: string;
}

interface RankingReportsSectionProps {
  students: Student[];
  subjects: Subject[];
  grades: Grade[];
  className: string;
  selectedClassId: string;
  classKkm?: number | null;
}

interface StudentRanking {
  student: Student;
  subjectGrades: Record<string, number>;
  overallAverage: number;
  rank: number;
}

export function RankingReportsSection({
  students,
  subjects,
  grades,
  className,
  selectedClassId,
  classKkm,
}: RankingReportsSectionProps) {
  const { toast } = useEnhancedToast();
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState<"pdf" | "excel">("pdf");
  const overallKkm = classKkm ?? 75;

  // Calculate grades per subject for each student
  const calculateSubjectAverage = (studentId: string, subjectId: string): number => {
    const studentGrades = grades.filter(
      (g) => g.student_id === studentId && g.subject_id === subjectId && g.value !== null
    );

    if (studentGrades.length === 0) return 0;

    // Get STS and SAS grades
    const stsGrade = studentGrades.find((g) => g.grade_type === "sts")?.value ?? 0;
    const sasGrade = studentGrades.find((g) => g.grade_type === "sas")?.value ?? 0;

    // Get assignment grades
    const assignmentGrades = studentGrades
      .filter((g) => g.grade_type === "assignment")
      .map((g) => g.value ?? 0);

    const assignmentAvg = assignmentGrades.length > 0
      ? assignmentGrades.reduce((sum, v) => sum + v, 0) / assignmentGrades.length
      : 0;

    // Calculate final score (simplified: avg of assignments, STS, SAS)
    const validScores = [assignmentAvg, stsGrade, sasGrade].filter((v) => v > 0);
    return validScores.length > 0
      ? validScores.reduce((sum, v) => sum + v, 0) / validScores.length
      : 0;
  };

  // Get ranking for a specific subject
  const getSubjectRanking = (subjectId: string): StudentRanking[] => {
    const rankings = students.map((student) => {
      const average = calculateSubjectAverage(student.id, subjectId);
      return {
        student,
        subjectGrades: { [subjectId]: average },
        overallAverage: average,
        rank: 0,
      };
    });

    // Sort by average descending and assign ranks
    rankings.sort((a, b) => b.overallAverage - a.overallAverage);
    rankings.forEach((r, index) => {
      r.rank = index + 1;
    });

    return rankings;
  };

  // Get overall ranking across selected subjects
  const getOverallRanking = (subjectIds: string[]): StudentRanking[] => {
    const subjectsToUse = subjectIds.length > 0 ? subjectIds : subjects.map((s) => s.id);

    const rankings = students.map((student) => {
      const subjectGrades: Record<string, number> = {};
      let totalScore = 0;
      let subjectCount = 0;

      subjectsToUse.forEach((subjectId) => {
        const avg = calculateSubjectAverage(student.id, subjectId);
        subjectGrades[subjectId] = avg;
        if (avg > 0) {
          totalScore += avg;
          subjectCount++;
        }
      });

      const overallAverage = subjectCount > 0 ? totalScore / subjectCount : 0;

      return {
        student,
        subjectGrades,
        overallAverage,
        rank: 0,
      };
    });

    // Sort and assign ranks
    rankings.sort((a, b) => b.overallAverage - a.overallAverage);
    rankings.forEach((r, index) => {
      r.rank = index + 1;
    });

    return rankings;
  };

  const overallRankings = useMemo(() => {
    return getOverallRanking(selectedSubjectIds);
  }, [students, subjects, grades, selectedSubjectIds]);

  const toggleSubjectSelection = (subjectId: string) => {
    setSelectedSubjectIds((prev) =>
      prev.includes(subjectId)
        ? prev.filter((id) => id !== subjectId)
        : [...prev, subjectId]
    );
  };

  const selectAllSubjects = () => {
    setSelectedSubjectIds(subjects.map((s) => s.id));
  };

  const clearSubjectSelection = () => {
    setSelectedSubjectIds([]);
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <Badge className="bg-gradient-to-r from-amber-500 to-yellow-400 text-white gap-1">
          <Crown className="w-3 h-3" />
          Juara 1
        </Badge>
      );
    }
    if (rank === 2) {
      return (
        <Badge className="bg-gradient-to-r from-gray-400 to-gray-300 text-gray-800 gap-1">
          <Medal className="w-3 h-3" />
          Juara 2
        </Badge>
      );
    }
    if (rank === 3) {
      return (
        <Badge className="bg-gradient-to-r from-amber-700 to-amber-600 text-white gap-1">
          <Award className="w-3 h-3" />
          Juara 3
        </Badge>
      );
    }
    return <span className="text-muted-foreground">{rank}</span>;
  };

  const formatGrade = (value: number): string => {
    if (value === 0) return "-";
    return Math.round(value * 10) / 10 + "";
  };

  // Export functions
  const exportSubjectRanking = (subjectId: string) => {
    const subject = subjects.find((s) => s.id === subjectId);
    if (!subject) return;

    const rankings = getSubjectRanking(subjectId);
    const fileName = `Ranking_${className}_${subject.name}`;
    const dateStr = new Date().toLocaleDateString("id-ID");

    const data = rankings.map((r) => ({
      Peringkat: r.rank,
      Nama: r.student.name,
      NISN: r.student.nisn,
      "Nilai Rata-rata": formatGrade(r.overallAverage),
      Status: r.overallAverage >= subject.kkm ? "Lulus" : "Belum Lulus",
    }));

    if (exportFormat === "pdf") {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.setFontSize(16);
      doc.text(`RANKING SISWA - ${subject.name}`, pageWidth / 2, 15, {
        align: "center",
      });
      doc.setFontSize(10);
      doc.text(`Kelas: ${className} | KKM: ${subject.kkm} | Tanggal: ${dateStr}`, 14, 25);

      const colKeys = Object.keys(data[0] || {});
      const colWidths: Record<number, object> = {};
      const usable = pageWidth - 20; // 10mm margin each side
      const totalCols = colKeys.length;
      // Fixed widths for No-like, Name, NISN columns
      const fixedW = [12, 55, 30, 25, 30]; // Peringkat, Nama, NISN, Nilai, Status
      const totalFixed = fixedW.reduce((s, w) => s + w, 0);
      const scale = totalCols === fixedW.length ? usable / totalFixed : 1;
      colKeys.forEach((_, idx) => {
        const baseW = idx < fixedW.length ? fixedW[idx] : 20;
        colWidths[idx] = {
          cellWidth: baseW * (totalCols === fixedW.length ? scale : 1),
          halign: idx === 1 ? 'left' : 'center',
          overflow: idx === 1 ? 'linebreak' : 'ellipsize',
          cellPadding: idx === 1 ? { top: 1, right: 2, bottom: 1, left: 2 } : 1.2,
        };
      });

      autoTable(doc, {
        head: [colKeys],
        body: data.map((row) => Object.values(row)),
        startY: 32,
        styles: { fontSize: 9, overflow: 'linebreak', valign: 'middle' },
        headStyles: { 
          fillColor: [59, 130, 246], 
          halign: 'center', 
          valign: 'middle',
          overflow: 'linebreak',
          cellPadding: { top: 1.5, right: 1, bottom: 1.5, left: 1 },
        },
        columnStyles: colWidths,
      });

      doc.save(`${fileName}.pdf`);
    } else {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Ranking");
      XLSX.writeFile(wb, `${fileName}.xlsx`);
    }

    toast({ title: "Ekspor berhasil", description: `File ${exportFormat.toUpperCase()} telah diunduh` });
  };

  const exportOverallRanking = () => {
    const fileName = `Ranking_Keseluruhan_${className}`;
    const dateStr = new Date().toLocaleDateString("id-ID");
    const subjectsToUse = selectedSubjectIds.length > 0
      ? subjects.filter((s) => selectedSubjectIds.includes(s.id))
      : subjects;

    const data = overallRankings.map((r) => {
      const row: Record<string, string | number> = {
        Peringkat: r.rank,
        Nama: r.student.name,
        NISN: r.student.nisn,
      };

      subjectsToUse.forEach((subject) => {
        row[subject.name] = formatGrade(r.subjectGrades[subject.id] || 0);
      });

      row["Rata-rata"] = formatGrade(r.overallAverage);

      return row;
    });

    if (exportFormat === "pdf") {
      const doc = new jsPDF({ orientation: "landscape" });
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.setFontSize(16);
      doc.text("RANKING KESELURUHAN SISWA", pageWidth / 2, 15, {
        align: "center",
      });
      doc.setFontSize(10);
      doc.text(
        `Kelas: ${className} | ${subjectsToUse.length} Mapel | Tanggal: ${dateStr}`,
        14,
        25
      );

      const colKeys = Object.keys(data[0] || {});
      const usable = pageWidth - 20;
      // Build header rows: level1 = group row, level2 = column names
      // Fixed: Peringkat, Nama, NISN should merge vertically (rowSpan=2)
      const fixedCount = 3; // Peringkat, Nama, NISN
      const hasSubjects = subjectsToUse.length > 0;
      
      if (hasSubjects) {
        // Multi-level: Row 1 has fixed cells with rowSpan + subject group header + "Rata-rata" rowSpan
        const level1: any[] = [];
        // Fixed cols with rowSpan
        for (let i = 0; i < fixedCount; i++) {
          level1.push({
            content: colKeys[i],
            rowSpan: 2,
            styles: { halign: 'center', valign: 'middle', fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold', overflow: 'linebreak', cellPadding: { top: 1.5, right: 1, bottom: 1.5, left: 1 } },
          });
        }
        // Subjects group header
        level1.push({
          content: 'Mata Pelajaran',
          colSpan: subjectsToUse.length,
          styles: { halign: 'center', valign: 'middle', fillColor: [14, 165, 233], textColor: [255, 255, 255], fontStyle: 'bold', overflow: 'linebreak' },
        });
        // Rata-rata with rowSpan
        level1.push({
          content: 'Rata-rata',
          rowSpan: 2,
          styles: { halign: 'center', valign: 'middle', fillColor: [124, 58, 237], textColor: [255, 255, 255], fontStyle: 'bold', overflow: 'linebreak' },
        });

        // Level 2: subject names only
        const level2 = subjectsToUse.map((s) => ({
          content: s.name,
          styles: { halign: 'center', valign: 'middle', fillColor: [59, 130, 246], textColor: [255, 255, 255], fontSize: 7, overflow: 'linebreak', cellPadding: { top: 1, right: 1, bottom: 1, left: 1 } },
        }));

        // Column widths: auto-fit to page
        const fixedWidths = [12, 45, 25];
        const avgWidth = 20;
        const fixedTotal = fixedWidths.reduce((s, w) => s + w, 0) + avgWidth;
        const subjectWidth = Math.max(12, (usable - fixedTotal) / subjectsToUse.length);
        const allWidths = [...fixedWidths, ...subjectsToUse.map(() => subjectWidth), avgWidth];
        const totalW = allWidths.reduce((s, w) => s + w, 0);
        const scaledWidths = allWidths.map((w) => (w / totalW) * usable);

        const columnStyles: Record<number, object> = {};
        colKeys.forEach((_, idx) => {
          columnStyles[idx] = {
            cellWidth: scaledWidths[idx],
            halign: idx === 1 ? 'left' : 'center',
            overflow: idx === 1 ? 'linebreak' : 'ellipsize',
            cellPadding: idx === 1 ? { top: 1, right: 2, bottom: 1, left: 2 } : 1.2,
          };
        });

        autoTable(doc, {
          head: [level1, level2],
          body: data.map((row) => Object.values(row)),
          startY: 32,
          styles: { fontSize: 8, overflow: 'linebreak', valign: 'middle' },
          headStyles: { fontSize: 8, overflow: 'linebreak' },
          columnStyles,
        });
      } else {
        autoTable(doc, {
          head: [colKeys],
          body: data.map((row) => Object.values(row)),
          startY: 32,
          styles: { fontSize: 8, overflow: 'linebreak', valign: 'middle' },
          headStyles: { fillColor: [59, 130, 246], halign: 'center', valign: 'middle', overflow: 'linebreak' },
        });
      }

      doc.save(`${fileName}.pdf`);
    } else {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Ranking Keseluruhan");
      XLSX.writeFile(wb, `${fileName}.xlsx`);
    }

    toast({ title: "Ekspor berhasil", description: `File ${exportFormat.toUpperCase()} telah diunduh` });
  };

  if (!selectedClassId || students.length === 0) {
    return null;
  }

  return (
    <Card className="animate-fade-in-up">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 
                            flex items-center justify-center shadow-lg">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Ranking Siswa</CardTitle>
              <CardDescription>Peringkat per mata pelajaran dan keseluruhan</CardDescription>
            </div>
          </div>

          {/* Export Format Toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant={exportFormat === "pdf" ? "default" : "outline"}
              size="sm"
              onClick={() => setExportFormat("pdf")}
              className="gap-1.5"
            >
              <FileText className="w-4 h-4" />
              PDF
            </Button>
            <Button
              variant={exportFormat === "excel" ? "default" : "outline"}
              size="sm"
              onClick={() => setExportFormat("excel")}
              className="gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Excel
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <Tabs defaultValue="overall" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="overall" className="gap-2">
              <Star className="w-4 h-4" />
              Ranking Keseluruhan
            </TabsTrigger>
            <TabsTrigger value="per-subject" className="gap-2">
              <TrendingUp className="w-4 h-4" />
              Per Mata Pelajaran
            </TabsTrigger>
          </TabsList>

          {/* Overall Ranking Tab */}
          <TabsContent value="overall" className="space-y-4 mt-4">
            {/* Subject Selection for Overall */}
            <div className="p-4 bg-muted/50 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Pilih Mata Pelajaran untuk Dihitung:</Label>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={selectAllSubjects}>
                    Pilih Semua
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearSubjectSelection}>
                    Hapus Pilihan
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {subjects.map((subject) => (
                  <div
                    key={subject.id}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer 
                               transition-all ${
                      selectedSubjectIds.includes(subject.id)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted"
                    }`}
                    onClick={() => toggleSubjectSelection(subject.id)}
                  >
                    <Checkbox
                      checked={selectedSubjectIds.includes(subject.id)}
                      className="pointer-events-none"
                    />
                    <span className="text-sm">{subject.name}</span>
                  </div>
                ))}
              </div>
              {selectedSubjectIds.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  * Jika tidak ada yang dipilih, semua mata pelajaran akan dihitung
                </p>
              )}
            </div>

            {/* Overall Ranking Table */}
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Ranking</TableHead>
                    <TableHead className="min-w-[150px]">Nama Siswa</TableHead>
                    <TableHead>NISN</TableHead>
                    {(selectedSubjectIds.length > 0
                      ? subjects.filter((s) => selectedSubjectIds.includes(s.id))
                      : subjects
                    ).map((subject) => (
                      <TableHead key={subject.id} className="text-center w-20">
                        {subject.name}
                      </TableHead>
                    ))}
                    <TableHead className="text-center w-24 bg-primary/10 font-semibold">
                      Rata-rata
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overallRankings.slice(0, 20).map((ranking) => (
                    <TableRow
                      key={ranking.student.id}
                      className={ranking.rank <= 3 ? "bg-gradient-to-r from-amber-500/5 to-transparent" : ""}
                    >
                      <TableCell className="font-medium">{getRankBadge(ranking.rank)}</TableCell>
                      <TableCell className="font-medium">{ranking.student.name}</TableCell>
                      <TableCell className="text-muted-foreground">{ranking.student.nisn}</TableCell>
                      {(selectedSubjectIds.length > 0
                        ? subjects.filter((s) => selectedSubjectIds.includes(s.id))
                        : subjects
                      ).map((subject) => (
                        <TableCell
                          key={subject.id}
                          className={`text-center ${
                            (ranking.subjectGrades[subject.id] || 0) >= subject.kkm ? "text-grade-pass" : "text-grade-fail"
                          }`}
                        >
                          {formatGrade(ranking.subjectGrades[subject.id] || 0)}
                        </TableCell>
                      ))}
                      <TableCell
                        className={`text-center bg-primary/10 font-bold ${
                          ranking.overallAverage >= overallKkm ? "text-grade-pass" : "text-grade-fail"
                        }`}
                      >
                        {formatGrade(ranking.overallAverage)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Export Button for Overall */}
            <div className="flex justify-end">
              <Button onClick={exportOverallRanking} className="gap-2">
                <Download className="w-4 h-4" />
                Ekspor Ranking Keseluruhan
              </Button>
            </div>
          </TabsContent>

          {/* Per Subject Ranking Tab */}
          <TabsContent value="per-subject" className="space-y-4 mt-4">
            {subjects.map((subject) => {
              const rankings = getSubjectRanking(subject.id);
              const top5 = rankings.slice(0, 5);

              return (
                <div
                  key={subject.id}
                  className="p-4 bg-muted/30 rounded-xl space-y-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-foreground">{subject.name}</h4>
                        <p className="text-xs text-muted-foreground">KKM: {subject.kkm}</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportSubjectRanking(subject.id)}
                      className="gap-1.5"
                    >
                      <Download className="w-4 h-4" />
                      Ekspor
                    </Button>
                  </div>

                  {/* Top 5 Preview */}
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                    {top5.map((ranking, index) => (
                      <div
                        key={ranking.student.id}
                        className={`p-3 rounded-lg border ${
                          index === 0
                            ? "bg-gradient-to-br from-amber-500/20 to-yellow-500/10 border-amber-500/30"
                            : index === 1
                            ? "bg-gradient-to-br from-gray-400/20 to-gray-300/10 border-gray-400/30"
                            : index === 2
                            ? "bg-gradient-to-br from-amber-700/20 to-amber-600/10 border-amber-700/30"
                            : "bg-background"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {index === 0 && <Crown className="w-4 h-4 text-amber-500" />}
                          {index === 1 && <Medal className="w-4 h-4 text-gray-400" />}
                          {index === 2 && <Award className="w-4 h-4 text-amber-700" />}
                          <span className="text-xs font-medium text-muted-foreground">
                            #{ranking.rank}
                          </span>
                        </div>
                        <p className="font-medium text-sm text-foreground truncate">
                          {ranking.student.name}
                        </p>
                        <p className={`text-lg font-bold ${ranking.overallAverage >= subject.kkm ? "text-grade-pass" : "text-grade-fail"}`}>
                          {formatGrade(ranking.overallAverage)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
