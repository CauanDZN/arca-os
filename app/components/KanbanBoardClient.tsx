"use client";

import dynamic from "next/dynamic";
import type { KanbanBoardProps } from "@/app/components/KanbanBoard";

// dnd-kit assigns internal accessibility ids (aria-describedby) via a
// module-level counter that increments differently between the SSR pass and
// React 19's dev Strict-Mode double-render on the client, producing a
// permanent hydration mismatch warning. The board has nothing worth
// server-rendering anyway (it's behind auth, not indexable) — loading it
// client-only sidesteps the mismatch instead of fighting dnd-kit's internals.
const LazyKanbanBoard = dynamic(() => import("@/app/components/KanbanBoard").then((m) => m.KanbanBoard), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-40 animate-pulse rounded-2xl border border-slate-200/80 bg-white shadow-sm" />
      ))}
    </div>
  ),
});

export function KanbanBoardClient(props: KanbanBoardProps) {
  return <LazyKanbanBoard {...props} />;
}
