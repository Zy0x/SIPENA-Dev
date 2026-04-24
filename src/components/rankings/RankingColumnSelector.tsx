import { useState, useMemo } from "react";
import { ChevronDown, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface RankingColumn {
  id: string;
  label: string;
  key: string;
  description?: string;
  category: "identity" | "grades" | "summary";
  subjectId?: string;
  subjectName?: string;
  required?: boolean;
}

interface RankingColumnSelectorProps {
  columns: RankingColumn[];
  selectedColumnIds: string[];
  onColumnChange: (columnIds: string[]) => void;
  className?: string;
}

interface ColumnGroup {
  category: "identity" | "grades" | "summary";
  label: string;
  description: string;
  columns: RankingColumn[];
}

export function RankingColumnSelector({
  columns,
  selectedColumnIds,
  onColumnChange,
  className,
}: RankingColumnSelectorProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(["identity", "summary"])
  );

  const groupedColumns = useMemo(() => {
    const groups: Record<string, ColumnGroup> = {
      identity: {
        category: "identity",
        label: "Identitas Siswa",
        description: "Informasi dasar siswa (Peringkat, Nama, NISN)",
        columns: columns.filter((c) => c.category === "identity"),
      },
      grades: {
        category: "grades",
        label: "Nilai Per Mapel",
        description: "Nilai siswa untuk setiap mata pelajaran",
        columns: columns.filter((c) => c.category === "grades"),
      },
      summary: {
        category: "summary",
        label: "Ringkasan",
        description: "Nilai rata-rata keseluruhan dan status",
        columns: columns.filter((c) => c.category === "summary"),
      },
    };

    return Object.values(groups).filter((g) => g.columns.length > 0);
  }, [columns]);

  const toggleGroup = (category: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedGroups(newExpanded);
  };

  const toggleColumn = (columnId: string) => {
    const column = columns.find((c) => c.id === columnId);
    if (column?.required) return;

    const newSelected = selectedColumnIds.includes(columnId)
      ? selectedColumnIds.filter((id) => id !== columnId)
      : [...selectedColumnIds, columnId];

    onColumnChange(newSelected);
  };

  const toggleGroupColumns = (category: string, checked: boolean) => {
    const groupColumns = columns.filter((c) => c.category === category);
    const groupIds = groupColumns.map((c) => c.id);

    if (checked) {
      const newSelected = Array.from(
        new Set([...selectedColumnIds, ...groupIds])
      );
      onColumnChange(newSelected);
    } else {
      const requiredIds = groupColumns
        .filter((c) => c.required)
        .map((c) => c.id);
      const newSelected = selectedColumnIds.filter(
        (id) => !groupIds.includes(id) || requiredIds.includes(id)
      );
      onColumnChange(newSelected);
    }
  };

  const getGroupSelectionState = (category: string) => {
    const groupColumns = columns.filter((c) => c.category === category);
    const selectableColumns = groupColumns.filter((c) => !c.required);
    const selectedCount = groupColumns.filter((c) =>
      selectedColumnIds.includes(c.id)
    ).length;

    if (selectedCount === 0) return "none";
    if (selectedCount === groupColumns.length) return "all";
    return "partial";
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="text-sm font-semibold text-foreground">
        Pilih Kolom Ekspor
      </div>

      {groupedColumns.map((group) => {
        const isExpanded = expandedGroups.has(group.category);
        const selectionState = getGroupSelectionState(group.category);
        const groupColumns = group.columns;
        const selectableColumns = groupColumns.filter((c) => !c.required);

        return (
          <div
            key={group.category}
            className="border border-border/50 rounded-lg overflow-hidden bg-card/50"
          >
            {/* Group Header */}
            <button
              onClick={() => toggleGroup(group.category)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1 text-left">
                <Checkbox
                  checked={selectionState === "all" || (selectionState === "partial" ? "indeterminate" : false)}
                  onCheckedChange={(checked) =>
                    toggleGroupColumns(group.category, checked as boolean)
                  }
                  onClick={(e) => e.stopPropagation()}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="font-medium text-sm text-foreground">
                    {group.label}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {group.description}
                  </div>
                </div>
              </div>
              <ChevronDown
                className={cn(
                  "w-4 h-4 text-muted-foreground transition-transform",
                  isExpanded && "rotate-180"
                )}
              />
            </button>

            {/* Group Content */}
            {isExpanded && (
              <div className="border-t border-border/30 px-4 py-3 space-y-2 bg-muted/20">
                {groupColumns.map((column) => (
                  <div
                    key={column.id}
                    className="flex items-start gap-3 p-2 rounded hover:bg-accent/30 transition-colors"
                  >
                    <Checkbox
                      id={column.id}
                      checked={selectedColumnIds.includes(column.id)}
                      onCheckedChange={() => toggleColumn(column.id)}
                      disabled={column.required}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor={column.id}
                          className={cn(
                            "text-sm font-medium leading-none cursor-pointer",
                            column.required && "text-muted-foreground"
                          )}
                        >
                          {column.label}
                        </label>
                        {column.subjectName && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                            {column.subjectName}
                          </span>
                        )}
                        {column.description && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs">
                              {column.description}
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {column.required && (
                          <span className="text-xs text-muted-foreground ml-auto">
                            (Wajib)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Summary */}
      <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded">
        {selectedColumnIds.length} kolom dipilih
      </div>
    </div>
  );
}
