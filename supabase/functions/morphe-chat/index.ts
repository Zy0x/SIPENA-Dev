import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string | any[];
}

interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  system_prompt?: string;
  stream?: boolean;
  include_sipena_data?: boolean;
  user_id?: string;
  deep_data?: boolean;
}

// ─── Valid Groq model IDs ──────────────────────────────────────────────────
const VALID_MODELS = [
  "llama-3.3-70b-versatile", "llama-3.1-8b-instant", "llama3-70b-8192", "llama3-8b-8192",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "openai/gpt-oss-120b", "openai/gpt-oss-20b",
  "deepseek-r1-distill-llama-70b", "deepseek-r1-distill-qwen-32b",
  "qwen/qwen3-32b", "qwen-qwq-32b",
  "qwen-2.5-coder-32b", "qwen-2.5-32b",
  "mistral-saba-24b", "mixtral-8x7b-32768", "gemma2-9b-it",
];
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

function resolveModel(model: string | undefined): string {
  if (!model || model === "auto") return DEFAULT_MODEL;
  if (VALID_MODELS.includes(model)) return model;
  console.warn(`Unknown model "${model}", falling back to ${DEFAULT_MODEL}`);
  return DEFAULT_MODEL;
}

// ─── SIPENA Web Usage Guide (for mode SIPENA) ─────────────────────────────
const SIPENA_WEB_GUIDE = `[PANDUAN PENGGUNAAN SIPENA]
SIPENA adalah aplikasi web untuk guru mengelola nilai akademik siswa. Berikut panduan navigasi & fitur:

📌 NAVIGASI UTAMA (Sidebar kiri):
- Dashboard: Ringkasan data, grafik, prediksi AI, ranking siswa
- Kelas: Kelola kelas & siswa (tambah, edit, hapus, import Excel)
- Mata Pelajaran: Kelola mapel, atur KKM, bagikan akses via link
- Nilai: Input nilai spreadsheet (klik sel → ketik angka → otomatis tersimpan)
- Presensi: Catat kehadiran harian (Hadir/Izin/Sakit/Alpha), kalender bulanan
- Laporan: Lihat rekap nilai per kelas/mapel, export PDF/Excel/CSV
- Ranking: Peringkat siswa berdasarkan nilai keseluruhan
- Morphe AI: Chatbot AI ini untuk analisis & bantuan

📝 CARA INPUT NILAI:
1. Buka menu "Nilai" di sidebar
2. Pilih kelas dan mata pelajaran
3. Tambahkan BAB (chapter) terlebih dahulu
4. Tambahkan tugas/ujian di dalam BAB
5. Klik sel pada tabel → ketik angka (0-100) → tekan Enter/Tab
6. Nilai otomatis tersimpan, rata-rata dihitung otomatis

📝 CARA MEMBUAT KELAS:
1. Buka menu "Kelas" di sidebar
2. Klik tombol "Tambah Kelas"
3. Isi nama kelas (misal: "X IPA 1")
4. Kelas berhasil dibuat → tambahkan siswa manual atau import Excel

📝 CARA MENAMBAH SISWA:
1. Klik kelas yang diinginkan
2. Klik "Tambah Siswa" atau "Import" untuk import dari Excel
3. Format Excel: kolom "Nama" (wajib), "NIS" (opsional)

📝 CARA MENGELOLA PRESENSI:
1. Buka menu "Presensi"
2. Pilih kelas → pilih tanggal di kalender
3. Klik status per siswa: H (Hadir), I (Izin), S (Sakit), A (Alpha)
4. Data otomatis tersimpan

📝 CARA EXPORT LAPORAN:
1. Buka menu "Laporan"
2. Pilih kelas & mata pelajaran
3. Pilih format: PDF, Excel, atau CSV
4. Klik "Export" → file terdownload

📝 FITUR LAIN:
- Guru Tamu: Bagikan link mata pelajaran ke guru lain untuk input nilai
- Portal Orang Tua: Orang tua bisa melihat nilai anak via link khusus
- Prediksi AI: AI memprediksi nilai akhir siswa berdasarkan tren
- Tema: Bisa ganti tema warna di Pengaturan
- PWA: SIPENA bisa diinstall di HP seperti aplikasi native
[/PANDUAN PENGGUNAAN SIPENA]`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) {
      return new Response(
        JSON.stringify({ error: "GROQ_API_KEY belum dikonfigurasi di Supabase Secrets" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: ChatRequest = await req.json();
    const model = resolveModel(body.model);
    const shouldStream = body.stream !== false;

    // ─── Sanitize messages: ensure no array content for non-vision models ──
    const isVisionModel = model === "meta-llama/llama-4-scout-17b-16e-instruct";
    const sanitizedMessages: ChatMessage[] = (body.messages || []).map(msg => {
      if (Array.isArray(msg.content) && !isVisionModel) {
        // Flatten multimodal content to text-only for non-vision models
        const textParts = msg.content
          .filter((p: any) => p.type === "text")
          .map((p: any) => p.text)
          .join("\n");
        return { ...msg, content: textParts || "(gambar dilampirkan)" };
      }
      return msg;
    });

    const messages: ChatMessage[] = [];
    if (body.system_prompt) {
      messages.push({ role: "system", content: body.system_prompt });
    }

    // ─── Mode SIPENA: inject data + web guide ──────────────────────────────
    if (body.include_sipena_data === true) {
      // Always inject web usage guide for SIPENA mode
      messages.push({ role: "system", content: SIPENA_WEB_GUIDE });

      let sipenaContext = "";
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (!supabaseUrl || !supabaseServiceKey) {
          sipenaContext = "[DATA SIPENA] Tidak tersedia — SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi. [/DATA SIPENA]";
        } else {
          let userId = body.user_id || null;

          if (!userId) {
            const authHeader = req.headers.get("Authorization") || "";
            const token = authHeader.replace("Bearer ", "").trim();
            if (token && token.split(".").length === 3 && token.length > 100) {
              try {
                const payloadBase64 = token.split(".")[1];
                const payloadJson = atob(payloadBase64.replace(/-/g, "+").replace(/_/g, "/"));
                const payload = JSON.parse(payloadJson);
                userId = payload.sub || null;
              } catch { /* ignore */ }
            }
          }

          if (!userId) {
            sipenaContext = "[DATA SIPENA] Tidak tersedia — tidak dapat mengidentifikasi pengguna. [/DATA SIPENA]";
          } else {
            const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
              auth: { autoRefreshToken: false, persistSession: false },
            });

            const [classesResult, subjectsResult] = await Promise.allSettled([
              adminClient.from("classes").select("id, name").eq("user_id", userId).limit(20),
              adminClient.from("subjects").select("id, name, kkm").eq("user_id", userId).limit(50),
            ]);

            const classes = classesResult.status === "fulfilled" ? (classesResult.value.data || []) : [];
            const subjects = subjectsResult.status === "fulfilled" ? (subjectsResult.value.data || []) : [];

            const isDeepData = body.deep_data === true;
            let gradeCtx = "";
            let deepGradeCtx = "";
            let chaptersCtx = "";

            if (subjects.length > 0) {
              const ids = subjects.map((s: any) => s.id);

              // Fetch chapters & assignments for context
              try {
                const [chapRes, assignRes] = await Promise.allSettled([
                  adminClient.from("chapters").select("id, name, subject_id").in("subject_id", ids).limit(100),
                  adminClient.from("assignments").select("id, name, chapter_id, type").in("subject_id", ids).limit(200),
                ]);
                const chapters = chapRes.status === "fulfilled" ? (chapRes.value.data || []) : [];
                const assignments = assignRes.status === "fulfilled" ? (assignRes.value.data || []) : [];
                
                if (chapters.length > 0) {
                  const chapInfo = subjects.map((subj: any) => {
                    const subjChaps = chapters.filter((c: any) => c.subject_id === subj.id);
                    if (subjChaps.length === 0) return null;
                    const chapDetails = subjChaps.map((ch: any) => {
                      const chAssign = assignments.filter((a: any) => a.chapter_id === ch.id);
                      return `${ch.name}(${chAssign.length} tugas)`;
                    }).join(", ");
                    return `${subj.name}: ${chapDetails}`;
                  }).filter(Boolean);
                  if (chapInfo.length > 0) {
                    chaptersCtx = `\n- Struktur BAB: ${chapInfo.join("; ")}`;
                  }
                }
              } catch { /* ignore */ }

              try {
                const { data: grades } = await adminClient
                  .from("grades").select("value, subject_id, student_id, assignment_id")
                  .in("subject_id", ids)
                  .limit(isDeepData ? 5000 : 1000);

                if (grades && grades.length > 0) {
                  const vals = grades.filter((g: any) => g.value !== null).map((g: any) => g.value as number);
                  const avg = vals.length > 0 ? (vals.reduce((a: number, b: number) => a + b, 0) / vals.length).toFixed(1) : "N/A";
                  
                  const subjectAvgs: string[] = [];
                  for (const subj of subjects) {
                    const subjGrades = grades.filter((g: any) => g.subject_id === subj.id && g.value !== null);
                    if (subjGrades.length > 0) {
                      const subjAvg = (subjGrades.reduce((a: number, g: any) => a + g.value, 0) / subjGrades.length).toFixed(1);
                      const belowKkm = subjGrades.filter((g: any) => g.value < subj.kkm).length;
                      subjectAvgs.push(`${subj.name}: rata-rata ${subjAvg}, ${belowKkm} siswa di bawah KKM`);
                    }
                  }
                  gradeCtx = `\n- Total nilai: ${grades.length}, rata-rata keseluruhan: ${avg}`;
                  if (subjectAvgs.length > 0) {
                    gradeCtx += `\n- Detail per mapel: ${subjectAvgs.join("; ")}`;
                  }

                  // Deep data: per-student breakdown
                  if (isDeepData) {
                    try {
                      const classIds = classes.map((c: any) => c.id);
                      const { data: studentsList } = await adminClient.from("students")
                        .select("id, name, class_id")
                        .in("class_id", classIds)
                        .limit(200);

                      if (studentsList && studentsList.length > 0) {
                        const studentDetails: string[] = [];
                        for (const student of studentsList.slice(0, 50)) {
                          const sg = grades.filter((g: any) => g.student_id === student.id && g.value !== null);
                          if (sg.length === 0) continue;
                          const sAvg = (sg.reduce((a: number, g: any) => a + g.value, 0) / sg.length).toFixed(1);
                          const cls = classes.find((c: any) => c.id === student.class_id);
                          const perSubj = subjects.map((subj: any) => {
                            const subjG = sg.filter((g: any) => g.subject_id === subj.id);
                            return subjG.length > 0
                              ? `${subj.name}:${(subjG.reduce((a: number, g: any) => a + g.value, 0) / subjG.length).toFixed(0)}`
                              : null;
                          }).filter(Boolean).join(", ");
                          studentDetails.push(`${student.name}(${cls?.name || "?"}) avg:${sAvg} [${perSubj}]`);
                        }
                        if (studentDetails.length > 0) {
                          deepGradeCtx = `\n- Detail siswa (${studentDetails.length}): ${studentDetails.join("; ")}`;
                        }
                      }
                    } catch (e) {
                      console.error("Deep data fetch error:", e);
                    }
                  }
                }
              } catch (e) {
                console.error("Grade fetch error:", e);
              }
            }

            let attendCtx = "";
            try {
              if (classes.length > 0) {
                const classIds = classes.map((c: any) => c.id);
                const { data: att } = await adminClient.from("attendance_records")
                  .select("status")
                  .in("class_id", classIds)
                  .limit(500);
                if (att && att.length > 0) {
                  const counts: Record<string, number> = {};
                  att.forEach((a: any) => { counts[a.status] = (counts[a.status] || 0) + 1; });
                  attendCtx = `\n- Presensi: ${JSON.stringify(counts)}`;
                } else {
                  const { data: att2 } = await adminClient.from("attendance")
                    .select("status")
                    .in("class_id", classIds)
                    .limit(500);
                  if (att2 && att2.length > 0) {
                    const counts: Record<string, number> = {};
                    att2.forEach((a: any) => { counts[a.status] = (counts[a.status] || 0) + 1; });
                    attendCtx = `\n- Presensi: ${JSON.stringify(counts)}`;
                  }
                }
              }
            } catch { /* ignore */ }

            let studentsCtx = "";
            try {
              if (classes.length > 0) {
                const classIds = classes.map((c: any) => c.id);
                const { data: studentsList } = await adminClient.from("students")
                  .select("id")
                  .in("class_id", classIds)
                  .limit(200);
                if (studentsList) {
                  studentsCtx = `\n- Total siswa: ${studentsList.length}`;
                }
              }
            } catch { /* ignore */ }

            sipenaContext = `[DATA SIPENA GURU INI${isDeepData ? " — AKSES PENUH" : ""}]
- Kelas: ${classes.map((c: any) => c.name).join(", ") || "tidak ada"}
- Mapel: ${subjects.map((s: any) => `${s.name} KKM:${s.kkm}`).join(", ") || "tidak ada"}${chaptersCtx}${gradeCtx}${deepGradeCtx}${attendCtx}${studentsCtx}
[/DATA SIPENA]
Gunakan data ini jika relevan dengan pertanyaan guru. Berikan analisis yang detail dan actionable.${isDeepData ? " Kamu memiliki akses ke data detail per siswa — gunakan untuk analisis mendalam." : ""}
Jika guru bertanya tentang cara menggunakan SIPENA, gunakan panduan penggunaan yang sudah diberikan untuk menjawab dengan akurat.`;
          }
        }
      } catch (e) {
        console.error("SIPENA data inject error (non-fatal):", e);
        sipenaContext = "[DATA SIPENA] Terjadi error saat mengambil data. Lanjutkan percakapan tanpa data SIPENA. [/DATA SIPENA]";
      }

      if (sipenaContext) {
        messages.push({ role: "system", content: sipenaContext });
      }
    }

    messages.push(...sanitizedMessages);

    // ─── Send to Groq ──────────────────────────────────────────────────────
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        stream: shouldStream,
        max_tokens: 4096,
        temperature: 0.7,
      }),
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error(`Groq API error [${groqResponse.status}] model=${model}:`, errorText);
      
      // If model-related error, retry with default model
      if (groqResponse.status === 400 && model !== DEFAULT_MODEL) {
        console.log(`Retrying with default model ${DEFAULT_MODEL}...`);
        const retryResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: DEFAULT_MODEL,
            messages: messages.map(m => ({
              ...m,
              content: Array.isArray(m.content)
                ? m.content.filter((p: any) => p.type === "text").map((p: any) => p.text).join("\n") || "(konten)"
                : m.content,
            })),
            stream: shouldStream,
            max_tokens: 4096,
            temperature: 0.7,
          }),
        });

        if (retryResponse.ok) {
          if (shouldStream) {
            return new Response(retryResponse.body, {
              headers: {
                ...corsHeaders,
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
              },
            });
          }
          const data = await retryResponse.json();
          return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      return new Response(
        JSON.stringify({ error: `Groq API error: ${groqResponse.status}`, details: errorText }),
        { status: groqResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (shouldStream) {
      const reader = groqResponse.body?.getReader();
      if (!reader) {
        return new Response(
          JSON.stringify({ error: "No response body from Groq" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const stream = new ReadableStream({
        async start(controller) {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
                controller.close();
                break;
              }
              controller.enqueue(value);
            }
          } catch (err) {
            console.error("Stream error:", err);
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const data = await groqResponse.json();
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("morphe-chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
