import { type ComponentType, type ReactNode } from "react";
import { ChevronDown, Eye, PanelLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { StudioViewportProfile } from "@/hooks/useStudioViewportProfile";

export type StudioOverlayState = "expanded" | "minimized" | "hidden-temporary";
export type ResponsivePreviewMode = "table" | "cards" | "hybrid";

export interface StudioSectionDescriptor<T extends string = string> {
  id: T;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  priority?: "primary" | "secondary";
  supportsPreviewSync?: boolean;
  mobileVisibility?: "visible" | "compact" | "hidden";
  desktopVisibility?: "visible" | "compact" | "hidden";
}

export interface ResponsivePreviewColumn<Row> {
  id: string;
  label: string;
  className?: string;
  cellClassName?: string;
  primary?: boolean;
  render: (row: Row, index: number) => ReactNode;
}

interface StudioSectionTabsProps<T extends string> {
  sections: StudioSectionDescriptor<T>[];
  active: T;
  onChange: (value: T) => void;
  className?: string;
}

interface StudioActionFooterProps {
  helperText?: ReactNode;
  actions: ReactNode;
  className?: string;
  sticky?: boolean;
}

interface StudioStepHeaderProps<T extends string> {
  steps: Array<{ id: T; label: string }>;
  currentStep: T;
  className?: string;
}

interface StudioInfoCollapsibleProps {
  title: string;
  description?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}

interface ResponsiveDataPreviewProps<Row> {
  rows: Row[];
  columns: ResponsivePreviewColumn<Row>[];
  getRowKey: (row: Row, index: number) => string;
  profile: StudioViewportProfile;
  mode?: ResponsivePreviewMode;
  emptyMessage?: ReactNode;
  detailLabel?: string;
  className?: string;
}

export function getResponsivePreviewMode(profile: StudioViewportProfile): ResponsivePreviewMode {
  if (profile === "phone-compact") return "cards";
  if (profile === "phone-regular" || profile === "tablet-portrait") return "hybrid";
  return "table";
}

export function StudioSectionTabs<T extends string>({
  sections,
  active,
  onChange,
  className,
}: StudioSectionTabsProps<T>) {
  return (
    <div
      className={cn("grid gap-2", className)}
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 8.75rem), 1fr))" }}
    >
      {sections.map((section) => {
        const Icon = section.icon;
        const isActive = active === section.id;
        return (
          <Button
            key={section.id}
            type="button"
            variant={isActive ? "default" : "outline"}
            size="sm"
            className="min-h-11 rounded-2xl px-3 py-2 text-left text-[11px] font-medium"
            onClick={() => onChange(section.id)}
          >
            <span className="flex w-full items-center justify-center gap-2 text-center leading-tight">
              {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
              <span className="line-clamp-2">{section.label}</span>
            </span>
          </Button>
        );
      })}
    </div>
  );
}

export function StudioActionFooter({
  helperText,
  actions,
  className,
  sticky = false,
}: StudioActionFooterProps) {
  return (
    <div
      className={cn(
        "border-t border-border bg-background/95 px-3 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/88",
        sticky && "sticky bottom-0 z-20",
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl text-[11px] leading-relaxed text-muted-foreground sm:text-xs">{helperText}</div>
        <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">{actions}</div>
      </div>
    </div>
  );
}

export function StudioStepHeader<T extends string>({
  steps,
  currentStep,
  className,
}: StudioStepHeaderProps<T>) {
  const currentIndex = Math.max(steps.findIndex((step) => step.id === currentStep), 0);
  return (
    <div className={cn("rounded-2xl border border-border bg-background/80 p-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {steps.map((step, index) => {
          const active = step.id === currentStep;
          const done = index < currentIndex;
          return (
            <div
              key={step.id}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-medium",
                active
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : done
                    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "border-border bg-muted/40 text-muted-foreground",
              )}
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full border text-[9px]">
                {index + 1}
              </span>
              <span>{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StudioInfoCollapsible({
  title,
  description,
  defaultOpen = false,
  className,
  children,
}: StudioInfoCollapsibleProps) {
  return (
    <Collapsible defaultOpen={defaultOpen} className={cn("rounded-2xl border border-border bg-background/70", className)}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
        >
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-foreground">{title}</p>
            {description ? (
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform data-[state=open]:rotate-180" />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border px-3 py-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ResponsiveDataPreview<Row>({
  rows,
  columns,
  getRowKey,
  profile,
  mode,
  emptyMessage = "Tidak ada data untuk ditampilkan.",
  detailLabel = "Lihat detail tabel",
  className,
}: ResponsiveDataPreviewProps<Row>) {
  const resolvedMode = mode ?? getResponsivePreviewMode(profile);
  const primaryColumn = columns.find((column) => column.primary) ?? columns[0];
  const secondaryColumns = columns.filter((column) => column.id !== primaryColumn?.id);

  if (rows.length === 0) {
    return (
      <div className={cn("rounded-2xl border border-dashed border-border bg-background/70 p-4 text-center text-[11px] text-muted-foreground", className)}>
        {emptyMessage}
      </div>
    );
  }

  const renderCards = () => (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div key={getRowKey(row, index)} className="rounded-2xl border border-border bg-background p-3">
          <div className="text-sm font-semibold text-foreground">
            {primaryColumn ? primaryColumn.render(row, index) : null}
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {secondaryColumns.map((column) => (
              <div key={column.id} className="min-w-0 rounded-xl border border-border/70 bg-muted/20 px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  {column.label}
                </p>
                <div className="mt-1 text-[11px] leading-relaxed text-foreground">
                  {column.render(row, index)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const renderTable = () => (
    <ScrollArea className="w-full rounded-2xl border border-border">
      <div className="min-w-[34rem]">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.id} className={cn("text-[10px]", column.className)}>
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={getRowKey(row, index)}>
                {columns.map((column) => (
                  <TableCell key={column.id} className={cn("text-xs", column.cellClassName)}>
                    {column.render(row, index)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ScrollArea>
  );

  if (resolvedMode === "cards") {
    return <div className={className}>{renderCards()}</div>;
  }

  if (resolvedMode === "hybrid") {
    return (
      <div className={cn("space-y-3", className)}>
        {renderCards()}
        <StudioInfoCollapsible
          title={detailLabel}
          description="Buka tabel detail bila Anda perlu memeriksa kolom lengkap."
        >
          {renderTable()}
        </StudioInfoCollapsible>
      </div>
    );
  }

  return <div className={className}>{renderTable()}</div>;
}

export function StudioPreviewToggle({
  active,
  onChange,
  canPreview,
  className,
}: {
  active: "panel" | "preview";
  onChange: (value: "panel" | "preview") => void;
  canPreview: boolean;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-1 rounded-2xl border border-border bg-muted/30 p-1", className)}>
      <Button
        type="button"
        variant={active === "panel" ? "default" : "ghost"}
        size="sm"
        className="h-10 rounded-xl text-[11px]"
        onClick={() => onChange("panel")}
      >
        <PanelLeft className="mr-1.5 h-4 w-4" />
        Panel
      </Button>
      <Button
        type="button"
        variant={active === "preview" ? "default" : "ghost"}
        size="sm"
        className="h-10 rounded-xl text-[11px]"
        onClick={() => onChange("preview")}
        disabled={!canPreview}
      >
        <Eye className="mr-1.5 h-4 w-4" />
        Preview
      </Button>
    </div>
  );
}
