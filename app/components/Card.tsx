import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`bg-white rounded-2xl shadow-sm border border-slate-200/80 p-8 ${className}`}
    >
      {children}
    </section>
  );
}
