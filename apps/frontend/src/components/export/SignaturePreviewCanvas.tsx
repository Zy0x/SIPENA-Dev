export { SignaturePreviewCanvas, type SignaturePreviewData, type ExportPreviewHighlightTarget } from "./SignaturePreviewDocument";
/*
import { useCallback, useMemo, useRef, type Dispatch, type PointerEvent as ReactPointerEvent, type SetStateAction } from "react";
import { Move } from "lucide-react";
import type { AttendanceStatusValue } from "@/hooks/useAttendance";
import type { SignatureSettingsConfig, SignatureSigner } from "@/hooks/useSignatureSettings";
import { ATTENDANCE_REKAP_STATUS_ORDER } from "@/lib/attendanceExport";

const PREVIEW_COLORS = {
  page: "hsl(0 0% 100%)",
  ink: "hsl(222 47% 11%)",
  inkMuted: "hsl(215 16% 47%)",
  border: "hsl(214 32% 91%)",
  borderStrong: "hsl(214 32% 82%)",
  panel: "hsl(210 40% 98%)",
  panelStrong: "hsl(210 40% 96%)",
  header: "hsl(217 91% 60%)",
  headerDark: "hsl(221 83% 53%)",
  headerSoft: "hsl(217 91% 96%)",
  accent: "hsl(217 91% 60%)",
  accentSoft: "hsl(217 91% 92%)",
  dragSoft: "hsl(217 91% 96%)",
  dragBorder: "hsl(217 91% 72%)",
  status: {
    H: { bg: "hsl(138 76% 97%)", fg: "hsl(142 72% 29%)" },
    S: { bg: "hsl(48 96% 89%)", fg: "hsl(35 92% 33%)" },
    I: { bg: "hsl(214 95% 93%)", fg: "hsl(221 83% 53%)" },
    A: { bg: "hsl(0 93% 94%)", fg: "hsl(0 72% 42%)" },
    D: { bg: "hsl(258 90% 95%)", fg: "hsl(262 83% 58%)" },
    L: { bg: "hsl(33 100% 95%)", fg: "hsl(24 95% 44%)" },
    total: { bg: "hsl(215 28% 93%)", fg: "hsl(222 47% 20%)" },
  },
};

type SummaryKey = AttendanceStatusValue | "total";

export interface AttendanceSignaturePreviewData {
  className: string;
  monthLabel: string;
  studentCount: number;
  workDayFormatLabel: string;
  exportTimeLabel: string;
  effectiveDays: number;
  days: Array<{
    key: string;
    dayName: string;
    dateLabel: string;
    isHoliday: boolean;
    isEvent: boolean;
  }>;
  rows: Array<{
    id: string;
    rowNumber: number;
    name: string;
    nisn: string;
    cells: Array<{
      status: AttendanceStatusValue | "L" | null;
      note: string | null;
      isHoliday: boolean;
    }>;
    stats: Record<AttendanceStatusValue, number>;
    total: number;
  }>;
  totals: Record<SummaryKey, number>;
  dayEvents: Array<{ date: string; label: string; description?: string }>;
  holidays: Array<{ date: string; description: string }>;
  notes: Array<{ student: string; date: string; note: string }>;
  pngSignatureLayout?: "inline" | "stacked";
}

interface SignaturePreviewCanvasProps {
  previewFormat: "pdf" | "png";
  draft: SignatureSettingsConfig;
  setDraft: Dispatch<SetStateAction<SignatureSettingsConfig>>;
  previewDate: string;
  previewData?: AttendanceSignaturePreviewData;
}

function useDraggableSignature(
  setDraft: Dispatch<SetStateAction<SignatureSettingsConfig>>,
  pxToMm: number,
) {
  const dragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const startOffset = useRef({ x: 0, y: 0 });

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    startPos.current = { x: event.clientX, y: event.clientY };
    setDraft((prev) => {
      startOffset.current = {
        x: prev.signatureOffsetX,
        y: prev.signatureOffsetY,
      };
      return prev;
    });
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }, [setDraft]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const deltaX = (event.clientX - startPos.current.x) * pxToMm;
    const deltaY = (event.clientY - startPos.current.y) * pxToMm;
    setDraft((prev) => ({
      ...prev,
      signatureOffsetX: Math.max(-100, Math.min(100, Math.round(startOffset.current.x + deltaX))),
      signatureOffsetY: Math.max(-60, Math.min(80, Math.round(startOffset.current.y + deltaY))),
    }));
  }, [pxToMm, setDraft]);

  const endDragging = useCallback(() => {
    dragging.current = false;
  }, []);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: endDragging,
    onPointerCancel: endDragging,
  };
}

function getVisibleSigners(signers: SignatureSigner[]) {
  const active = signers.filter((signer) => signer.name.trim() || signer.title.trim());
  return active.length > 0 ? active : signers.slice(0, 1);
}

function getStatusTone(status: AttendanceStatusValue | "L" | null) {
  if (!status) return { bg: PREVIEW_COLORS.panel, fg: PREVIEW_COLORS.inkMuted };
  return PREVIEW_COLORS.status[status === "L" ? "L" : status];
}

function formatSummaryValue(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

function splitRowsForPdf(data: AttendanceSignaturePreviewData) {
  const detailWeight = Math.ceil((data.dayEvents.length + data.holidays.length + data.notes.length) / 6);
  const firstPageCapacity = 12;
  const middleCapacity = 16;
  const lastPageCapacity = Math.max(7, 12 - detailWeight);
  const rows = [...data.rows];
  const pages: typeof data.rows[] = [];

  while (rows.length > 0) {
    const capacity = pages.length === 0
      ? (rows.length <= lastPageCapacity ? lastPageCapacity : firstPageCapacity)
      : (rows.length <= lastPageCapacity ? lastPageCapacity : middleCapacity);
    pages.push(rows.splice(0, capacity));
  }

  return pages.length > 0 ? pages : [[]];
}

function LegendBadges() {
  const items: Array<{ key: AttendanceStatusValue | "L" | "total"; label: string }> = [
    { key: "H", label: "Hadir" },
    { key: "S", label: "Sakit" },
    { key: "I", label: "Izin" },
    { key: "A", label: "Alpha" },
    { key: "D", label: "Dispensasi" },
    { key: "L", label: "Libur" },
  ];

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      <strong style={{ color: PREVIEW_COLORS.ink, fontSize: 11 }}>Keterangan Status:</strong>
      {items.map((item) => {
        const tone = PREVIEW_COLORS.status[item.key === "L" ? "L" : (item.key as AttendanceStatusValue)];
        return (
          <span
            key={item.key}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 8px",
              borderRadius: 999,
              background: tone.bg,
              color: tone.fg,
              border: `1px solid ${PREVIEW_COLORS.border}`,
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            {item.key} = {item.label}
          </span>
        );
      })}
    </div>
  );
}

function DetailSection({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  if (items.length === 0) return null;

  return (
    <div style={{ display: "grid", gap: 4 }}>
      <strong style={{ color: PREVIEW_COLORS.ink, fontSize: 11 }}>{title}</strong>
      <div style={{ display: "grid", gap: 2 }}>
        {items.map((item, index) => (
          <div key={`${title}-${index}`} style={{ color: PREVIEW_COLORS.inkMuted, fontSize: 10, lineHeight: 1.35 }}>
            • {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function SignatureBlock({
  draft,
  previewDate,
  setDraft,
  pxToMm,
  compact,
}: {
  draft: SignatureSettingsConfig;
  previewDate: string;
  setDraft: Dispatch<SetStateAction<SignatureSettingsConfig>>;
  pxToMm: number;
  compact?: boolean;
}) {
  const drag = useDraggableSignature(setDraft, pxToMm);
  const signers = useMemo(() => getVisibleSigners(draft.signers), [draft.signers]);
  const justifyContent = draft.signatureAlignment === "left"
    ? "flex-start"
    : draft.signatureAlignment === "center"
      ? "center"
      : "flex-end";
  const textAlign = draft.signatureAlignment === "left"
    ? "left"
    : draft.signatureAlignment === "center"
      ? "center"
      : "right";
  const pxPerMm = 1 / pxToMm;

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        justifyContent,
        transform: `translate(${draft.signatureOffsetX * pxPerMm}px, ${draft.signatureOffsetY * pxPerMm}px)`,
      }}
    >
      <div
        {...drag}
        style={{
          cursor: "grab",
          touchAction: "none",
          maxWidth: compact ? 320 : 420,
          width: "100%",
          borderRadius: 18,
          border: `1px dashed ${PREVIEW_COLORS.dragBorder}`,
          background: PREVIEW_COLORS.dragSoft,
          boxShadow: `0 10px 24px -18px ${PREVIEW_COLORS.dragBorder}`,
          padding: compact ? "12px 14px" : "14px 16px",
        }}
        title="Seret untuk mengatur posisi tanda tangan"
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            marginBottom: 8,
            padding: "3px 8px",
            borderRadius: 999,
            background: PREVIEW_COLORS.accent,
            color: PREVIEW_COLORS.page,
            fontSize: 10,
            fontWeight: 700,
          }}
        >
          <Move size={12} /> Seret langsung
        </div>
        <div style={{ textAlign, color: PREVIEW_COLORS.ink, fontSize: Math.max(10, draft.fontSize + 1), marginBottom: 8 }}>
          {draft.city || "[Kota]"}, {previewDate}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent,
            gap: compact ? Math.max(12, draft.signatureSpacing) : Math.max(16, draft.signatureSpacing),
            flexWrap: "wrap",
          }}
        >
          {signers.map((signer, index) => {
            const lineWidth = Math.max(96, draft.signatureLineWidth * (compact ? 1.55 : 1.8));
            return (
              <div
                key={signer.id || `${signer.name}-${index}`}
                style={{
                  minWidth: compact ? 120 : 140,
                  maxWidth: compact ? 180 : 210,
                  textAlign: "center",
                  color: PREVIEW_COLORS.ink,
                  fontSize: draft.fontSize,
                }}
              >
                <div>{signer.title || "Guru Mata Pelajaran"}</div>
                {index === 0 && signer.school_name ? (
                  <div style={{ color: PREVIEW_COLORS.inkMuted, fontSize: Math.max(9, draft.fontSize - 1), marginTop: 2 }}>
                    {signer.school_name}
                  </div>
                ) : null}
                <div style={{ height: compact ? 32 : 40 }} />
                {draft.showSignatureLine ? (
                  <div
                    style={{
                      width: lineWidth,
                      borderBottom: `1px solid ${PREVIEW_COLORS.ink}`,
                      margin: "0 auto 4px",
                    }}
                  />
                ) : null}
                <div style={{ fontWeight: 700 }}>{signer.name || "[Nama Penanda Tangan]"}</div>
                {signer.nip ? (
                  <div style={{ color: PREVIEW_COLORS.inkMuted, fontSize: Math.max(9, draft.fontSize - 1), marginTop: 2 }}>
                    NIP. {signer.nip}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AttendanceTable({
  days,
  rows,
  totals,
  showTotals,
}: {
  days: AttendanceSignaturePreviewData["days"];
  rows: AttendanceSignaturePreviewData["rows"];
  totals?: AttendanceSignaturePreviewData["totals"];
  showTotals?: boolean;
}) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
      <thead>
        <tr>
          <th rowSpan={2} style={pdfTableHeadCellStyle({ width: 28, align: "center" })}>No</th>
          <th rowSpan={2} style={pdfTableHeadCellStyle({ width: 120, align: "left" })}>Nama Siswa</th>
          {days.map((day) => (
            <th key={`day-name-${day.key}`} style={pdfTableHeadCellStyle({ width: 18, align: "center" })}>
              <div>{day.dayName}</div>
            </th>
          ))}
          <th colSpan={ATTENDANCE_REKAP_STATUS_ORDER.length + 1} style={pdfTableHeadCellStyle({ align: "center" })}>Jumlah</th>
        </tr>
        <tr>
          {days.map((day) => (
            <th key={`day-date-${day.key}`} style={pdfTableHeadCellStyle({ width: 18, align: "center", isSubhead: true })}>
              <div style={{ color: day.isHoliday ? PREVIEW_COLORS.status.L.fg : PREVIEW_COLORS.page }}>{day.dateLabel}</div>
            </th>
          ))}
          {ATTENDANCE_REKAP_STATUS_ORDER.map((status) => (
            <th key={`summary-${status}`} style={pdfTableHeadCellStyle({ width: 22, align: "center", isSubhead: true })}>{status}</th>
          ))}
          <th style={pdfTableHeadCellStyle({ width: 28, align: "center", isSubhead: true })}>Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={row.id} style={{ background: index % 2 === 0 ? PREVIEW_COLORS.page : PREVIEW_COLORS.panel }}>
            <td style={pdfTableBodyCellStyle({ align: "center", muted: true })}>{row.rowNumber}</td>
            <td style={pdfTableBodyCellStyle({ align: "left" })}>
              <div style={{ fontWeight: 600, color: PREVIEW_COLORS.ink, lineHeight: 1.25 }}>{row.name}</div>
            </td>
            {row.cells.map((cell, cellIndex) => {
              const tone = getStatusTone(cell.status);
              return (
                <td
                  key={`${row.id}-cell-${cellIndex}`}
                  style={{
                    ...pdfTableBodyCellStyle({ align: "center" }),
                    background: tone.bg,
                    color: tone.fg,
                    fontWeight: 700,
                  }}
                >
                  {cell.status || "-"}
                  {cell.note ? "*" : ""}
                </td>
              );
            })}
            {ATTENDANCE_REKAP_STATUS_ORDER.map((status) => {
              const tone = PREVIEW_COLORS.status[status];
              return (
                <td
                  key={`${row.id}-summary-${status}`}
                  style={{
                    ...pdfTableBodyCellStyle({ align: "center" }),
                    background: tone.bg,
                    color: tone.fg,
                    fontWeight: 700,
                  }}
                >
                  {row.stats[status]}
                </td>
              );
            })}
            <td
              style={{
                ...pdfTableBodyCellStyle({ align: "center" }),
                background: PREVIEW_COLORS.status.total.bg,
                color: PREVIEW_COLORS.status.total.fg,
                fontWeight: 700,
              }}
            >
              {row.total}
            </td>
          </tr>
        ))}
      </tbody>
      {showTotals && totals ? (
        <tfoot>
          <tr>
            <td style={pdfTableFootCellStyle({ align: "center" })}>#</td>
            <td style={pdfTableFootCellStyle({ align: "left" })}>TOTAL SEMUA SISWA</td>
            <td colSpan={days.length} style={pdfTableFootCellStyle({ align: "left", muted: true })}>
              Hari efektif: {formatSummaryValue(totals.total === 0 ? 0 : totals.total)} catatan presensi tercatat
            </td>
            {ATTENDANCE_REKAP_STATUS_ORDER.map((status) => (
              <td key={`total-${status}`} style={pdfTableFootCellStyle({ align: "center" })}>{totals[status]}</td>
            ))}
            <td style={pdfTableFootCellStyle({ align: "center" })}>{totals.total}</td>
          </tr>
        </tfoot>
      ) : null}
    </table>
  );
}

function pdfTableHeadCellStyle({
  width,
  align,
  isSubhead,
}: {
  width?: number;
  align: "left" | "center" | "right";
  isSubhead?: boolean;
}) {
  return {
    width,
    border: `1px solid ${PREVIEW_COLORS.headerDark}`,
    background: isSubhead ? PREVIEW_COLORS.headerDark : PREVIEW_COLORS.header,
    color: PREVIEW_COLORS.page,
    padding: isSubhead ? "3px 4px" : "5px 4px",
    textAlign: align,
    fontSize: 8,
    fontWeight: 700,
    verticalAlign: "middle" as const,
  };
}

function pdfTableBodyCellStyle({
  align,
  muted,
}: {
  align: "left" | "center" | "right";
  muted?: boolean;
}) {
  return {
    border: `1px solid ${PREVIEW_COLORS.border}`,
    padding: "3px 4px",
    textAlign: align,
    fontSize: 8,
    color: muted ? PREVIEW_COLORS.inkMuted : PREVIEW_COLORS.ink,
    verticalAlign: "middle" as const,
    lineHeight: 1.2,
    wordBreak: "break-word" as const,
  };
}

function pdfTableFootCellStyle({
  align,
  muted,
}: {
  align: "left" | "center" | "right";
  muted?: boolean;
}) {
  return {
    border: `1px solid ${PREVIEW_COLORS.borderStrong}`,
    background: PREVIEW_COLORS.panelStrong,
    padding: "4px 5px",
    textAlign: align,
    fontSize: 8,
    color: muted ? PREVIEW_COLORS.inkMuted : PREVIEW_COLORS.ink,
    fontWeight: 700,
    lineHeight: 1.2,
  };
}

function AttendancePdfPreview({
  data,
  draft,
  previewDate,
  setDraft,
}: {
  data: AttendanceSignaturePreviewData;
  draft: SignatureSettingsConfig;
  previewDate: string;
  setDraft: Dispatch<SetStateAction<SignatureSettingsConfig>>;
}) {
  const pages = useMemo(() => splitRowsForPdf(data), [data]);

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {pages.map((pageRows, index) => {
        const isLastPage = index === pages.length - 1;

        return (
          <section
            key={`pdf-page-${index}`}
            style={{
              width: 560,
              background: PREVIEW_COLORS.page,
              border: `1px solid ${PREVIEW_COLORS.border}`,
              borderRadius: 18,
              overflow: "hidden",
              boxShadow: `0 18px 40px -30px ${PREVIEW_COLORS.ink}`,
            }}
          >
            {index === 0 ? (
              <div style={{ background: PREVIEW_COLORS.header, color: PREVIEW_COLORS.page, padding: "12px 16px 10px" }}>
                <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: 0.4 }}>REKAP PRESENSI BULANAN</div>
                <div style={{ marginTop: 4, fontSize: 11, opacity: 0.92 }}>{data.className} — {data.monthLabel}</div>
              </div>
            ) : (
              <div style={{ background: PREVIEW_COLORS.panel, color: PREVIEW_COLORS.ink, padding: "10px 16px", borderBottom: `1px solid ${PREVIEW_COLORS.border}` }}>
                <div style={{ fontSize: 11, fontWeight: 700 }}>Lanjutan Rekap Presensi — Halaman {index + 1}</div>
              </div>
            )}

            <div style={{ padding: 14 }}>
              {index === 0 ? (
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 10, fontSize: 9, color: PREVIEW_COLORS.inkMuted }}>
                  <span>👥 Jumlah siswa: <strong style={{ color: PREVIEW_COLORS.ink }}>{data.studentCount}</strong></span>
                  <span>📅 Format: <strong style={{ color: PREVIEW_COLORS.ink }}>{data.workDayFormatLabel}</strong></span>
                  <span>✅ Hari efektif: <strong style={{ color: PREVIEW_COLORS.ink }}>{data.effectiveDays} hari</strong></span>
                  <span>🕐 {data.exportTimeLabel}</span>
                </div>
              ) : null}

              <AttendanceTable
                days={data.days}
                rows={pageRows}
                totals={isLastPage ? data.totals : undefined}
                showTotals={isLastPage}
              />

              {isLastPage ? (
                <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                  <LegendBadges />

                  <div
                    style={{
                      display: "grid",
                      gap: 8,
                      padding: 10,
                      borderRadius: 14,
                      background: PREVIEW_COLORS.panel,
                      border: `1px solid ${PREVIEW_COLORS.border}`,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 700, color: PREVIEW_COLORS.ink }}>Hari Efektif</div>
                    <div style={{ color: PREVIEW_COLORS.inkMuted, fontSize: 10, lineHeight: 1.4 }}>
                      Total hari kerja aktif bulan {data.monthLabel}: <strong style={{ color: PREVIEW_COLORS.ink }}>{data.effectiveDays} hari</strong>
                    </div>
                  </div>

                  <DetailSection
                    title="Kegiatan Khusus"
                    items={data.dayEvents.map((event) => `${event.date}: ${event.label}${event.description ? ` — ${event.description}` : ""}`)}
                  />
                  <DetailSection
                    title="Hari Libur Kustom"
                    items={data.holidays.map((holiday) => `${holiday.date}: ${holiday.description}`)}
                  />
                  <DetailSection
                    title="Catatan Per Siswa"
                    items={data.notes.map((note) => `${note.student} (${note.date}): ${note.note}`)}
                  />

                  <SignatureBlock
                    draft={draft}
                    previewDate={previewDate}
                    setDraft={setDraft}
                    pxToMm={297 / 560}
                  />
                </div>
              ) : null}

              <div style={{ marginTop: 12, paddingTop: 8, borderTop: `1px solid ${PREVIEW_COLORS.border}`, textAlign: "center", fontSize: 8, color: PREVIEW_COLORS.inkMuted }}>
                SIPENA — Sistem Informasi Penilaian Akademik • Halaman {index + 1}/{pages.length}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function AttendancePngPreview({
  data,
  draft,
  previewDate,
  setDraft,
}: {
  data: AttendanceSignaturePreviewData;
  draft: SignatureSettingsConfig;
  previewDate: string;
  setDraft: Dispatch<SetStateAction<SignatureSettingsConfig>>;
}) {
  const layoutMode = data.pngSignatureLayout ?? "inline";

  return (
    <section
      style={{
        width: 880,
        background: PREVIEW_COLORS.page,
        border: `1px solid ${PREVIEW_COLORS.border}`,
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: `0 18px 40px -30px ${PREVIEW_COLORS.ink}`,
      }}
    >
      <div style={{ background: `linear-gradient(135deg, ${PREVIEW_COLORS.header}, ${PREVIEW_COLORS.headerDark})`, color: PREVIEW_COLORS.page, padding: "18px 22px 14px" }}>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 0.5 }}>REKAP PRESENSI BULANAN</div>
        <div style={{ marginTop: 5, fontSize: 13, opacity: 0.92 }}>{data.className} — {data.monthLabel}</div>
        <div style={{ marginTop: 4, fontSize: 10, opacity: 0.78 }}>SIPENA — Sistem Informasi Penilaian Akademik</div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, padding: "10px 22px", background: PREVIEW_COLORS.panel, borderBottom: `1px solid ${PREVIEW_COLORS.border}` }}>
        <span style={{ fontSize: 11, color: PREVIEW_COLORS.inkMuted }}>👥 <strong style={{ color: PREVIEW_COLORS.ink }}>{data.studentCount}</strong> siswa</span>
        <span style={{ fontSize: 11, color: PREVIEW_COLORS.inkMuted }}>📅 <strong style={{ color: PREVIEW_COLORS.ink }}>{data.workDayFormatLabel}</strong></span>
        <span style={{ fontSize: 11, color: PREVIEW_COLORS.inkMuted }}>✅ <strong style={{ color: PREVIEW_COLORS.ink }}>{data.effectiveDays} hari efektif</strong></span>
        <span style={{ fontSize: 11, color: PREVIEW_COLORS.inkMuted }}>🕐 {data.exportTimeLabel}</span>
      </div>

      <div style={{ padding: 20 }}>
        <AttendanceTable days={data.days} rows={data.rows} totals={data.totals} showTotals />

        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
          <LegendBadges />

          <div
            style={{
              display: "grid",
              gap: 8,
              padding: 12,
              borderRadius: 14,
              background: PREVIEW_COLORS.panel,
              border: `1px solid ${PREVIEW_COLORS.border}`,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: PREVIEW_COLORS.ink }}>Hari Efektif</div>
            <div style={{ color: PREVIEW_COLORS.inkMuted, fontSize: 11 }}>
              Rekap bulan {data.monthLabel} memuat <strong style={{ color: PREVIEW_COLORS.ink }}>{data.effectiveDays} hari kerja aktif</strong> sesuai format presensi dan libur yang diatur.
            </div>
          </div>

          {layoutMode === "inline" ? (
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 16, alignItems: "start" }}>
              <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
                <DetailSection
                  title="Kegiatan Khusus"
                  items={data.dayEvents.map((event) => `${event.date}: ${event.label}${event.description ? ` — ${event.description}` : ""}`)}
                />
                <DetailSection
                  title="Hari Libur Kustom"
                  items={data.holidays.map((holiday) => `${holiday.date}: ${holiday.description}`)}
                />
                <DetailSection
                  title="Catatan Per Siswa"
                  items={data.notes.map((note) => `${note.student} (${note.date}): ${note.note}`)}
                />
              </div>
              <div style={{ minWidth: 280, maxWidth: 340 }}>
                <SignatureBlock
                  draft={draft}
                  previewDate={previewDate}
                  setDraft={setDraft}
                  pxToMm={297 / 720}
                  compact
                />
              </div>
            </div>
          ) : (
            <>
              <DetailSection
                title="Kegiatan Khusus"
                items={data.dayEvents.map((event) => `${event.date}: ${event.label}${event.description ? ` — ${event.description}` : ""}`)}
              />
              <DetailSection
                title="Hari Libur Kustom"
                items={data.holidays.map((holiday) => `${holiday.date}: ${holiday.description}`)}
              />
              <DetailSection
                title="Catatan Per Siswa"
                items={data.notes.map((note) => `${note.student} (${note.date}): ${note.note}`)}
              />
              <SignatureBlock
                draft={draft}
                previewDate={previewDate}
                setDraft={setDraft}
                pxToMm={297 / 720}
                compact
              />
            </>
          )}
        </div>
      </div>

      <div style={{ padding: "10px 20px 12px", borderTop: `1px solid ${PREVIEW_COLORS.border}`, background: PREVIEW_COLORS.panel, textAlign: "center", color: PREVIEW_COLORS.inkMuted, fontSize: 10 }}>
        SIPENA — Sistem Informasi Penilaian Akademik • Preview PNG realistis sesuai data ekspor
      </div>
    </section>
  );
}

function GenericPreview({ previewFormat }: { previewFormat: "pdf" | "png" }) {
  return (
    <div
      style={{
        width: previewFormat === "pdf" ? 560 : 720,
        background: PREVIEW_COLORS.page,
        border: `1px solid ${PREVIEW_COLORS.border}`,
        borderRadius: 18,
        padding: 24,
        boxShadow: `0 18px 40px -30px ${PREVIEW_COLORS.ink}`,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 800, color: PREVIEW_COLORS.ink }}>Preview ekspor realistis</div>
      <p style={{ marginTop: 8, fontSize: 12, color: PREVIEW_COLORS.inkMuted, lineHeight: 1.5 }}>
        Data ekspor nyata belum tersedia pada halaman ini, jadi editor menampilkan struktur tanda tangan generik.
        Pada halaman yang sudah mendukung preview realistis, seluruh tabel, jumlah siswa, orientasi, dan keterangan ekspor akan dirender penuh sebelum posisi tanda tangan diatur.
      </p>
    </div>
  );
}

export function SignaturePreviewCanvas({
  previewFormat,
  draft,
  setDraft,
  previewDate,
  previewData,
}: SignaturePreviewCanvasProps) {
  if (!previewData) {
    return <GenericPreview previewFormat={previewFormat} />;
  }

  return previewFormat === "pdf" ? (
    <AttendancePdfPreview data={previewData} draft={draft} previewDate={previewDate} setDraft={setDraft} />
  ) : (
    <AttendancePngPreview data={previewData} draft={draft} previewDate={previewDate} setDraft={setDraft} />
  );
}
*/
