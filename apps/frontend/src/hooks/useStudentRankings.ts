import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useAcademicYear } from "@/contexts/AcademicYearContext";
import { supabaseExternal as supabase } from "@/core/repositories/supabase-compat.repository";
import { useStudents } from "@/hooks/useStudents";
import { useSubjects } from "@/hooks/useSubjects";
import { DEFAULT_FORMULA, calculateReportGrade } from "@/components/grades/FormulaSettings";

type RankingSemesterValue = "1" | "2" | "all";

interface Grade {
  id: string;
  student_id: string;
  subject_id: string;
  assignment_id: string | null;
  grade_type: string;
  value: number | null;
  semester_id?: string | null;
}

interface Chapter {
  id: string;
  subject_id: string;
  semester_id?: string | null;
}

interface Assignment {
  id: string;
  chapter_id: string;
  semester_id?: string | null;
}

export interface StudentRankingEntry {
  student: {
    id: string;
    name: string;
    nisn: string;
  };
  subjectGrades: Record<string, number>;
  overallAverage: number;
  rank: number;
  gradedSubjectCount: number;
}

interface UseStudentRankingsOptions {
  classId?: string;
  semesterFilter?: RankingSemesterValue;
  overallSubjectIds?: string[];
}

const applyDenseRank = (sorted: StudentRankingEntry[]): StudentRankingEntry[] => {
  let currentRank = 0;
  let previousAverage: number | null = null;

  return sorted.map((entry) => {
    const roundedAverage = Math.round(entry.overallAverage * 10) / 10;
    if (roundedAverage !== previousAverage) {
      currentRank += 1;
      previousAverage = roundedAverage;
    }

    return {
      ...entry,
      rank: currentRank,
    };
  });
};

