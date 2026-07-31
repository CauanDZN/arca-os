"use client";

import { useState, type ReactNode } from "react";

/**
 * Trello/ClickUp-style "+ Add" affordance: a dashed button that expands
 * in place into the form passed as children, with a way to collapse back.
 * Replaces the old native <details><summary> disclosure, which rendered as
 * a plain triangle + link-styled text.
 */
export function ExpandableTrigger({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-1.5 rounded-lg border-2 border-dashed border-slate-200 px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700"
      >
        <span className="text-base leading-none">+</span>
        {label}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      {children}
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="mt-2 text-xs text-slate-500 hover:text-slate-800 hover:underline"
      >
        Cancelar
      </button>
    </div>
  );
}
