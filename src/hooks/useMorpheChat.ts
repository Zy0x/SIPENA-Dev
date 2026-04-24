import { useState, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabaseExternal as supabase } from "@/lib/supabase-external";
import { EDGE_FUNCTIONS_URL, SUPABASE_EXTERNAL_ANON_KEY } from "@/lib/supabase-external";
import { useAuth } from "@/contexts/AuthContext";

export interface MorpheSession {
  id: string;
  user_id: string;
  title: string;
  system_prompt: string | null;
  model: string;
  is_pinned: boolean;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface MorpheMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  attachments: any[];
  token_count: number;
  model: string | null;
  created_at: string;
}

// ─── Image attachment type ────────────────────────────────────────────────
export interface ImageAttachment {
  base64: string;
  mediaType: string;
  name: string;
}

// ─── Model list — Groq supported models 2025 ──────────────────────────────
export const MORPHE_MODELS = [
  // Auto
  { id: "auto", label: "Auto (Otomatis)", group: "Auto", speed: "Adaptif", ctx: "128K", recommended: true },

  // Production — General Purpose
  { id: "llama-3.3-70b-versatile",     label: "Llama 3.3 70B",       group: "Production",  speed: "Sedang",       ctx: "128K", recommended: false },
  { id: "llama-3.1-8b-instant",        label: "Llama 3.1 8B",        group: "Production",  speed: "Sangat Cepat", ctx: "128K", recommended: false },
  { id: "llama3-70b-8192",             label: "Llama 3 70B",         group: "Production",  speed: "Sedang",       ctx: "8K",   recommended: false },
  { id: "llama3-8b-8192",              label: "Llama 3 8B",          group: "Production",  speed: "Sangat Cepat", ctx: "8K",   recommended: false },
  { id: "meta-llama/llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout 17B (Vision)", group: "Production", speed: "Cepat", ctx: "128K", recommended: false },

  // OpenAI GPT-OSS
  { id: "openai/gpt-oss-120b",         label: "GPT-OSS 120B",        group: "OpenAI",      speed: "Sedang",       ctx: "128K", recommended: false },
  { id: "openai/gpt-oss-20b",          label: "GPT-OSS 20B",         group: "OpenAI",      speed: "Cepat",        ctx: "128K", recommended: false },

  // Reasoning
  { id: "deepseek-r1-distill-llama-70b",  label: "DeepSeek R1 70B",     group: "Reasoning", speed: "Sedang", ctx: "128K", recommended: false },
  { id: "deepseek-r1-distill-qwen-32b",   label: "DeepSeek R1 Qwen 32B", group: "Reasoning", speed: "Cepat", ctx: "128K", recommended: false },
  { id: "qwen/qwen3-32b",                 label: "Qwen 3 32B",          group: "Reasoning", speed: "Cepat", ctx: "128K", recommended: false },
  { id: "qwen-qwq-32b",                   label: "Qwen QwQ 32B",        group: "Reasoning", speed: "Cepat", ctx: "128K", recommended: false },

  // Coding & Specialized
  { id: "qwen-2.5-coder-32b",             label: "Qwen 2.5 Coder 32B",  group: "Coding",    speed: "Cepat", ctx: "128K", recommended: false },
  { id: "qwen-2.5-32b",                   label: "Qwen 2.5 32B",        group: "Coding",    speed: "Cepat", ctx: "128K", recommended: false },

  // Other
  { id: "mistral-saba-24b",               label: "Mistral Saba 24B",    group: "Lainnya",   speed: "Cepat",        ctx: "32K",  recommended: false },
  { id: "mixtral-8x7b-32768",             label: "Mixtral 8x7B",        group: "Lainnya",   speed: "Cepat",        ctx: "32K",  recommended: false },
  { id: "gemma2-9b-it",                   label: "Gemma 2 9B",          group: "Lainnya",   speed: "Cepat",        ctx: "8K",   recommended: false },
];

export const MORPHE_MODEL_GROUPS = [
  { group: "Auto",        items: MORPHE_MODELS.filter((m) => m.group === "Auto") },
  { group: "Production",  items: MORPHE_MODELS.filter((m) => m.group === "Production") },
  { group: "OpenAI",      items: MORPHE_MODELS.filter((m) => m.group === "OpenAI") },
  { group: "Reasoning",   items: MORPHE_MODELS.filter((m) => m.group === "Reasoning") },
  { group: "Coding",      items: MORPHE_MODELS.filter((m) => m.group === "Coding") },
  { group: "Lainnya",     items: MORPHE_MODELS.filter((m) => m.group === "Lainnya") },
];

