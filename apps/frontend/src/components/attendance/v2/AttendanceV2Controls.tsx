import React from "react";
import { format, getDay } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { 
  CalendarDays, Upload, ChevronDown, FileSpreadsheet, Camera, 
  School, Calendar as CalendarIcon, Settings2, Sun, Bookmark, 
  CheckCircle2, Loader2, CalendarOff, FileText, Image as ImageIcon 
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TourButton } from "@/components/ui/product-tour";
import { UnifiedExportStudio } from "@/components/export/UnifiedExportStudio";
import { AttendanceExportPreviewV2 } from "@/components/export/AttendanceExportPreviewV2";
import { cn } from "@/lib/utils";

interface AttendanceV2ControlsProps {
  selectedClassId: string;
  setSelectedClassId: (id: string) => void;
  selectedClass: any;
  classes: any[];
  dbAvailable: boolean;
  isPromoting: boolean;
  setShowPromoteConfirm: (show: boolean) => void;
  setShowImportAttendance: (show: boolean) => void;
  setShowOCRAttendance: (show: boolean) => void;
  prepareAttendanceTour: () => void;
  hasData: boolean;
  attendanceStudioOpen: boolean;
  setAttendanceStudioOpen: (open: boolean) => void;
  openAttendanceExportMonthDialog: () => void;
  attendanceExportFormat: "pdf" | "excel" | "png-hd" | "png-4k";
  handleAttendanceExportFormatChange: (format: "pdf" | "excel" | "png-hd" | "png-4k") => void;
  selectedAttendanceColumnKeys: string[];
  includeSignature: boolean;
  setIncludeSignature: (val: boolean) => void;
  attendanceDefaultSignatureConfig: any;
  hasSignature: boolean;
  signatureLoading: boolean;
  signatureSaving: boolean;
  saveSignature: (config: any) => Promise<any>;
  paperSize: any;
  setPaperSize: (val: any) => void;
  documentStyle: any;
  setDocumentStyle: (val: any) => void;
  autoFitOnePage: boolean;
  setAutoFitOnePage: (val: boolean) => void;
  attendanceDebugPanel: React.ReactNode;
  attendanceStylePanelExtra: React.ReactNode;
  attendanceDebugPreviewFooter: React.ReactNode;
  attendanceColumnOptions: any[];
  handleAttendanceColumnOptionChange: (key: string, checked: boolean) => void;
  attendanceColumnTypographyOptions: any[];
  resetAttendanceStudioDefaults: () => void;
  attendanceStylePresetBaseline: any;
  attendancePreviewStudioData: any;
  attendancePrintDataset: any;
  isHolidayCombined: (date: Date) => boolean;
  selectedDate: Date;
  isDatePickerOpen: boolean;
  setIsDatePickerOpen: (open: boolean) => void;
  handleDateSelect: (date: Date | undefined) => void;
  isNationalHoliday: (date: Date) => boolean;
  getHolidayDescription: (date: Date) => string | null;
  getNationalHolidayName: (date: Date) => string | null;
  holidays: any[];
  workDayFormat: string;
  setShowSettingsSheet: (show: boolean) => void;
  getHolidayDescriptionCombined: (date: Date) => string | null;
  getDayEvent: (date: Date) => any;
  handleExportExcel: (sig?: any, inclSig?: boolean, cols?: string[]) => Promise<void>;
  handleExportPDFVector: (sig?: any, inclSig?: boolean, style?: any, fit?: boolean, paper?: any, cols?: string[]) => Promise<void>;
  handleExportPNGV2: (quality: "hd" | "4k", sig?: any, inclSig?: boolean, style?: any, fit?: boolean, paper?: any, cols?: string[]) => Promise<void>;
  attendanceAnnotationDisplayMode: any;
  attendanceEventAnnotationDisplayMode: any;
  attendanceInlineLabelStyle: any;
  attendanceDebugEnabled: boolean;
  commitAttendanceTrace: (trace: any) => void;
}

const ATTENDANCE_EXPORT_FORMATS = [
  { id: "excel", label: "Excel Spreadsheet (.xlsx)", description: "Unduh rekapitulasi tahunan dalam format Excel terpolarisasi dengan tab bulanan.", icon: FileSpreadsheet, badge: "TAHUNAN" },
  { id: "pdf", label: "PDF Document (.pdf)", description: "Cetak atau simpan presensi bulanan dalam format vektor berkualitas tinggi.", icon: FileText, badge: "VEKTOR" },
  { id: "png-hd", label: "PNG Image (HD)", description: "Ekspor halaman presensi sebagai gambar beresolusi tinggi (1080p).", icon: ImageIcon },
  { id: "png-4k", label: "PNG Image (4K)", description: "Ekspor halaman presensi sebagai gambar resolusi ultra tinggi (2160p) untuk cetak tajam.", icon: ImageIcon, badge: "TAJAM" },
];

