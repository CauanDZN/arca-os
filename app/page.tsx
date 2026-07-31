import Link from "next/link";
import { SearchIcon, ListChecksIcon, PlayCircleIcon, TrendingUpIcon } from "@/app/components/icons";

const CYCLE = [
  { label: "Diagnosticar", icon: SearchIcon },
  { label: "Priorizar", icon: ListChecksIcon },
  { label: "Executar", icon: PlayCircleIcon },
  { label: "Medir", icon: TrendingUpIcon },
];

const STATS = [
  { value: "12", label: "áreas de gestão avaliadas" },
  { value: "~140", label: "perguntas no diagnóstico" },
  { value: "30/90/365", label: "dias de plano de ação" },
];

export default function Home() {
  return (
    <main className="flex-1 relative overflow-hidden bg-slate-50">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-128 w-3xl rounded-full bg-blue-200/30 blur-3xl"
      />

      <div className="relative mx-auto max-w-3xl px-6 py-20 text-center">
        <p className="text-sm font-semibold tracking-wide text-blue-700 uppercase mb-3">
          Arca Consulting
        </p>
        <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4 tracking-tight">
          ArcaOS — Diagnóstico 360
        </h1>
        <p className="text-lg text-slate-600 mb-10 max-w-xl mx-auto">
          Avalie a maturidade da sua empresa em 12 áreas de gestão, receba um
          relatório executivo com riscos e oportunidades, e um plano de ação
          priorizado para os próximos 30, 90 e 365 dias.
        </p>

        <div className="flex items-center justify-center gap-3 mb-16">
          <Link
            href="/diagnostico/novo"
            className="inline-flex items-center justify-center rounded-lg bg-blue-700 px-6 py-3 text-white font-semibold hover:bg-blue-800 transition-colors shadow-sm shadow-blue-700/20"
          >
            Iniciar Diagnóstico
          </Link>
          <Link
            href="/empresas"
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-6 py-3 text-slate-700 font-semibold hover:bg-slate-100 transition-colors"
          >
            Ver empresas
          </Link>
        </div>

        {/* Ciclo Arca */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-3 mb-14">
          {CYCLE.map((step, i) => (
            <div key={step.label} className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <div className="flex flex-col items-center gap-2 rounded-xl bg-white border border-slate-200/80 px-4 py-3 shadow-sm w-full sm:w-auto">
                <step.icon className="w-5 h-5 text-blue-700" />
                <span className="text-xs font-semibold text-slate-700">{step.label}</span>
              </div>
              {i < CYCLE.length - 1 && (
                <span className="text-slate-300 text-lg rotate-90 sm:rotate-0" aria-hidden>
                  →
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left sm:text-center">
          {STATS.map((stat) => (
            <div key={stat.label} className="rounded-xl bg-white border border-slate-200/80 p-4">
              <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
