import React from "react";
import {
  AlertTriangle,
  Archive,
  CalendarDays,
  CheckCircle2,
  Clock,
  History,
  Loader2,
  Lock,
  Plus,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AttendanceStatusValue, Delegation, MonthSnapshot, RecapProfile } from "@/hooks/useAttendanceV2";
import { cn } from "@/lib/utils";

export type AttendanceV2Section = "calendar" | "effective" | "recap" | "audit" | "delegation" | "backup";
export type CalendarScope = "school" | "class";
export type CalendarEffect = "non_effective" | "effective" | "info_only" | "blocked_write";
export type CalendarEventType = "holiday" | "activity" | "closure" | "effective_override" | "exam" | "info";
export type RecurrenceFrequency = "none" | "weekly" | "monthly";

export interface CalendarContext {
  timezone?: string;
  workDayFormat?: "5days" | "6days";
  academicStartsOn?: string;
  academicEndsOn?: string;
}

export interface ExpandedCalendarEvent {
  id: string;
  sourceEventId: string;
  date: string;
  title: string;
  description: string | null;
  color: string;
  scopeType: "national" | "school" | "class" | "user";
  eventType: CalendarEventType;
  effectOnAttendance: CalendarEffect | "force_present";
  priority: number;
  reasonCode: string;
}

export interface CalendarDay {
  date: string;
  dayOfWeek: number;
  isWeekend: boolean;
  isEffective: boolean;
  labels: string[];
  appliedEvents: ExpandedCalendarEvent[];
  reasonCodes: string[];
}

export interface CalendarResponse {
  context: CalendarContext;
  days: CalendarDay[];
  events: ExpandedCalendarEvent[];
}

export interface AuditLogRow {
  id: string;
  actor_user_id?: string | null;
  actor_role?: string | null;
  action: string;
  class_id?: string | null;
  student_id?: string | null;
  date?: string | null;
  before_state?: unknown;
  after_state?: unknown;
  source?: string | null;
  created_at?: string;
}

export interface EffectiveStats {
  total: number;
  effective: number;
  nonEffective: number;
  locked: number;
  outsideYear: number;
  conflicts: number;
}

export const SECTION_ITEMS: Array<{ value: AttendanceV2Section; label: string; description: string; icon: React.ElementType; tour: string }> = [
  { value: "calendar", label: "Kalender Akademik", description: "Agenda, libur, rentang, dan event berulang.", icon: CalendarDays, tour: "attendance-v2-calendar-nav" },
  { value: "effective", label: "Hari Efektif", description: "Alasan sistem untuk rekap dan export.", icon: CheckCircle2, tour: "attendance-v2-effective-nav" },
  { value: "recap", label: "Profil Rekap", description: "Rumus HSIAD, SIA, HSIA, atau custom.", icon: Settings2, tour: "attendance-v2-recap-nav" },
  { value: "audit", label: "Riwayat", description: "Jejak perubahan dan sumber edit.", icon: History, tour: "attendance-v2-audit-nav" },
  { value: "delegation", label: "Delegasi", description: "Akses guru pengganti sementara.", icon: Users, tour: "attendance-v2-delegation-nav" },
  { value: "backup", label: "Backup", description: "Snapshot dan restore bulanan.", icon: Archive, tour: "attendance-v2-backup-nav" },
];

export const STATUS_LABEL: Record<AttendanceStatusValue, string> = {
  H: "Hadir",
  S: "Sakit",
  I: "Izin",
  A: "Alpha",
  D: "Dispensasi",
};

export const EFFECT_OPTIONS: Array<{ value: CalendarEffect; label: string; description: string }> = [
  { value: "non_effective", label: "Libur / Tidak Efektif", description: "Tanggal tidak masuk hitungan hari efektif." },
  { value: "effective", label: "Tetap Efektif", description: "Tanggal tetap dihitung sebagai hari efektif." },
  { value: "info_only", label: "Info Saja", description: "Hanya tampil sebagai keterangan." },
  { value: "blocked_write", label: "Terkunci", description: "Presensi tidak bisa diedit pada tanggal ini." },
];

