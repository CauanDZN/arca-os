"use client";

import { useState } from "react";

type Props = {
  questionId: string;
  defaultEvidence: string;
  defaultResponsible: string;
  defaultImpact: string;
  defaultUrgency: string;
  defaultRisk: string;
  impactOptions: readonly string[];
  urgencyOptions: readonly string[];
  riskOptions: readonly string[];
};

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-500 transition-all";

const labelClass = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3.5 h-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v0Z" />
    </svg>
  );
}

export function DetailsAccordion({
  questionId,
  defaultEvidence,
  defaultResponsible,
  defaultImpact,
  defaultUrgency,
  defaultRisk,
  impactOptions,
  urgencyOptions,
  riskOptions,
}: Props) {
  const [open, setOpen] = useState(
    // auto-open if the user already filled in some data
    Boolean(defaultEvidence || defaultResponsible)
  );

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 text-xs font-medium rounded-md px-2.5 py-1.5 transition-colors select-none ${
          open
            ? "bg-blue-50 text-blue-700"
            : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
        }`}
      >
        <ClipboardIcon />
        <span>Detalhes adicionais</span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Observações — full width */}
          <label className="block sm:col-span-2">
            <span className={labelClass}>Observações</span>
            <input
              type="text"
              name={`${questionId}__evidence`}
              defaultValue={defaultEvidence}
              placeholder="Ex.: sem processo formalizado, detectado em auditoria de Q1"
              className={inputClass}
            />
          </label>

          {/* Responsável — full width */}
          <label className="block sm:col-span-2">
            <span className={labelClass}>Responsável</span>
            <input
              type="text"
              name={`${questionId}__responsible`}
              defaultValue={defaultResponsible}
              placeholder="Nome ou cargo"
              className={inputClass}
            />
          </label>

          {/* Impacto */}
          <label className="block">
            <span className={labelClass}>Impacto</span>
            <select
              name={`${questionId}__impact`}
              defaultValue={defaultImpact}
              className={inputClass}
            >
              {impactOptions.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </label>

          {/* Urgência */}
          <label className="block">
            <span className={labelClass}>Urgência</span>
            <select
              name={`${questionId}__urgency`}
              defaultValue={defaultUrgency}
              className={inputClass}
            >
              {urgencyOptions.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </label>

          {/* Risco — full width */}
          <label className="block sm:col-span-2">
            <span className={labelClass}>Tipo de risco</span>
            <select
              name={`${questionId}__risk`}
              defaultValue={defaultRisk}
              className={inputClass}
            >
              {riskOptions.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
