import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { endOfMonth, eachDayOfInterval, format, parse, startOfMonth } from "date-fns";
import { CalendarDays, HelpCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductTour, TourButton, type TourStep } from "@/components/ui/product-tour";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { supabaseExternal as supabase } from "@/core/repositories/supabase-compat.repository";
import { providerConfig } from "@/config/provider.config";
import { useClasses } from "@/hooks/useClasses";
import { useAttendanceV2, type RecapProfile } from "@/hooks/useAttendanceV2";
import {
  AcademicCalendarPanel,
  AttendanceV2MobileSectionNav,
  AttendanceV2SafetyNotes,
  AttendanceV2SectionNav,
  AttendanceV2StatusBadges,
  AttendanceV2SummaryStrip,
  AuditHistoryPanel,
  DelegationPanel,
  EffectiveDayPanel,
  MonthlyBackupPanel,
  RecapProfilePanel,
  type AttendanceV2Section,
  type AuditLogRow,
  type CalendarDay,
  type CalendarEffect,
  type CalendarEventType,
  type CalendarResponse,
  type CalendarScope,
  type EffectiveStats,
  hasCalendarConflict,
  type RecurrenceFrequency,
} from "./AttendanceV2ControlCenter.panels";

const TOUR_CLASS_ID = "attendance-v2-tour-class";

const TOUR_STEPS: TourStep[] = [
  {
    target: "[data-tour='attendance-v2-header']",
    title: "Pusat Pengaturan Presensi V2",
    description: "Semua pengaturan penting Presensi V2 dikumpulkan di satu dashboard yang aman. V1 tetap menjadi jalur default.",
  },
  {
    target: "[data-tour='attendance-v2-context']",
    title: "Pilih Kelas dan Bulan",
    description: "Kelas dan bulan menjadi konteks utama. Semua kalender, rekap, riwayat, delegasi, dan backup mengikuti pilihan ini.",
  },
  {
    target: "[data-tour='attendance-v2-summary']",
    title: "Ringkasan Cepat",
    description: "Lihat hari efektif, hari tidak efektif, konflik kalender, timezone, dan profile rekap aktif sebelum masuk ke detail.",
  },
  {
    target: "[data-tour='attendance-v2-section-nav']",
    title: "Navigasi Pengaturan",
    description: "Gunakan navigasi ini untuk berpindah antar area tanpa membuka semua fitur sekaligus.",
  },
  {
    target: "[data-tour='attendance-v2-calendar-panel']",
    title: "Kalender Akademik",
    description: "Kalender menampilkan libur, kegiatan, hari terkunci, hari di luar tahun ajaran, dan konflik event.",
    prepare: () => { window.dispatchEvent(new CustomEvent("attendance-v2-tour-section", { detail: "calendar" })); },
  },
  {
    target: "[data-tour='attendance-v2-add-event']",
    title: "Tambah Event",
    description: "Buat event satu hari, rentang tanggal, atau berulang. Gunakan scope kelas/sekolah dan efek presensi yang sesuai.",
    prepare: () => { window.dispatchEvent(new CustomEvent("attendance-v2-tour-section", { detail: "calendar" })); },
  },
  {
    target: "[data-tour='attendance-v2-effective-panel']",
    title: "Preview Hari Efektif",
    description: "Panel ini menjelaskan kenapa tanggal dihitung efektif, tidak efektif, terkunci, atau di luar tahun ajaran.",
    prepare: () => { window.dispatchEvent(new CustomEvent("attendance-v2-tour-section", { detail: "effective" })); },
  },
  {
    target: "[data-tour='attendance-v2-recap-panel']",
    title: "Profil Rekap",
    description: "Pilih rumus HSIAD, SIA, atau HSIA agar rekap mengikuti kebijakan sekolah atau kelas.",
    prepare: () => { window.dispatchEvent(new CustomEvent("attendance-v2-tour-section", { detail: "recap" })); },
  },
  {
    target: "[data-tour='attendance-v2-audit-panel']",
    title: "Riwayat Perubahan",
    description: "Audit menampilkan siapa editor, kapan perubahan terjadi, sumber perubahan, serta nilai sebelum dan sesudah.",
    prepare: () => { window.dispatchEvent(new CustomEvent("attendance-v2-tour-section", { detail: "audit" })); },
  },
  {
    target: "[data-tour='attendance-v2-delegation-panel']",
    title: "Delegasi Guru Pengganti",
    description: "Guru pengganti bisa diberi akses sementara, dan semua edit tetap tercatat atas nama editor sebenarnya.",
    prepare: () => { window.dispatchEvent(new CustomEvent("attendance-v2-tour-section", { detail: "delegation" })); },
  },
  {
    target: "[data-tour='attendance-v2-backup-panel']",
    title: "Backup Bulanan",
    description: "Buat snapshot sebelum perubahan besar. Restore tetap membuat audit baru agar riwayat tidak hilang.",
    prepare: () => { window.dispatchEvent(new CustomEvent("attendance-v2-tour-section", { detail: "backup" })); },
  },
];

