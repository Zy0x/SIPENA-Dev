import { useAcademicYear } from "@/contexts/AcademicYearContext";

/**
 * Helper hook for adding academic year AND semester filtering to data queries
 * 
 * KEY CONCEPT:
 * - Master data (classes, subjects, students): Filter by YEAR only
 * - Transactional data (grades, chapters, assignments): Filter by YEAR + SEMESTER
 * - Attendance: Filter by YEAR only (uses date range)
 * 
 * Usage example for MASTER data (classes, subjects, students):
 * ```tsx
 * const { activeYearId, shouldFilterByYear, withYearId } = useAcademicYearFilter();
 * 
 * // In query - only filter by year
 * let query = supabase.from("classes").select("*");
 * if (shouldFilterByYear) {
 *   query = query.eq("academic_year_id", activeYearId);
 * }
 * ```
 * 
 * Usage example for TRANSACTIONAL data (grades, chapters, assignments):
 * ```tsx
 * const { activeYearId, activeSemesterId, shouldFilterBySemester, withYearAndSemesterId } = useAcademicYearFilter();
 * 
 * // In query - filter by year AND semester
 * let query = supabase.from("grades").select("*");
 * if (shouldFilterBySemester) {
 *   query = query.eq("academic_year_id", activeYearId).eq("semester_id", activeSemesterId);
 * }
 * 
 * // In mutation - add both IDs
 * const dataToInsert = withYearAndSemesterId({ student_id: ..., value: ... });
 * ```
 */
export function useAcademicYearFilter() {
  const { 
    activeYear, 
    activeYearId, 
    activeSemester,
    activeSemesterId,
    activeSemesterNumber,
    hasActiveYear,
    hasActiveSemester,
    isLoading,
  } = useAcademicYear();
  
  return {
    // Active year info
    activeYear,
    activeYearId,
    
    // Active semester info
    activeSemester,
    activeSemesterId,
    activeSemesterNumber,
    
    // Filter checks
    hasActiveYear,
    hasActiveSemester,
    
    // Should filter by year only (for master data)
    shouldFilterByYear: hasActiveYear && !isLoading,
    
    // Should filter by semester (for transactional data)
    shouldFilterBySemester: hasActiveYear && hasActiveSemester && !isLoading,
    
    // Loading state
    isLoading,
    
    /**
     * Helper to add academic_year_id to data object for insert/update
     * Use for MASTER data (classes, subjects, students)
     */
    withYearId: <T extends object>(data: T): T & { academic_year_id: string | null } => ({
      ...data,
      academic_year_id: activeYearId,
    }),
    
    /**
     * Helper to add both academic_year_id and semester_id to data object
     * Use for TRANSACTIONAL data (grades, chapters, assignments)
     */
    withYearAndSemesterId: <T extends object>(data: T): T & { 
      academic_year_id: string | null;
      semester_id: string | null;
    } => ({
      ...data,
      academic_year_id: activeYearId,
      semester_id: activeSemesterId,
    }),
    
    /**
     * Build query filter options based on active year only
     * Use for MASTER data queries
     */
    getYearFilter: () => {
      if (!hasActiveYear || !activeYearId) {
        return {};
      }
      return { academic_year_id: activeYearId };
    },
    
    /**
     * Build query filter options based on active year AND semester
     * Use for TRANSACTIONAL data queries
     */
    getYearAndSemesterFilter: () => {
      if (!hasActiveYear || !activeYearId) {
        return {};
      }
      const filter: Record<string, string> = { academic_year_id: activeYearId };
      if (hasActiveSemester && activeSemesterId) {
        filter.semester_id = activeSemesterId;
      }
      return filter;
    },
    
    /**
     * Get query key suffix for cache differentiation
     * Ensures queries are cached separately per academic year
     */
    getYearQueryKeySuffix: () => {
      return activeYearId || "all";
    },
    
    /**
     * Get query key suffix for cache differentiation by semester
     * Ensures transactional queries are cached separately per semester
     */
    getSemesterQueryKeySuffix: () => {
      return activeSemesterId || "all";
    },
  };
}

export default useAcademicYearFilter;
