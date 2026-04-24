import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseExternal as supabase, EDGE_FUNCTIONS_URL, SUPABASE_EXTERNAL_ANON_KEY } from "@/lib/supabase-external";
import { useAuth } from "@/contexts/AuthContext";
import { useEnhancedToast } from "@/contexts/ToastContext";

// ============================================================================
// TYPES
// ============================================================================

export interface AcademicYear {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Semester {
  id: string;
  user_id: string;
  academic_year_id: string;
  name: string;
  number: number;
  is_active: boolean;
  start_date?: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
}

interface AcademicYearContextType {
  activeYear: AcademicYear | null;
  activeSemester: Semester | null;
  academicYears: AcademicYear[];
  semesters: Semester[];
  semestersForActiveYear: Semester[];
  isLoading: boolean;
  isSwitching: boolean;
  
  switchYear: (yearId: string) => Promise<void>;
  switchSemester: (semesterId: string) => Promise<void>;
  createYear: (name: string, setActive?: boolean) => Promise<AcademicYear>;
  createSemester: (academicYearId: string, number: 1 | 2, setActive?: boolean) => Promise<Semester>;
  deleteYear: (yearId: string) => Promise<void>;
  deleteSemesterData: (semesterId: string, semesterNumber: number) => Promise<void>;
  
  activeYearId: string | null;
  activeSemesterId: string | null;
  activeSemesterNumber: number | null;
  getYearById: (id: string) => AcademicYear | undefined;
  getSemesterById: (id: string) => Semester | undefined;
  hasActiveYear: boolean;
  hasActiveSemester: boolean;
  
  invalidateAllData: () => void;
  invalidateTransactionalData: () => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const AcademicYearContext = createContext<AcademicYearContextType | undefined>(undefined);

const ACTIVE_YEAR_CACHE_KEY = "sipena_active_year_id";
const ACTIVE_SEMESTER_CACHE_KEY = "sipena_active_semester_id";

// ============================================================================
// PROVIDER
// ============================================================================

export function AcademicYearProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { success, error: showError, warning, toast } = useEnhancedToast();
  const queryClient = useQueryClient();
  
  const [isSwitching, setIsSwitching] = useState(false);

  // -------------------------------------------------------------------------
  // QUERIES
  // -------------------------------------------------------------------------