export const RECAP_PRESETS: Array<{
  id: "HSIAD" | "SIA" | "HSIA";
  name: string;
  counted: AttendanceStatusValue[];
  present: AttendanceStatusValue[];
  absence: AttendanceStatusValue[];
}> = [
  { id: "HSIAD", name: "HSIAD", counted: ["H", "S", "I", "A", "D"], present: ["H", "D"], absence: ["S", "I", "A"] },
  { id: "SIA", name: "SIA", counted: ["S", "I", "A"], present: [], absence: ["S", "I", "A"] },
  { id: "HSIA", name: "HSIA", counted: ["H", "S", "I", "A"], present: ["H"], absence: ["S", "I", "A"] },
];

export function getReasonLabel(reason: string) {
  const labels: Record<string, string> = {
    outside_academic_year: "Di luar tahun ajaran",
    sunday: "Minggu",
    saturday_inactive: "Sabtu pada mode 5 hari",
    event_non_effective: "Event tidak efektif",
    event_effective_override: "Event membuat hari efektif",
    event_blocked_write: "Tanggal terkunci",
    default_effective_day: "Hari efektif normal",
  };
  return labels[reason] || reason.replace(/_/g, " ");
}

export function hasCalendarConflict(day: CalendarDay) {
  const events = day.appliedEvents || [];
  const effects = new Set(events.map((event) => event.effectOnAttendance));
  const scopes = new Set(events.map((event) => event.scopeType));
  return events.length > 1 && (effects.size > 1 || scopes.size > 1);
}

function StatCard({ label, value, tone = "default" }: { label: string; value: number | string; tone?: "default" | "green" | "amber" | "red" | "blue" }) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card px-3 py-2.5",
        tone === "green" && "border-emerald-200 bg-emerald-50/80 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-100",
        tone === "amber" && "border-amber-200 bg-amber-50/80 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100",
        tone === "red" && "border-red-200 bg-red-50/80 text-red-950 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-100",
        tone === "blue" && "border-blue-200 bg-blue-50/80 text-blue-950 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-100",
      )}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}

export function AttendanceV2SummaryStrip({ stats, timezone, activeProfile }: { stats: EffectiveStats; timezone: string; activeProfile: string }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5" data-tour="attendance-v2-summary">
      <StatCard label="Hari efektif" value={stats.effective} tone="green" />
      <StatCard label="Tidak efektif" value={stats.nonEffective} tone="amber" />
      <StatCard label="Konflik" value={stats.conflicts} tone={stats.conflicts ? "red" : "default"} />
      <StatCard label="Timezone" value={timezone} tone="blue" />
      <StatCard label="Profil rekap" value={activeProfile} />
    </div>
  );
}