function toIsoDate(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function formatMonthInput(date: Date) {
  return format(date, "yyyy-MM");
}

function parseMonthInput(value: string) {
  return parse(value, "yyyy-MM", new Date());
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { data: { session } } = await (supabase as any).auth.getSession();
  const token = session?.access_token;
  const response = await fetch(`${providerConfig.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token || ""}`,
      ...(init?.headers || {}),
    },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.error) {
    throw new Error(json.error?.message || `HTTP ${response.status}`);
  }
  return json.data as T;
}

function createTourCalendarDays(monthDate: Date): CalendarDay[] {
  const start = startOfMonth(monthDate);
  const end = endOfMonth(monthDate);
  return eachDayOfInterval({ start, end }).map((date) => {
    const dateStr = toIsoDate(date);
    const dayOfWeek = date.getDay();
    const isRangeEvent = dateStr >= `${format(monthDate, "yyyy-MM")}-10` && dateStr <= `${format(monthDate, "yyyy-MM")}-14`;
    const isWeeklyEvent = dayOfWeek === 5;
    const appliedEvents = [
      ...(isRangeEvent
        ? [{
            id: `tour-range-${dateStr}`,
            sourceEventId: "tour-range",
            date: dateStr,
            title: "Pesantren Ramadhan",
            description: "Contoh event rentang",
            color: "amber",
            scopeType: "school" as const,
            eventType: "activity" as const,
            effectOnAttendance: "non_effective" as const,
            priority: 50,
            reasonCode: "event_non_effective",
          }]
        : []),
      ...(isWeeklyEvent
        ? [{
            id: `tour-friday-${dateStr}`,
            sourceEventId: "tour-friday",
            date: dateStr,
            title: "Senam Jumat",
            description: "Contoh event berulang",
            color: "blue",
            scopeType: "class" as const,
            eventType: "activity" as const,
            effectOnAttendance: isRangeEvent ? "effective" as const : "info_only" as const,
            priority: 80,
            reasonCode: "event_effective_override",
          }]
        : []),
    ];
    const isSunday = dayOfWeek === 0;
    const isEffective = !isSunday && !isRangeEvent;
    return {
      date: dateStr,
      dayOfWeek,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      isEffective,
      labels: appliedEvents.map((event) => event.title),
      appliedEvents,
      reasonCodes: isSunday
        ? ["sunday"]
        : isRangeEvent
          ? ["event_non_effective"]
          : ["default_effective_day"],
    };
  });
}

function computeEffectiveStats(calendarDays: CalendarDay[], fallbackTotal: number): EffectiveStats {
  const total = calendarDays.length || fallbackTotal;
  const effective = calendarDays.filter((day) => day.isEffective).length;
  const locked = calendarDays.filter((day) => day.reasonCodes.includes("event_blocked_write")).length;
  const outsideYear = calendarDays.filter((day) => day.reasonCodes.includes("outside_academic_year")).length;
  return {
    total,
    effective,
    nonEffective: Math.max(0, total - effective),
    locked,
    outsideYear,
    conflicts: calendarDays.filter(hasCalendarConflict).length,
  };
}

