import { ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";

export function ManualChoiceCard({
  title,
  body,
  fields,
  children,
}: {
  title: string;
  body: string;
  fields?: Array<{ label: string; value: string }>;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-red-100 bg-red-50/70 p-3 text-red-950 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-100">
      <div className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <h5 className="text-sm font-semibold">{title}</h5>
          <p className="mt-1 text-xs leading-5 opacity-85">{body}</p>
          {fields?.length ? (
            <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
              {fields.map((field) => (
                <div key={field.label} className="min-w-0 rounded-xl bg-white/75 p-2 dark:bg-slate-950/35">
                  <dt className="font-semibold opacity-70">{field.label}</dt>
                  <dd className="mt-1 truncate" title={field.value}>{field.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">{children}</div>
        </div>
      </div>
    </div>
  );
}
