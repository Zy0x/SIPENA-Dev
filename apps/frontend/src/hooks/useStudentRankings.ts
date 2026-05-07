import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useAcademicYear } from "@/contexts/AcademicYearContext";
import { supabaseExternal as supabase } from "@/core/repositories/supabase-compat.repository";
import { useStudents } from "@/hooks/useStudents";
import { useSubjects } from "@/hooks/useSubjects";
import {
  buildOverallRankings,
  buildSubjectRankings,
  type RankingAssignment,
  type RankingChapter,
  type RankingGrade,
  type RankingSemesterValue,
} from "@/lib/rankingCalculations";
import { DEFAULT_FORMULA, normalizeFormula, type CustomFormula } from "@/lib/gradeFormula";

export type { StudentRankingEntry } from "@/lib/rankingCalculations";

interface UseStudentRankingsOptions {
  classId?: string;
  semesterFilter?: RankingSemesterValue;
  overallSubjectIds?: string[];
}

const RANKING_QUERY_PAGE_SIZE = 1000;

async function fetchAllRankingRows<T>(buildQuery: () => any): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const to = from + RANKING_QUERY_PAGE_SIZE - 1;
    const { data, error } = await buildQuery().range(from, to);

    if (error) throw error;

    const page = (data || []) as T[];
    rows.push(...page);

    if (page.length < RANKING_QUERY_PAGE_SIZE) {
      break;
    }

    from += RANKING_QUERY_PAGE_SIZE;
  }

  return rows;
}

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
  const studentIds = useMemo(() => students.map((student) => student.id), [students]);
  const subjectIdsKey = subjectIds.join(",");
  const studentIdsKey = studentIds.join(",");
  const semesterIdsKey = semesterIds.join(",");

  const rankingDataQuery = useQuery({
    queryKey: [
      "student-rankings",
      classId ?? "all",
      user?.id ?? "anonymous",
      activeYearId ?? "all",
      resolvedSemesterFilter,
      subjectIdsKey,
      studentIdsKey,
      semesterIdsKey,
    ],
    queryFn: async () => {
      if (!classId || !user || subjectIds.length === 0 || studentIds.length === 0) {
        return {
          grades: [] as RankingGrade[],
          chapters: [] as RankingChapter[],
          assignments: [] as RankingAssignment[],
          formulasBySubject: {} as Record<string, CustomFormula>,
        };
      }

      const buildGradesQuery = () => {
        let query = supabase
          .from("grades")
          .select("*")
          .in("subject_id", subjectIds)
          .in("student_id", studentIds)
          .eq("user_id", user.id);

        if (activeYearId) {
          query = query.or(`academic_year_id.eq.${activeYearId},academic_year_id.is.null`);
        }

        if (!isCombinedView && semesterIds.length > 0) {
          const semesterFilterValue = semesterIds.map((id) => `semester_id.eq.${id}`).join(",");
          query = query.or(`${semesterFilterValue},semester_id.is.null`);
        }

        return query;
      };

      const buildChaptersQuery = () => {
        let query = supabase
          .from("chapters")
          .select("*")
          .in("subject_id", subjectIds)
          .eq("user_id", user.id);

        const effectiveSemesterIds = isCombinedView ? semestersForActiveYear.map((semester) => semester.id) : semesterIds;
        if (effectiveSemesterIds.length > 0) {
          const semesterFilterValue = effectiveSemesterIds.map((id) => `semester_id.eq.${id}`).join(",");
          query = query.or(`${semesterFilterValue},semester_id.is.null`);
        }

        return query;
      };

      const [
        gradesData,
        chaptersData,
        { data: formulaData, error: formulaError },
      ] = await Promise.all([
        fetchAllRankingRows<RankingGrade>(buildGradesQuery),
        fetchAllRankingRows<RankingChapter>(buildChaptersQuery),
        (supabase as any)
          .from("grade_formula_settings")
          .select("subject_id, formula")
          .in("subject_id", subjectIds)
          .eq("user_id", user.id),
      ]);

      if (formulaError) console.warn("[StudentRankings] Formula query error:", formulaError.message);

      const formulasBySubject = Object.fromEntries(
        subjectIds.map((subjectId) => {
          const row = (formulaData || []).find((item: any) => item.subject_id === subjectId);
          return [subjectId, normalizeFormula(row?.formula ?? DEFAULT_FORMULA)];
        }),
      ) as Record<string, CustomFormula>;

      const chapters = chaptersData;
      const chapterIds = chapters.map((chapter) => chapter.id);

      if (chapterIds.length === 0) {
        return {
          grades: gradesData,
          chapters,
          assignments: [] as RankingAssignment[],
          formulasBySubject,
        };
      }

      const effectiveSemesterIds = isCombinedView ? semestersForActiveYear.map((semester) => semester.id) : semesterIds;
      const buildAssignmentsQuery = () => {
        let query = supabase
          .from("assignments")
          .select("*")
          .in("chapter_id", chapterIds)
          .eq("user_id", user.id);

        if (effectiveSemesterIds.length > 0) {
          const semesterFilterValue = effectiveSemesterIds.map((id) => `semester_id.eq.${id}`).join(",");
          query = query.or(`${semesterFilterValue},semester_id.is.null`);
        }

        return query;
      };

      const assignmentsData = await fetchAllRankingRows<RankingAssignment>(buildAssignmentsQuery);

      return {
        grades: gradesData,
        chapters,
        assignments: assignmentsData,
        formulasBySubject,
      };
    },
    enabled: !!classId && !!user && !studentsLoading,
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
      .on("postgres_changes", { event: "*", schema: "public", table: "grade_formula_settings", filter: `user_id=eq.${user.id}` }, invalidateRankings)
      .on("postgres_changes", { event: "*", schema: "public", table: "students", filter: `user_id=eq.${user.id}` }, invalidateRankings)
      .on("postgres_changes", { event: "*", schema: "public", table: "subjects", filter: `user_id=eq.${user.id}` }, invalidateRankings)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, user]);

  const grades = useMemo(() => rankingDataQuery.data?.grades || [], [rankingDataQuery.data?.grades]);
  const chapters = useMemo(() => rankingDataQuery.data?.chapters || [], [rankingDataQuery.data?.chapters]);
  const assignments = useMemo(() => rankingDataQuery.data?.assignments || [], [rankingDataQuery.data?.assignments]);
  const formulasBySubject = useMemo(
    () => rankingDataQuery.data?.formulasBySubject || {},
    [rankingDataQuery.data?.formulasBySubject],
  );

  const buildOverallRanking = useCallback((selectedSubjectIds: string[]) => {
    const subjectsToUse = selectedSubjectIds.length > 0 ? selectedSubjectIds : subjectIds;
    return buildOverallRankings({
      students,
      subjectIds: subjectsToUse,
      grades,
      chapters,
      assignments,
      semesterIds,
      formulasBySubject,
    });
  }, [assignments, chapters, formulasBySubject, grades, semesterIds, students, subjectIds]);

  const getSubjectRanking = useCallback((subjectId: string) => {
    return buildSubjectRankings({
      students,
      subjectId,
      grades,
      chapters,
      assignments,
      semesterIds,
      formulasBySubject,
    });
  }, [assignments, chapters, formulasBySubject, grades, semesterIds, students]);

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
