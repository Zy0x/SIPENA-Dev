import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: "Token reCAPTCHA v2 tidak ditemukan" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const secretKey = Deno.env.get("RECAPTCHA_V2_SECRET_KEY");
    if (!secretKey) {
      console.error("RECAPTCHA_V2_SECRET_KEY tidak dikonfigurasi");
      return new Response(
        JSON.stringify({ success: true, warning: "reCAPTCHA v2 tidak dikonfigurasi" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify token with Google
    const verifyUrl = "https://www.google.com/recaptcha/api/siteverify";
    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("response", token);

    // Forward client IP if available
    const clientIp = req.headers.get("x-forwarded-for") || 
                    req.headers.get("cf-connecting-ip");
    if (clientIp) {
      formData.append("remoteip", clientIp);
    }

    const googleResponse = await fetch(verifyUrl, {
      method: "POST",
      body: formData,
    });

    const googleData = await googleResponse.json();

    console.log("[reCAPTCHA-v2] Response:", JSON.stringify(googleData));

    if (!googleData.success) {
      console.warn("[reCAPTCHA-v2] Verification failed:", googleData["error-codes"]);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Verifikasi CAPTCHA gagal. Silakan coba lagi.",
          "error-codes": googleData["error-codes"],
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[reCAPTCHA-v2] Verification passed");

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[reCAPTCHA-v2] Error:", error);
    return new Response(
      JSON.stringify({ success: true, warning: "Server error, verification skipped" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