export function AttendanceV2SectionNav({ active, onChange }: { active: AttendanceV2Section; onChange: (section: AttendanceV2Section) => void }) {
  return (
    <nav className="space-y-2" aria-label="Pengaturan Presensi V2" data-tour="attendance-v2-section-nav">
      {SECTION_ITEMS.map((item) => {
        const Icon = item.icon;
        const selected = active === item.value;
        return (
          <button
            key={item.value}
            type="button"
            data-tour={item.tour}
            data-selected={selected ? "true" : "false"}
            className={cn(
              "flex min-h-14 w-full touch-manipulation items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
              selected
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card hover:border-primary/40 hover:bg-primary/5",
            )}
            onClick={() => onChange(item.value)}
          >
            <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", selected ? "bg-white/15" : "bg-primary/10 text-primary")}>
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{item.label}</span>
              <span className={cn("block text-xs", selected ? "text-primary-foreground/80" : "text-muted-foreground")}>{item.description}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

export function AttendanceV2MobileSectionNav({ active, onChange }: { active: AttendanceV2Section; onChange: (section: AttendanceV2Section) => void }) {
  return (
    <div className="overflow-x-auto pb-1 lg:hidden" data-tour="attendance-v2-section-nav-mobile">
      <div className="grid min-w-[620px] grid-cols-6 gap-1 rounded-2xl border bg-muted/30 p-1">
        {SECTION_ITEMS.map((item) => {
          const Icon = item.icon;
          const selected = active === item.value;
          return (
            <button
              key={item.value}
              type="button"
              className={cn(
                "flex min-h-11 touch-manipulation items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold",
                selected ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-background",
              )}
              onClick={() => onChange(item.value)}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label.split(" ")[0]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface AcademicCalendarPanelProps {
  calendarDays: CalendarDay[];
  calendarEvents: ExpandedCalendarEvent[];
  monthDays: Date[];
  context?: CalendarContext;
  stats: EffectiveStats;
  eventTitle: string;
  eventDescription: string;
  eventStart: string;
  eventEnd: string;
  eventScope: CalendarScope;
  eventType: CalendarEventType;
  eventEffect: CalendarEffect;
  recurrence: RecurrenceFrequency;
  isSaving: boolean;
  canSave: boolean;
  isTourMode: boolean;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  onScopeChange: (value: CalendarScope) => void;
  onTypeChange: (value: CalendarEventType) => void;
  onEffectChange: (value: CalendarEffect) => void;
  onRecurrenceChange: (value: RecurrenceFrequency) => void;
  onSave: () => void;
}

export function AcademicCalendarPanel(props: AcademicCalendarPanelProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
      <Card data-tour="attendance-v2-calendar-panel">
        <CardHeader className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg"><CalendarDays className="h-5 w-5 text-primary" />Kalender Akademik</CardTitle>
          <CardDescription>Event tampil berdasarkan bulan aktif, sehingga kalender tetap ringan walau data bertambah.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-7 overflow-hidden rounded-xl border text-center text-xs">
            {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((day) => (
              <div key={day} className="border-b bg-muted/70 px-2 py-2 font-semibold text-muted-foreground shadow-sm">{day}</div>
            ))}
            {props.monthDays.map((date) => {
              const dateStr = format(date, "yyyy-MM-dd");
              const day = props.calendarDays.find((item) => item.date === dateStr);
              const hasConflict = day ? hasCalendarConflict(day) : false;
              return (
                <div
                  key={dateStr}
                  className={cn(
                    "min-h-[102px] border-b border-r p-2 text-left last:border-r-0",
                    day && !day.isEffective && "bg-amber-50/70 dark:bg-amber-950/20",
                    day?.reasonCodes.includes("event_blocked_write") && "bg-red-50/70 dark:bg-red-950/20",
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold">{format(date, "d")}</span>
                    {hasConflict ? <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> : null}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {day && !day.isEffective ? <Badge variant="secondary" className="h-5 rounded-full px-1.5 text-[10px]">Tidak efektif</Badge> : null}
                    {day?.reasonCodes.includes("event_blocked_write") ? <Badge variant="destructive" className="h-5 rounded-full px-1.5 text-[10px]">Terkunci</Badge> : null}
                    {day?.reasonCodes.includes("outside_academic_year") ? <Badge variant="outline" className="h-5 rounded-full px-1.5 text-[10px]">Luar TA</Badge> : null}
                  </div>
                  <div className="mt-1 space-y-1">
                    {(day?.appliedEvents || []).slice(0, 3).map((event) => (
                      <div key={`${event.id}-${event.date}`} className="truncate rounded-md bg-primary/10 px-1.5 py-1 text-[10px] font-medium text-primary">
                        {event.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <StatCard label="Event bulan ini" value={props.calendarEvents.length} />
            <StatCard label="Konflik terdeteksi" value={props.stats.conflicts} tone={props.stats.conflicts ? "amber" : "green"} />
            <StatCard label="Timezone" value={props.context?.timezone || "Asia/Makassar"} />
          </div>
        </CardContent>
      </Card>

      <Card data-tour="attendance-v2-add-event">
        <CardHeader>
          <CardTitle className="text-lg">Tambah Event Kalender</CardTitle>
          <CardDescription>Gunakan rentang atau berulang agar guru tidak perlu membuat banyak tanggal manual.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {props.isTourMode ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-100">
              Mode panduan memakai contoh in-memory. Tidak ada data yang disimpan ke database.
            </div>
          ) : null}
          <div className="space-y-1">
            <Label>Judul</Label>
            <Input value={props.eventTitle} onChange={(event) => props.onTitleChange(event.target.value)} placeholder="Contoh: Pesantren Ramadhan" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Tanggal Mulai</Label>
              <Input type="date" value={props.eventStart} onChange={(event) => props.onStartChange(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Tanggal Selesai</Label>
              <Input type="date" value={props.eventEnd} onChange={(event) => props.onEndChange(event.target.value)} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Scope</Label>
              <Select value={props.eventScope} onValueChange={(value) => props.onScopeChange(value as CalendarScope)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="class">Kelas ini</SelectItem>
                  <SelectItem value="school">Sekolah</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Berulang</Label>
              <Select value={props.recurrence} onValueChange={(value) => props.onRecurrenceChange(value as RecurrenceFrequency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tidak berulang</SelectItem>
                  <SelectItem value="weekly">Mingguan</SelectItem>
                  <SelectItem value="monthly">Bulanan</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Jenis</Label>
              <Select value={props.eventType} onValueChange={(value) => props.onTypeChange(value as CalendarEventType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="holiday">Libur</SelectItem>
                  <SelectItem value="activity">Kegiatan</SelectItem>
                  <SelectItem value="closure">Penutupan</SelectItem>
                  <SelectItem value="effective_override">Override Efektif</SelectItem>
                  <SelectItem value="exam">Ujian</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Efek Presensi</Label>
              <Select value={props.eventEffect} onValueChange={(value) => props.onEffectChange(value as CalendarEffect)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EFFECT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Catatan</Label>
            <Textarea value={props.eventDescription} onChange={(event) => props.onDescriptionChange(event.target.value)} placeholder="Keterangan tambahan untuk guru atau export." />
          </div>
          <Button className="min-h-11 w-full gap-2" disabled={!props.canSave || props.isSaving} onClick={props.onSave}>
            {props.isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Simpan Event Kalender
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function EffectiveDayPanel({ calendarDays, stats }: { calendarDays: CalendarDay[]; stats: EffectiveStats }) {
  return (
    <div className="space-y-4" data-tour="attendance-v2-effective-panel">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total hari kalender" value={stats.total} />
        <StatCard label="Hari efektif" value={stats.effective} tone="green" />
        <StatCard label="Tidak efektif" value={stats.nonEffective} tone="amber" />
        <StatCard label="Di luar tahun ajaran" value={stats.outsideYear} />
        <StatCard label="Terkunci" value={stats.locked} tone={stats.locked ? "red" : "default"} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Alasan Hari Efektif Bulan Ini</CardTitle>
          <CardDescription>Daftar ini menjadi dasar rekap/export agar angka hari efektif mudah diperiksa.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted/70 shadow-sm">
                <tr className="[&>th]:px-3 [&>th]:py-3 [&>th]:text-center [&>th]:font-semibold">
                  <th>Tanggal</th>
                  <th>Status Sistem</th>
                  <th>Alasan</th>
                  <th>Event</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {calendarDays.map((day) => (
                  <tr key={day.date} className="[&>td]:px-3 [&>td]:py-2">
                    <td className="whitespace-nowrap font-medium">{format(new Date(`${day.date}T00:00:00`), "EEEE, d MMM yyyy", { locale: idLocale })}</td>
                    <td className="text-center"><Badge variant={day.isEffective ? "default" : "secondary"}>{day.isEffective ? "Efektif" : "Tidak efektif"}</Badge></td>
                    <td>{day.reasonCodes.map(getReasonLabel).join(", ") || "-"}</td>
                    <td>{day.appliedEvents.map((event) => event.title).join(", ") || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function RecapProfilePanel({ profile, onSave, isSaving }: { profile: RecapProfile; onSave: (profile: RecapProfile) => void; isSaving: boolean }) {
  return (
    <Card data-tour="attendance-v2-recap-panel">
      <CardHeader>
        <CardTitle className="text-lg">Profil Rekap Presensi</CardTitle>
        <CardDescription>Profile aktif: <span className="font-semibold text-foreground">{profile.name}</span>. Rekap/export mengikuti rumus ini.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 md:grid-cols-3">
          {RECAP_PRESETS.map((preset) => (
            <Button
              key={preset.id}
              variant="outline"
              className="min-h-20 flex-col items-start justify-center rounded-xl text-left"
              disabled={isSaving}
              onClick={() => onSave({
                id: profile.id,
                name: preset.name,
                counted_statuses: preset.counted,
                present_statuses: preset.present,
                absence_statuses: preset.absence,
                denominator_policy: "effective_days",
                display_order: ["H", "S", "I", "A", "D"],
              })}
            >
              <span className="font-bold">{preset.name}</span>
              <span className="text-xs text-muted-foreground">Hitung: {preset.counted.join(", ") || "-"}</span>
            </Button>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-5">
          {(["H", "S", "I", "A", "D"] as AttendanceStatusValue[]).map((status) => {
            const category = profile.present_statuses.includes(status)
              ? "Hadir"
              : profile.absence_statuses.includes(status)
                ? "Tidak hadir"
                : profile.counted_statuses.includes(status)
                  ? "Catatan"
                  : "Tidak dihitung";
            return (
              <div key={status} className="rounded-xl border bg-card p-3">
                <div className="text-lg font-bold">{status}</div>
                <div className="text-sm">{STATUS_LABEL[status]}</div>
                <div className="mt-2 text-xs text-muted-foreground">{category}</div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function AuditHistoryPanel({ logs, filter, onFilterChange }: { logs: AuditLogRow[]; filter: string; onFilterChange: (value: string) => void }) {
  return (
    <Card data-tour="attendance-v2-audit-panel">
      <CardHeader>
        <CardTitle className="text-lg">Audit Riwayat Perubahan</CardTitle>
        <CardDescription>Catatan perubahan V2 menampilkan editor, waktu, sumber, dan nilai sebelum/sesudah.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input value={filter} onChange={(event) => onFilterChange(event.target.value)} placeholder="Filter murid, tanggal, guru, aksi, atau sumber..." />
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-muted/70 shadow-sm">
              <tr className="[&>th]:px-3 [&>th]:py-3 [&>th]:text-center [&>th]:font-semibold">
                <th>Waktu</th>
                <th>Aksi</th>
                <th>Editor</th>
                <th>Tanggal Presensi</th>
                <th>Sumber</th>
                <th>Perubahan</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Belum ada riwayat untuk filter ini.</td></tr>
              ) : logs.slice(0, 80).map((log) => (
                <tr key={log.id} className="[&>td]:px-3 [&>td]:py-2">
                  <td className="whitespace-nowrap">{log.created_at ? format(new Date(log.created_at), "d MMM yyyy HH:mm", { locale: idLocale }) : "-"}</td>
                  <td className="font-medium">{log.action}</td>
                  <td>{log.actor_role || log.actor_user_id || "-"}</td>
                  <td>{log.date || "-"}</td>
                  <td>{log.source || "manual"}</td>
                  <td className="max-w-[280px] truncate">{JSON.stringify({ before: log.before_state, after: log.after_state })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

interface DelegationPanelProps {
  email: string;
  startsAt: string;
  endsAt: string;
  delegations: Delegation[];
  isSaving: boolean;
  onEmailChange: (value: string) => void;
  onStartsAtChange: (value: string) => void;
  onEndsAtChange: (value: string) => void;
  onCreate: () => void;
  onRevoke: (id: string) => void;
}

export function DelegationPanel(props: DelegationPanelProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]" data-tour="attendance-v2-delegation-panel">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Delegasi Guru Pengganti</CardTitle>
          <CardDescription>Guru pengganti bisa diberi akses sementara dan tetap tercatat sebagai editor sebenarnya.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Email guru</Label>
            <Input value={props.email} onChange={(event) => props.onEmailChange(event.target.value)} placeholder="guru.pengganti@sekolah.sch.id" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Mulai</Label>
              <Input type="date" value={props.startsAt} onChange={(event) => props.onStartsAtChange(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Selesai</Label>
              <Input type="date" value={props.endsAt} onChange={(event) => props.onEndsAtChange(event.target.value)} />
            </div>
          </div>
          <Button className="min-h-11 w-full gap-2" disabled={!props.email.trim() || props.isSaving} onClick={props.onCreate}>
            {props.isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
            Beri Akses Sementara
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-lg">Delegasi Aktif</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {props.delegations.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Belum ada delegasi aktif.</div>
          ) : props.delegations.map((delegation) => (
            <div key={delegation.id} className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-semibold">{delegation.grantee_label || delegation.grantee_user_id}</div>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(delegation.starts_at), "d MMM yyyy", { locale: idLocale })} - {format(new Date(delegation.ends_at), "d MMM yyyy", { locale: idLocale })}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => props.onRevoke(delegation.id)}>Cabut</Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

interface MonthlyBackupPanelProps {
  reason: string;
  snapshots: MonthSnapshot[];
  isCreating: boolean;
  onReasonChange: (value: string) => void;
  onCreate: () => void;
  onRestore: (id: string) => void;
}

export function MonthlyBackupPanel(props: MonthlyBackupPanelProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]" data-tour="attendance-v2-backup-panel">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Backup Bulanan</CardTitle>
          <CardDescription>Backup menyimpan snapshot bulan aktif dan restore membuat audit baru.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Catatan backup</Label>
            <Textarea value={props.reason} onChange={(event) => props.onReasonChange(event.target.value)} placeholder="Contoh: sebelum import massal bulan ini" />
          </div>
          <Button className="min-h-11 w-full gap-2" disabled={props.isCreating} onClick={props.onCreate}>
            {props.isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
            Buat Backup Bulan Ini
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-lg">Daftar Backup</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {props.snapshots.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Belum ada backup untuk bulan ini.</div>
          ) : props.snapshots.map((snapshot) => (
            <div key={snapshot.id} className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-semibold">{format(new Date(snapshot.created_at), "d MMM yyyy HH:mm", { locale: idLocale })}</div>
                <div className="text-xs text-muted-foreground">{snapshot.reason || "Tanpa catatan"}</div>
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => props.onRestore(snapshot.id)}>
                <RotateCcw className="h-3.5 w-3.5" />
                Pulihkan
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function AttendanceV2SafetyNotes() {
  return (
    <div className="grid gap-3 text-xs text-muted-foreground md:grid-cols-3">
      <div className="flex items-center gap-2 rounded-xl border bg-card p-3"><Clock className="h-4 w-4" />Tahun ajaran dihitung dari kalender kelas/sekolah, bukan asumsi awal bulan.</div>
      <div className="flex items-center gap-2 rounded-xl border bg-card p-3"><Lock className="h-4 w-4" />Bulan terkunci hanya baca dan dicatat di audit V2.</div>
      <div className="flex items-center gap-2 rounded-xl border bg-card p-3"><AlertTriangle className="h-4 w-4" />Event konflik ditandai agar guru dapat memeriksa prioritas.</div>
    </div>
  );
}

export function AttendanceV2StatusBadges({ isTourMode }: { isTourMode: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="secondary" className="gap-1 rounded-full"><ShieldCheck className="h-3.5 w-3.5" />V2 terkendali flag</Badge>
      <Badge variant="outline" className="rounded-full">V1 tetap default</Badge>
      {isTourMode ? <Badge variant="default" className="rounded-full">Mode Panduan</Badge> : null}
    </div>
  );
}
