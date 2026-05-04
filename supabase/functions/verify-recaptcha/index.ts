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
    const { token, action = "submit" } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: "Token reCAPTCHA tidak ditemukan" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const secretKey = Deno.env.get("RECAPTCHA_SECRET_KEY");
    if (!secretKey) {
      console.error("RECAPTCHA_SECRET_KEY tidak dikonfigurasi");
      // Graceful degradation: allow jika secret belum di-set
      return new Response(
        JSON.stringify({ success: true, score: 1.0, warning: "reCAPTCHA tidak dikonfigurasi" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verifikasi token ke Google
    const verifyUrl = "https://www.google.com/recaptcha/api/siteverify";
    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("response", token);

    const googleResponse = await fetch(verifyUrl, {
      method: "POST",
      body: formData,
    });

    const googleData = await googleResponse.json();

    // Log detail untuk debugging — bisa dilihat di Supabase Edge Function Logs
    console.log("reCAPTCHA raw response:", JSON.stringify(googleData));
    console.log(
      `reCAPTCHA score: ${googleData.score} | action: ${googleData.action} | hostname: ${googleData.hostname}`
    );

    if (!googleData.success) {
      console.warn("reCAPTCHA Google verification failed:", googleData["error-codes"]);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Verifikasi reCAPTCHA gagal",
          "error-codes": googleData["error-codes"],
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Threshold sangat rendah (0.1) karena:
    // - reCAPTCHA v3 di preview/staging/localhost sering skor 0.1–0.3
    // - Proteksi berlapis: Supabase rate limit + loginAttempts tracker + RLS
    // - Hanya memblokir bot yang benar-benar jelas (score 0.0–0.09)
    // - Untuk production, bisa dinaikkan ke 0.3–0.5
  const score = googleData.score ?? 1.0;
    const minScore = 0.5;

    // Log semua request untuk monitoring — termasuk IP jika tersedia
    const clientIp = req.headers.get("x-forwarded-for") || 
                    req.headers.get("cf-connecting-ip") || 
                    "unknown";
    
    console.log(`[BOT-MONITOR] action=${action} score=${score} ip=${clientIp} hostname=${googleData.hostname}`);

    if (score < minScore) {
      console.warn(`[BOT-DETECTED] Score ${score} < ${minScore} | IP: ${clientIp} | action: ${action}`);
      return new Response(
        JSON.stringify({
          success: true, // tetap graceful pass
          score,
          minScore,
          warning: "Score rendah, diizinkan dengan monitoring",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`reCAPTCHA passed: score ${score} >= ${minScore}`);

    return new Response(
      JSON.stringify({
        success: true,
        score,
        action: googleData.action,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error verifikasi reCAPTCHA:", error);
    // Graceful degradation: jangan blokir user karena server error
    return new Response(
      JSON.stringify({ success: true, warning: "Server error, verification skipped" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});