import { useAcademicYear } from "@/contexts/AcademicYearContext";

/**
 * Hook untuk menyediakan filter komposit Year + Semester
 * untuk data transaksional (grades, chapters, assignments)
 * 
 * Data transaksional = data yang terisolasi per semester
 * Master data (classes, subjects, students) = hanya terisolasi per tahun ajaran
 */
export function useTransactionalFilter() {
  const { 
    activeYearId, 
    activeSemesterId, 
    activeSemesterNumber,
    hasActiveYear,
    hasActiveSemester,
  } = useAcademicYear();

  /**
   * Returns filter object for transactional data queries
   * Includes both academic_year_id AND semester_id
   */
  const getTransactionalFilter = () => ({
    academic_year_id: activeYearId,
    semester_id: activeSemesterId,
  });

  /**
   * Returns filter object for master data queries
   * Only includes academic_year_id (soft boundary doesn't apply)
   */
  const getMasterDataFilter = () => ({
    academic_year_id: activeYearId,
  });

  /**
   * Creates data object with automatic period assignment for INSERT operations
   */
  const withTransactionalIds = <T extends Record<string, unknown>>(data: T): T & {
    academic_year_id: string | null;
    semester_id: string | null;
  } => ({
    ...data,
    academic_year_id: activeYearId,
    semester_id: activeSemesterId,
  });

  /**
   * Creates data object with only year assignment for master data INSERT
   */
  const withYearId = <T extends Record<string, unknown>>(data: T): T & {
    academic_year_id: string | null;
  } => ({
    ...data,
    academic_year_id: activeYearId,
  });

  /**
   * Check if we have valid filters for transactional queries
   */
  const canQueryTransactional = hasActiveYear && hasActiveSemester;

  /**
   * Check if we have valid filter for master data queries
   */
  const canQueryMaster = hasActiveYear;

  return {
    // Filters
    getTransactionalFilter,
    getMasterDataFilter,
    
    // Data injection
    withTransactionalIds,
    withYearId,
    
    // State checks
    canQueryTransactional,
    canQueryMaster,
    
    // Raw values
    activeYearId,
    activeSemesterId,
    activeSemesterNumber,
    hasActiveYear,
    hasActiveSemester,
  };
}

/**
 * Type for semester filter mode in reports
 */
export type SemesterFilterMode = "semester1" | "semester2" | "all";

/**
 * Hook untuk independent semester filtering di halaman Reports
 * Tidak terikat dengan semester aktif global
 */
export function useReportFilter() {
  const { 
    activeYearId, 
    activeSemesterNumber,
    semestersForActiveYear,
  } = useAcademicYear();

  /**
   * Get semester IDs based on filter mode
   */
  const getSemesterIdsForMode = (mode: SemesterFilterMode): string[] => {
    if (mode === "all") {
      return semestersForActiveYear.map(s => s.id);
    }
    
    const targetNumber = mode === "semester1" ? 1 : 2;
    const semester = semestersForActiveYear.find(s => s.number === targetNumber);
    return semester ? [semester.id] : [];
  };

  /**
   * Get display label for current filter mode
   */
  const getFilterLabel = (mode: SemesterFilterMode): string => {
    switch (mode) {
      case "semester1":
        return "Semester 1";
      case "semester2":
        return "Semester 2";
      case "all":
        return "Semua Semester (Gabungan)";
    }
  };

  /**
   * Get default mode based on active semester
   */
  const getDefaultMode = (): SemesterFilterMode => {
    if (activeSemesterNumber === 1) return "semester1";
    if (activeSemesterNumber === 2) return "semester2";
    return "all";
  };

  return {
    activeYearId,
    semestersForActiveYear,
    getSemesterIdsForMode,
    getFilterLabel,
    getDefaultMode,
  };
}

/**
 * Hook untuk attendance filtering (hanya year, bukan semester)
 * dengan support date range validation
 */
export function useAttendanceFilter() {
  const { 
    activeYear,
    activeYearId,
    semestersForActiveYear,
  } = useAcademicYear();

  /**
   * Get date range for the active academic year
   */
  const getYearDateRange = () => {
    if (!activeYear) return null;
    
    // Try to get from semesters first (more accurate)
    if (semestersForActiveYear.length >= 2) {
      const semester1 = semestersForActiveYear.find(s => s.number === 1);
      const semester2 = semestersForActiveYear.find(s => s.number === 2);
      
      return {
        start: semester1?.start_date || null,
        end: semester2?.end_date || null,
      };
    }
    
    // Fallback to academic year dates
    const year = activeYear as any;
    return {
      start: year.start_date || null,
      end: year.end_date || null,
    };
  };

  /**
   * Get date range for a specific semester
   */
  const getSemesterDateRange = (semesterNumber: 1 | 2) => {
    const semester = semestersForActiveYear.find(s => s.number === semesterNumber);
    if (!semester) return null;
    
    return {
      start: semester.start_date || null,
      end: semester.end_date || null,
    };
  };

  /**
   * Check if a date falls within the active academic year
   */
  const isDateInActiveYear = (date: Date): boolean => {
    const range = getYearDateRange();
    if (!range || !range.start || !range.end) return true; // Allow if no range defined
    
    const checkDate = date.getTime();
    const start = new Date(range.start).getTime();
    const end = new Date(range.end).getTime();
    
    return checkDate >= start && checkDate <= end;
  };

  return {
    activeYearId,
    getYearDateRange,
    getSemesterDateRange,
    isDateInActiveYear,
  };
}
