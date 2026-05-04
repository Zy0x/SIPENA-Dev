import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DeletionRequest {
  action: "request" | "approve" | "reject" | "process_expired" | "cancel";
  requestId?: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  reason?: string;
  adminPassword?: string;
  adminResponse?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get Supabase credentials - prioritize external Supabase
    const supabaseUrl = Deno.env.get("SBASE_URL") || Deno.env.get("SUPABASE_URL") || "https://jdncrsmjvbweyxcbtnou.supabase.co";
    const serviceRoleKey = Deno.env.get("SBASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const adminPassword = Deno.env.get("ADMIN_DB_PASSWORD");

    if (!serviceRoleKey) {
      throw new Error("Service role key not configured");
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const body: DeletionRequest = await req.json();
    const { action } = body;

    // ========== CREATE DELETION REQUEST ==========
    if (action === "request") {
      const { userId, userEmail, userName, reason } = body;

      if (!userId || !userEmail) {
        throw new Error("User ID and email are required");
      }

      // Check for existing pending request
      const { data: existingRequest } = await supabaseAdmin
        .from("account_deletion_requests")
        .select("id, status, expires_at")
        .eq("user_id", userId)
        .eq("status", "pending")
        .single();

      if (existingRequest) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Permintaan penghapusan sudah ada dan sedang menunggu persetujuan admin.",
            existingRequest
          }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Create deletion request
      const { data: newRequest, error: insertError } = await supabaseAdmin
        .from("account_deletion_requests")
        .insert({
          user_id: userId,
          user_email: userEmail,
          user_name: userName || null,
          reason: reason || null,
          status: "pending",
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Create notification for admin
      // We'll notify via the notifications table with a special type
      await supabaseAdmin
        .from("notifications")
        .insert({
          user_id: userId, // Will be shown in admin panel
          title: "Permintaan Hapus Akun",
          message: `Pengguna ${userEmail} meminta penghapusan akun. Akan otomatis dihapus dalam 24 jam jika tidak direspon.`,
          type: "account_deletion_request",
          data: { requestId: newRequest.id, userName, userEmail }
        });

      return new Response(
        JSON.stringify({
          success: true,
          message: "Permintaan penghapusan akun telah dikirim ke admin. Jika tidak direspon dalam 24 jam, akun akan otomatis dihapus.",
          request: newRequest
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // ========== CANCEL DELETION REQUEST (by user) ==========
    if (action === "cancel") {
      const { requestId, userId } = body;

      if (!requestId || !userId) {
        throw new Error("Request ID and User ID are required");
      }

      const { error: updateError } = await supabaseAdmin
        .from("account_deletion_requests")
        .update({ 
          status: "rejected", 
          admin_response: "Dibatalkan oleh pengguna",
          processed_at: new Date().toISOString()
        })
        .eq("id", requestId)
        .eq("user_id", userId)
        .eq("status", "pending");

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({ success: true, message: "Permintaan penghapusan dibatalkan." }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // ========== ADMIN: APPROVE DELETION ==========
    if (action === "approve") {
      const { requestId, adminPassword: providedPassword, adminResponse } = body;

      if (providedPassword !== adminPassword) {
        return new Response(
          JSON.stringify({ success: false, error: "Password admin salah" }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Get the request details
      const { data: request, error: fetchError } = await supabaseAdmin
        .from("account_deletion_requests")
        .select("*")
        .eq("id", requestId)
        .single();

      if (fetchError || !request) {
        throw new Error("Permintaan tidak ditemukan");
      }

      // Delete all user data
      const deletionResult = await deleteUserData(supabaseAdmin, request.user_id);

      // Update request status
      await supabaseAdmin
        .from("account_deletion_requests")
        .update({
          status: "approved",
          admin_response: adminResponse || "Disetujui oleh admin",
          processed_at: new Date().toISOString(),
          processed_by: "admin"
        })
        .eq("id", requestId);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Akun dan semua data terkait telah dihapus.",
          deletionResult
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // ========== ADMIN: REJECT DELETION ==========
    if (action === "reject") {
      const { requestId, adminPassword: providedPassword, adminResponse } = body;

      if (providedPassword !== adminPassword) {
        return new Response(
          JSON.stringify({ success: false, error: "Password admin salah" }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      await supabaseAdmin
        .from("account_deletion_requests")
        .update({
          status: "rejected",
          admin_response: adminResponse || "Ditolak oleh admin",
          processed_at: new Date().toISOString(),
          processed_by: "admin"
        })
        .eq("id", requestId);

      return new Response(
        JSON.stringify({ success: true, message: "Permintaan penghapusan ditolak." }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // ========== PROCESS EXPIRED REQUESTS (cron job or manual trigger) ==========
    if (action === "process_expired") {
      const { adminPassword: providedPassword } = body;

      if (providedPassword !== adminPassword) {
        return new Response(
          JSON.stringify({ success: false, error: "Password admin salah" }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Find all expired pending requests
      const { data: expiredRequests, error: fetchError } = await supabaseAdmin
        .from("account_deletion_requests")
        .select("*")
        .eq("status", "pending")
        .lt("expires_at", new Date().toISOString());

      if (fetchError) throw fetchError;

      const results = [];

      for (const request of expiredRequests || []) {
        try {
          // Delete user data
          const deletionResult = await deleteUserData(supabaseAdmin, request.user_id);

          // Update request status
          await supabaseAdmin
            .from("account_deletion_requests")
            .update({
              status: "auto_deleted",
              admin_response: "Otomatis dihapus setelah 24 jam tanpa respons admin",
              processed_at: new Date().toISOString(),
              processed_by: "system"
            })
            .eq("id", request.id);

          results.push({ 
            requestId: request.id, 
            userId: request.user_id, 
            success: true, 
            deletionResult 
          });
        } catch (err: any) {
          results.push({ 
            requestId: request.id, 
            userId: request.user_id, 
            success: false, 
            error: err.message 
          });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Processed ${results.length} expired deletion requests`,
          results
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    throw new Error("Invalid action");

  } catch (error: any) {
    console.error("Error in process-account-deletion:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

// Helper function to delete all user data
async function deleteUserData(supabase: any, userId: string) {
  const results: Record<string, any> = {};

  try {
    // Order matters due to foreign key constraints
    // 1. Delete grades
    const { error: gradesError, count: gradesCount } = await supabase
      .from("grades")
      .delete()
      .eq("user_id", userId)
      .select("*", { count: "exact", head: true });
    results.grades = { deleted: !gradesError, count: gradesCount };

    // 2. Delete assignments
    const { error: assignmentsError } = await supabase
      .from("assignments")
      .delete()
      .eq("user_id", userId);
    results.assignments = { deleted: !assignmentsError };

    // 3. Delete chapters
    const { error: chaptersError } = await supabase
      .from("chapters")
      .delete()
      .eq("user_id", userId);
    results.chapters = { deleted: !chaptersError };

    // 4. Delete shared_links (and their audit logs will be orphaned but safe)
    const { error: sharedLinksError } = await supabase
      .from("shared_links")
      .delete()
      .eq("user_id", userId);
    results.shared_links = { deleted: !sharedLinksError };

    // 5. Delete subjects
    const { error: subjectsError } = await supabase
      .from("subjects")
      .delete()
      .eq("user_id", userId);
    results.subjects = { deleted: !subjectsError };

    // 6. Delete students
    const { error: studentsError } = await supabase
      .from("students")
      .delete()
      .eq("user_id", userId);
    results.students = { deleted: !studentsError };

    // 7. Delete classes
    const { error: classesError } = await supabase
      .from("classes")
      .delete()
      .eq("user_id", userId);
    results.classes = { deleted: !classesError };

    // 8. Delete semesters
    const { error: semestersError } = await supabase
      .from("semesters")
      .delete()
      .eq("user_id", userId);
    results.semesters = { deleted: !semestersError };

    // 9. Delete academic_years
    const { error: academicYearsError } = await supabase
      .from("academic_years")
      .delete()
      .eq("user_id", userId);
    results.academic_years = { deleted: !academicYearsError };

    // 10. Delete activity_logs
    const { error: activityLogsError } = await supabase
      .from("activity_logs")
      .delete()
      .eq("user_id", userId);
    results.activity_logs = { deleted: !activityLogsError };

    // 11. Delete notifications
    const { error: notificationsError } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", userId);
    results.notifications = { deleted: !notificationsError };

    // 12. Delete user_preferences
    const { error: preferencesError } = await supabase
      .from("user_preferences")
      .delete()
      .eq("user_id", userId);
    results.user_preferences = { deleted: !preferencesError };

    // 12b. Delete attendance records
    const { error: attendanceError } = await supabase
      .from("attendance")
      .delete()
      .eq("user_id", userId);
    results.attendance = { deleted: !attendanceError };

    // 12c. Delete user_roles
    const { error: rolesError } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId);
    results.user_roles = { deleted: !rolesError };

    // 12d. Delete profiles
    const { error: profilesError } = await supabase
      .from("profiles")
      .delete()
      .eq("id", userId);
    results.profiles = { deleted: !profilesError };

    // 12e. Delete password_reset_tokens
    const { error: tokensError } = await supabase
      .from("password_reset_tokens")
      .delete()
      .eq("user_id", userId);
    results.password_reset_tokens = { deleted: !tokensError };

    // 12f. Delete account_deletion_requests (except current one being processed)
    const { error: deletionReqError } = await supabase
      .from("account_deletion_requests")
      .delete()
      .eq("user_id", userId);
    results.account_deletion_requests = { deleted: !deletionReqError };

    // 12g. Delete guest_audit_logs related to user's shared links
    const { error: guestAuditError } = await supabase
      .from("guest_audit_logs")
      .delete()
      .eq("user_id", userId);
    results.guest_audit_logs = { deleted: !guestAuditError };

    // 13. Delete avatar from storage
    try {
      const { error: storageError } = await supabase.storage
        .from("avatars")
        .remove([`${userId}/avatar`]);
      results.avatar = { deleted: !storageError };
    } catch {
      results.avatar = { deleted: false, note: "No avatar found" };
    }

    // 14. Delete the auth user (requires admin API)
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);
    results.auth_user = { deleted: !authError };

    return results;
  } catch (error: any) {
    console.error("Error deleting user data:", error);
    throw error;
  }
}

serve(handler);
