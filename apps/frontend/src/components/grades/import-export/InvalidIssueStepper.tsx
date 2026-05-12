import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type {
  SpreadsheetPreviewCell,
  SpreadsheetPreviewColumn,
  SpreadsheetPreviewRow,
} from "@/lib/gradeImport";

import type { InvalidIssue } from "./importIssueQueue";

export function InvalidIssueStepper({
  open,
  issues,
  activeIndex,
  onOpenChange,
  onActiveIndexChange,
  onSelectIssue,
  onSkipCell,
  onSkipRow,
  onSkipColumn,
  onSkipAllInvalid,
}: {
  open: boolean;
  issues: InvalidIssue[];
  activeIndex: number;
  onOpenChange: (open: boolean) => void;
  onActiveIndexChange: (index: number) => void;
  onSelectIssue: (issue: InvalidIssue) => void;
  onSkipCell: (cell: SpreadsheetPreviewCell) => void;
  onSkipRow: (row: SpreadsheetPreviewRow) => void;
  onSkipColumn: (column: SpreadsheetPreviewColumn) => void;
  onSkipAllInvalid: () => void;
}) {
  const safeIndex = Math.min(Math.max(activeIndex, 0), Math.max(issues.length - 1, 0));
  const issue = issues[safeIndex];
  const invalidCount = issues.filter((item) => item.cell?.status === "invalid").length;

  const skipIssue = () => {
    if (!issue) return;
    if (issue.cell) onSkipCell(issue.cell);
    else if (issue.row) onSkipRow(issue.row);
    else if (issue.column) onSkipColumn(issue.column);
    onActiveIndexChange(Math.min(safeIndex, Math.max(issues.length - 2, 0)));
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="sipena-invalid-drawer">
        <DrawerHeader>
          <DrawerTitle>Selesaikan nilai bermasalah</DrawerTitle>
          <DrawerDescription>
            {issues.length ? `${safeIndex + 1} dari ${issues.length} item perlu dicek. Anda bisa atur, lewati, atau tutup dulu.` : "Tidak ada item bermasalah."}
          </DrawerDescription>
        </DrawerHeader>

        {issue ? (
          <div className="sipena-invalid-drawer-body">
            <div className="sipena-invalid-step-card">
              <div className="sipena-invalid-step-header">
                <span className="sipena-invalid-step-count">Item {safeIndex + 1}</span>
                <strong>{issue.title}</strong>
              </div>
              <p>{issue.description}</p>
              <dl className="sipena-invalid-context">
                {issue.row ? (
                  <div>
                    <dt>Siswa</dt>
                    <dd>{issue.row.studentName}</dd>
                  </div>
                ) : null}
                {issue.column ? (
                  <div>
                    <dt>Kolom</dt>
                    <dd>{issue.column.header}</dd>
                  </div>
                ) : null}
                {issue.cell ? (
                  <div>
                    <dt>Nilai Excel</dt>
                    <dd>{issue.cell.displayValue || issue.cell.rawValue || "kosong"}</dd>
                  </div>
                ) : null}
              </dl>
              <div className="sipena-invalid-detail">
                <b>{issue.detailTitle}</b>
                <ul>
                  {issue.detailBullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                </ul>
              </div>
            </div>
          </div>
        ) : null}

        <DrawerFooter className="sipena-invalid-drawer-actions">
          {issue ? (
            <>
              <button type="button" className="sipena-column-btn sipena-column-btn-primary" onClick={() => onSelectIssue(issue)}>
                {issue.primaryActionLabel}
              </button>
              <button type="button" className="sipena-column-btn sipena-column-btn-warning" onClick={skipIssue}>
                {issue.skipActionLabel}
              </button>
              <button type="button" className="sipena-column-btn" onClick={() => onActiveIndexChange(Math.min(safeIndex + 1, issues.length - 1))} disabled={safeIndex >= issues.length - 1}>
                Berikutnya
              </button>
              <button type="button" className="sipena-column-btn" onClick={onSkipAllInvalid} disabled={invalidCount === 0}>
                Lewati semua invalid
              </button>
            </>
          ) : null}
          <button type="button" className="sipena-column-btn" onClick={() => onOpenChange(false)}>
            Tutup
          </button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
