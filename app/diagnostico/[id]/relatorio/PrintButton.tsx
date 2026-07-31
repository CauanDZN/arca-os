"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex-1 sm:flex-none rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 text-center"
    >
      Imprimir / Exportar PDF
    </button>
  );
}
