import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const groqApiKey = Deno.env.get("GROQ_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Supabase configuration missing");
    if (!groqApiKey) throw new Error("GROQ_API_KEY not configured in Supabase Secrets.");

    const body = await req.json();
    const { studentId, subjectId, modelId = "llama-3.3-70b-versatile" } = body;

    // Get user_id: prefer body (always sent by client), fallback to JWT
    let userId: string | null = body.user_id || null;

    if (!userId) {
      // Try JWT as fallback
      const authHeader = req.headers.get("Authorization") || "";
      const accessToken = authHeader.replace("Bearer ", "").trim();
      if (accessToken && accessToken.split(".").length === 3 && accessToken.length > 100) {
        try {
          const payloadBase64 = accessToken.split(".")[1];
          const payloadJson = atob(payloadBase64.replace(/-/g, "+").replace(/_/g, "/"));
          const payload = JSON.parse(payloadJson);
          userId = payload.sub || null;
        } catch { /* ignore */ }
      }
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Autentikasi diperlukan. Silakan login ulang." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!studentId || !subjectId) throw new Error("studentId and subjectId are required");

    // Use service role to bypass RLS
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const [{ data: student }, { data: subject }, { data: grades }] = await Promise.all([
      adminClient.from("students").select("name, nisn").eq("id", studentId).single(),
      adminClient.from("subjects").select("name, kkm").eq("id", subjectId).single(),
      adminClient.from("grades")
        .select("grade_type, value, assignment_id, created_at")
        .eq("student_id", studentId)
        .eq("subject_id", subjectId)
        .order("created_at", { ascending: true }),
    ]);

    if (!grades || grades.length === 0) {
      return new Response(
        JSON.stringify({ prediction: null, message: "Tidak cukup data untuk prediksi. Minimal 3 nilai diperlukan." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const assignmentGrades = grades.filter((g) => g.grade_type === "assignment" && g.value !== null);
    const stsGrade = grades.find((g) => g.grade_type === "sts")?.value;
    const sasGrade = grades.find((g) => g.grade_type === "sas")?.value;
    const gradeValues = assignmentGrades.map((g) => g.value as number);
    const avgAssignment = gradeValues.length > 0
      ? gradeValues.reduce((a, b) => a + b, 0) / gradeValues.length
      : null;

    const prompt = `Kamu adalah asisten analisis pendidikan yang membantu guru memprediksi performa siswa.

Data Siswa: ${student?.name || "Siswa"}
Mata Pelajaran: ${subject?.name || "Mapel"}
KKM: ${subject?.kkm || 75}

Data Nilai:
- Nilai Tugas (${gradeValues.length} tugas): ${gradeValues.join(", ") || "Belum ada"}
- Rata-rata Tugas: ${avgAssignment ? avgAssignment.toFixed(1) : "N/A"}
- Nilai STS: ${stsGrade ?? "Belum ada"}
- Nilai SAS: ${sasGrade ?? "Belum ada"}

Berdasarkan data di atas, berikan analisis singkat dalam format JSON:
{
  "predicted_final": <angka prediksi nilai rapor 0-100>,
  "trend": "<naik|stabil|turun>",
  "risk_level": "<rendah|sedang|tinggi>",
  "summary": "<ringkasan 1-2 kalimat dalam Bahasa Indonesia>",
  "recommendation": "<saran singkat untuk meningkatkan nilai dalam Bahasa Indonesia>"
}

Hanya berikan JSON, tanpa penjelasan tambahan.`;

    const aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${groqApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    const makeFallback = () => {
      const values = [...gradeValues];
      if (stsGrade) values.push(stsGrade);
      if (sasGrade) values.push(sasGrade);
      const avgAll = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      const kkm = subject?.kkm || 75;
      return {
        predicted_final: Math.round(avgAll),
        trend: "stabil",
        risk_level: avgAll < kkm ? "tinggi" : avgAll < kkm + 10 ? "sedang" : "rendah",
        summary: `Berdasarkan ${values.length} nilai yang tersedia, siswa memiliki rata-rata ${avgAll.toFixed(1)}.`,
        recommendation: avgAll < kkm ? "Perlu bimbingan tambahan untuk mencapai KKM." : "Pertahankan performa belajar saat ini.",
      };
    };

    if (!aiResponse.ok) {
      return new Response(
        JSON.stringify({
          prediction: makeFallback(),
          student: student?.name, subject: subject?.name, kkm: subject?.kkm,
          currentData: { assignmentCount: gradeValues.length, avgAssignment, stsGrade, sasGrade },
          note: "Fallback prediction (AI tidak tersedia).", model: modelId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    let prediction;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      prediction = jsonMatch ? JSON.parse(jsonMatch[0]) : makeFallback();
    } catch {
      prediction = makeFallback();
    }

    return new Response(
      JSON.stringify({
        prediction, student: student?.name, subject: subject?.name, kkm: subject?.kkm,
        currentData: { assignmentCount: gradeValues.length, avgAssignment, stsGrade, sasGrade },
        model: modelId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
