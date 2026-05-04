import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// VERSION - Update this on every deployment to verify correct version is running
const VERSION = "v2.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// External Supabase Configuration - use service role key for bypassing RLS
const EXTERNAL_SUPABASE_URL = Deno.env.get("SBASE_URL") || Deno.env.get("SUPABASE_URL") || "";
const EXTERNAL_SERVICE_ROLE_KEY = Deno.env.get("SBASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

interface DeleteRequest {
  action: "delete_semester_data" | "delete_year_data";
  semester_id?: string;
  semester_number?: number;
  academic_year_id?: string;
  user_id: string;
}

interface DeleteResult {
  success: boolean;
  message: string;
  deleted?: {
    grades: number;
    assignments: number;
    chapters: number;
    attendance: number;
    subjects?: number;
    students?: number;
    classes?: number;
    semesters?: number;
  };
  error?: string;
  _version?: string;
  debug?: any;
}

serve(async (req) => {
  // Log version on every request
  console.log(`[${VERSION}] ========================================`);
  console.log(`[${VERSION}] delete-semester-data function called`);
  console.log(`[${VERSION}] Timestamp: ${new Date().toISOString()}`);
  console.log(`[${VERSION}] Method: ${req.method}`);
  console.log(`[${VERSION}] ========================================`);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    console.log(`[${VERSION}] Handling CORS preflight`);
    return new Response("ok", { headers: corsHeaders });
  }

  console.log(`[${VERSION}] Request received, processing...`);

  try {
    const body = await req.json();
    const { action, semester_id, semester_number, academic_year_id, user_id }: DeleteRequest = body;

    console.log(`[${VERSION}] Parsed request body:`);
    console.log(`[${VERSION}] - Action: ${action}`);
    console.log(`[${VERSION}] - Semester ID: ${semester_id}`);
    console.log(`[${VERSION}] - Academic Year ID: ${academic_year_id}`);
    console.log(`[${VERSION}] - User ID: ${user_id}`);

    if (!user_id) {
      console.error(`[${VERSION}] ERROR: Missing user_id`);
      return new Response(
        JSON.stringify({ success: false, error: "User ID is required", _version: VERSION }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!EXTERNAL_SUPABASE_URL || !EXTERNAL_SERVICE_ROLE_KEY) {
      console.error(`[${VERSION}] ERROR: Missing Supabase credentials`);
      console.log(`[${VERSION}] SBASE_URL exists: ${!!Deno.env.get("SBASE_URL")}`);
      console.log(`[${VERSION}] SUPABASE_URL exists: ${!!Deno.env.get("SUPABASE_URL")}`);
      console.log(`[${VERSION}] SBASE_SERVICE_ROLE_KEY exists: ${!!Deno.env.get("SBASE_SERVICE_ROLE_KEY")}`);
      console.log(`[${VERSION}] SUPABASE_SERVICE_ROLE_KEY exists: ${!!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Supabase credentials not configured. Please set SBASE_URL and SBASE_SERVICE_ROLE_KEY in Edge Function secrets.",
          _version: VERSION
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[${VERSION}] Supabase credentials OK, creating admin client...`);
    console.log(`[${VERSION}] URL: ${EXTERNAL_SUPABASE_URL.substring(0, 30)}...`);

    // Create service role client (bypasses RLS)
    const supabaseAdmin = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    if (action === "delete_semester_data") {
      if (!semester_id) {
        return new Response(
          JSON.stringify({ success: false, error: "Semester ID is required", _version: VERSION }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[${VERSION}] Starting semester data deletion for: ${semester_id}`);
      const result = await deleteSemesterData(supabaseAdmin, semester_id, user_id);
      console.log(`[${VERSION}] Semester deletion result:`, JSON.stringify(result));
      
      return new Response(
        JSON.stringify({ ...result, _version: VERSION }),
        { status: result.success ? 200 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete_year_data") {
      if (!academic_year_id) {
        return new Response(
          JSON.stringify({ success: false, error: "Academic year ID is required", _version: VERSION }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[${VERSION}] Starting year data deletion for: ${academic_year_id}`);
      const result = await deleteYearData(supabaseAdmin, academic_year_id, user_id);
      console.log(`[${VERSION}] Year deletion result:`, JSON.stringify(result));
      
      return new Response(
        JSON.stringify({ ...result, _version: VERSION }),
        { status: result.success ? 200 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Invalid action. Use 'delete_semester_data' or 'delete_year_data'", _version: VERSION }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error(`[${VERSION}] Fatal error:`, error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, _version: VERSION }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Delete semester transactional data only
 * Keeps: classes, subjects, students (year-level data)
 * Deletes: grades, assignments, chapters, attendance for this semester
 * 
 * IMPORTANT: Grades may not have direct semester_id, so we delete via:
 * 1. Find all chapters with this semester_id
 * 2. Find all assignments in those chapters
 * 3. Delete grades that reference those assignments (by assignment_id or chapter)
 * 4. Then delete assignments and chapters
 */
async function deleteSemesterData(
  supabase: any,
  semesterId: string,
  userId: string
): Promise<DeleteResult> {
  const deleted = {
    grades: 0,
    assignments: 0,
    chapters: 0,
    attendance: 0,
  };
  
  const debug: any = {
    steps: [],
    errors: [],
  };

  try {
    console.log("[deleteSemesterData] ========================================");
    console.log("[deleteSemesterData] Starting deletion for semester:", semesterId);
    console.log("[deleteSemesterData] User ID:", userId);
    console.log("[deleteSemesterData] ========================================");

    // Step 1: Get all chapters for this semester
    debug.steps.push("Step 1: Getting chapters");
    console.log("[deleteSemesterData] Step 1: Getting chapters for semester");
    
    const { data: chapters, error: chaptersQueryError } = await supabase
      .from("chapters")
      .select("id, name")
      .eq("semester_id", semesterId)
      .eq("user_id", userId);

    if (chaptersQueryError) {
      console.error("[deleteSemesterData] Error fetching chapters:", chaptersQueryError);
      debug.errors.push({ step: 1, error: chaptersQueryError.message });
    }

    const chapterIds = chapters?.map((c: { id: string }) => c.id) || [];
    console.log("[deleteSemesterData] Found", chapterIds.length, "chapters");
    debug.steps.push(`Found ${chapterIds.length} chapters`);

    // Step 2: Get all assignments from these chapters
    let assignmentIds: string[] = [];
    if (chapterIds.length > 0) {
      debug.steps.push("Step 2: Getting assignments");
      console.log("[deleteSemesterData] Step 2: Getting assignments for chapters");
      
      const { data: assignments, error: assignmentsQueryError } = await supabase
        .from("assignments")
        .select("id, name")
        .in("chapter_id", chapterIds);

      if (assignmentsQueryError) {
        console.error("[deleteSemesterData] Error fetching assignments:", assignmentsQueryError);
        debug.errors.push({ step: 2, error: assignmentsQueryError.message });
      }

      assignmentIds = assignments?.map((a: { id: string }) => a.id) || [];
      console.log("[deleteSemesterData] Found", assignmentIds.length, "assignments");
      debug.steps.push(`Found ${assignmentIds.length} assignments`);
    }

    // Step 3: Delete grades - try multiple approaches
    debug.steps.push("Step 3: Deleting grades");
    console.log("[deleteSemesterData] Step 3: Deleting grades");

    // Approach 3a: Delete by semester_id directly (if column exists)
    try {
      const { data: deletedGrades1, error: gradesError1 } = await supabase
        .from("grades")
        .delete()
        .eq("semester_id", semesterId)
        .eq("user_id", userId)
        .select("id");

      if (!gradesError1) {
        deleted.grades += deletedGrades1?.length || 0;
        console.log("[deleteSemesterData] Deleted grades by semester_id:", deletedGrades1?.length || 0);
      } else {
        console.log("[deleteSemesterData] semester_id approach failed:", gradesError1.message);
        debug.errors.push({ step: "3a", error: gradesError1.message });
      }
    } catch (e) {
      console.log("[deleteSemesterData] semester_id column may not exist");
    }

    // Approach 3b: Delete by assignment_id (if we have assignments)
    if (assignmentIds.length > 0) {
      try {
        const { data: deletedGrades2, error: gradesError2 } = await supabase
          .from("grades")
          .delete()
          .in("assignment_id", assignmentIds)
          .select("id");

        if (!gradesError2) {
          deleted.grades += deletedGrades2?.length || 0;
          console.log("[deleteSemesterData] Deleted grades by assignment_id:", deletedGrades2?.length || 0);
        } else {
          console.log("[deleteSemesterData] assignment_id approach failed:", gradesError2.message);
          debug.errors.push({ step: "3b", error: gradesError2.message });
        }
      } catch (e) {
        console.log("[deleteSemesterData] assignment_id column may not exist");
      }
    }

    // Approach 3c: Delete by chapter_id (if column exists)
    if (chapterIds.length > 0) {
      try {
        const { data: deletedGrades3, error: gradesError3 } = await supabase
          .from("grades")
          .delete()
          .in("chapter_id", chapterIds)
          .select("id");

        if (!gradesError3) {
          deleted.grades += deletedGrades3?.length || 0;
          console.log("[deleteSemesterData] Deleted grades by chapter_id:", deletedGrades3?.length || 0);
        } else {
          console.log("[deleteSemesterData] chapter_id approach failed:", gradesError3.message);
          debug.errors.push({ step: "3c", error: gradesError3.message });
        }
      } catch (e) {
        console.log("[deleteSemesterData] chapter_id column may not exist on grades");
      }
    }

    debug.steps.push(`Deleted ${deleted.grades} grades total`);

    // Step 4: Delete assignments
    if (chapterIds.length > 0) {
      debug.steps.push("Step 4: Deleting assignments");
      console.log("[deleteSemesterData] Step 4: Deleting assignments");
      
      const { data: deletedAssignments, error: assignmentsError } = await supabase
        .from("assignments")
        .delete()
        .in("chapter_id", chapterIds)
        .select("id");

      if (assignmentsError) {
        console.error("[deleteSemesterData] Error deleting assignments:", assignmentsError);
        debug.errors.push({ step: 4, error: assignmentsError.message });
      } else {
        deleted.assignments = deletedAssignments?.length || 0;
        console.log("[deleteSemesterData] Deleted assignments:", deleted.assignments);
      }
      debug.steps.push(`Deleted ${deleted.assignments} assignments`);
    }

    // Step 5: Delete chapters
    debug.steps.push("Step 5: Deleting chapters");
    console.log("[deleteSemesterData] Step 5: Deleting chapters");
    
    const { data: deletedChapters, error: chaptersDeleteError } = await supabase
      .from("chapters")
      .delete()
      .eq("semester_id", semesterId)
      .eq("user_id", userId)
      .select("id");

    if (chaptersDeleteError) {
      console.error("[deleteSemesterData] Error deleting chapters:", chaptersDeleteError);
      debug.errors.push({ step: 5, error: chaptersDeleteError.message });
    } else {
      deleted.chapters = deletedChapters?.length || 0;
      console.log("[deleteSemesterData] Deleted chapters:", deleted.chapters);
    }
    debug.steps.push(`Deleted ${deleted.chapters} chapters`);

    // Step 6: Delete attendance records
    debug.steps.push("Step 6: Deleting attendance");
    console.log("[deleteSemesterData] Step 6: Deleting attendance records");
    
    // Try attendance_records table
    try {
      const { data: deletedAttendance, error: attendanceError } = await supabase
        .from("attendance_records")
        .delete()
        .eq("semester_id", semesterId)
        .eq("user_id", userId)
        .select("id");

      if (!attendanceError) {
        deleted.attendance = deletedAttendance?.length || 0;
        console.log("[deleteSemesterData] Deleted attendance_records:", deleted.attendance);
      } else {
        console.log("[deleteSemesterData] attendance_records error:", attendanceError.message);
      }
    } catch (e) {
      console.log("[deleteSemesterData] attendance_records table not found");
    }

    // Try attendance table (different naming)
    try {
      const { data: deletedAttendance2, error: attendance2Error } = await supabase
        .from("attendance")
        .delete()
        .eq("semester_id", semesterId)
        .eq("user_id", userId)
        .select("id");

      if (!attendance2Error) {
        deleted.attendance += deletedAttendance2?.length || 0;
        console.log("[deleteSemesterData] Deleted attendance:", deletedAttendance2?.length || 0);
      }
    } catch (e) {
      // Ignore - table may not exist
    }
    
    debug.steps.push(`Deleted ${deleted.attendance} attendance records`);

    console.log("[deleteSemesterData] ========================================");
    console.log("[deleteSemesterData] DELETION COMPLETE");
    console.log("[deleteSemesterData] Final counts:", deleted);
    console.log("[deleteSemesterData] ========================================");

    return {
      success: true,
      message: `Data semester berhasil dihapus. Terhapus: ${deleted.grades} nilai, ${deleted.chapters} BAB, ${deleted.assignments} tugas, ${deleted.attendance} presensi.`,
      deleted,
      debug,
    };

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[deleteSemesterData] Fatal error:", errorMsg);
    debug.errors.push({ fatal: errorMsg });
    return {
      success: false,
      message: "Gagal menghapus data semester",
      error: errorMsg,
      debug,
    };
  }
}

/**
 * Delete entire academic year data including classes, subjects, students
 * This is a CASCADE delete - removes EVERYTHING related to the year
 */
async function deleteYearData(
  supabase: any,
  yearId: string,
  userId: string
): Promise<DeleteResult> {
  const deleted = {
    grades: 0,
    assignments: 0,
    chapters: 0,
    attendance: 0,
    subjects: 0,
    students: 0,
    classes: 0,
    semesters: 0,
  };

  try {
    console.log("[deleteYearData] Starting cascade delete for year:", yearId);

    // 1. Get all semesters for this year
    const { data: semesters } = await supabase
      .from("semesters")
      .select("id")
      .eq("academic_year_id", yearId)
      .eq("user_id", userId);

    const semesterIds = semesters?.map((s: { id: string }) => s.id) || [];
    console.log("[deleteYearData] Found semesters:", semesterIds.length);

    // 2. Get all chapters for these semesters
    let chapterIds: string[] = [];
    if (semesterIds.length > 0) {
      const { data: chapters } = await supabase
        .from("chapters")
        .select("id")
        .in("semester_id", semesterIds)
        .eq("user_id", userId);
      chapterIds = chapters?.map((c: { id: string }) => c.id) || [];
    }
    console.log("[deleteYearData] Found chapters:", chapterIds.length);

    // 3. Get all assignments
    let assignmentIds: string[] = [];
    if (chapterIds.length > 0) {
      const { data: assignments } = await supabase
        .from("assignments")
        .select("id")
        .in("chapter_id", chapterIds);
      assignmentIds = assignments?.map((a: { id: string }) => a.id) || [];
    }
    console.log("[deleteYearData] Found assignments:", assignmentIds.length);

    // 4. Delete grades - multiple approaches
    if (semesterIds.length > 0) {
      try {
        const { data: deletedGrades1 } = await supabase
          .from("grades")
          .delete()
          .in("semester_id", semesterIds)
          .eq("user_id", userId)
          .select("id");
        deleted.grades += deletedGrades1?.length || 0;
      } catch (e) {}
    }

    if (assignmentIds.length > 0) {
      try {
        const { data: deletedGrades2 } = await supabase
          .from("grades")
          .delete()
          .in("assignment_id", assignmentIds)
          .select("id");
        deleted.grades += deletedGrades2?.length || 0;
      } catch (e) {}
    }

    try {
      const { data: deletedGrades3 } = await supabase
        .from("grades")
        .delete()
        .eq("academic_year_id", yearId)
        .eq("user_id", userId)
        .select("id");
      deleted.grades += deletedGrades3?.length || 0;
    } catch (e) {}
    
    console.log("[deleteYearData] Deleted grades:", deleted.grades);

    // 5. Delete assignments
    if (chapterIds.length > 0) {
      const { data: deletedAssignments } = await supabase
        .from("assignments")
        .delete()
        .in("chapter_id", chapterIds)
        .select("id");
      deleted.assignments = deletedAssignments?.length || 0;
      console.log("[deleteYearData] Deleted assignments:", deleted.assignments);
    }

    // 6. Delete chapters
    if (semesterIds.length > 0) {
      const { data: deletedChapters } = await supabase
        .from("chapters")
        .delete()
        .in("semester_id", semesterIds)
        .eq("user_id", userId)
        .select("id");
      deleted.chapters = deletedChapters?.length || 0;
      console.log("[deleteYearData] Deleted chapters:", deleted.chapters);
    }

    // 7. Delete attendance
    try {
      if (semesterIds.length > 0) {
        const { data: deletedAttendance } = await supabase
          .from("attendance_records")
          .delete()
          .in("semester_id", semesterIds)
          .eq("user_id", userId)
          .select("id");
        deleted.attendance = deletedAttendance?.length || 0;
      }
    } catch (e) {
      console.log("[deleteYearData] attendance_records not found or error");
    }

    // 8. Get subjects to delete shared_links
    const { data: subjects } = await supabase
      .from("subjects")
      .select("id")
      .eq("academic_year_id", yearId)
      .eq("user_id", userId);

    const subjectIds = subjects?.map((s: { id: string }) => s.id) || [];
    
    if (subjectIds.length > 0) {
      // Delete shared_links first (foreign key constraint)
      await supabase
        .from("shared_links")
        .delete()
        .in("subject_id", subjectIds);
      console.log("[deleteYearData] Deleted shared_links for subjects");
    }

    // 9. Delete subjects
    const { data: deletedSubjects } = await supabase
      .from("subjects")
      .delete()
      .eq("academic_year_id", yearId)
      .eq("user_id", userId)
      .select("id");
    deleted.subjects = deletedSubjects?.length || 0;
    console.log("[deleteYearData] Deleted subjects:", deleted.subjects);

    // 10. Get classes to delete students
    const { data: classes } = await supabase
      .from("classes")
      .select("id")
      .eq("academic_year_id", yearId)
      .eq("user_id", userId);

    const classIds = classes?.map((c: { id: string }) => c.id) || [];

    // 11. Delete students
    if (classIds.length > 0) {
      const { data: deletedStudents } = await supabase
        .from("students")
        .delete()
        .in("class_id", classIds)
        .select("id");
      deleted.students = deletedStudents?.length || 0;
      console.log("[deleteYearData] Deleted students:", deleted.students);
    }

    // 12. Delete classes
    const { data: deletedClasses } = await supabase
      .from("classes")
      .delete()
      .eq("academic_year_id", yearId)
      .eq("user_id", userId)
      .select("id");
    deleted.classes = deletedClasses?.length || 0;
    console.log("[deleteYearData] Deleted classes:", deleted.classes);

    // 13. Delete semesters
    const { data: deletedSemesters } = await supabase
      .from("semesters")
      .delete()
      .eq("academic_year_id", yearId)
      .eq("user_id", userId)
      .select("id");
    deleted.semesters = deletedSemesters?.length || 0;
    console.log("[deleteYearData] Deleted semesters:", deleted.semesters);

    // 14. Finally delete the academic year itself
    const { error: yearError } = await supabase
      .from("academic_years")
      .delete()
      .eq("id", yearId)
      .eq("user_id", userId);

    if (yearError) {
      console.error("[deleteYearData] Error deleting year:", yearError);
      throw yearError;
    }

    console.log("[deleteYearData] Successfully deleted academic year");
    console.log("[deleteYearData] Final counts:", deleted);

    return {
      success: true,
      message: `Tahun ajaran berhasil dihapus. Terhapus: ${deleted.classes} kelas, ${deleted.students} siswa, ${deleted.subjects} mapel, ${deleted.grades} nilai.`,
      deleted,
    };

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[deleteYearData] Fatal error:", errorMsg);
    return {
      success: false,
      message: "Gagal menghapus tahun ajaran",
      error: errorMsg,
    };
  }
}
