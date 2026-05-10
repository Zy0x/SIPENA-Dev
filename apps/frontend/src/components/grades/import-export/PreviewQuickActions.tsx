export function PreviewQuickActions({
  onApplySafeFixes,
  onApproveSuggestions,
  onIgnoreNonGradeColumns,
  onPickManualItems,
}: {
  onApplySafeFixes: () => void;
  onApproveSuggestions: () => void;
  onIgnoreNonGradeColumns: () => void;
  onPickManualItems: () => void;
}) {
  return (
    <section className="rounded-[18px] border border-border bg-white p-3 dark:bg-slate-950">
      <div className="grid gap-2 lg:grid-cols-3">
        <button type="button" className="min-h-11 rounded-2xl bg-emerald-600 px-4 text-left text-sm font-semibold text-white hover:bg-emerald-700" onClick={onApplySafeFixes}>
          Terapkan yang Aman
          <span className="mt-1 block text-xs font-medium text-emerald-50">Isi nilai kosong, lewati nilai lama, dan abaikan kolom bukan nilai.</span>
        </button>
        <button type="button" className="min-h-11 rounded-2xl bg-orange-600 px-4 text-left text-sm font-semibold text-white hover:bg-orange-700" onClick={onApproveSuggestions}>
          Setujui saran aman
          <span className="mt-1 block text-xs font-medium text-orange-50">Pakai saran yang tidak membuat struktur baru dan tidak menimpa nilai.</span>
        </button>
        <button type="button" className="min-h-11 rounded-2xl bg-red-600 px-4 text-left text-sm font-semibold text-white hover:bg-red-700" onClick={onPickManualItems}>
          Pilih item bermasalah
          <span className="mt-1 block text-xs font-medium text-red-50">Bagian merah perlu dipilih agar nilai tidak masuk ke target yang salah.</span>
        </button>
      </div>
      <div className="mt-2">
        <button type="button" className="min-h-10 rounded-full border border-border bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900" onClick={onIgnoreNonGradeColumns}>
          Abaikan kolom bukan nilai
        </button>
      </div>
    </section>
  );
}
