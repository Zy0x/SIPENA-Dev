import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Resend types
interface ResendEmailResponse {
  id?: string;
  error?: { message: string };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendOtpRequest {
  email: string;
  type: "email_verification" | "password_reset";
  userId?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get Resend API key from secrets
    const resendApiKey = Deno.env.get("RESEND_OTP_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_OTP_KEY not configured");
    }

    // Get Supabase credentials - prioritize external Supabase
    // For external Supabase: use SBASE_URL or hardcoded external URL
    const supabaseUrl = Deno.env.get("SBASE_URL") || Deno.env.get("SUPABASE_URL") || "https://jdncrsmjvbweyxcbtnou.supabase.co";
    const serviceRoleKey = Deno.env.get("SBASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!serviceRoleKey) {
      throw new Error("Service role key not configured");
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { email, type, userId }: SendOtpRequest = await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Generate unique token
    const token = crypto.randomUUID();

    // Set expiry (15 minutes)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // Store OTP in password_reset_tokens table (can be used for both purposes)
    const { error: dbError } = await supabaseAdmin
      .from("password_reset_tokens")
      .insert({
        token,
        otp_code: otp,
        user_id: userId || null,
        method: "email",
        expires_at: expiresAt,
        used: false,
      });

    if (dbError) {
      console.error("Database error:", dbError);
      throw new Error("Failed to store OTP");
    }

    // Prepare email content based on type
    const subject = type === "email_verification" 
      ? "Verifikasi Email SIPENA - Kode OTP Anda"
      : "Reset Password SIPENA - Kode OTP Anda";

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; padding: 20px;">
        <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #6366f1; font-size: 28px; margin: 0;">SIPENA</h1>
            <p style="color: #71717a; font-size: 14px; margin-top: 4px;">Sistem Informasi Penilaian Akademik</p>
          </div>
          
          <h2 style="color: #18181b; font-size: 20px; margin-bottom: 16px;">
            ${type === "email_verification" ? "Verifikasi Email Anda" : "Reset Password"}
          </h2>
          
          <p style="color: #3f3f46; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
            ${type === "email_verification" 
              ? "Gunakan kode OTP di bawah ini untuk memverifikasi alamat email Anda:" 
              : "Gunakan kode OTP di bawah ini untuk mereset password Anda:"}
          </p>
          
          <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <p style="color: rgba(255,255,255,0.8); font-size: 12px; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">Kode OTP Anda</p>
            <p style="color: white; font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 0;">${otp}</p>
          </div>
          
          <p style="color: #71717a; font-size: 12px; text-align: center; margin-bottom: 24px;">
            ⏱️ Kode ini berlaku selama <strong>15 menit</strong>
          </p>
          
          <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <p style="color: #92400e; font-size: 12px; margin: 0;">
              ⚠️ <strong>Jangan bagikan kode ini kepada siapapun.</strong> Tim SIPENA tidak akan pernah meminta kode OTP Anda.
            </p>
          </div>
          
          <p style="color: #a1a1aa; font-size: 12px; text-align: center;">
            Jika Anda tidak meminta kode ini, abaikan email ini.
          </p>
        </div>
        
        <p style="color: #a1a1aa; font-size: 11px; text-align: center; margin-top: 24px;">
          © 2024-2025 SIPENA. Made with ❤️ in Indonesia
        </p>
      </body>
      </html>
    `;

    // Send email via Resend REST API
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "SIPENA <noreply@sipena.my.id>",
        to: [email],
        subject,
        html: htmlContent,
      }),
    });

    const emailResult: ResendEmailResponse = await emailResponse.json();

    if (!emailResponse.ok) {
      throw new Error(emailResult.error?.message || "Failed to send email");
    }

    console.log("OTP email sent successfully:", emailResult);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "OTP sent successfully",
        token // Return token for verification
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-otp-email:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Failed to send OTP" 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