  const academicYearsQuery = useQuery({
    queryKey: ["academic_years", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("academic_years")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as AcademicYear[];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const semestersQuery = useQuery({
    queryKey: ["semesters", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("semesters")
        .select("*")
        .eq("user_id", user.id)
        .order("number", { ascending: true });

      if (error) throw error;
      return data as Semester[];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  // -------------------------------------------------------------------------
  // DERIVED STATE
  // -------------------------------------------------------------------------

  const academicYears = academicYearsQuery.data || [];
  const semesters = semestersQuery.data || [];
  const activeYear = academicYears.find(y => y.is_active) || null;
  const semestersForActiveYear = semesters.filter(s => s.academic_year_id === activeYear?.id);
  const activeSemester = semesters.find(s => s.is_active && s.academic_year_id === activeYear?.id) || null;

  // -------------------------------------------------------------------------
  // LOCAL STORAGE SYNC
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (activeYear) {
      localStorage.setItem(ACTIVE_YEAR_CACHE_KEY, activeYear.id);
    }
  }, [activeYear?.id]);

  useEffect(() => {
    if (activeSemester) {
      localStorage.setItem(ACTIVE_SEMESTER_CACHE_KEY, activeSemester.id);
    }
  }, [activeSemester?.id]);

  // -------------------------------------------------------------------------
  // MUTATIONS
  // -------------------------------------------------------------------------

  const switchYearMutation = useMutation({
    mutationFn: async (yearId: string) => {
      if (!user) throw new Error("User not authenticated");

      await supabase
        .from("academic_years")
        .update({ is_active: false })
        .eq("user_id", user.id);

      const { data, error } = await supabase
        .from("academic_years")
        .update({ is_active: true })
        .eq("id", yearId)
        .select()
        .single();

      if (error) throw error;
      
      const { data: yearSemesters } = await supabase
        .from("semesters")
        .select("*")
        .eq("academic_year_id", yearId)
        .order("number", { ascending: true });
      
      if (yearSemesters && yearSemesters.length > 0) {
        await supabase
          .from("semesters")
          .update({ is_active: false })
          .eq("user_id", user.id);
        
        await supabase
          .from("semesters")
          .update({ is_active: true })
          .eq("id", yearSemesters[0].id);
      }
      
      return data as AcademicYear;
    },
  });

  const switchSemesterMutation = useMutation({
    mutationFn: async (semesterId: string) => {
      if (!user) throw new Error("User not authenticated");

      await supabase
        .from("semesters")
        .update({ is_active: false })
        .eq("user_id", user.id);

      const { data, error } = await supabase
        .from("semesters")
        .update({ is_active: true })
        .eq("id", semesterId)
        .select()
        .single();

      if (error) throw error;
      return data as Semester;
    },
  });

  const createYearMutation = useMutation({
    mutationFn: async ({ name, setActive }: { name: string; setActive: boolean }) => {
      if (!user) throw new Error("User not authenticated");

      if (setActive) {
        await supabase
          .from("academic_years")
          .update({ is_active: false })
          .eq("user_id", user.id);
      }

      const { data, error } = await supabase
        .from("academic_years")
        .insert({
          user_id: user.id,
          name,
          is_active: setActive,
        })
        .select()
        .single();

      if (error) throw error;
      return data as AcademicYear;
    },
  });

  const createSemesterMutation = useMutation({
    mutationFn: async ({ 
      academicYearId, 
      number, 
      setActive 
    }: { 
      academicYearId: string; 
      number: 1 | 2; 
      setActive: boolean;
    }) => {
      if (!user) throw new Error("User not authenticated");

      const currentYear = new Date().getFullYear();
      let startDate: string;
      let endDate: string;
      
      if (number === 1) {
        startDate = `${currentYear}-07-01`;
        endDate = `${currentYear}-12-31`;
      } else {
        startDate = `${currentYear + 1}-01-01`;
        endDate = `${currentYear + 1}-06-30`;
      }

      if (setActive) {
        await supabase
          .from("semesters")
          .update({ is_active: false })
          .eq("user_id", user.id);
      }

      const { data, error } = await supabase
        .from("semesters")
        .insert({
          user_id: user.id,
          academic_year_id: academicYearId,
          name: `Semester ${number}`,
          number,
          is_active: setActive,
          start_date: startDate,
          end_date: endDate,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Semester;
    },
  });

  // -------------------------------------------------------------------------
  // ACTIONS
  // -------------------------------------------------------------------------

  const invalidateAllData = useCallback(() => {
    const queriesToInvalidate = [
      "academic_years",
      "semesters",
      "classes",
      "subjects",
      "all_subjects",
      "students",
      "grades",
      "grades_by_class",
      "attendance",
      "attendance_holidays",
      "attendance_lock",
      "chapters",
      "assignments",
      "all_assignments",
      "shared_links",
      "notifications",
      "input_progress",
    ];

    queriesToInvalidate.forEach(key => {
      queryClient.invalidateQueries({ queryKey: [key] });
    });
  }, [queryClient]);

  const invalidateTransactionalData = useCallback(() => {
    const queriesToInvalidate = [
      "semesters",
      "grades",
      "grades_by_class",
      "chapters",
      "assignments",
      "all_assignments",
      "input_progress",
      "report-grades-all",
      "report-chapters-all",
      "report-assignments-all",
    ];

    queriesToInvalidate.forEach(key => {
      queryClient.invalidateQueries({ queryKey: [key] });
    });
  }, [queryClient]);

  const switchYear = useCallback(async (yearId: string) => {
    try {
      setIsSwitching(true);
      await switchYearMutation.mutateAsync(yearId);
      invalidateAllData();
      success("Tahun ajaran berhasil diganti", "Halaman akan dimuat ulang...");
      setTimeout(() => window.location.reload(), 500);
    } catch (err: any) {
      showError("Gagal mengganti tahun ajaran", err.message);
      throw err;
    } finally {
      setIsSwitching(false);
    }
  }, [switchYearMutation, invalidateAllData, success, showError]);

  const switchSemester = useCallback(async (semesterId: string) => {
    try {
      setIsSwitching(true);
      await switchSemesterMutation.mutateAsync(semesterId);
      invalidateTransactionalData();
      success("Semester berhasil diganti", "Halaman akan dimuat ulang...");
      setTimeout(() => window.location.reload(), 500);
    } catch (err: any) {
      showError("Gagal mengganti semester", err.message);
      throw err;
    } finally {
      setIsSwitching(false);
    }
  }, [switchSemesterMutation, invalidateTransactionalData, success, showError]);

  const createYear = useCallback(async (name: string, setActive: boolean = true): Promise<AcademicYear> => {
    try {
      const newYear = await createYearMutation.mutateAsync({ name, setActive });
      await queryClient.invalidateQueries({ queryKey: ["academic_years"] });
      if (setActive) invalidateAllData();
      success("Tahun ajaran berhasil dibuat", `${name} telah ditambahkan`);
      return newYear;
    } catch (err: any) {
      showError("Gagal membuat tahun ajaran", err.message);
      throw err;
    }
  }, [createYearMutation, queryClient, invalidateAllData, success, showError]);

  const createSemester = useCallback(async (
    academicYearId: string, 
    number: 1 | 2, 
    setActive: boolean = false
  ): Promise<Semester> => {
    try {
      const newSemester = await createSemesterMutation.mutateAsync({ 
        academicYearId, 
        number, 
        setActive 
      });
      await queryClient.invalidateQueries({ queryKey: ["semesters"] });
      if (setActive) invalidateTransactionalData();
      success("Semester berhasil dibuat", `Semester ${number} telah ditambahkan`);
      return newSemester;
    } catch (err: any) {
      showError("Gagal membuat semester", err.message);
      throw err;
    }
  }, [createSemesterMutation, queryClient, invalidateTransactionalData, success, showError]);

  // -------------------------------------------------------------------------
  // DELETE YEAR - Direct execution with confirmation toast
  // -------------------------------------------------------------------------
  const deleteYear = useCallback(async (yearId: string) => {
    if (!user) throw new Error("User not authenticated");

    const yearToDelete = academicYears.find(y => y.id === yearId);
    if (!yearToDelete) {
      showError("Tahun ajaran tidak ditemukan", "");
      return;
    }

    const isActiveYear = yearId === activeYear?.id;
    const otherYears = academicYears.filter(y => y.id !== yearId);
    const hasOtherYears = otherYears.length > 0;

    // Determine what happens after deletion
    let postDeleteAction: "switch" | "setup" = "setup";
    let switchToYearId: string | null = null;
    
    if (hasOtherYears) {
      const mostRecentYear = otherYears.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];
      postDeleteAction = "switch";
      switchToYearId = mostRecentYear.id;
    }

    console.log("================================================================");
    console.log("[AcademicYearContext] DELETE YEAR - Starting");
    console.log("[AcademicYearContext] Year ID:", yearId);
    console.log("[AcademicYearContext] Year Name:", yearToDelete.name);
    console.log("[AcademicYearContext] Is Active:", isActiveYear);
    console.log("[AcademicYearContext] Has Other Years:", hasOtherYears);
    console.log("================================================================");

    // Show processing toast
    warning(`Menghapus ${yearToDelete.name}...`, "Mohon tunggu sebentar");

    try {
      const response = await fetch(`${EDGE_FUNCTIONS_URL}/delete-semester-data`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_EXTERNAL_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: "delete_year_data",
          academic_year_id: yearId,
          user_id: user.id,
        }),
      });

      const result = await response.json();
      console.log("[AcademicYearContext] Year deletion result:", result);

      if (!result.success) {
        throw new Error(result.error || "Gagal menghapus tahun ajaran");
      }

      await queryClient.invalidateQueries({ queryKey: ["academic_years"] });
      await queryClient.invalidateQueries({ queryKey: ["semesters"] });
      invalidateAllData();

      success("Tahun ajaran berhasil dihapus", `${yearToDelete.name} dan semua data terkait telah dihapus.`);

      // Handle post-deletion navigation
      if (isActiveYear) {
        setTimeout(() => {
          if (postDeleteAction === "switch" && switchToYearId) {
            switchYear(switchToYearId);
          } else {
            window.location.href = "/dashboard";
          }
        }, 1000);
      }
    } catch (err: any) {
      console.error("[AcademicYearContext] Year deletion error:", err);
      showError("Gagal menghapus tahun ajaran", err.message);
    }
  }, [user, activeYear, academicYears, queryClient, invalidateAllData, success, showError, warning, switchYear]);

  // -------------------------------------------------------------------------
  // DELETE SEMESTER DATA - Direct execution with detailed logging
  // -------------------------------------------------------------------------
  const deleteSemesterData = useCallback(async (semesterId: string, semesterNumber: number) => {
    if (!user) {
      showError("Autentikasi diperlukan", "Silakan login ulang");
      return;
    }
    
    const semester = semesters.find(s => s.id === semesterId);
    if (!semester) {
      showError("Semester tidak ditemukan", "");
      return;
    }

    const edgeFunctionUrl = `${EDGE_FUNCTIONS_URL}/delete-semester-data`;

    console.log("================================================================");
    console.log("[AcademicYearContext] DELETE SEMESTER DATA - Starting");
    console.log("[AcademicYearContext] Semester ID:", semesterId);
    console.log("[AcademicYearContext] Semester Number:", semesterNumber);
    console.log("[AcademicYearContext] User ID:", user.id);
    console.log("[AcademicYearContext] Edge Function URL:", edgeFunctionUrl);
    console.log("================================================================");

    // Show processing toast immediately
    warning(`Menghapus data Semester ${semesterNumber}...`, "Mohon tunggu, proses penghapusan sedang berlangsung");

    try {
      const requestBody = {
        action: "delete_semester_data",
        semester_id: semesterId,
        user_id: user.id,
      };
      
      console.log("[AcademicYearContext] Request body:", JSON.stringify(requestBody, null, 2));
      console.log("[AcademicYearContext] Calling Edge Function NOW...");
      
      const response = await fetch(edgeFunctionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_EXTERNAL_ANON_KEY}`,
        },
        body: JSON.stringify(requestBody),
      });

      console.log("[AcademicYearContext] Response received!");
      console.log("[AcademicYearContext] Response status:", response.status);
      console.log("[AcademicYearContext] Response ok:", response.ok);
      
      const responseText = await response.text();
      console.log("[AcademicYearContext] Raw response:", responseText);
      
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error("[AcademicYearContext] Failed to parse response as JSON:", parseError);
        throw new Error(`Invalid response from server: ${responseText.substring(0, 100)}`);
      }
      
      console.log("[AcademicYearContext] Parsed response:", JSON.stringify(result, null, 2));

      // Check for Edge Function version
      if (result._version) {
        console.log("[AcademicYearContext] ✅ Edge function version:", result._version);
      } else {
        console.warn("[AcademicYearContext] ⚠️ No version info - Edge Function may be outdated");
      }

      // Check for debug info
      if (result.debug) {
        console.log("[AcademicYearContext] Debug info:", JSON.stringify(result.debug, null, 2));
      }

      if (!result.success) {
        throw new Error(result.error || "Gagal menghapus data semester");
      }

      // Invalidate queries to refresh UI
      invalidateTransactionalData();

      // Show success with deletion counts
      const deletedInfo = result.deleted || {};
      success(
        `Data Semester ${semesterNumber} berhasil dihapus!`,
        `Terhapus: ${deletedInfo.grades || 0} nilai, ${deletedInfo.chapters || 0} BAB, ${deletedInfo.assignments || 0} tugas, ${deletedInfo.attendance || 0} presensi`
      );
      
      console.log("[AcademicYearContext] ========================================");
      console.log("[AcademicYearContext] SEMESTER DELETION SUCCESSFUL!");
      console.log("[AcademicYearContext] Deleted:", deletedInfo);
      console.log("[AcademicYearContext] ========================================");
      
    } catch (err: any) {
      console.error("================================================================");
      console.error("[AcademicYearContext] SEMESTER DELETION FAILED");
      console.error("[AcademicYearContext] Error:", err);
      console.error("[AcademicYearContext] Error message:", err.message);
      console.error("================================================================");
      showError("Gagal menghapus data semester", err.message);
    }
  }, [user, semesters, invalidateTransactionalData, success, showError, warning]);

  const getYearById = useCallback((id: string) => {
    return academicYears.find(y => y.id === id);
  }, [academicYears]);

  const getSemesterById = useCallback((id: string) => {
    return semesters.find(s => s.id === id);
  }, [semesters]);

  // -------------------------------------------------------------------------
  // CONTEXT VALUE
  // -------------------------------------------------------------------------

  const value: AcademicYearContextType = {
    activeYear,
    activeSemester,
    academicYears,
    semesters,
    semestersForActiveYear,
    isLoading: academicYearsQuery.isLoading || semestersQuery.isLoading,
    isSwitching,
    
    switchYear,
    switchSemester,
    createYear,
    createSemester,
    deleteYear,
    deleteSemesterData,
    
    activeYearId: activeYear?.id || null,
    activeSemesterId: activeSemester?.id || null,
    activeSemesterNumber: activeSemester?.number || null,
    getYearById,
    getSemesterById,
    hasActiveYear: !!activeYear,
    hasActiveSemester: !!activeSemester,
    
    invalidateAllData,
    invalidateTransactionalData,
  };

  return (
    <AcademicYearContext.Provider value={value}>
      {children}
    </AcademicYearContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useAcademicYear(): AcademicYearContextType {
  const context = useContext(AcademicYearContext);
  
  if (context === undefined) {
    throw new Error("useAcademicYear must be used within an AcademicYearProvider");
  }
  
  return context;
}
