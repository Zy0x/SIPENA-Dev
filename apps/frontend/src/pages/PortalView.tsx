import { useParams } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { usePortalData } from "@/hooks/useParentPortal";
import { supabaseExternal as supabase } from "@/core/repositories/supabase-compat.repository";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SipenaLogo } from "@/components/SipenaLogo";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, AlertCircle, FileSpreadsheet, CalendarDays,
  Trophy, Brain, Users, CheckCircle2, Clock, XCircle, ShieldAlert, Bookmark
} from "lucide-react";

interface StudentData {
  id: string;
  name: string;
  nisn: string;
}

interface GradeData {
  student_id: string;
  grade_type: string;
  value: number | null;
  assignment_id: string | null;
  subject_id: string;
}

interface AssignmentData {
  id: string;
  name: string;
  chapter_id: string;
}

interface ChapterData {
  id: string;
  name: string;
  subject_id: string;
}

interface AttendanceData {
  student_id: string;
  date: string;
  status: string;
}

interface SubjectData {
  id: string;
  name: string;
  kkm: number;
}

export default function PortalView() {
  const { code } = useParams<{ code: string }>();
  const { config, isLoading, error } = usePortalData(code || "");

  const [students, setStudents] = useState<StudentData[]>([]);
  const [grades, setGrades] = useState<GradeData[]>([]);
  const [assignments, setAssignments] = useState<AssignmentData[]>([]);
  const [chapters, setChapters] = useState<ChapterData[]>([]);
  const [attendance, setAttendance] = useState<AttendanceData[]>([]);
  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [className, setClassName] = useState("");
  const [dataLoading, setDataLoading] = useState(false);
  const [activeSubjectTab, setActiveSubjectTab] = useState<string>("all");

  // Fetch actual data when config loads
  useEffect(() => {
    if (!config) return;

    const fetchData = async () => {
      setDataLoading(true);
      try {
        // Fetch class info
        const { data: classData } = await (supabase as any)
          .from("classes")
          .select("name")
          .eq("id", config.class_id)
          .maybeSingle();
        if (classData) setClassName(classData.name);

        // Fetch students
        const { data: studentsData } = await (supabase as any)
          .from("students")
          .select("id, name, nisn")
          .eq("class_id", config.class_id)
          .order("name");
        if (studentsData) setStudents(studentsData);

        const studentIds = studentsData?.map((s: any) => s.id) || [];
        if (studentIds.length === 0) { setDataLoading(false); return; }

        // Get user_id from portal config
        const { data: portalRow } = await (supabase as any)
          .from("parent_portal_configs")
          .select("user_id")
          .eq("id", config.id)
          .maybeSingle();

        const userId = portalRow?.user_id;

        // Fetch subjects
        if (userId && (config.show_grades || config.show_rankings)) {
          let subQuery = (supabase as any)
            .from("subjects")
            .select("id, name, kkm")
            .eq("user_id", userId);
          if (config.subject_ids && config.subject_ids.length > 0) {
            subQuery = subQuery.in("id", config.subject_ids);
          }
          const { data: subData } = await subQuery;
          if (subData) setSubjects(subData);

          // Fetch chapters & assignments for detailed view
          if (subData && subData.length > 0) {
            const subjectIds = subData.map((s: any) => s.id);
            const { data: chapData } = await (supabase as any)
              .from("chapters")
              .select("id, name, subject_id")
              .in("subject_id", subjectIds)
              .order("order_index");
            if (chapData) setChapters(chapData);

            if (chapData && chapData.length > 0) {
              const chapterIds = chapData.map((c: any) => c.id);
              const { data: assignData } = await (supabase as any)
                .from("assignments")
                .select("id, name, chapter_id")
                .in("chapter_id", chapterIds)
                .order("created_at");
              if (assignData) setAssignments(assignData);
            }
          }
        }

        // Fetch grades if enabled — now with assignment detail
        if (config.show_grades) {
          let gradeQuery = (supabase as any)
            .from("grades")
            .select("student_id, grade_type, value, assignment_id, subject_id")
            .in("student_id", studentIds);

          if (config.subject_ids && config.subject_ids.length > 0) {
            gradeQuery = gradeQuery.in("subject_id", config.subject_ids);
          }

          const { data: gradesData } = await gradeQuery;
          if (gradesData) setGrades(gradesData);
        }

        // Fetch attendance if enabled
        if (config.show_attendance) {
          let attData = null;
          const { data: att1 } = await (supabase as any)
            .from("attendance_records")
            .select("student_id, date, status")
            .eq("class_id", config.class_id);
          if (att1 && att1.length > 0) {
            attData = att1;
          } else {
            const { data: att2 } = await (supabase as any)
              .from("attendance")
              .select("student_id, date, status")
              .eq("class_id", config.class_id);
            if (att2) attData = att2;
          }
          if (attData) setAttendance(attData);
        }
      } catch (err) {
        console.error("Failed to fetch portal data:", err);
      } finally {
        setDataLoading(false);
      }
    };

    fetchData();
  }, [config]);

  // Build detailed grade structure per subject
  const subjectGradeDetails = useMemo(() => {
    return subjects.map(subject => {
      const subChapters = chapters.filter(c => c.subject_id === subject.id);
      const subAssignments = subChapters.flatMap(ch => {
        const chAssigns = assignments.filter(a => a.chapter_id === ch.id);
        return chAssigns.map(a => ({ ...a, chapterName: ch.name }));
      });

      const studentGrades = students.map(student => {
        const studentSubjectGrades = grades.filter(
          g => g.student_id === student.id && g.subject_id === subject.id
        );
        const assignmentScores: Record<string, number | null> = {};
        for (const a of subAssignments) {
          const grade = studentSubjectGrades.find(g => g.assignment_id === a.id);
          assignmentScores[a.id] = grade?.value ?? null;
        }
        const validGrades = studentSubjectGrades.filter(g => g.value != null);
        const avg = validGrades.length > 0
          ? validGrades.reduce((sum, g) => sum + (g.value || 0), 0) / validGrades.length
          : null;
        return {
          ...student,
          assignmentScores,
          average: avg !== null ? Math.round(avg * 10) / 10 : null,
          belowKkm: avg !== null && avg < subject.kkm,
        };
      });

      return { subject, chapters: subChapters, assignments: subAssignments, studentGrades };
    });
  }, [subjects, chapters, assignments, grades, students]);

  // Attendance summary
  const attendanceSummary = students.map(student => {
    const records = attendance.filter(a => a.student_id === student.id);
    const summary = { H: 0, I: 0, S: 0, A: 0, D: 0 };
    records.forEach(r => { if (summary[r.status as keyof typeof summary] !== undefined) summary[r.status as keyof typeof summary]++; });
    return { ...student, ...summary, total: records.length };
  });

  // Overall rankings
  const overallRankings = useMemo(() => {
    return students.map(student => {
      const allStudentGrades = grades.filter(g => g.student_id === student.id && g.value != null);
      const avg = allStudentGrades.length > 0
        ? allStudentGrades.reduce((sum, g) => sum + (g.value || 0), 0) / allStudentGrades.length
        : 0;
      return { ...student, average: Math.round(avg * 10) / 10, count: allStudentGrades.length };
    }).sort((a, b) => b.average - a.average);
  }, [students, grades]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Memuat portal...</p>
        </div>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center text-center py-12 gap-4">
            <AlertCircle className="w-12 h-12 text-destructive" />
            <h2 className="text-lg font-semibold">Portal Tidak Ditemukan</h2>
            <p className="text-sm text-muted-foreground">
              {error || "Link portal tidak valid atau sudah tidak aktif."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <SipenaLogo size="sm" />
            <Separator orientation="vertical" className="h-6" />
            <span className="font-semibold text-sm">{config.title}</span>
          </div>
          <div className="flex items-center gap-2">
            {className && (
              <Badge variant="outline" className="text-xs">
                <Users className="w-3 h-3 mr-1" />
                {className}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              Portal Orang Tua
            </Badge>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container px-4 py-6 max-w-5xl mx-auto space-y-6">
        {/* Portal Info */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">{config.title}</h1>
          {config.description && (
            <p className="text-muted-foreground text-sm">{config.description}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {students.length} siswa {className ? `• ${className}` : ""} • {subjects.length} mata pelajaran
          </p>
        </div>

        {dataLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Memuat data...</span>
          </div>
        ) : (
          <>
            {/* ═══ DETAILED GRADES SECTION ═══ */}
            {config.show_grades && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileSpreadsheet className="w-5 h-5 text-primary" />
                    Nilai Akademik Detail
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {subjectGradeDetails.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Belum ada data nilai.</p>
                  ) : (
                    <Tabs value={activeSubjectTab} onValueChange={setActiveSubjectTab}>
                      <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/30 p-1">
                        <TabsTrigger value="all" className="text-xs">Ringkasan</TabsTrigger>
                        {subjectGradeDetails.map(({ subject }) => (
                          <TabsTrigger key={subject.id} value={subject.id} className="text-xs">
                            {subject.name}
                          </TabsTrigger>
                        ))}
                      </TabsList>

                      {/* Summary tab */}
                      <TabsContent value="all" className="mt-4">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-10">#</TableHead>
                                <TableHead>Nama Siswa</TableHead>
                                {subjects.map(s => (
                                  <TableHead key={s.id} className="text-center text-xs">
                                    <div>{s.name}</div>
                                    <div className="text-[10px] text-muted-foreground font-normal">KKM: {s.kkm}</div>
                                  </TableHead>
                                ))}
                                <TableHead className="text-center font-bold">Rata-rata</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {students.map((student, i) => {
                                const allVals = grades.filter(g => g.student_id === student.id && g.value != null);
                                const overallAvg = allVals.length > 0
                                  ? Math.round((allVals.reduce((s, g) => s + (g.value || 0), 0) / allVals.length) * 10) / 10
                                  : null;

                                return (
                                  <TableRow key={student.id}>
                                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                                    <TableCell className="font-medium whitespace-nowrap">{student.name}</TableCell>
                                    {subjects.map(subject => {
                                      const sg = grades.filter(g => g.student_id === student.id && g.subject_id === subject.id && g.value != null);
                                      const avg = sg.length > 0
                                        ? Math.round((sg.reduce((s, g) => s + (g.value || 0), 0) / sg.length) * 10) / 10
                                        : null;
                                      const belowKkm = avg !== null && avg < subject.kkm;
                                      return (
                                        <TableCell key={subject.id} className={`text-center font-semibold ${belowKkm ? "text-destructive" : ""}`}>
                                          {avg !== null ? avg : "-"}
                                        </TableCell>
                                      );
                                    })}
                                    <TableCell className="text-center font-bold">
                                      {overallAvg !== null ? overallAvg : "-"}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </TabsContent>

                      {/* Per-subject detailed tab */}
                      {subjectGradeDetails.map(({ subject, chapters: subChaps, assignments: subAssigns, studentGrades: sg }) => (
                        <TabsContent key={subject.id} value={subject.id} className="mt-4">
                          <div className="mb-3 flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">KKM: {subject.kkm}</Badge>
                            <Badge variant="secondary" className="text-xs">{subChaps.length} BAB</Badge>
                            <Badge variant="secondary" className="text-xs">{subAssigns.length} Tugas</Badge>
                          </div>

                          {subAssigns.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-6">
                              Belum ada struktur BAB/tugas untuk {subject.name}.
                            </p>
                          ) : (
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-10">#</TableHead>
                                    <TableHead className="sticky left-0 bg-background z-10">Nama Siswa</TableHead>
                                    {subAssigns.map(a => (
                                      <TableHead key={a.id} className="text-center text-[10px] min-w-[60px]">
                                        <div className="font-medium">{a.name}</div>
                                        <div className="text-[9px] text-muted-foreground font-normal truncate max-w-[80px]">{a.chapterName}</div>
                                      </TableHead>
                                    ))}
                                    <TableHead className="text-center font-bold">Rata-rata</TableHead>
                                    <TableHead className="text-center">Status</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {sg.map((student, i) => (
                                    <TableRow key={student.id}>
                                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                                      <TableCell className="font-medium whitespace-nowrap sticky left-0 bg-background z-10">{student.name}</TableCell>
                                      {subAssigns.map(a => {
                                        const val = student.assignmentScores[a.id];
                                        const belowKkm = val !== null && val < subject.kkm;
                                        return (
                                          <TableCell key={a.id} className={`text-center text-xs ${belowKkm ? "text-destructive font-medium" : ""}`}>
                                            {val !== null ? val : "-"}
                                          </TableCell>
                                        );
                                      })}
                                      <TableCell className={`text-center font-bold ${student.belowKkm ? "text-destructive" : ""}`}>
                                        {student.average !== null ? student.average : "-"}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {student.average !== null ? (
                                          student.belowKkm ? (
                                            <Badge variant="destructive" className="text-[9px]">Belum Tuntas</Badge>
                                          ) : (
                                            <Badge className="text-[9px] bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">Tuntas</Badge>
                                          )
                                        ) : "-"}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </TabsContent>
                      ))}
                    </Tabs>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Attendance Section */}
            {config.show_attendance && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <CalendarDays className="w-5 h-5 text-primary" />
                    Presensi
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {attendanceSummary.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Belum ada data presensi.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">#</TableHead>
                            <TableHead>Nama Siswa</TableHead>
                            <TableHead className="text-center">
                              <span className="flex items-center justify-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-green-500" /> H
                              </span>
                            </TableHead>
                            <TableHead className="text-center">
                              <span className="flex items-center justify-center gap-1">
                                <Clock className="w-3 h-3 text-blue-500" /> I
                              </span>
                            </TableHead>
                            <TableHead className="text-center">
                              <span className="flex items-center justify-center gap-1">
                                <ShieldAlert className="w-3 h-3 text-yellow-500" /> S
                              </span>
                            </TableHead>
                            <TableHead className="text-center">
                              <span className="flex items-center justify-center gap-1">
                                <XCircle className="w-3 h-3 text-red-500" /> A
                              </span>
                            </TableHead>
                            <TableHead className="text-center">
                              <span className="flex items-center justify-center gap-1">
                                <Bookmark className="w-3 h-3 text-purple-500" /> D
                              </span>
                            </TableHead>
                            <TableHead className="text-center">%</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {attendanceSummary.map((s, i) => {
                            const pct = s.total > 0 ? Math.round((s.H / s.total) * 100) : 0;
                            return (
                              <TableRow key={s.id}>
                                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                                <TableCell className="font-medium">{s.name}</TableCell>
                                <TableCell className="text-center text-green-600 dark:text-green-400 font-medium">{s.H || "-"}</TableCell>
                                <TableCell className="text-center text-blue-600 dark:text-blue-400">{s.I || "-"}</TableCell>
                                <TableCell className="text-center text-yellow-600 dark:text-yellow-400">{s.S || "-"}</TableCell>
                                <TableCell className="text-center text-red-600 dark:text-red-400">{s.A || "-"}</TableCell>
                                <TableCell className="text-center text-purple-600 dark:text-purple-400">{s.D || "-"}</TableCell>
                                <TableCell className={`text-center font-semibold ${pct < 75 ? "text-destructive" : ""}`}>
                                  {s.total > 0 ? `${pct}%` : "-"}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Rankings Section */}
            {config.show_rankings && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Trophy className="w-5 h-5 text-amber-500" />
                    Ranking Kelas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {overallRankings.length === 0 || overallRankings.every(r => r.count === 0) ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Belum ada data ranking.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">Rank</TableHead>
                            <TableHead>Nama Siswa</TableHead>
                            {subjects.map(s => (
                              <TableHead key={s.id} className="text-center text-xs">{s.name}</TableHead>
                            ))}
                            <TableHead className="text-center font-bold">Rata-rata</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {overallRankings.filter(r => r.count > 0).map((s, i) => (
                            <TableRow key={s.id}>
                              <TableCell>
                                <span className={`font-bold ${i === 0 ? "text-amber-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-orange-400" : "text-muted-foreground"}`}>
                                  {i + 1}
                                </span>
                              </TableCell>
                              <TableCell className="font-medium">{s.name}</TableCell>
                              {subjects.map(subject => {
                                const sg = grades.filter(g => g.student_id === s.id && g.subject_id === subject.id && g.value != null);
                                const avg = sg.length > 0
                                  ? Math.round((sg.reduce((sum, g) => sum + (g.value || 0), 0) / sg.length) * 10) / 10
                                  : null;
                                return (
                                  <TableCell key={subject.id} className="text-center text-xs">
                                    {avg !== null ? avg : "-"}
                                  </TableCell>
                                );
                              })}
                              <TableCell className="text-center font-semibold">{s.average}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Predictions Section */}
            {config.show_predictions && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Brain className="w-5 h-5 text-purple-500" />
                    Prediksi AI
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Fitur prediksi AI sedang dalam pengembangan.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground py-6">
          <p>Dibuat dengan SIPENA — Sistem Informasi Penilaian Akademik</p>
        </div>
      </main>
    </div>
  );
}