export const AttendanceV2Controls: React.FC<AttendanceV2ControlsProps> = ({
  selectedClassId,
  setSelectedClassId,
  selectedClass,
  classes,
  dbAvailable,
  isPromoting,
  setShowPromoteConfirm,
  setShowImportAttendance,
  setShowOCRAttendance,
  prepareAttendanceTour,
  hasData,
  attendanceStudioOpen,
  setAttendanceStudioOpen,
  openAttendanceExportMonthDialog,
  attendanceExportFormat,
  handleAttendanceExportFormatChange,
  selectedAttendanceColumnKeys,
  includeSignature,
  setIncludeSignature,
  attendanceDefaultSignatureConfig,
  hasSignature,
  signatureLoading,
  signatureSaving,
  saveSignature,
  paperSize,
  setPaperSize,
  documentStyle,
  setDocumentStyle,
  autoFitOnePage,
  setAutoFitOnePage,
  attendanceDebugPanel,
  attendanceStylePanelExtra,
  attendanceDebugPreviewFooter,
  attendanceColumnOptions,
  handleAttendanceColumnOptionChange,
  attendanceColumnTypographyOptions,
  resetAttendanceStudioDefaults,
  attendanceStylePresetBaseline,
  attendancePreviewStudioData,
  attendancePrintDataset,
  isHolidayCombined,
  selectedDate,
  isDatePickerOpen,
  setIsDatePickerOpen,
  handleDateSelect,
  isNationalHoliday,
  getHolidayDescription,
  getNationalHolidayName,
  holidays,
  workDayFormat,
  setShowSettingsSheet,
  getHolidayDescriptionCombined,
  getDayEvent,
  handleExportExcel,
  handleExportPDFVector,
  handleExportPNGV2,
  attendanceAnnotationDisplayMode,
  attendanceEventAnnotationDisplayMode,
  attendanceInlineLabelStyle,
  attendanceDebugEnabled,
  commitAttendanceTrace
}) => {
  return (
    <>
      <PageHeader
        icon={<CalendarDays className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-primary" />}
        title="Presensi"
        subtitle="Kelola kehadiran murid"
        breadcrumbs={[{ label: "Presensi" }]}
        actions={
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto justify-end">
            {/* 0. (Merge to V1 dipindah ke Panel Admin) */}

            {/* 1. Import (excel/OCR) */}
            {selectedClassId && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 px-2.5 gap-1.5 text-xs font-semibold" data-tour="import-attendance">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Import</span>
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setShowImportAttendance(true)} className="gap-2 min-h-[44px] sm:min-h-[38px] cursor-pointer">
                    <FileSpreadsheet className="w-4 h-4" />
                    Import dari Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowOCRAttendance(true)} className="gap-2 min-h-[44px] sm:min-h-[38px] cursor-pointer">
                    <Camera className="w-4 h-4" />
                    Import dari Foto (OCR) <Badge className="ml-auto bg-amber-500 text-amber-950">BETA</Badge>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* 2. Panduan (TourButton) */}
            <TourButton tourKey="attendance" onBeforeStart={prepareAttendanceTour} />

            {/* 3. Ekspor (UnifiedExportStudio) */}
            {hasData && (
              <div data-tour="export-attendance">
                <UnifiedExportStudio
                  title="Studio Ekspor Presensi"
                  description="Pilih format ekspor presensi dan kelola signature dari satu panel yang lebih mudah dipahami."
                  triggerLabel="Ekspor"
                  triggerClassName="h-9 px-2.5 text-xs font-semibold"
                  open={attendanceStudioOpen}
                  onOpenChange={setAttendanceStudioOpen}
                  onTriggerClick={openAttendanceExportMonthDialog}
                  formats={ATTENDANCE_EXPORT_FORMATS}
                  selectedFormat={attendanceExportFormat}
                  onFormatChange={handleAttendanceExportFormatChange}
                  onExport={async ({ formatId, includeSignature: nextIncludeSignature, signatureConfig: nextSignatureConfig, paperSize: nextPaperSize, documentStyle: nextDocumentStyle, autoFitOnePage: nextAutoFitOnePage }) => {
                    if (formatId === "excel") {
                      await handleExportExcel(nextSignatureConfig, nextIncludeSignature, selectedAttendanceColumnKeys);
                      return;
                    }
                    if (formatId === "pdf") {
                      await handleExportPDFVector(nextSignatureConfig, nextIncludeSignature, nextDocumentStyle, nextAutoFitOnePage, nextPaperSize, selectedAttendanceColumnKeys);
                      return;
                    }
                    await handleExportPNGV2(formatId === "png-4k" ? "4k" : "hd", nextSignatureConfig, nextIncludeSignature, nextDocumentStyle, nextAutoFitOnePage, nextPaperSize, selectedAttendanceColumnKeys);
                  }}
                  includeSignature={includeSignature}
                  onIncludeSignatureChange={setIncludeSignature}
                  signatureConfig={attendanceDefaultSignatureConfig}
                  hasSignature={hasSignature}
                  isLoading={signatureLoading}
                  isSaving={signatureSaving}
                  onSaveSignature={saveSignature}
                  paperSize={paperSize}
                  onPaperSizeChange={setPaperSize}
                  documentStyle={documentStyle}
                  onDocumentStyleChange={setDocumentStyle}
                  autoFitOnePage={autoFitOnePage}
                  onAutoFitOnePageChange={setAutoFitOnePage}
                  showAutoFitPreset
                  formatPanelExtra={attendanceDebugPanel}
                  stylePanelExtra={attendanceStylePanelExtra}
                  previewFooter={attendanceDebugPreviewFooter}
                  columnOptions={attendanceColumnOptions}
                  onColumnOptionChange={handleAttendanceColumnOptionChange}
                  columnCount={selectedAttendanceColumnKeys.length}
                  columnTypographyOptions={attendanceColumnTypographyOptions}
                  onRestoreDefaultMode={resetAttendanceStudioDefaults}
                  defaultModeDescription="Reset semua pengaturan studio kembali ke baseline awal sambil mempertahankan ukuran kertas dan identitas signature."
                  stylePresetMode="attendance"
                  stylePresetBaseline={attendanceStylePresetBaseline}
                  renderPreview={({ previewFormat, draft, setDraft, previewDate, includeSignature: previewIncludeSignature, paperSize: previewPaperSize, documentStyle: previewDocumentStyle, autoFitOnePage: previewAutoFitOnePage, liveEditMode, highlightTarget, onHighlightTargetHoverChange, onHighlightTargetSelect }) => (
                    <AttendanceExportPreviewV2
                      previewFormat={previewFormat}
                      draft={draft}
                      setDraft={setDraft}
                      previewDate={previewDate}
                      includeSignature={previewIncludeSignature}
                      data={attendancePreviewStudioData}
                      paperSize={previewPaperSize}
                      documentStyle={previewDocumentStyle ?? documentStyle}
                      autoFitOnePage={previewAutoFitOnePage ?? autoFitOnePage}
                      visibleColumnKeys={selectedAttendanceColumnKeys}
                      debugEnabled={attendanceDebugEnabled}
                      onTrace={(trace) => attendanceDebugEnabled && commitAttendanceTrace(trace)}
                      liveEditMode={liveEditMode}
                      highlightTarget={highlightTarget}
                      onHighlightTargetHoverChange={onHighlightTargetHoverChange}
                      onHighlightTargetSelect={onHighlightTargetSelect}
                      annotationDisplayMode={attendanceAnnotationDisplayMode}
                      eventAnnotationDisplayMode={attendanceEventAnnotationDisplayMode}
                      inlineLabelStyle={attendanceInlineLabelStyle}
                    />
                  )}
                />
              </div>
            )}
          </div>
        }
      />

      <div className={cn(
        "rounded-2xl bg-card border border-border overflow-hidden flex flex-col divide-y divide-border sm:divide-y-0 sm:divide-x",
        selectedClassId ? "sm:grid sm:grid-cols-3" : "sm:grid sm:grid-cols-2"
      )}>
        <div data-tour="class-select" className="flex items-center gap-3 p-3 sm:p-3.5">
          <School className="w-4 h-4 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <Label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Kelas</Label>
            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger className="h-7 border-0 px-0 py-0 shadow-none text-sm font-medium focus:ring-0">
                <SelectValue placeholder="Pilih kelas..." />
              </SelectTrigger>
              <SelectContent isEmpty={classes.length === 0} emptyLabel="Tidak ada pilihan Kelas">
                {classes.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id} className="text-sm">{cls.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div data-tour="date-select" className="flex items-center gap-3 p-3 sm:p-3.5">
          <CalendarIcon className="w-4 h-4 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <Label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Tanggal</Label>
            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <button className={cn("w-full text-left text-sm font-medium py-0.5 truncate", isHolidayCombined(selectedDate) && "text-grade-warning")}>
                      {format(selectedDate, "EEEE, d MMMM yyyy", { locale: idLocale })}
                      {isHolidayCombined(selectedDate) && " (Libur)"}
                    </button>
                  </PopoverTrigger>
                </TooltipTrigger>
                {isHolidayCombined(selectedDate) && (
                  <TooltipContent side="bottom" className="text-[10px] p-2 rounded-xl">
                    <p className="font-bold text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1.5">
                      <CalendarOff className="w-3 h-3" /> {isNationalHoliday(selectedDate) ? "Libur Nasional" : "Hari Libur"}
                    </p>
                    <p className="text-muted-foreground">
                      {getHolidayDescription(selectedDate) || getNationalHolidayName(selectedDate) || (getDay(selectedDate) === 0 ? "Hari Minggu" : "Libur")}
                    </p>
                  </TooltipContent>
                )}
              </Tooltip>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={selectedDate} onSelect={handleDateSelect} initialFocus className="pointer-events-auto"
                  modifiers={{ 
                    holiday: (date) => isHolidayCombined(date), 
                    sunday: (date) => getDay(date) === 0,
                    dayEvent: (date) => !!getDayEvent(date),
                    customHoliday: (date) => {
                      const dateStr = format(date, "yyyy-MM-dd");
                      return holidays.some((h) => h.date === dateStr);
                    },
                    nationalHoliday: (date) => isNationalHoliday(date),
                  }}
                  modifiersClassNames={{ 
                    holiday: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium", 
                    sunday: "text-amber-600 dark:text-amber-400",
                    dayEvent: "ring-2 ring-primary/50 ring-inset font-bold",
                    customHoliday: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-medium",
                    nationalHoliday: "bg-red-50 dark:bg-red-950/30 text-red-500 dark:text-red-400 font-semibold",
                  }}
                />
                {/* Calendar Color Legend */}
                <div className="px-3 pb-3 pt-2 border-t border-border/50 space-y-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Keterangan Warna Kalender:</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[9px] font-bold flex items-center justify-center border border-amber-200 dark:border-amber-800/50">15</div>
                      <span className="text-[10px] text-muted-foreground">Hari Libur</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-md bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[9px] font-bold flex items-center justify-center border border-red-200 dark:border-red-800/50">17</div>
                      <span className="text-[10px] text-muted-foreground">Kustom (Libur/Kerja)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-md text-amber-600 dark:text-amber-400 text-[9px] font-bold flex items-center justify-center">7</div>
                      <span className="text-[10px] text-muted-foreground">Hari Minggu</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-md ring-2 ring-primary/50 ring-inset text-[9px] font-bold flex items-center justify-center">20</div>
                      <span className="text-[10px] text-muted-foreground">Kegiatan Khusus</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-md bg-red-50 dark:bg-red-950/30 text-red-500 text-[9px] font-bold flex items-center justify-center border border-red-200 dark:border-red-800/50">🇮🇩</div>
                      <span className="text-[10px] text-muted-foreground">Libur Nasional</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-md bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">{new Date().getDate()}</div>
                      <span className="text-[10px] text-muted-foreground">Tanggal Terpilih</span>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        {selectedClassId && (
          <div data-tour="calendar-settings" className="flex items-center justify-between p-3 sm:p-3.5 bg-muted/5">
            <div className="flex items-center gap-3 min-w-0">
              <Settings2 className="w-4 h-4 text-primary flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <Label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Pengaturan Kalender</Label>
                <p className="text-xs font-medium text-foreground truncate">
                  {workDayFormat === "5days" ? "5 Hari Kerja" : "6 Hari Kerja"} • {holidays.length} Libur Kustom
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-[10px] rounded-lg border-primary/20 hover:border-primary/45 transition-colors"
              onClick={() => setShowSettingsSheet(true)}
            >
              <Settings2 className="w-3 h-3 mr-1" />
              Ubah
            </Button>
          </div>
        )}
      </div>

      {/* Holiday Banner */}
      {isHolidayCombined(selectedDate) && (
        <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-grade-warning/5 border border-grade-warning/20">
          <Sun className="w-4 h-4 text-grade-warning flex-shrink-0" />
          <p className="text-xs">
            <span className="font-semibold text-grade-warning">Hari Libur</span>
            <span className="text-muted-foreground ml-1.5">{getHolidayDescriptionCombined(selectedDate)}</span>
          </p>
        </div>
      )}

      {/* Day Event Banner */}
      {getDayEvent(selectedDate) && (
        <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-primary/5 border border-primary/20">
          <Bookmark className="w-4 h-4 text-primary flex-shrink-0" />
          <p className="text-xs">
            <span className="font-semibold text-primary">{getDayEvent(selectedDate)!.label}</span>
            {getDayEvent(selectedDate)!.description && <span className="text-muted-foreground ml-1.5">— {getDayEvent(selectedDate)!.description}</span>}
          </p>
        </div>
      )}
    </>
  );
};
