import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AREAS, getAreaByKey, getAreaIndex } from "@/lib/areas";
import { saveAreaAnswers } from "@/app/actions";
import { IMPACT_OPTIONS, URGENCY_OPTIONS, RISK_OPTIONS } from "@/lib/validation";
import { getSession } from "@/lib/auth";
import { assertCompanyAccess } from "@/lib/access";
import { SubmitButton } from "@/app/components/SubmitButton";

const SCALE_LABELS = [
  "0 · Inexistente",
  "1 · Informal",
  "2 · Básico",
  "3 · Padronizado",
  "4 · Gerenciado",
  "5 · Otimizado",
];

type ExistingAnswer = {
  questionId: string;
  score: number;
  evidence: string;
  responsible: string;
  impact: string;
  urgency: string;
  risk: string;
};

export default async function QuestionarioAreaPage({
  params,
}: {
  params: Promise<{ id: string; areaKey: string }>;
}) {
  const { id, areaKey } = await params;

  const area = getAreaByKey(areaKey);
  if (!area) notFound();

  const diagnostic = await prisma.diagnostic.findUnique({ where: { id } });
  if (!diagnostic) notFound();
  assertCompanyAccess(await getSession(), diagnostic.companyId);

  const existingAnswers = await prisma.answer.findMany({
    where: { diagnosticId: id, areaKey },
  });
  const answerMap = new Map<string, ExistingAnswer>(
    existingAnswers.map((a: ExistingAnswer) => [a.questionId, a])
  );

  const areaIndex = getAreaIndex(areaKey);
  const isLast = areaIndex === AREAS.length - 1;
  const action = saveAreaAnswers.bind(null, id, areaKey);

  return (
    <main className="flex-1 bg-slate-50 py-10 px-4">
      <div className="mx-auto max-w-3xl">
        <ProgressBar current={areaIndex + 1} total={AREAS.length} />

        <form
          action={action}
          className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-8 mt-4"
        >
          <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide mb-1">
            Área {areaIndex + 1} de {AREAS.length}
          </p>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">
            {area.name}
          </h1>
          <p className="text-slate-600 mb-6">{area.objective}</p>

          <div className="mb-6 rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-500 flex flex-wrap gap-3">
            {SCALE_LABELS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div className="space-y-6">
            {area.questions.map((q, i) => {
              const existing = answerMap.get(q.id);
              return (
                <fieldset key={q.id} className="border-b border-slate-100 pb-5">
                  <legend className="text-slate-800 font-medium mb-3">
                    {i + 1}. {q.text}
                  </legend>
                  <div className="flex gap-2">
                    {[0, 1, 2, 3, 4, 5].map((score) => (
                      <label
                        key={score}
                        className="flex-1 cursor-pointer text-center relative"
                      >
                        <input
                          type="radio"
                          name={q.id}
                          value={score}
                          defaultChecked={
                            existing?.score === score ||
                            (!existing && score === 0)
                          }
                          className="peer sr-only"
                          required
                        />
                        <div className="rounded-lg border border-slate-300 py-2 text-sm font-semibold text-slate-600 peer-checked:bg-status-managed peer-checked:text-white peer-checked:border-status-managed hover:bg-slate-100 transition-colors">
                          {score}
                        </div>
                      </label>
                    ))}
                  </div>

                  <details className="mt-3 group">
                    <summary className="cursor-pointer text-xs font-medium text-blue-700 select-none">
                      + Evidência, responsável, impacto, urgência e risco
                    </summary>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="block sm:col-span-2">
                        <span className="block text-xs font-medium text-slate-600 mb-1">
                          Evidência (documento, print, indicador, descrição)
                        </span>
                        <input
                          type="text"
                          name={`${q.id}__evidence`}
                          defaultValue={existing?.evidence ?? ""}
                          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/40 focus:border-blue-600 transition-shadow"
                        />
                      </label>
                      <label className="block">
                        <span className="block text-xs font-medium text-slate-600 mb-1">
                          Responsável pela área
                        </span>
                        <input
                          type="text"
                          name={`${q.id}__responsible`}
                          defaultValue={existing?.responsible ?? ""}
                          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/40 focus:border-blue-600 transition-shadow"
                        />
                      </label>
                      <label className="block">
                        <span className="block text-xs font-medium text-slate-600 mb-1">
                          Impacto
                        </span>
                        <select
                          name={`${q.id}__impact`}
                          defaultValue={existing?.impact ?? "Médio"}
                          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/40 focus:border-blue-600 transition-shadow"
                        >
                          {IMPACT_OPTIONS.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="block text-xs font-medium text-slate-600 mb-1">
                          Urgência
                        </span>
                        <select
                          name={`${q.id}__urgency`}
                          defaultValue={existing?.urgency ?? "Média"}
                          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/40 focus:border-blue-600 transition-shadow"
                        >
                          {URGENCY_OPTIONS.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="block text-xs font-medium text-slate-600 mb-1">
                          Risco
                        </span>
                        <select
                          name={`${q.id}__risk`}
                          defaultValue={existing?.risk ?? "Operacional"}
                          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/40 focus:border-blue-600 transition-shadow"
                        >
                          {RISK_OPTIONS.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </details>
                </fieldset>
              );
            })}
          </div>

          <div className="mt-8 flex items-center justify-between">
            {areaIndex > 0 ? (
              <Link
                href={`/diagnostico/${id}/questionario/${AREAS[areaIndex - 1].key}`}
                className="text-slate-600 font-medium hover:text-slate-900"
              >
                ← Área anterior
              </Link>
            ) : (
              <span />
            )}
            <SubmitButton
              pendingText={isLast ? "Gerando relatório..." : "Salvando..."}
              className="rounded-lg bg-blue-700 text-white font-semibold px-6 py-3 hover:bg-blue-800 transition-colors shadow-sm shadow-blue-700/20"
            >
              {isLast ? "Concluir e gerar relatório" : "Próxima área →"}
            </SubmitButton>
          </div>
        </form>
      </div>
    </main>
  );
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-500 mb-1">
        <span>Progresso do diagnóstico</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
        <div
          className="h-full rounded-full bg-status-managed transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
