import type { ReactNode } from "react";

export function StatTile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      {children}
    </div>
  );
}
