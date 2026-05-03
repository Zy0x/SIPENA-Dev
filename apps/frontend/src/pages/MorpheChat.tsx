import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Plus, Send, Square, MessageSquare, Pin, PinOff, Trash2,
  User, PanelLeftClose, PanelLeft,
  Edit3, Settings2, ArrowLeft, Menu,
  AlertTriangle, RefreshCw, MessageCircle, Database,
  Paperclip, Image as ImageIcon, FileText, Code, ChevronDown,
  Share2, Loader2, Camera, Settings,
} from "lucide-react";
import { MorpheSettings } from "@/components/morphe/MorpheSettings";
import { FilePreviewDialog } from "@/components/morphe/FilePreviewDialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  useMorpheChat, MORPHE_MODELS, MORPHE_MODEL_GROUPS, type MorpheMessage, type MorpheSession, type ImageAttachment,
} from "@/hooks/useMorpheChat";
import { useEnhancedToast } from "@/contexts/ToastContext";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import gsap from "gsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import morpheIcon from "@/icon/icon_morphe.png";
import morpheIconPure from "@/icon/icon_morphe_pure.png";

type ChatMode = "chat" | "sipena";

const QUICK_PROMPTS_CHAT = [
  { icon: "🤖", text: "Jelaskan cara kerja Large Language Model secara sederhana" },
  { icon: "🐍", text: "Buatkan REST API sederhana menggunakan Flask" },
  { icon: "⚡", text: "Apa kelebihan Groq LPU dibanding GPU untuk AI?" },
  { icon: "📊", text: "Analisis tren perkembangan AI dari 2020 hingga sekarang" },
];

const QUICK_PROMPTS_SIPENA = [
  { icon: "📊", text: "Analisis rata-rata nilai seluruh kelas saya" },
  { icon: "📈", text: "Rekap presensi siswa bulan ini" },
  { icon: "🏆", text: "Siapa siswa dengan nilai tertinggi di kelas?" },
  { icon: "⚠️", text: "Siswa mana yang berisiko tidak mencapai KKM?" },
];

const SYSTEM_PRESETS = [
  { label: "🤖 Asisten SIPENA", text: "Kamu adalah Morphe, asisten AI cerdas untuk guru di SIPENA (Sistem Informasi Penilaian Akademik). Bantu guru menganalisis data nilai, presensi, membuat soal, dan memberikan saran pengajaran. Gunakan Bahasa Indonesia yang jelas dan profesional." },
  { label: "💻 Developer", text: "Kamu adalah senior software engineer yang ahli dalam berbagai bahasa pemrograman. Berikan kode yang bersih, efisien, dan disertai penjelasan teknis." },
  { label: "✍️ Penulis Kreatif", text: "Kamu adalah penulis kreatif berbakat. Bantu pengguna menulis konten yang menarik, ekspresif, dan engaging." },
  { label: "📊 Analis Data", text: "Kamu adalah data analyst expert. Bantu menganalisis data, membuat visualisasi konsep, dan memberikan insight yang actionable." },
  { label: "🎓 Tutor", text: "Kamu adalah tutor yang sabar dan berpengalaman. Jelaskan konsep secara bertahap, gunakan analogi yang relevan." },
];

// Vision-capable models
const VISION_MODELS = ["meta-llama/llama-4-scout-17b-16e-instruct"];