export function useStudentRankings({
  classId,
  semesterFilter,
  overallSubjectIds = [],
}: UseStudentRankingsOptions) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { activeYearId, activeSemesterNumber, semestersForActiveYear } = useAcademicYear();
  const resolvedSemesterFilter = semesterFilter ?? ((activeSemesterNumber?.toString() as RankingSemesterValue) || "all");

  const { subjects, isLoading: subjectsLoading } = useSubjects(classId);
  const { students, isLoading: studentsLoading } = useStudents(classId);

  const semesterIds = useMemo(() => {
    if (resolvedSemesterFilter === "all") {
      return semestersForActiveYear.map((semester) => semester.id);
    }

    const targetNumber = parseInt(resolvedSemesterFilter, 10);
    const targetSemester = semestersForActiveYear.find((semester) => semester.number === targetNumber);
    return targetSemester ? [targetSemester.id] : [];
  }, [resolvedSemesterFilter, semestersForActiveYear]);

  const isCombinedView = resolvedSemesterFilter === "all";
  const subjectIds = useMemo(() => subjects.map((subject) => subject.id), [subjects]);
  const subjectIdsKey = subjectIds.join(",");
  const semesterIdsKey = semesterIds.join(",");

  const rankingDataQuery = useQuery({
    queryKey: [
      "student-rankings",
      classId ?? "all",
      user?.id ?? "anonymous",
      activeYearId ?? "all",
      resolvedSemesterFilter,
      subjectIdsKey,
      semesterIdsKey,
    ],
    queryFn: async () => {
      if (!classId || !user || subjectIds.length === 0) {
        return {
          grades: [] as Grade[],
          chapters: [] as Chapter[],
          assignments: [] as Assignment[],
        };
      }

      let gradesQuery = supabase
        .from("grades")
        .select("*")
        .in("subject_id", subjectIds)
        .eq("user_id", user.id);

      if (activeYearId) {
        gradesQuery = gradesQuery.or(`academic_year_id.eq.${activeYearId},academic_year_id.is.null`);
      }

      if (!isCombinedView && semesterIds.length > 0) {
        const semesterFilterValue = semesterIds.map((id) => `semester_id.eq.${id}`).join(",");
        gradesQuery = gradesQuery.or(`${semesterFilterValue},semester_id.is.null`);
      }

      let chaptersQuery = supabase
        .from("chapters")
        .select("*")
        .in("subject_id", subjectIds)
        .eq("user_id", user.id);

      const effectiveSemesterIds = isCombinedView ? semestersForActiveYear.map((semester) => semester.id) : semesterIds;
      if (effectiveSemesterIds.length > 0) {
        const semesterFilterValue = effectiveSemesterIds.map((id) => `semester_id.eq.${id}`).join(",");
        chaptersQuery = chaptersQuery.or(`${semesterFilterValue},semester_id.is.null`);
      }

      const [{ data: gradesData, error: gradesError }, { data: chaptersData, error: chaptersError }] = await Promise.all([
        gradesQuery,
        chaptersQuery,
      ]);

      if (gradesError) throw gradesError;
      if (chaptersError) throw chaptersError;

      const chapters = (chaptersData || []) as Chapter[];
      const chapterIds = chapters.map((chapter) => chapter.id);

      if (chapterIds.length === 0) {
        return {
          grades: (gradesData || []) as Grade[],
          chapters,
          assignments: [] as Assignment[],
        };
      }

      let assignmentsQuery = supabase
        .from("assignments")
        .select("*")
        .in("chapter_id", chapterIds)
        .eq("user_id", user.id);

      if (effectiveSemesterIds.length > 0) {
        const semesterFilterValue = effectiveSemesterIds.map((id) => `semester_id.eq.${id}`).join(",");
        assignmentsQuery = assignmentsQuery.or(`${semesterFilterValue},semester_id.is.null`);
      }

      const { data: assignmentsData, error: assignmentsError } = await assignmentsQuery;
      if (assignmentsError) throw assignmentsError;

      return {
        grades: (gradesData || []) as Grade[],
        chapters,
        assignments: (assignmentsData || []) as Assignment[],
      };
    },
    enabled: !!classId && !!user,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    if (!user) return;

    const invalidateRankings = () => {
      queryClient.invalidateQueries({ queryKey: ["student-rankings"] });
    };

    const channel = supabase
      .channel(`student-rankings:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "grades", filter: `user_id=eq.${user.id}` }, invalidateRankings)
      .on("postgres_changes", { event: "*", schema: "public", table: "chapters", filter: `user_id=eq.${user.id}` }, invalidateRankings)
      .on("postgres_changes", { event: "*", schema: "public", table: "assignments", filter: `user_id=eq.${user.id}` }, invalidateRankings)
      .on("postgres_changes", { event: "*", schema: "public", table: "students", filter: `user_id=eq.${user.id}` }, invalidateRankings)
      .on("postgres_changes", { event: "*", schema: "public", table: "subjects", filter: `user_id=eq.${user.id}` }, invalidateRankings)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, user]);

  const grades = rankingDataQuery.data?.grades || [];
  const chapters = rankingDataQuery.data?.chapters || [];
  const assignments = rankingDataQuery.data?.assignments || [];

  const calculateSubjectAverage = useCallback((studentId: string, subjectId: string): number | null => {
    const studentGrades = grades.filter(
      (grade) => grade.student_id === studentId && grade.subject_id === subjectId
    );

    const subjectChapters = chapters.filter((chapter) => chapter.subject_id === subjectId);
    const assignmentsByChapter: Record<string, Assignment[]> = {};

    subjectChapters.forEach((chapter) => {
      assignmentsByChapter[chapter.id] = assignments.filter((assignment) => assignment.chapter_id === chapter.id);
    });

    const hasChapters = subjectChapters.length > 0 && subjectChapters.some(
      (chapter) => (assignmentsByChapter[chapter.id]?.length || 0) > 0
    );

    let chapterSum = 0;
    let chapterCount = 0;

    subjectChapters.forEach((chapter) => {
      const chapterAssignments = assignmentsByChapter[chapter.id] || [];
      if (chapterAssignments.length === 0) {
        return;
      }

      let assignmentSum = 0;
      chapterAssignments.forEach((assignment) => {
        const grade = studentGrades.find(
          (studentGrade) =>
            studentGrade.grade_type === "assignment" && studentGrade.assignment_id === assignment.id
        );
        assignmentSum += grade?.value ?? 0;
      });

      chapterSum += assignmentSum / chapterAssignments.length;
      chapterCount += 1;
    });

    const chaptersAverage = chapterCount > 0 ? chapterSum / chapterCount : null;
    const stsRaw = studentGrades.find((grade) => grade.grade_type === "sts" && !grade.assignment_id)?.value ?? null;
    const sasRaw = studentGrades.find((grade) => grade.grade_type === "sas" && !grade.assignment_id)?.value ?? null;

    if (stsRaw === null && sasRaw === null && chaptersAverage === null) {
      return null;
    }

    return calculateReportGrade(
      DEFAULT_FORMULA,
      chaptersAverage ?? 0,
      stsRaw ?? 0,
      sasRaw ?? 0,
      hasChapters
    );
  }, [assignments, chapters, grades]);

  const buildOverallRanking = useCallback((selectedSubjectIds: string[]) => {
    const subjectsToUse = selectedSubjectIds.length > 0 ? selectedSubjectIds : subjectIds;

    const rankings = students
      .map((student) => {
        const subjectGrades: Record<string, number> = {};
        let totalScore = 0;
        let gradedSubjectCount = 0;

        subjectsToUse.forEach((subjectId) => {
          const average = calculateSubjectAverage(student.id, subjectId);
          subjectGrades[subjectId] = average ?? 0;

          if (average !== null) {
            totalScore += average;
            gradedSubjectCount += 1;
          }
        });

        if (gradedSubjectCount === 0) {
          return null;
        }

        return {
          student,
          subjectGrades,
          overallAverage: totalScore / gradedSubjectCount,
          rank: 0,
          gradedSubjectCount,
        } satisfies StudentRankingEntry;
      })
      .filter((entry) => entry !== null)
      .sort((left, right) =>
        right!.overallAverage - left!.overallAverage || left!.student.name.localeCompare(right!.student.name)
      ) as StudentRankingEntry[];

    return applyDenseRank(rankings);
  }, [calculateSubjectAverage, students, subjectIds]);

  const getSubjectRanking = useCallback((subjectId: string) => {
    const rankings = students
      .map((student) => {
        const average = calculateSubjectAverage(student.id, subjectId);
        if (average === null) {
          return null;
        }

        return {
          student,
          subjectGrades: { [subjectId]: average },
          overallAverage: average,
          rank: 0,
          gradedSubjectCount: 1,
        } satisfies StudentRankingEntry;
      })
      .filter((entry) => entry !== null)
      .sort((left, right) =>
        right!.overallAverage - left!.overallAverage || left!.student.name.localeCompare(right!.student.name)
      ) as StudentRankingEntry[];

    return applyDenseRank(rankings);
  }, [calculateSubjectAverage, students]);

  const overallRankings = useMemo(
    () => buildOverallRanking(overallSubjectIds),
    [buildOverallRanking, overallSubjectIds]
  );

  return {
    subjects,
    students,
    overallRankings,
    getSubjectRanking,
    isLoading: subjectsLoading || studentsLoading || rankingDataQuery.isLoading,
    isFetching: rankingDataQuery.isFetching,
    semesterFilter: resolvedSemesterFilter,
  };
}