// Vision-capable models
const VISION_MODELS = ["meta-llama/llama-4-scout-17b-16e-instruct"];

const DEFAULT_SYSTEM_PROMPT = `Kamu adalah Morphe, asisten AI cerdas untuk guru di SIPENA (Sistem Informasi Penilaian Akademik). Kamu membantu guru dalam:
- Menganalisis data nilai dan presensi siswa
- Membuat soal dan materi pembelajaran
- Memberikan saran pengajaran berdasarkan data
- Menjawab pertanyaan umum tentang pendidikan

Gunakan Bahasa Indonesia yang jelas dan profesional. Jika diminta analisis data, berikan insight yang actionable.
Jika menulis rumus matematika, gunakan format LaTeX dengan delimiter $...$ untuk inline dan $$...$$ untuk block.`;

export const MORPHE_DEFAULT_SYSTEM_PROMPT = DEFAULT_SYSTEM_PROMPT;

const AUTO_SUMMARIZE_THRESHOLD = 28;

/**
 * Resolve "auto" model to a concrete model based on content
 */
function resolveAutoModel(hasImages: boolean, content: string): string {
  if (hasImages) return "meta-llama/llama-4-scout-17b-16e-instruct";
  
  // Check for code-related keywords
  const codeKeywords = /\b(code|kode|program|function|fungsi|debug|error|script|api|endpoint|sql|query|algorithm)\b/i;
  if (codeKeywords.test(content)) return "qwen-2.5-coder-32b";
  
  // Check for reasoning/math keywords
  const reasoningKeywords = /\b(analisis|analisa|hitung|rumus|statistik|probabilitas|logika|buktikan|bandingkan|evaluasi)\b/i;
  if (reasoningKeywords.test(content)) return "deepseek-r1-distill-qwen-32b";
  
  // Default: versatile model
  return "llama-3.3-70b-versatile";
}

