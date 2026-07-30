import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 flex items-center justify-center bg-slate-50 px-6">
      <div className="max-w-2xl text-center">
        <p className="text-sm font-semibold tracking-wide text-blue-700 uppercase mb-3">
          Arca Consulting
        </p>
        <h1 className="text-4xl font-bold text-slate-900 mb-4">
          ArcaOS — Diagnóstico 360
        </h1>
        <p className="text-lg text-slate-600 mb-8">
          Avalie a maturidade da sua empresa em 12 áreas de gestão, receba um
          relatório executivo com riscos e oportunidades, e um plano de ação
          priorizado para os próximos 30, 90 e 365 dias.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/diagnostico/novo"
            className="inline-flex items-center justify-center rounded-lg bg-blue-700 px-6 py-3 text-white font-semibold hover:bg-blue-800 transition-colors"
          >
            Iniciar Diagnóstico
          </Link>
          <Link
            href="/empresas"
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-6 py-3 text-slate-700 font-semibold hover:bg-slate-100 transition-colors"
          >
            Ver empresas
          </Link>
        </div>
      </div>
    </main>
  );
}
