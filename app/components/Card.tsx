import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`bg-white rounded-2xl shadow-sm border border-slate-200/80 p-8 ${className}`}
    >
      {children}
    </section>
  );
}
