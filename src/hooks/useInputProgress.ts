import { useQuery } from "@tanstack/react-query";
import { supabaseExternal as supabase } from "@/lib/supabase-external";
import { useAuth } from "@/contexts/AuthContext";
import { useAcademicYear } from "@/contexts/AcademicYearContext";

/**
 * Hook untuk menghitung persentase progress input nilai
 * FILTERING: Filter by TAHUN AJARAN + SEMESTER aktif
 * 
 * Ketika user switch semester, persentase akan reset ke data semester baru
 */

interface InputProgressData {
  percentage: number;
  totalExpected: number;
  totalEntered: number;
  periodInfo: {
    yearName: string | null;
    semesterName: string | null;
  };
  breakdown: {
    classes: number;
    subjects: number;
    students: number;
    assignments: number;
    stsEntries: number;
    sasEntries: number;
    assignmentEntries: number;
  };
}

function getEmptyProgress(yearName: string | null, semesterName: string | null): InputProgressData {
  return {
    percentage: 0,
    totalExpected: 0,
    totalEntered: 0,
    periodInfo: { yearName, semesterName },
    breakdown: {
      classes: 0,
      subjects: 0,
      students: 0,
      assignments: 0,
      stsEntries: 0,
      sasEntries: 0,
      assignmentEntries: 0,
    },
  };
}

export function useInputProgress(): {
  data: InputProgressData;
  isLoading: boolean;
} {
  const { user } = useAuth();
  const { 
    activeYearId, 
    activeSemesterId, 
    activeYear, 
    activeSemester 
  } = useAcademicYear();

  const progressQuery = useQuery({
    queryKey: ["input_progress", user?.id, activeYearId, activeSemesterId],
    queryFn: async (): Promise<InputProgressData> => {
      if (!user) {
        return getEmptyProgress(null, null);
      }

      const yearName = activeYear?.name || null;
      const semesterName = activeSemester?.name || null;

      // Fetch classes for active year
      let classesQuery = supabase
        .from("classes")
        .select("id")
        .eq("user_id", user.id);
      
      if (activeYearId) {
        classesQuery = classesQuery.eq("academic_year_id", activeYearId);
      }

      const { data: classes } = await classesQuery;

      if (!classes || classes.length === 0) {
        return getEmptyProgress(yearName, semesterName);
      }

      const classIds = classes.map((c) => c.id);

      // Fetch students per class
      const { data: students } = await supabase
        .from("students")
        .select("id, class_id")
        .in("class_id", classIds);

      const totalStudents = students?.length || 0;

      if (totalStudents === 0) {
        return {
          ...getEmptyProgress(yearName, semesterName),
          breakdown: {
            ...getEmptyProgress(yearName, semesterName).breakdown,
            classes: classes.length,
          },
        };
      }

      // Fetch subjects for active year
      let subjectsQuery = supabase
        .from("subjects")
        .select("id, class_id")
        .eq("user_id", user.id);
      
      if (activeYearId) {
        subjectsQuery = subjectsQuery.or(`academic_year_id.eq.${activeYearId},academic_year_id.is.null`);
      }

      const { data: subjects } = await subjectsQuery;

      if (!subjects || subjects.length === 0) {
        return {
          ...getEmptyProgress(yearName, semesterName),
          breakdown: {
            ...getEmptyProgress(yearName, semesterName).breakdown,
            classes: classes.length,
            students: totalStudents,
          },
        };
      }

      // Fetch chapters filtered by semester
      const subjectIds = subjects.map((s) => s.id);
      let chaptersQuery = supabase
        .from("chapters")
        .select("id, subject_id")
        .in("subject_id", subjectIds);
      
      if (activeSemesterId) {
        chaptersQuery = chaptersQuery.or(`semester_id.eq.${activeSemesterId},semester_id.is.null`);
      }

      const { data: chapters } = await chaptersQuery;

      // Fetch assignments filtered by semester
      const chapterIds = chapters?.map((c) => c.id) || [];
      let assignmentsQuery = supabase
        .from("assignments")
        .select("id, chapter_id")
        .in("chapter_id", chapterIds.length > 0 ? chapterIds : ["none"]);
      
      if (activeSemesterId) {
        assignmentsQuery = assignmentsQuery.or(`semester_id.eq.${activeSemesterId},semester_id.is.null`);
      }

      const { data: assignments } = await assignmentsQuery;

      // Build mappings
      const subjectClassMap: Record<string, string> = {};
      subjects.forEach((s) => {
        if (s.class_id) subjectClassMap[s.id] = s.class_id;
      });

      const subjectChaptersMap: Record<string, string[]> = {};
      chapters?.forEach((c) => {
        if (!subjectChaptersMap[c.subject_id]) {
          subjectChaptersMap[c.subject_id] = [];
        }
        subjectChaptersMap[c.subject_id].push(c.id);
      });

      const chapterAssignmentsMap: Record<string, string[]> = {};
      assignments?.forEach((a) => {
        if (!chapterAssignmentsMap[a.chapter_id]) {
          chapterAssignmentsMap[a.chapter_id] = [];
        }
        chapterAssignmentsMap[a.chapter_id].push(a.id);
      });

      // Calculate expected entries
      let totalExpected = 0;
      const studentsByClass: Record<string, number> = {};

      students?.forEach((s) => {
        studentsByClass[s.class_id] = (studentsByClass[s.class_id] || 0) + 1;
      });

      subjects.forEach((subject) => {
        const classId = subject.class_id;
        if (!classId) return;

        const studentsInClass = studentsByClass[classId] || 0;
        if (studentsInClass === 0) return;

        // STS and SAS entries for this subject
        totalExpected += studentsInClass * 2;

        // Assignment entries
        const subjectChapters = subjectChaptersMap[subject.id] || [];
        subjectChapters.forEach((chapterId) => {
          const chapterAssignments = chapterAssignmentsMap[chapterId] || [];
          totalExpected += studentsInClass * chapterAssignments.length;
        });
      });

      // Fetch actual grades filtered by semester
      let gradesQuery = supabase
        .from("grades")
        .select("id, grade_type, value")
        .eq("user_id", user.id)
        .not("value", "is", null);
      
      if (activeSemesterId) {
        gradesQuery = gradesQuery.or(`semester_id.eq.${activeSemesterId},semester_id.is.null`);
      }

      const { data: grades } = await gradesQuery;

      const totalEntered = grades?.length || 0;

      let stsEntries = 0;
      let sasEntries = 0;
      let assignmentEntries = 0;

      grades?.forEach((g) => {
        if (g.grade_type === "sts") stsEntries++;
        else if (g.grade_type === "sas") sasEntries++;
        else if (g.grade_type === "assignment") assignmentEntries++;
      });

      const percentage =
        totalExpected > 0
          ? Math.min(100, Math.round((totalEntered / totalExpected) * 100))
          : 0;

      return {
        percentage,
        totalExpected,
        totalEntered,
        periodInfo: { yearName, semesterName },
        breakdown: {
          classes: classes.length,
          subjects: subjects.length,
          students: totalStudents,
          assignments: assignments?.length || 0,
          stsEntries,
          sasEntries,
          assignmentEntries,
        },
      };
    },
    enabled: !!user,
    staleTime: 30000,
  });

  return {
    data: progressQuery.data || getEmptyProgress(
      activeYear?.name || null, 
      activeSemester?.name || null
    ),
    isLoading: progressQuery.isLoading,
  };
}