export default function MorpheChat() {
  const {
    sessions, activeSession, activeSessionId, setActiveSessionId,
    messages, isStreaming, streamingContent, lastResolvedModel,
    createSession, deleteSession, togglePin, renameSession, updateModel,
    updateSystemPrompt, sendMessage, stopStreaming, sessionsLoading, messagesLoading,
    exportSessions, importSessions,
  } = useMorpheChat();
  const { success, error: showError } = useEnhancedToast();
  const prefersReducedMotion = useReducedMotion();
  const navigate = useNavigate();

  const [input, setInput] = useState("");
  const [chatMode, setChatMode] = useState<ChatMode>("chat");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [sysPromptOpen, setSysPromptOpen] = useState(false);
  const [sysPromptValue, setSysPromptValue] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [imageAttachments, setImageAttachments] = useState<ImageAttachment[]>([]);
  const [deepDataConsent, setDeepDataConsent] = useState<boolean | null>(null);
  const [showDeepDataDialog, setShowDeepDataDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; type: string } | null>(null);
  const morpheTextRef = useRef<HTMLSpanElement>(null);
  const welcomeMorpheTextRef = useRef<HTMLSpanElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const morpheLogoRef = useRef<HTMLImageElement>(null);

  // Force dark mode on this page
  useEffect(() => {
    const root = document.documentElement;
    const prevTheme = root.classList.contains("dark") ? "dark" : "light";
    root.classList.add("dark");
    return () => {
      if (prevTheme === "light") root.classList.remove("dark");
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // GSAP entrance
  useEffect(() => {
    if (prefersReducedMotion || !containerRef.current) return;
    gsap.fromTo(containerRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power3.out" });
  }, [prefersReducedMotion]);

  // GSAP Glow animation for Morphe icon (no rotation)
  useEffect(() => {
    if (prefersReducedMotion || !morpheLogoRef.current) return;
    const el = morpheLogoRef.current;
    // Pulsating glow effect using drop-shadow
    gsap.to(el, {
      filter: "drop-shadow(0 0 12px rgba(211,166,63,0.7)) drop-shadow(0 0 24px rgba(25,91,178,0.4)) drop-shadow(0 0 8px rgba(110,119,187,0.3))",
      duration: 2.5,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
    });
    return () => { gsap.killTweensOf(el); };
  }, [prefersReducedMotion, messages.length]);

  // GSAP animated gradient text for "Morphe" branding
  useEffect(() => {
    if (prefersReducedMotion) return;
    const targets = [morpheTextRef.current, welcomeMorpheTextRef.current].filter(Boolean);
    targets.forEach(el => {
      if (!el) return;
      gsap.to(el, {
        backgroundImage: "linear-gradient(90deg, #6e77bb, #d3a63f, #195bb2, #6e77bb)",
        backgroundSize: "300% 100%",
        backgroundPositionX: "100%",
        duration: 4,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    });
    return () => { targets.forEach(el => el && gsap.killTweensOf(el)); };
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (input) setSendError(null);
  }, [input]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }, []);

  // Show deep data consent when switching to SIPENA mode
  const handleSwitchToSipena = useCallback(() => {
    if (deepDataConsent === null) {
      setShowDeepDataDialog(true);
    }
    setChatMode("sipena");
  }, [deepDataConsent]);

  const handleDeepDataConsent = useCallback((agreed: boolean) => {
    setDeepDataConsent(agreed);
    setShowDeepDataDialog(false);
  }, []);

  const handleSend = useCallback(async () => {
      const text = input.trim();
      if (!text || isStreaming) return;
      setSendError(null);

      const includeSipena = chatMode === "sipena";
      const useDeepData = chatMode === "sipena" && deepDataConsent === true;

      // Build content + pisahkan gambar vs dokumen
      let fullContent = text;
      const collectedImages: ImageAttachment[] = [];

      for (const file of attachedFiles) {
        if (
          file.type.startsWith("text/") ||
          file.name.endsWith(".json") ||
          file.name.endsWith(".csv") ||
          file.name.endsWith(".md")
        ) {
          const fileText = await file.text();
          fullContent += `\n\n--- Lampiran: ${file.name} ---\n${fileText.slice(0, 8000)}`;
        } else if (file.type.startsWith("image/")) {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve((reader.result as string).split(",")[1]);
            reader.onerror = () => reject(new Error("Gagal membaca gambar"));
            reader.readAsDataURL(file);
          });
          collectedImages.push({
            base64,
            mediaType: file.type,
            name: file.name,
          });
        }
      }

      const hasImages = collectedImages.length > 0;
      setAttachedFiles([]);
      setImageAttachments([]);

      try {
        if (!activeSessionId) {
          const newSession = await createSession();
          setInput("");
          if (inputRef.current) inputRef.current.style.height = "auto";
          await sendMessage(fullContent, includeSipena, newSession.id, newSession, hasImages, collectedImages, useDeepData);
          return;
        }
        setInput("");
        if (inputRef.current) inputRef.current.style.height = "auto";
        await sendMessage(fullContent, includeSipena, undefined, undefined, hasImages, collectedImages, useDeepData);
      } catch (err: any) {
        const msg = err.message || "Gagal mengirim pesan.";
        setSendError(msg);
        showError("Gagal mengirim pesan", msg);
      }
    }, [input, isStreaming, activeSessionId, activeSession, chatMode, attachedFiles, createSession, sendMessage, showError, deepDataConsent]);

  const handleRetry = useCallback(async () => {
    if (!messages.length) return;
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      setSendError(null);
      await sendMessage(lastUserMsg.content, chatMode === "sipena");
    }
  }, [messages, sendMessage, chatMode]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  // Don't create empty sessions - only create when sending first message
  const handleNewChat = useCallback(() => {
    setActiveSessionId(null as any);
    setInput("");
    setSendError(null);
    setMobileSidebar(false);
  }, [setActiveSessionId]);

  const handleQuickPrompt = useCallback(async (text: string) => {
    setSendError(null);
    const includeSipena = chatMode === "sipena";
    if (!activeSessionId) {
      const newSession = await createSession();
      await sendMessage(text, includeSipena, newSession.id, newSession);
      return;
    }
    sendMessage(text, includeSipena);
  }, [activeSessionId, chatMode, createSession, sendMessage]);

  const handleRename = useCallback((id: string, currentTitle: string) => {
    setRenameId(id);
    setRenameValue(currentTitle);
    setRenameDialogOpen(true);
  }, []);

  const confirmRename = useCallback(async () => {
    if (renameId && renameValue.trim()) {
      await renameSession(renameId, renameValue.trim());
      setRenameDialogOpen(false);
      success("Sesi diubah nama");
    }
  }, [renameId, renameValue, renameSession, success]);

  const handleExport = useCallback(async () => {
    try { const count = await exportSessions(); success(`${count} sesi diekspor`); }
    catch { showError("Gagal mengekspor"); }
  }, [exportSessions, success, showError]);

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { const count = await importSessions(file); success(`${count} sesi diimpor`); }
    catch { showError("File JSON tidak valid"); }
    if (importRef.current) importRef.current.value = "";
  }, [importSessions, success, showError]);

  const handleSysPromptSave = useCallback(async () => {
    if (activeSessionId && sysPromptValue) {
      await updateSystemPrompt(activeSessionId, sysPromptValue);
      setSysPromptOpen(false);
      success("System prompt disimpan");
    }
  }, [activeSessionId, sysPromptValue, updateSystemPrompt, success]);

  const openSysPrompt = useCallback(() => {
    setSysPromptValue(activeSession?.system_prompt || "");
    setSysPromptOpen(true);
  }, [activeSession]);

  const handleFileAttach = useCallback((type: "image" | "document" | "code") => {
    if (type === "image" && imageInputRef.current) {
      imageInputRef.current.click();
    } else if (fileInputRef.current) {
      fileInputRef.current.accept = type === "code" ? ".js,.ts,.tsx,.py,.java,.cpp,.c,.go,.rs,.json,.yaml,.toml,.sql,.sh" : ".txt,.md,.csv,.json,.pdf,.docx";
      fileInputRef.current.click();
    }
  }, []);

  const handleFilesSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachedFiles(prev => [...prev, ...files].slice(0, 5));
    e.target.value = "";
  }, []);

  const allMessages: (MorpheMessage | { role: "assistant"; content: string; id: string })[] = [
    ...messages,
    ...(isStreaming && streamingContent
      ? [{ role: "assistant" as const, content: streamingContent, id: "streaming" }]
      : []),
  ];

  const pinnedSessions = sessions.filter((s) => s.is_pinned);
  const unpinnedSessions = sessions.filter((s) => !s.is_pinned);
  const lastMsg = allMessages[allMessages.length - 1];
  const lastMsgIsError = lastMsg?.role === "assistant" && lastMsg?.content?.startsWith("⚠️");
  const quickPrompts = chatMode === "sipena" ? QUICK_PROMPTS_SIPENA : QUICK_PROMPTS_CHAT;

  const tokenEstimate = allMessages.reduce((acc, m) => acc + Math.ceil(m.content.length / 4), 0);
  const currentModel = MORPHE_MODELS.find(m => m.id === (activeSession?.model || "llama-3.3-70b-versatile"));

  return (
    <div ref={containerRef} className="h-dvh w-full flex bg-background overflow-hidden dark">
      <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFilesSelected} multiple />
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleFilesSelected} multiple />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFilesSelected} />

      {mobileSidebar && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setMobileSidebar(false)} />
      )}

      {/* ═══ SIDEBAR — Desktop ═══ */}
      <aside className={cn(
        "flex flex-col border-r border-border bg-card/95 backdrop-blur-xl shrink-0 transition-all duration-300 hidden lg:flex",
        sidebarOpen ? "w-[260px]" : "w-0 overflow-hidden"
      )}>
        <SidebarContent
          sessions={sessions} pinnedSessions={pinnedSessions} unpinnedSessions={unpinnedSessions}
          activeSessionId={activeSessionId} setActiveSessionId={setActiveSessionId}
          sessionsLoading={sessionsLoading} onNewChat={handleNewChat} onDelete={deleteSession}
          onTogglePin={togglePin} onRename={handleRename}
          onBack={() => navigate("/dashboard")}
          morpheIcon={morpheIcon}
        />
      </aside>

      {/* ═══ SIDEBAR — Mobile ═══ */}
      <aside className={cn(
        "fixed inset-y-0 left-0 flex flex-col border-r border-border bg-card/95 backdrop-blur-xl z-50 w-[260px] transition-transform duration-300 lg:hidden",
        mobileSidebar ? "translate-x-0" : "-translate-x-full"
      )}>
        <SidebarContent
          sessions={sessions} pinnedSessions={pinnedSessions} unpinnedSessions={unpinnedSessions}
          activeSessionId={activeSessionId}
          setActiveSessionId={(id) => { setActiveSessionId(id); setMobileSidebar(false); }}
          sessionsLoading={sessionsLoading} onNewChat={handleNewChat} onDelete={deleteSession}
          onTogglePin={togglePin} onRename={handleRename}
          onBack={() => navigate("/dashboard")}
          morpheIcon={morpheIcon}
        />
      </aside>

      {/* ═══ MAIN ═══ */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Header */}
        <header className="h-12 border-b border-border flex items-center gap-2 px-3 shrink-0 bg-card/50 backdrop-blur-sm">
          <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden" onClick={() => setMobileSidebar(true)}>
            <Menu className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 hidden lg:flex" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
          </Button>

          <div className="flex-1 min-w-0 flex items-center gap-2">
            <img src={morpheIconPure} alt="Morphe" className="w-5 h-5 shrink-0 rounded" />
            <span ref={morpheTextRef} className="text-sm font-bold bg-gradient-to-r from-[#195bb2] via-[#d3a63f] to-[#6e77bb] bg-clip-text text-transparent" style={{ backgroundSize: "300% 100%" }}>{activeSession ? "" : "Morphe"}</span>
            {activeSession && <span className="text-sm font-bold truncate">{activeSession.title}</span>}
            {activeSession && (
              <button onClick={() => handleRename(activeSession.id, activeSession.title)} className="p-0.5 rounded hover:bg-muted/50 shrink-0">
                <Edit3 className="w-3 h-3 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Model selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 h-7 text-[11px] bg-muted/50 border border-border rounded-lg px-2.5 text-foreground outline-none cursor-pointer hover:bg-muted/80 transition-colors shrink-0 max-w-[160px]">
                <span className="truncate font-medium">{currentModel?.label || "Llama 3.3 70B"}</span>
                <ChevronDown className="w-3 h-3 shrink-0 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 max-h-[400px] overflow-y-auto">
              {MORPHE_MODEL_GROUPS.map((g) => (
                <div key={g.group}>
                  <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{g.group}</div>
                  {g.items.map((m) => (
                    <DropdownMenuItem
                      key={m.id}
                      onClick={() => activeSession && updateModel(activeSession.id, m.id)}
                      className={cn("flex items-center justify-between gap-2 text-xs", activeSession?.model === m.id && "bg-primary/10 text-primary")}
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium truncate">
                          {m.label}
                          {m.recommended && <span className="ml-1 text-primary">★</span>}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{m.speed} · {m.ctx}</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={openSysPrompt}>
                <Settings2 className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>System Prompt</TooltipContent>
          </Tooltip>

          {/* Settings */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowSettings(true)}>
                <Settings className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Pengaturan Morphe</TooltipContent>
          </Tooltip>

          {/* Share (Export/Import) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Share2 className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={handleExport} className="text-xs gap-2">
                <Share2 className="w-3 h-3" /> Export Sesi
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => importRef.current?.click()} className="text-xs gap-2">
                <FileText className="w-3 h-3" /> Import Sesi
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)] animate-pulse shrink-0" />
        </header>

        {/* ── Floating Mode Toggle ── */}
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 mt-2">
          <div className="flex items-center gap-0.5 bg-card/90 backdrop-blur-md rounded-full p-0.5 border border-border shadow-lg">
            <button
              onClick={() => setChatMode("chat")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                chatMode === "chat"
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <MessageCircle className="w-3 h-3" />
              Chat
            </button>
            <button
              onClick={handleSwitchToSipena}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                chatMode === "sipena"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Database className="w-3 h-3" />
              SIPENA
              {deepDataConsent === true && <span className="text-[8px] ml-0.5">🔓</span>}
            </button>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-4 pt-14">
            {allMessages.length === 0 && !messagesLoading && (
              <div className="flex flex-col items-center justify-center min-h-[55vh] text-center">
                <div className="relative mb-6">
                  <img
                    ref={morpheLogoRef}
                    src={morpheIconPure}
                    alt="Morphe AI"
                    className="w-20 h-20 rounded-2xl"
                    style={{ filter: "drop-shadow(0 0 8px rgba(99,102,241,0.4))" }}
                  />
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-1 tracking-tight">
                  Selamat datang di{" "}
                  <span ref={welcomeMorpheTextRef} className="bg-gradient-to-r from-[#195bb2] via-[#d3a63f] to-[#6e77bb] bg-clip-text text-transparent" style={{ backgroundSize: "300% 100%" }}>Morphe</span>
                </h2>
                <p className="text-sm text-muted-foreground mb-6 max-w-md leading-relaxed">
                  AI chat ultra-cepat dengan Groq. Multi-sesi, memori persisten, mendukung kode, tabel, dan lebih banyak lagi.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-lg">
                  {quickPrompts.map((qp, i) => (
                    <button
                      key={i}
                      onClick={() => handleQuickPrompt(qp.text)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card/50 hover:bg-muted/60 text-left text-sm transition-all hover:border-primary/30 hover:shadow-sm"
                    >
                      <span className="text-base">{qp.icon}</span>
                      <span className="text-muted-foreground text-xs line-clamp-2">{qp.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {allMessages.map((msg) => (
              <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role !== "user" && (
                  <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0 mt-0.5">
                    <img src={morpheIconPure} alt="Morphe" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className={cn(
                  "max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-3 text-sm",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : msg.content.startsWith("⚠️")
                    ? "bg-destructive/10 border border-destructive/30 text-foreground rounded-bl-sm"
                    : "bg-muted/40 border border-border/40 text-foreground rounded-bl-sm"
                )}>
                  {msg.role === "user" ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1 [&>pre]:my-2 [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border [&_pre]:bg-card [&_code]:text-xs [&_code]:font-mono [&_.katex]:text-sm [&_.katex-display]:my-2 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:py-1 [&_.katex-display_.katex]:text-base [&_table]:w-full [&_table]:text-xs [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1">
                      <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeHighlight, rehypeKatex]}
                      >{msg.content}</ReactMarkdown>
                    </div>
                  )}
                  {msg.id === "streaming" && (
                    <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5 rounded-full" />
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5 text-primary" />
                  </div>
                )}
              </div>
            ))}

            {/* Auto model notification */}
            {lastResolvedModel && activeSession?.model === "auto" && !isStreaming && messages.length > 0 && (
              <div className="flex justify-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/50 border border-border/50 text-[10px] text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                  Auto → {MORPHE_MODELS.find(m => m.id === lastResolvedModel)?.label || lastResolvedModel}
                </div>
              </div>
            )}

            {/* Typing indicator when streaming but no content yet */}
            {isStreaming && !streamingContent && (
              <div className="flex gap-3 justify-start">
                <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0 mt-0.5">
                  <img src={morpheIconPure} alt="Morphe" className="w-full h-full object-cover" />
                </div>
                <div className="bg-muted/40 border border-border/40 rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                    <span className="text-xs text-muted-foreground ml-2">
                      Morphe sedang berpikir
                      {lastResolvedModel && activeSession?.model === "auto" && (
                        <span className="text-primary/70"> ({MORPHE_MODELS.find(m => m.id === lastResolvedModel)?.label})</span>
                      )}
                      ...
                    </span>
                  </div>
                </div>
              </div>
            )}

            {lastMsgIsError && !isStreaming && (
              <div className="flex justify-center">
                <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={handleRetry}>
                  <RefreshCw className="w-3 h-3" /> Coba lagi
                </Button>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {sendError && (
          <div className="mx-4 mb-2 flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{sendError}</span>
          </div>
        )}

        {/* Attached files preview */}
        {attachedFiles.length > 0 && (
          <div className="mx-4 mb-2 flex flex-wrap gap-2">
            {attachedFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border text-xs">
                {f.type.startsWith("image/") ? (
                  <div className="flex items-center gap-1.5">
                    <img
                      src={URL.createObjectURL(f)}
                      alt={f.name}
                      className="w-8 h-8 rounded object-cover border border-border cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                      onClick={() => setPreviewFile({ url: URL.createObjectURL(f), name: f.name, type: f.type })}
                    />
                    <span className="text-[10px] text-primary font-medium">Vision</span>
                  </div>
                ) : (
                  <button
                    className="flex items-center gap-1 hover:text-primary transition-colors"
                    onClick={() => setPreviewFile({ url: URL.createObjectURL(f), name: f.name, type: f.type })}
                  >
                    <FileText className="w-3 h-3" />
                  </button>
                )}
                <span className="truncate max-w-[120px]">{f.name}</span>
                <button onClick={() => setAttachedFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ═══ Input Area ═══ */}
        <div className="border-t border-border p-3 bg-card/30 backdrop-blur-sm shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-2 rounded-2xl border border-border bg-muted/20 p-2 transition-colors focus-within:border-border">
              {/* Attachment dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" type="button">
                    <Paperclip className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-44">
                  <DropdownMenuItem className="gap-2 text-xs" onClick={() => handleFileAttach("image")}>
                    <ImageIcon className="w-3.5 h-3.5" /> Gambar
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2 text-xs" onClick={() => cameraInputRef.current?.click()}>
                    <Camera className="w-3.5 h-3.5" /> Kamera
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2 text-xs" onClick={() => handleFileAttach("document")}>
                    <FileText className="w-3.5 h-3.5" /> Dokumen
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2 text-xs" onClick={() => handleFileAttach("code")}>
                    <Code className="w-3.5 h-3.5" /> Kode
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {chatMode === "sipena" && (
                <div className="shrink-0 self-center">
                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/20 font-medium">
                    <Database className="w-2.5 h-2.5" />
                    SIPENA
                  </span>
                </div>
              )}

              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={chatMode === "sipena"
                  ? "Tanyakan tentang data nilai, presensi, atau analisis siswa..."
                  : "Ketik pesan atau seret file ke sini\u2026"}
                rows={1}
                disabled={isStreaming}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none ring-0 focus:ring-0 focus:outline-none border-none focus:border-none min-h-[36px] max-h-[140px] py-2 px-1"
                style={{ boxShadow: "none" }}
              />

              {isStreaming ? (
                <Button size="icon" variant="destructive" className="h-9 w-9 rounded-xl shrink-0" onClick={stopStreaming}>
                  <Square className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  className="h-9 w-9 rounded-xl shrink-0 bg-foreground text-background hover:bg-foreground/90"
                  onClick={handleSend}
                  disabled={!input.trim()}
                >
                  <Send className="w-4 h-4" />
                </Button>
              )}
            </div>

            <div className="flex items-center justify-end mt-1.5 px-1">
              <p className="text-[10px] text-muted-foreground font-mono">
                ~{tokenEstimate} / 6,000 tok · Enter = kirim · Shift+Enter = baris baru
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Ubah nama sesi</DialogTitle></DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && confirmRename()} placeholder="Nama sesi" autoFocus />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>Batal</Button>
            <Button onClick={confirmRename}>Simpan</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* System Prompt Dialog */}
      <Dialog open={sysPromptOpen} onOpenChange={setSysPromptOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" /> System Prompt
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {SYSTEM_PRESETS.map((p, i) => (
              <button key={i} onClick={() => setSysPromptValue(p.text)} className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-primary/50 hover:text-primary transition-colors bg-card">
                {p.label}
              </button>
            ))}
          </div>
          <Textarea value={sysPromptValue} onChange={(e) => setSysPromptValue(e.target.value)} rows={6} placeholder="Instruksi untuk AI..." className="resize-y min-h-[120px]" />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setSysPromptOpen(false)}>Batal</Button>
            <Button onClick={handleSysPromptSave}>Simpan</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deep Data Consent Dialog */}
      <Dialog open={showDeepDataDialog} onOpenChange={setShowDeepDataDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              Akses Data Tingkat Lanjut
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Mode SIPENA memungkinkan Morphe AI mengakses data akademik Anda untuk memberikan analisis yang lebih akurat.
            </p>
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
              <p className="font-medium text-xs">Data yang akan diakses:</p>
              <ul className="text-xs text-muted-foreground space-y-0.5 list-disc pl-4">
                <li>Daftar kelas dan siswa</li>
                <li>Mata pelajaran dan KKM</li>
                <li>Nilai per siswa per tugas (detail lengkap)</li>
                <li>Rekap presensi per kelas</li>
                <li>Struktur BAB dan tugas</li>
              </ul>
            </div>
            <p className="text-xs text-muted-foreground">
              Data hanya digunakan untuk konteks percakapan ini dan tidak disimpan oleh AI.
            </p>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => handleDeepDataConsent(false)}>
              Akses Umum Saja
            </Button>
            <Button onClick={() => handleDeepDataConsent(true)} className="gap-1.5">
              <Database className="w-3.5 h-3.5" />
              Izinkan Akses Penuh
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Morphe Settings */}
      <MorpheSettings
        open={showSettings}
        onOpenChange={setShowSettings}
        activeSession={activeSession}
        sessions={sessions}
        onUpdateSystemPrompt={updateSystemPrompt}
        onDeleteAllSessions={() => {
          sessions.forEach(s => deleteSession(s.id));
        }}
        deepDataConsent={deepDataConsent}
        onDeepDataConsentChange={(val) => setDeepDataConsent(val)}
      />

      {/* File Preview */}
      <FilePreviewDialog
        open={!!previewFile}
        onOpenChange={(open) => { if (!open) setPreviewFile(null); }}
        file={previewFile}
      />
    </div>
  );
}

// ═══ SIDEBAR CONTENT ═══
interface SidebarContentProps {
  sessions: any[]; pinnedSessions: any[]; unpinnedSessions: any[];
  activeSessionId: string | null; setActiveSessionId: (id: string) => void;
  sessionsLoading: boolean; onNewChat: () => void; onDelete: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void; onRename: (id: string, title: string) => void;
  onBack: () => void;
  morpheIcon: string;
}

function SidebarContent({ sessions, pinnedSessions, unpinnedSessions, activeSessionId, setActiveSessionId, sessionsLoading, onNewChat, onDelete, onTogglePin, onRename, onBack, morpheIcon }: SidebarContentProps) {
  return (
    <>
      <div className="h-12 border-b border-border/50 flex items-center gap-2 px-3 shrink-0">
        <img src={morpheIcon} alt="Morphe" className="w-7 h-7 rounded-lg shrink-0" />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-extrabold bg-gradient-to-r from-[#195bb2] via-[#d3a63f] to-[#6e77bb] bg-clip-text text-transparent">Morphe</h2>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onNewChat} title="Sesi baru">
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 overflow-hidden">
        <div className="p-2 space-y-0.5">
          {pinnedSessions.length > 0 && (
            <>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-1.5 flex items-center gap-1.5">
                <Pin className="w-2.5 h-2.5" /> Disematkan
              </p>
              {pinnedSessions.map((s) => (
                <SessionItem key={s.id} session={s} active={activeSessionId === s.id} onClick={() => setActiveSessionId(s.id)} onRename={() => onRename(s.id, s.title)} onDelete={() => onDelete(s.id)} onPin={() => onTogglePin(s.id, s.is_pinned)} />
              ))}
            </>
          )}
          {pinnedSessions.length > 0 && unpinnedSessions.length > 0 && (
            <Separator className="my-2 opacity-30" />
          )}
          {unpinnedSessions.length > 0 && (
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-1.5 flex items-center gap-1.5">
              <MessageSquare className="w-2.5 h-2.5" /> Riwayat
            </p>
          )}
          {unpinnedSessions.map((s) => (
            <SessionItem key={s.id} session={s} active={activeSessionId === s.id} onClick={() => setActiveSessionId(s.id)} onRename={() => onRename(s.id, s.title)} onDelete={() => onDelete(s.id)} onPin={() => onTogglePin(s.id, s.is_pinned)} />
          ))}
          {sessions.length === 0 && !sessionsLoading && (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <MessageCircle className="w-8 h-8 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">Belum ada sesi chat</p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">Mulai percakapan baru</p>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-border/50 p-2 shrink-0">
        <button onClick={onBack} className="w-full flex items-center justify-center gap-2 px-2 py-2 rounded-lg text-[11px] text-muted-foreground hover:bg-muted/50 transition-colors">
          <ArrowLeft className="w-3 h-3" /> Kembali ke SIPENA
        </button>
      </div>
    </>
  );
}

// ═══ SESSION ITEM with truncation + right-click context menu + hover actions ═══
function SessionItem({ session, active, onClick, onRename, onDelete, onPin }: {
  session: any; active: boolean; onClick: () => void; onRename: () => void; onDelete: () => void; onPin: () => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout>>();
  const itemRef = useRef<HTMLDivElement>(null);

  // Long-press for mobile
  const handleTouchStart = () => {
    holdTimer.current = setTimeout(() => setShowActions(true), 500);
  };
  const handleTouchEnd = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
  };

  // Right-click for desktop
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setShowActions(true);
  };

  const closeMenu = useCallback(() => {
    setShowActions(false);
    setMenuPos(null);
  }, []);

  // Close menu on any outside click/touch — using onPointerDown for reliable dismiss
  useEffect(() => {
    if (!showActions) return;
    const handler = (e: PointerEvent) => {
      closeMenu();
    };
    // Use capture to catch before any stopPropagation
    document.addEventListener("pointerdown", handler, { capture: true });
    return () => document.removeEventListener("pointerdown", handler, { capture: true });
  }, [showActions, closeMenu]);

  return (
    <div
      ref={itemRef}
      className={cn(
        "group flex items-center gap-1.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors text-sm relative overflow-hidden",
        active ? "bg-primary/10 border border-primary/20 text-primary" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      )}
      onClick={onClick}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {session.is_pinned && <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0 flex-none" />}
      <MessageSquare className="w-3.5 h-3.5 shrink-0 flex-none opacity-60" />
      {/* Title with strict truncation + padding kanan simetris */}
      <span className="block flex-1 min-w-0 truncate pr-2 text-xs leading-5">
        {session.title}
      </span>

      {/* Hover actions — desktop */}
      <div className={cn(
        "hidden group-hover:flex items-center gap-0.5 absolute right-1 top-1/2 -translate-y-1/2 rounded-md pl-6 pr-0.5",
        active ? "bg-gradient-to-l from-primary/10 via-primary/10 to-transparent" : "bg-gradient-to-l from-card via-card to-transparent"
      )}>
        <button
          className="p-1 rounded hover:bg-muted transition-colors"
          onClick={(e) => { e.stopPropagation(); onPin(); }}
          title={session.is_pinned ? "Unpin" : "Pin"}
        >
          {session.is_pinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
        </button>
        <button
          className="p-1 rounded hover:bg-destructive/10 text-destructive transition-colors"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Hapus"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Context menu — right-click (desktop) or long-press (mobile) */}
      {showActions && (
        <div
          className="fixed z-[70] bg-popover border border-border rounded-lg shadow-xl p-1 min-w-[140px] animate-in fade-in-0 zoom-in-95"
          style={menuPos ? { left: menuPos.x, top: menuPos.y } : { right: 8, top: '100%' }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted rounded-md transition-colors"
            onClick={(e) => { e.stopPropagation(); onRename(); closeMenu(); }}
          >
            <Edit3 className="w-3 h-3" /> Ubah Nama
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted rounded-md transition-colors"
            onClick={(e) => { e.stopPropagation(); onPin(); closeMenu(); }}
          >
            {session.is_pinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
            {session.is_pinned ? "Lepas Pin" : "Sematkan"}
          </button>
          <Separator className="my-1" />
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-destructive/10 rounded-md transition-colors"
            onClick={(e) => { e.stopPropagation(); onDelete(); closeMenu(); }}
          >
            <Trash2 className="w-3 h-3" /> Hapus Sesi
          </button>
        </div>
      )}
    </div>
  );
}