export function useMorpheChat() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [lastResolvedModel, setLastResolvedModel] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ─── REST helpers ─────────────────────────────────────────────────────────
  const getUserToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  };

  const fetchRpc = async (query: string) => {
    const url = `${EDGE_FUNCTIONS_URL.replace("/functions/v1", "")}/rest/v1/${query}`;
    const token = await getUserToken();
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_EXTERNAL_ANON_KEY,
        Authorization: `Bearer ${token || SUPABASE_EXTERNAL_ANON_KEY}`,
      },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };

  const mutateRpc = async (table: string, method: string, body?: any, query?: string) => {
    const url = `${EDGE_FUNCTIONS_URL.replace("/functions/v1", "")}/rest/v1/${table}${query ? `?${query}` : ""}`;
    const token = await getUserToken();
    const headers: Record<string, string> = {
      apikey: SUPABASE_EXTERNAL_ANON_KEY,
      Authorization: `Bearer ${token || SUPABASE_EXTERNAL_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: method === "POST" ? "return=representation" : "return=minimal",
    };
    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) throw new Error(await res.text());
    if (method === "POST" || method === "GET") return res.json();
    return null;
  };

  // ─── Queries ──────────────────────────────────────────────────────────────
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["morphe-sessions", user?.id],
    queryFn: () => fetchRpc("morphe_sessions?order=is_pinned.desc,updated_at.desc") as Promise<MorpheSession[]>,
    enabled: !!user?.id,
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["morphe-messages", activeSessionId],
    queryFn: () =>
      activeSessionId
        ? (fetchRpc(`morphe_messages?session_id=eq.${activeSessionId}&order=created_at.asc`) as Promise<MorpheMessage[]>)
        : Promise.resolve([]),
    enabled: !!activeSessionId,
  });

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;

  // ─── Session mutations ────────────────────────────────────────────────────
  const createSession = useCallback(async (title?: string, model?: string) => {
    const result = await mutateRpc("morphe_sessions", "POST", {
      user_id: user!.id,
      title: title || "Chat Baru",
      model: model || "auto",
      system_prompt: DEFAULT_SYSTEM_PROMPT,
    });
    const data = Array.isArray(result) ? result[0] : result;
    queryClient.invalidateQueries({ queryKey: ["morphe-sessions"] });
    setActiveSessionId(data.id);
    return data as MorpheSession;
  }, [user, queryClient]);

  const deleteSession = useCallback(async (sessionId: string) => {
    await mutateRpc("morphe_sessions", "DELETE", undefined, `id=eq.${sessionId}`);
    if (activeSessionId === sessionId) setActiveSessionId(null);
    queryClient.invalidateQueries({ queryKey: ["morphe-sessions"] });
  }, [activeSessionId, queryClient]);

  const togglePin = useCallback(async (sessionId: string, isPinned: boolean) => {
    await mutateRpc("morphe_sessions", "PATCH", { is_pinned: !isPinned }, `id=eq.${sessionId}`);
    queryClient.invalidateQueries({ queryKey: ["morphe-sessions"] });
  }, [queryClient]);

  const renameSession = useCallback(async (sessionId: string, title: string) => {
    await mutateRpc("morphe_sessions", "PATCH", { title }, `id=eq.${sessionId}`);
    queryClient.invalidateQueries({ queryKey: ["morphe-sessions"] });
  }, [queryClient]);

  const updateModel = useCallback(async (sessionId: string, model: string) => {
    await mutateRpc("morphe_sessions", "PATCH", { model }, `id=eq.${sessionId}`);
    queryClient.invalidateQueries({ queryKey: ["morphe-sessions"] });
  }, [queryClient]);

  const updateSystemPrompt = useCallback(async (sessionId: string, prompt: string) => {
    await mutateRpc("morphe_sessions", "PATCH", { system_prompt: prompt }, `id=eq.${sessionId}`);
    queryClient.invalidateQueries({ queryKey: ["morphe-sessions"] });
  }, [queryClient]);

  const exportSessions = useCallback(async () => {
    const all = (await fetchRpc("morphe_sessions?order=updated_at.desc")) as MorpheSession[];
    const out: Record<string, any> = {};
    for (const s of all) {
      const msgs = await fetchRpc(`morphe_messages?session_id=eq.${s.id}&order=created_at.asc`);
      out[s.id] = { ...s, messages: msgs };
    }
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `morphe_sipena_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    return all.length;
  }, []);

  const importSessions = useCallback(async (file: File) => {
    const data = JSON.parse(await file.text());
    let count = 0;
    for (const [, session] of Object.entries(data) as any) {
      if (!session.title || !Array.isArray(session.messages)) continue;
      const newSession = await mutateRpc("morphe_sessions", "POST", {
        user_id: user!.id,
        title: session.title || "Imported",
        model: session.model || "llama-3.3-70b-versatile",
        system_prompt: session.system_prompt || DEFAULT_SYSTEM_PROMPT,
        is_pinned: session.is_pinned || false,
      });
      const sd = Array.isArray(newSession) ? newSession[0] : newSession;
      for (const msg of session.messages) {
        if (msg.role && msg.content) {
          await mutateRpc("morphe_messages", "POST", {
            session_id: sd.id, role: msg.role, content: msg.content, model: msg.model || null,
          });
        }
      }
      count++;
    }
    queryClient.invalidateQueries({ queryKey: ["morphe-sessions"] });
    return count;
  }, [user, queryClient]);

  // ─── Auto-summarize ──────────────────────────────────────────────────────
  const autoSummarize = useCallback(async (sid: string, allMsgs: { role: string; content: string }[]) => {
    try {
      const response = await fetch(`${EDGE_FUNCTIONS_URL}/morphe-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_EXTERNAL_ANON_KEY}`,
          apikey: SUPABASE_EXTERNAL_ANON_KEY,
        },
        body: JSON.stringify({
          messages: [
            ...allMsgs.slice(0, 10),
            { role: "user", content: "Buatkan ringkasan singkat (maksimal 3 kalimat) dari percakapan di atas dalam Bahasa Indonesia." },
          ],
          model: "llama-3.1-8b-instant",
          stream: false,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        const summary = data.choices?.[0]?.message?.content;
        if (summary) {
          await mutateRpc("morphe_sessions", "PATCH", { summary }, `id=eq.${sid}`);
        }
      }
    } catch {
      // Non-fatal
    }
  }, []);

  // ─── Send message ───────────────────────────────────────────────────────
  const sendMessage = useCallback(async (
    content: string,
    includeSipenaData = false,
    explicitSessionId?: string,
    explicitSession?: MorpheSession,
    hasImageAttachment = false,
    imageAttachments?: ImageAttachment[],
    useDeepData = false
  ) => {
    const sid = explicitSessionId || activeSessionId;
    const sess = explicitSession || activeSession;
    if (!sid || !sess) return;

    // Simpan ke DB hanya teks (tidak simpan base64 gambar ke database)
    const contentForDb = imageAttachments && imageAttachments.length > 0
      ? `${content}\n\n📎 ${imageAttachments.map(i => `[Gambar: ${i.name}]`).join(", ")}`
      : content;

    await mutateRpc("morphe_messages", "POST", {
      session_id: sid,
      role: "user",
      content: contentForDb,
    });
    await queryClient.invalidateQueries({ queryKey: ["morphe-messages", sid] });

    // Build multimodal content jika ada gambar
    const userContent: string | any[] =
      imageAttachments && imageAttachments.length > 0
        ? [
            { type: "text", text: content },
            ...imageAttachments.map((img) => ({
              type: "image_url",
              image_url: {
                url: `data:${img.mediaType};base64,${img.base64}`,
              },
            })),
          ]
        : content;

    const allMessages = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: userContent },
    ];

    // Resolve model: if "auto", pick the best model for this message
    let resolvedModel = sess.model;
    let wasAutoResolved = false;
    if (resolvedModel === "auto") {
      resolvedModel = resolveAutoModel(hasImageAttachment, content);
      wasAutoResolved = true;
    } else if (hasImageAttachment && !VISION_MODELS.includes(resolvedModel)) {
      resolvedModel = "meta-llama/llama-4-scout-17b-16e-instruct";
    }

    // Expose which model was actually used when auto
    if (wasAutoResolved) {
      setLastResolvedModel(resolvedModel);
    } else {
      setLastResolvedModel(null);
    }

    setIsStreaming(true);
    setStreamingContent("");
    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const requestBody: Record<string, any> = {
        messages: allMessages,
        model: resolvedModel,
        system_prompt: sess.system_prompt || DEFAULT_SYSTEM_PROMPT,
        stream: true,
      };

      if (includeSipenaData) {
        requestBody.include_sipena_data = true;
        requestBody.user_id = user?.id;
        requestBody.deep_data = useDeepData;
      }

      const response = await fetch(`${EDGE_FUNCTIONS_URL}/morphe-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_EXTERNAL_ANON_KEY}`,
          apikey: SUPABASE_EXTERNAL_ANON_KEY,
        },
        body: JSON.stringify(requestBody),
        signal: abort.signal,
      });

      if (!response.ok) {
        let errMsg = "Gagal menghubungi Morphe";
        try {
          const errData = await response.json();
          errMsg = errData.error || errMsg;
        } catch {
          errMsg = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errMsg);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                fullContent += delta;
                setStreamingContent(fullContent);
              }
            } catch {
              // skip parse errors
            }
          }
        }
      }

      if (fullContent) {
        await mutateRpc("morphe_messages", "POST", {
          session_id: sid,
          role: "assistant",
          content: fullContent,
          model: resolvedModel,
        });

        // Auto-rename on first message
        if (messages.length === 0) {
          const shortTitle = content.slice(0, 50) + (content.length > 50 ? "..." : "");
          await mutateRpc("morphe_sessions", "PATCH", { title: shortTitle }, `id=eq.${sid}`);
          queryClient.invalidateQueries({ queryKey: ["morphe-sessions"] });
        }

        // Auto-summarize after threshold
        const totalMsgs = allMessages.length + 1;
        if (totalMsgs >= AUTO_SUMMARIZE_THRESHOLD && totalMsgs % 10 === 0) {
          autoSummarize(sid, [...allMessages, { role: "assistant", content: fullContent }]);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["morphe-messages", sid] });

    } catch (err: any) {
      if (err.name !== "AbortError") {
        await mutateRpc("morphe_messages", "POST", {
          session_id: sid,
          role: "assistant",
          content: `⚠️ Error: ${err.message || "Gagal menghubungi Morphe"}`,
        });
        queryClient.invalidateQueries({ queryKey: ["morphe-messages", sid] });
        throw err;
      }
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
      abortRef.current = null;
    }
  }, [activeSessionId, activeSession, messages, user, queryClient, autoSummarize]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setStreamingContent("");
  }, []);

  return {
    sessions, activeSession, activeSessionId, setActiveSessionId,
    messages, isStreaming, streamingContent, lastResolvedModel,
    createSession, deleteSession, togglePin, renameSession, updateModel,
    updateSystemPrompt, sendMessage, stopStreaming, sessionsLoading, messagesLoading,
    exportSessions, importSessions,
  };
}
