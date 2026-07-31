"use client";

import { useState, useEffect, type ReactNode } from "react";

export type ReportSection = {
  id: string;
  label: string;
  content: ReactNode;
};

/**
 * Sidebar-driven section filter for the report — clicking a section shows
 * only that section instead of scrolling to it. All sections are still
 * rendered (not lazy) so print/export always gets the full document:
 * the "hidden" utility is overridden by print:block on every branch.
 *
 * Some Server Actions redirect back here with a #section hash (e.g. the
 * Agente Especialista redirects to .../relatorio#especialistas after
 * generating). The initial render always opens the first section — matches
 * server output, avoids a hydration mismatch — then a post-mount effect
 * corrects to whatever the URL hash says, so that redirect actually lands
 * the user on the section it just updated instead of back on "Sumário".
 */
export function ReportTabs({ sections }: { sections: ReportSection[] }) {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash && sections.some((s) => s.id === hash)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- recovers the section from a server-redirect hash (window.location), not derived from props
      setActive(hash);
    }
    // only ever run on mount — this recovers the section from a redirect,
    // it shouldn't fight the user's own clicks afterward
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function select(id: string) {
    setActive(id);
    window.history.replaceState(null, "", `#${id}`);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 items-start print:block">
      <nav className="print:hidden flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-1 md:pb-0 md:sticky md:top-4">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => select(s.id)}
            aria-current={active === s.id ? "true" : undefined}
            className={`text-left rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              active === s.id
                ? "bg-blue-50 text-blue-700"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {s.label}
          </button>
        ))}
      </nav>
      <div className="space-y-6 min-w-0 print:space-y-6">
        {sections.map((s) => (
          <div key={s.id} className={`${active === s.id ? "block" : "hidden"} print:block`}>
            {s.content}
          </div>
        ))}
      </div>
    </div>
  );
}