export function AttendanceV2ControlCenter() {
  const { classes, isLoading: classesLoading } = useClasses();
  const { success, warning } = useEnhancedToast();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<AttendanceV2Section>("calendar");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [month, setMonth] = useState(formatMonthInput(new Date()));
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventStart, setEventStart] = useState(toIsoDate(new Date()));
  const [eventEnd, setEventEnd] = useState(toIsoDate(new Date()));
  const [eventScope, setEventScope] = useState<CalendarScope>("class");
  const [eventType, setEventType] = useState<CalendarEventType>("activity");
  const [eventEffect, setEventEffect] = useState<CalendarEffect>("info_only");
  const [recurrence, setRecurrence] = useState<RecurrenceFrequency>("none");
  const [delegationEmail, setDelegationEmail] = useState("");
  const [delegationStart, setDelegationStart] = useState(toIsoDate(new Date()));
  const [delegationEnd, setDelegationEnd] = useState(toIsoDate(new Date()));
  const [snapshotReason, setSnapshotReason] = useState("");
  const [auditFilter, setAuditFilter] = useState("");
  const [isTourMode, setIsTourMode] = useState(false);
  const preTourClassIdRef = useRef<string | null>(null);
  const preTourSectionRef = useRef<AttendanceV2Section | null>(null);

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<AttendanceV2Section>).detail;
      if (detail) setActiveSection(detail);
    };
    window.addEventListener("attendance-v2-tour-section", listener);
    return () => window.removeEventListener("attendance-v2-tour-section", listener);
  }, []);

  useEffect(() => {
    if (!selectedClassId && classes.length > 0 && !isTourMode) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId, isTourMode]);

  const effectiveClasses = useMemo(() => {
    if (!isTourMode) return classes;
    return [
      {
        id: TOUR_CLASS_ID,
        name: "Contoh Kelas V2",
        student_count: 24,
      },
      ...classes,
    ] as typeof classes;
  }, [classes, isTourMode]);

  const selectedClass = useMemo(
    () => effectiveClasses.find((item) => item.id === selectedClassId) || null,
    [effectiveClasses, selectedClassId],
  );

  const monthDate = useMemo(() => parseMonthInput(month), [month]);
  const rangeStart = toIsoDate(startOfMonth(monthDate));
  const rangeEnd = toIsoDate(endOfMonth(monthDate));
  const monthDays = useMemo(() => eachDayOfInterval({ start: startOfMonth(monthDate), end: endOfMonth(monthDate) }), [monthDate]);
  const activeClassId = isTourMode && selectedClassId === TOUR_CLASS_ID ? "" : selectedClassId;
  const attendance = useAttendanceV2(activeClassId, monthDate);

  const calendarQuery = useQuery({
    queryKey: ["attendance_v2_calendar_center", selectedClassId, rangeStart, rangeEnd],
    queryFn: () => apiFetch<CalendarResponse>(`/attendance/v2/calendar?classId=${selectedClassId}&startDate=${rangeStart}&endDate=${rangeEnd}`),
    enabled: !!selectedClassId && !isTourMode,
  });

  const auditQuery = useQuery({
    queryKey: ["attendance_v2_audit_center", selectedClassId],
    queryFn: () => apiFetch<AuditLogRow[]>(`/attendance/v2/audit?classId=${selectedClassId}`),
    enabled: !!selectedClassId && !isTourMode,
  });

  const tourCalendarDays = useMemo(() => createTourCalendarDays(monthDate), [monthDate]);
  const calendarDays = isTourMode ? tourCalendarDays : calendarQuery.data?.days || [];
  const calendarEvents = isTourMode ? tourCalendarDays.flatMap((day) => day.appliedEvents) : calendarQuery.data?.events || [];
  const effectiveStats = useMemo(() => computeEffectiveStats(calendarDays, monthDays.length), [calendarDays, monthDays.length]);

  const createEventMutation = useMutation({
    mutationFn: async () => {
      if (isTourMode) return { tour: true };
      const recurrenceRule =
        recurrence === "none"
          ? null
          : {
              freq: recurrence,
              interval: 1,
              byWeekday: recurrence === "weekly" ? [new Date(`${eventStart}T00:00:00`).getDay()] : undefined,
            };
      return apiFetch("/attendance/v2/calendar-events", {
        method: "POST",
        body: JSON.stringify({
          classId: eventScope === "class" ? selectedClassId : null,
          scopeType: eventScope,
          eventType,
          title: eventTitle.trim(),
          description: eventDescription.trim() || null,
          startDate: eventStart,
          endDate: eventEnd || eventStart,
          recurrenceRule,
          priority: eventScope === "class" ? 80 : 50,
          effectOnAttendance: eventEffect,
          color: eventEffect === "non_effective" ? "amber" : eventEffect === "blocked_write" ? "red" : "blue",
          source: "v2_calendar_ui",
        }),
      });
    },
    onSuccess: () => {
      success("Agenda disimpan", isTourMode ? "Contoh agenda panduan tidak disimpan ke database." : "Kalender akademik V2 berhasil diperbarui.");
      setEventTitle("");
      setEventDescription("");
      void queryClient.invalidateQueries({ queryKey: ["attendance_v2_calendar_center", selectedClassId] });
      attendance.refetch();
    },
    onError: (error: Error) => warning("Gagal menyimpan agenda", error.message),
  });

  const saveRecapMutation = useMutation({
    mutationFn: async (profile: RecapProfile) => attendance.updateRecapProfile(profile),
    onSuccess: () => success("Profil rekap disimpan", "Rumus rekap presensi V2 sudah diperbarui."),
    onError: (error: Error) => warning("Gagal menyimpan profil rekap", error.message),
  });

  const createDelegationMutation = useMutation({
    mutationFn: async () => {
      const { data: profileData, error } = await (supabase as any)
        .from("profiles")
        .select("id, name, email")
        .eq("email", delegationEmail.trim())
        .maybeSingle();
      if (error) throw error;
      if (!profileData?.id) {
        throw new Error("Akun guru pengganti tidak ditemukan. Pastikan email sudah terdaftar.");
      }
      await attendance.createDelegation({
        granteeUserId: profileData.id,
        granteeLabel: profileData.name || profileData.email || delegationEmail.trim(),
        startsAt: new Date(`${delegationStart}T00:00:00`),
        endsAt: new Date(`${delegationEnd}T23:59:59`),
      });
    },
    onSuccess: () => {
      success("Delegasi aktif", "Akses guru pengganti berhasil dibuat.");
      setDelegationEmail("");
    },
    onError: (error: Error) => warning("Gagal membuat delegasi", error.message),
  });

  const snapshotMutation = useMutation({
    mutationFn: () => attendance.createSnapshot(snapshotReason.trim() || null),
    onSuccess: () => {
      success("Backup dibuat", "Snapshot bulanan Presensi V2 berhasil dibuat.");
      setSnapshotReason("");
    },
    onError: (error: Error) => warning("Gagal membuat backup", error.message),
  });

  const filteredAudit = useMemo(() => {
    if (isTourMode) {
      return [
        {
          id: "tour-audit-1",
          action: "UPDATE_RECORD",
          actor_role: "Guru Pengganti",
          date: rangeStart,
          source: "manual",
          before_state: { status: "I" },
          after_state: { status: "H" },
          created_at: new Date().toISOString(),
        },
      ];
    }
    const query = auditFilter.trim().toLowerCase();
    const logs = auditQuery.data || [];
    if (!query) return logs;
    return logs.filter((log) => JSON.stringify(log).toLowerCase().includes(query));
  }, [auditFilter, auditQuery.data, isTourMode, rangeStart]);

  const prepareAttendanceV2Tour = async () => {
    preTourClassIdRef.current = selectedClassId;
    preTourSectionRef.current = activeSection;
    setIsTourMode(true);
    setSelectedClassId(TOUR_CLASS_ID);
    setActiveSection("calendar");
    setEventTitle("Pesantren Ramadhan");
    setEventDescription("Contoh event rentang untuk panduan.");
  };

  const cleanupAttendanceV2Tour = () => {
    setIsTourMode(false);
    setSelectedClassId(preTourClassIdRef.current || classes[0]?.id || "");
    setActiveSection(preTourSectionRef.current || "calendar");
    setEventTitle("");
    setEventDescription("");
    preTourClassIdRef.current = null;
    preTourSectionRef.current = null;
  };

  const renderActivePanel = () => {
    switch (activeSection) {
      case "effective":
        return <EffectiveDayPanel calendarDays={calendarDays} stats={effectiveStats} />;
      case "recap":
        return (
          <RecapProfilePanel
            profile={attendance.recapProfile}
            isSaving={saveRecapMutation.isPending}
            onSave={(profile) => saveRecapMutation.mutate(profile)}
          />
        );
      case "audit":
        return <AuditHistoryPanel logs={filteredAudit} filter={auditFilter} onFilterChange={setAuditFilter} />;
      case "delegation":
        return (
          <DelegationPanel
            email={delegationEmail}
            startsAt={delegationStart}
            endsAt={delegationEnd}
            delegations={isTourMode ? [{
              id: "tour-delegation",
              class_id: TOUR_CLASS_ID,
              grantee_user_id: "tour-substitute",
              grantee_label: "Guru Pengganti Contoh",
              actor_role: "substitute",
              permissions: ["read", "write"],
              starts_at: new Date().toISOString(),
              ends_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
            }] : attendance.delegations}
            isSaving={createDelegationMutation.isPending}
            onEmailChange={setDelegationEmail}
            onStartsAtChange={setDelegationStart}
            onEndsAtChange={setDelegationEnd}
            onCreate={() => createDelegationMutation.mutate()}
            onRevoke={(id) => attendance.revokeDelegation(id)}
          />
        );
      case "backup":
        return (
          <MonthlyBackupPanel
            reason={snapshotReason}
            snapshots={isTourMode ? [{
              id: "tour-snapshot",
              class_id: TOUR_CLASS_ID,
              month,
              snapshot_json: {},
              calendar_version: {},
              reason: "Contoh backup sebelum import massal",
              created_at: new Date().toISOString(),
            }] : attendance.snapshots}
            isCreating={snapshotMutation.isPending}
            onReasonChange={setSnapshotReason}
            onCreate={() => snapshotMutation.mutate()}
            onRestore={(id) => attendance.restoreSnapshot(id)}
          />
        );
      case "calendar":
      default:
        return (
          <AcademicCalendarPanel
            calendarDays={calendarDays}
            calendarEvents={calendarEvents}
            monthDays={monthDays}
            context={calendarQuery.data?.context}
            stats={effectiveStats}
            eventTitle={eventTitle}
            eventDescription={eventDescription}
            eventStart={eventStart}
            eventEnd={eventEnd}
            eventScope={eventScope}
            eventType={eventType}
            eventEffect={eventEffect}
            recurrence={recurrence}
            isSaving={createEventMutation.isPending}
            canSave={!!selectedClassId && !!eventTitle.trim()}
            isTourMode={isTourMode}
            onTitleChange={setEventTitle}
            onDescriptionChange={setEventDescription}
            onStartChange={setEventStart}
            onEndChange={setEventEnd}
            onScopeChange={setEventScope}
            onTypeChange={setEventType}
            onEffectChange={setEventEffect}
            onRecurrenceChange={setRecurrence}
            onSave={() => createEventMutation.mutate()}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <section className="rounded-2xl border bg-card p-4 shadow-sm" data-tour="attendance-v2-header">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0 space-y-2">
              <AttendanceV2StatusBadges isTourMode={isTourMode} />
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Pengaturan Presensi V2</h1>
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                  Dashboard untuk mengelola kalender akademik, hari efektif, rumus rekap, audit, delegasi, dan backup tanpa mengubah Presensi V1.
                </p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto] xl:w-[660px]" data-tour="attendance-v2-context">
              <div className="space-y-1">
                <Label htmlFor="attendance-v2-class">Kelas</Label>
                <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                  <SelectTrigger id="attendance-v2-class" className="min-h-11">
                    <SelectValue placeholder="Pilih kelas" />
                  </SelectTrigger>
                  <SelectContent isEmpty={effectiveClasses.length === 0} emptyLabel="Tidak ada pilihan Kelas">
                    {effectiveClasses.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} ({item.student_count || 0} murid)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="attendance-v2-month">Bulan</Label>
                <Input id="attendance-v2-month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="min-h-11" />
              </div>
              <div className="flex items-end">
                <TourButton tourKey="attendance-v2-settings" onBeforeStart={prepareAttendanceV2Tour} className="min-h-11 w-full justify-center" />
              </div>
            </div>
          </div>
        </section>

        {!selectedClassId && !classesLoading ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
              <HelpCircle className="h-8 w-8 text-primary" />
              Belum ada kelas yang dapat dikelola. Buat kelas terlebih dahulu dari halaman Kelas & Murid, atau gunakan tombol Panduan untuk melihat contoh.
            </CardContent>
          </Card>
        ) : null}

        <AttendanceV2SummaryStrip
          stats={effectiveStats}
          timezone={calendarQuery.data?.context?.timezone || "Asia/Makassar"}
          activeProfile={attendance.recapProfile.name}
        />

        <AttendanceV2MobileSectionNav active={activeSection} onChange={setActiveSection} />

        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-4">
              <AttendanceV2SectionNav active={activeSection} onChange={setActiveSection} />
            </div>
          </aside>
          <main className="min-w-0">{renderActivePanel()}</main>
        </div>

        <AttendanceV2SafetyNotes />
      </div>
      <ProductTour steps={TOUR_STEPS} tourKey="attendance-v2-settings" onComplete={cleanupAttendanceV2Tour} requireOnboarding={false} />
    </div>
  );
}

export default AttendanceV2ControlCenter;
