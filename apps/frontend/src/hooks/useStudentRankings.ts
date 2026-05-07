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

export type { StudentRankingEntry } from "@/lib/rankingCalculations";

interface UseStudentRankingsOptions {
  classId?: string;
  semesterFilter?: RankingSemesterValue;
  overallSubjectIds?: string[];
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
          grades: [] as RankingGrade[],
          chapters: [] as RankingChapter[],
          assignments: [] as RankingAssignment[],
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

      const chapters = (chaptersData || []) as RankingChapter[];
      const chapterIds = chapters.map((chapter) => chapter.id);

      if (chapterIds.length === 0) {
        return {
          grades: (gradesData || []) as RankingGrade[],
          chapters,
          assignments: [] as RankingAssignment[],
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
        grades: (gradesData || []) as RankingGrade[],
        chapters,
        assignments: (assignmentsData || []) as RankingAssignment[],
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

  const grades = useMemo(() => rankingDataQuery.data?.grades || [], [rankingDataQuery.data?.grades]);
  const chapters = useMemo(() => rankingDataQuery.data?.chapters || [], [rankingDataQuery.data?.chapters]);
  const assignments = useMemo(() => rankingDataQuery.data?.assignments || [], [rankingDataQuery.data?.assignments]);

  const buildOverallRanking = useCallback((selectedSubjectIds: string[]) => {
    const subjectsToUse = selectedSubjectIds.length > 0 ? selectedSubjectIds : subjectIds;
    return buildOverallRankings({
      students,
      subjectIds: subjectsToUse,
      grades,
      chapters,
      assignments,
      semesterIds,
    });
  }, [assignments, chapters, grades, semesterIds, students, subjectIds]);

  const getSubjectRanking = useCallback((subjectId: string) => {
    return buildSubjectRankings({
      students,
      subjectId,
      grades,
      chapters,
      assignments,
      semesterIds,
    });
  }, [assignments, chapters, grades, semesterIds, students]);

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
