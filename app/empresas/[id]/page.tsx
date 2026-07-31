import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getResumeAreaKey } from "@/lib/areas";
import { buildReport } from "@/lib/scoring";
import { statusTone } from "@/lib/badge-tones";
import type { MeetingMinutes } from "@/lib/ai";
import { findAtRiskTasks } from "@/lib/pmo";
import { Card } from "@/app/components/Card";
import { Badge } from "@/app/components/Badge";
import { ScoreBar } from "@/app/components/ScoreBar";
import {
  FolderIcon,
  TrendingUpIcon,
  EmptyBoxIcon,
  SparklesIcon,
  ListChecksIcon,
  DocumentIcon,
  PlayCircleIcon,
} from "@/app/components/icons";

export default async function EmpresaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      diagnostics: {
        orderBy: { createdAt: "asc" },
        include: { answers: true, tasks: true },
      },
      documents: { orderBy: { createdAt: "desc" }, take: 4 },
      meetingNotes: { orderBy: { createdAt: "desc" }, take: 2 },
    },
  });
  if (!company) notFound();

  const totalDocuments = await prisma.document.count({ where: { companyId: id } });

  const diagnosticsWithScore = company.diagnostics.map((d) => {
    const report = buildReport(
      d.answers.map((a) => ({ areaKey: a.areaKey, questionId: a.questionId, score: a.score }))
    );
    return { diagnostic: d, report };
  });

  // Generated once, at diagnostic completion (app/actions.ts) — reading it
  // here is free; it used to call Gemini live on every visit to this page.
  const evolutionNarrative: string | null =
    diagnosticsWithScore.length > 1
      ? diagnosticsWithScore[diagnosticsWithScore.length - 1].diagnostic.evolutionNarrative
      : null;

  const inExecution = [...diagnosticsWithScore].reverse().find((d) => d.diagnostic.tasks.length > 0);
  let execution: {
    diagnosticId: string;
    pct: number;
    done: number;
    total: number;
    overdueCount: number;
    noOwnerCount: number;
  } | null = null;
  if (inExecution) {
    const tasks = inExecution.diagnostic.tasks;
    const done = tasks.filter((t) => t.status === "done").length;
    const alerts = findAtRiskTasks(
      tasks.map((t) => ({
        id: t.id,
        title: t.title,
        areaName: t.areaName,
        status: t.status,
        dueDate: t.dueDate,
        responsible: t.responsible,
      }))
    );
    execution = {
      diagnosticId: inExecution.diagnostic.id,
      pct: Math.round((done / tasks.length) * 100),
      done,
      total: tasks.length,
      overdueCount: new Set(alerts.filter((a) => a.reason === "atrasada").map((a) => a.taskId)).size,
      noOwnerCount: alerts.filter((a) => a.reason === "sem_responsavel").length,
    };
  }

  return (
    <main className="flex-1 bg-slate-50 py-10 px-4">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href="/empresas" className="text-sm text-slate-500 hover:text-slate-800">
          ← Todas as empresas
        </Link>

        <Card>
          <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide mb-1">Empresa</p>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">{company.name}</h1>
          <p className="text-slate-600 mb-4">
            {company.segment} · {company.employees || "—"} colaboradores · {company.cities || "—"}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/empresas/${id}/documentos`}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <FolderIcon />
              Data Room ({totalDocuments})
            </Link>
            <Link
              href={`/empresas/${id}/reunioes`}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <ListChecksIcon className="w-4 h-4" />
              Atas de Reunião
            </Link>
            <Link
              href={`/empresas/${id}/indicadores`}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <TrendingUpIcon className="w-4 h-4" />
              Indicadores
            </Link>
            <Link
              href="/diagnostico/novo"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              + Novo diagnóstico
            </Link>
          </div>
        </Card>

        {diagnosticsWithScore.length > 1 && (
          <Card>
            <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900 mb-4">
              <TrendingUpIcon className="w-5 h-5 text-status-managed" />
              Evolução da Maturidade
            </h2>
            {evolutionNarrative && (
              <div className="mb-4 rounded-xl bg-blue-50/70 border border-blue-100 p-4">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1.5">
                  <SparklesIcon className="w-3.5 h-3.5" />
                  Agente de Evolução de Maturidade · Gerado por IA
                </p>
                <p className="text-sm text-slate-800 leading-relaxed">{evolutionNarrative}</p>
              </div>
            )}
            <div className="space-y-3">
              {diagnosticsWithScore.map(({ diagnostic, report }) => (
                <div key={diagnostic.id} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-24 shrink-0">
                    {new Date(diagnostic.createdAt).toLocaleDateString("pt-BR")}
                  </span>
                  <ScoreBar score={report.overallAverage} className="h-3 flex-1" />
                  <span className="text-sm font-semibold text-slate-800 w-10 text-right">
                    {report.overallAverage.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {execution && (
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                <PlayCircleIcon className="w-5 h-5 text-status-managed" />
                Execução em andamento
              </h2>
              <Link
                href={`/diagnostico/${execution.diagnosticId}/projeto`}
                className="rounded-lg bg-blue-700 text-white text-sm font-semibold px-3 py-1.5 hover:bg-blue-800 transition-colors"
              >
                Ver Kanban →
              </Link>
            </div>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs text-slate-500">Progresso do plano de ação</span>
              <span className="text-lg font-bold text-slate-900">{execution.pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 overflow-hidden mb-1">
              <div
                className="h-full rounded-full bg-status-good transition-all"
                style={{ width: `${execution.pct}%` }}
              />
            </div>
            <p className="text-xs text-slate-500">
              {execution.done} de {execution.total} ações concluídas
            </p>
            {(execution.overdueCount > 0 || execution.noOwnerCount > 0) && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <SparklesIcon className="w-3.5 h-3.5 shrink-0" />
                Agente PMO: {execution.overdueCount > 0 && `${execution.overdueCount} atrasada(s)`}
                {execution.overdueCount > 0 && execution.noOwnerCount > 0 && " · "}
                {execution.noOwnerCount > 0 && `${execution.noOwnerCount} sem responsável`}
              </p>
            )}
          </Card>
        )}

        <Card>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Diagnósticos</h2>
          {diagnosticsWithScore.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <EmptyBoxIcon className="w-10 h-10 text-slate-300" />
              <p className="text-sm text-slate-500">Nenhum diagnóstico realizado ainda.</p>
              <Link
                href="/diagnostico/novo"
                className="mt-1 text-sm font-medium text-blue-700 hover:underline"
              >
                Iniciar o primeiro diagnóstico →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {[...diagnosticsWithScore].reverse().map(({ diagnostic, report }) => (
                <div
                  key={diagnostic.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {new Date(diagnostic.createdAt).toLocaleDateString("pt-BR")} ·{" "}
                      {diagnostic.status === "concluido"
                        ? "Concluído"
                        : diagnostic.status === "em_execucao"
                          ? "Em execução"
                          : "Em andamento"}
                    </p>
                    <p className="text-xs text-slate-500">
                      Nota geral: {report.overallAverage.toFixed(1)}/5
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge text={report.overallStatus} tone={statusTone(report.overallStatus)} />
                    {diagnostic.status === "em_andamento" ? (
                      <Link
                        href={`/diagnostico/${diagnostic.id}/questionario/${getResumeAreaKey(diagnostic.answers)}`}
                        className="rounded-lg bg-blue-700 text-white text-sm font-semibold px-3 py-1.5 hover:bg-blue-800 transition-colors"
                      >
                        Continuar
                      </Link>
                    ) : (
                      <>
                        <Link
                          href={`/diagnostico/${diagnostic.id}/relatorio`}
                          className="rounded-lg bg-blue-700 text-white text-sm font-semibold px-3 py-1.5 hover:bg-blue-800 transition-colors"
                        >
                          Ver relatório
                        </Link>
                        {diagnostic.tasks.length > 0 && (
                          <Link
                            href={`/diagnostico/${diagnostic.id}/projeto`}
                            className="rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold px-3 py-1.5 hover:bg-slate-100 transition-colors"
                          >
                            Projeto
                          </Link>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-slate-900">Documentos recentes</h2>
              <Link href={`/empresas/${id}/documentos`} className="text-xs text-blue-700 hover:underline">
                Ver todos →
              </Link>
            </div>
            {company.documents.length > 0 ? (
              <ul className="space-y-2">
                {company.documents.map((doc) => (
                  <li key={doc.id} className="flex items-center gap-2 text-sm">
                    <DocumentIcon className="w-4 h-4 text-slate-400 shrink-0" />
                    <a
                      href={`/api/documentos/${doc.id}`}
                      className="text-slate-700 hover:text-blue-700 hover:underline truncate"
                    >
                      {doc.originalName}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400">Nenhum documento enviado ainda.</p>
            )}
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-slate-900">Atas recentes</h2>
              <Link href={`/empresas/${id}/reunioes`} className="text-xs text-blue-700 hover:underline">
                Ver todas →
              </Link>
            </div>
            {company.meetingNotes.length > 0 ? (
              <ul className="space-y-3">
                {company.meetingNotes.map((note) => {
                  const minutes: MeetingMinutes | null = note.summary ? JSON.parse(note.summary) : null;
                  return (
                    <li key={note.id} className="text-sm">
                      <p className="text-xs text-slate-400 mb-0.5">
                        {new Date(note.createdAt).toLocaleDateString("pt-BR")}
                      </p>
                      <p className="text-slate-700 line-clamp-2">
                        {minutes?.summary ?? note.rawNotes}
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-xs text-slate-400">Nenhuma ata gerada ainda.</p>
            )}
          </Card>
        </div>
      </div>
    </main>
  );
}
