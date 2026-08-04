import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getVerticalByKey } from "@/lib/verticals";
import { buildVerticalReport } from "@/lib/vertical-diagnostic";
import { getPlaybookByVertical } from "@/lib/playbooks";
import { findEvidenceGaps } from "@/lib/audit";
import { statusTone, maturityTone, priorityTone } from "@/lib/badge-tones";
import { getSession } from "@/lib/auth";
import { assertCompanyAccess, assertVerticalAccess } from "@/lib/access";
import { approveVerticalActionPlan } from "@/app/actions-module";
import { Card } from "@/app/components/Card";
import { Badge } from "@/app/components/Badge";
import { ScoreBar } from "@/app/components/ScoreBar";
import { SubmitButton } from "@/app/components/SubmitButton";
import { SparklesIcon } from "@/app/components/icons";

const LADDER = [
  { level: 1, label: "Diagnóstico" },
  { level: 2, label: "Execução" },
  { level: 3, label: "Performance" },
  { level: 4, label: "Especialista" },
];

export default async function ModuloVerticalRelatorioPage({
  params,
}: {
  params: Promise<{ id: string; verticalKey: string; diagnosticId: string }>;
}) {
  const { id, verticalKey, diagnosticId } = await params;
  const session = await getSession();
  assertCompanyAccess(session, id);
  assertVerticalAccess(session, verticalKey);

  const diagnostic = await prisma.diagnostic.findUnique({
    where: { id: diagnosticId },
    include: { company: true, answers: true, tasks: true, epics: true },
  });
  if (!diagnostic || diagnostic.companyId !== id || diagnostic.scope !== verticalKey) notFound();

  const vertical = getVerticalByKey(diagnostic.scope);
  if (!vertical) notFound();

  const report = buildVerticalReport(
    vertical,
    diagnostic.answers.map((a) => ({ areaKey: a.areaKey, questionId: a.questionId, score: a.score }))
  );

  // Filtra pelas áreas atuais da vertical, não só pelo diagnosticId — um
  // diagnóstico aprovado antes de uma vertical mudar de composição (ex.:
  // Marketing saindo de Comercial) ainda tem respostas de áreas que não
  // pertencem mais a ela, e essas respostas não devem aparecer aqui.
  const evidenceGaps = findEvidenceGaps(
    diagnostic.answers
      .filter((a) => vertical.areaKeys.includes(a.areaKey))
      .map((a) => ({
        areaKey: a.areaKey,
        questionId: a.questionId,
        score: a.score,
        evidence: a.evidence,
      }))
  );

  const alreadyApproved = diagnostic.tasks.length > 0;
  const multiArea = vertical.areaKeys.length > 1;
  const playbook = getPlaybookByVertical(vertical.key);
  // Diagnósticos aprovados antes deste épico existir não ganham ele
  // retroativamente (approveVerticalActionPlan só roda a criação uma vez) —
  // sem essa checagem, o aviso abaixo diria "já criado" pra um épico que
  // nunca existiu.
  const playbookAlreadyCreated = diagnostic.epics.some((e) => e.name.startsWith("Playbook de Execução"));

  return (
    <main className="flex-1 bg-slate-50 py-10 px-4">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href={`/empresas/${id}/modulo/${verticalKey}`} className="text-sm text-slate-500 hover:text-slate-800">
          ← Voltar pro Módulo {vertical.name}
        </Link>

        <Card>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-blue-700 uppercase tracking-wide mb-1">
            Arca Checkup · {diagnostic.company.name}
          </p>
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Relatório — {vertical.name}</h1>

          <div className="flex flex-wrap gap-2 mb-6">
            {LADDER.map((step) => (
              <span
                key={step.level}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  step.level === 1
                    ? "bg-blue-700 text-white border-blue-700"
                    : "bg-slate-50 text-slate-400 border-slate-200"
                }`}
              >
                Nível {step.level} · {step.label}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-4">
              <p className="text-xs text-slate-500 mb-1">Nota da vertical</p>
              <p className="text-2xl font-bold text-slate-900">{report.average.toFixed(1)}/5</p>
              <div className="mt-1.5">
                <Badge text={report.status} tone={statusTone(report.status)} />
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-4">
              <p className="text-xs text-slate-500 mb-1">Nível de maturidade</p>
              <p className="text-2xl font-bold text-slate-900">Nível {report.maturityLevel}</p>
              <div className="mt-1.5">
                <Badge text={report.maturityLabel} tone={maturityTone(report.maturityLevel)} />
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-4">
              <p className="text-xs text-slate-500 mb-1">Plano de ação</p>
              <p className="text-2xl font-bold text-slate-900">
                {alreadyApproved ? `${diagnostic.tasks.length} ações` : report.actionItems.length}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {alreadyApproved ? "aprovado, no Kanban" : "aguardando aprovação"}
              </p>
            </div>
          </div>
        </Card>

        {evidenceGaps.length > 0 && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-900 mb-2">
              <SparklesIcon className="w-4 h-4 shrink-0" />
              Agente de Auditoria de Evidências
            </p>
            <ul className="space-y-1 text-sm text-amber-900">
              {evidenceGaps.map((a, i) => (
                <li key={i}>
                  {multiArea && <span className="text-amber-700">[{a.areaName}]</span>} {a.questionText} (nota{" "}
                  {a.score}) — sem evidência anexada
                </li>
              ))}
            </ul>
          </div>
        )}

        <Card>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Perguntas mais críticas</h2>
          {report.weakestQuestions.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma resposta crítica (nota ≤ 2) nesta vertical.</p>
          ) : (
            <ul className="space-y-2">
              {report.weakestQuestions.map((q, i) => (
                <li key={i} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-700">
                    {multiArea && <span className="text-slate-400">[{q.areaName}] </span>}
                    {q.text}
                  </span>
                  <ScoreBar score={q.score} className="h-1.5 w-24 shrink-0" />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-xl font-bold text-slate-900">Plano de Ação — {vertical.name}</h2>
            {alreadyApproved ? (
              <Link
                href={`/diagnostico/${diagnosticId}/projeto`}
                className="rounded-lg bg-blue-700 text-white text-sm font-semibold px-4 py-2 hover:bg-blue-800 transition-colors"
              >
                Ver projeto de execução (Kanban) →
              </Link>
            ) : (
              <form action={approveVerticalActionPlan.bind(null, diagnosticId)}>
                <SubmitButton
                  pendingText="Aprovando..."
                  className="rounded-lg bg-blue-700 text-white text-sm font-semibold px-4 py-2 hover:bg-blue-800 transition-colors"
                >
                  Aprovar plano e criar projeto →
                </SubmitButton>
              </form>
            )}
          </div>
          <div className="space-y-2">
            {report.actionItems.map((item, i) => (
              <div key={i} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{item.action}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {multiArea && `${item.areaName} · `}
                    {item.problem}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge text={item.priority} tone={priorityTone(item.priority)} />
                  <Badge text={item.timeframe} tone="neutral" />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {playbook && (
          <Card>
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <h2 className="text-xl font-bold text-slate-900">Playbook de Execução — {vertical.name}</h2>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500 shrink-0">
                Nível 2 · Execução
              </span>
            </div>
            <p className="text-sm text-slate-500 mb-4">{playbook.summary}</p>
            <ul className="space-y-2">
              {playbook.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-0.5 text-slate-300">○</span>
                  {step}
                </li>
              ))}
            </ul>
            <p className="text-xs text-slate-400 mt-4">
              {playbookAlreadyCreated
                ? "Já criado como um épico próprio no Kanban junto com o plano de ação."
                : alreadyApproved
                  ? "Plano aprovado antes deste playbook existir — não entrou retroativamente no Kanban."
                  : "Padrão de implantação da vertical — entra como um épico separado no Kanban ao aprovar o plano de ação."}
            </p>
          </Card>
        )}
      </div>
    </main>
  );
}
