import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buildReport } from "@/lib/scoring";
import { findAtRiskTasks } from "@/lib/pmo";
import type { MeetingMinutes } from "@/lib/ai";
import { getSession } from "@/lib/auth";
import { assertCompanyAccess } from "@/lib/access";
import { statusTone, maturityTone, priorityTone } from "@/lib/badge-tones";
import { addDecision, sendMessage, generateMonthlyReport } from "@/app/actions-portal";
import { Card } from "@/app/components/Card";
import { Badge } from "@/app/components/Badge";
import { ScoreBar } from "@/app/components/ScoreBar";
import { SubmitButton } from "@/app/components/SubmitButton";
import {
  ListChecksIcon,
  SparklesIcon,
  TrendingUpIcon,
  DocumentIcon,
  EmptyBoxIcon,
  DashboardIcon,
} from "@/app/components/icons";

const ROLE_DISPLAY: Record<string, string> = {
  admin: "Arca",
  consultor: "Arca",
  cliente: "Cliente",
};

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("pt-BR");
}

type DecisionRow = {
  title: string;
  summary: string;
  decidedAt: Date;
  decidedBy: string;
  source: string;
};

export default async function PortalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();
  if (!session) notFound();
  assertCompanyAccess(session, id);

  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      diagnostics: {
        orderBy: { createdAt: "desc" },
        include: { answers: true, tasks: true },
      },
      decisions: { orderBy: { decidedAt: "desc" } },
      messages: { orderBy: { createdAt: "asc" } },
      monthlyReports: { orderBy: { period: "desc" } },
      meetingNotes: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!company) notFound();

  const isClient = session.role === "cliente";
  const latest = company.diagnostics.find((d) => d.answers.length > 0);
  const report = latest
    ? buildReport(
        latest.answers.map((a) => ({ areaKey: a.areaKey, questionId: a.questionId, score: a.score }))
      )
    : null;

  const allTasks = company.diagnostics.flatMap((d) =>
    d.tasks.map((t) => ({ ...t, diagnosticCreatedAt: d.createdAt }))
  );
  const pending = allTasks
    .filter((t) => t.status !== "done")
    .sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0));
  const overdueIds = new Set(
    findAtRiskTasks(
      pending.map((t) => ({
        id: t.id,
        title: t.title,
        areaName: t.areaName,
        status: t.status,
        dueDate: t.dueDate,
        responsible: t.responsible,
      }))
    )
      .filter((a) => a.reason === "atrasada")
      .map((a) => a.taskId)
  );
  const doneCount = allTasks.filter((t) => t.status === "done").length;
  const executionPct = allTasks.length > 0 ? Math.round((doneCount / allTasks.length) * 100) : null;

  const meetingDecisions: DecisionRow[] = company.meetingNotes.flatMap((note) => {
    if (!note.summary) return [];
    try {
      const minutes = JSON.parse(note.summary) as MeetingMinutes;
      return minutes.decisions.map((d) => ({
        title: d,
        summary: "",
        decidedAt: note.createdAt,
        decidedBy: "",
        source: "ata",
      }));
    } catch {
      return [];
    }
  });
  const decisions: DecisionRow[] = [
    ...company.decisions.map((d) => ({
      title: d.title,
      summary: d.summary,
      decidedAt: d.decidedAt,
      decidedBy: d.decidedBy,
      source: "portal",
    })),
    ...meetingDecisions,
  ].sort((a, b) => b.decidedAt.getTime() - a.decidedAt.getTime());

  const backHref = isClient ? "/dashboard" : `/empresas/${id}`;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="flex-1 bg-slate-50 py-10 px-4">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href={backHref} className="text-sm text-slate-500 hover:text-slate-800">
          ← Voltar
        </Link>

        <Card>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-blue-700 uppercase tracking-wide mb-1">
            <DashboardIcon className="w-4 h-4" />
            Portal do Cliente
          </p>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">{company.name}</h1>
          <p className="text-slate-600 mb-6">
            {company.segment || "—"} · {company.employees || "—"} colaboradores. Acompanhe
            pendências, decisões e a conversa com a Arca em um só lugar.
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-4">
              <p className="text-xs text-slate-500 mb-1">Nota geral de maturidade</p>
              <p className="text-2xl font-bold text-slate-900">
                {report ? `${report.overallAverage.toFixed(1)}/5` : "—"}
              </p>
              {report && (
                <div className="mt-1.5">
                  <Badge text={report.overallStatus} tone={statusTone(report.overallStatus)} />
                </div>
              )}
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-4">
              <p className="text-xs text-slate-500 mb-1">Nível de maturidade</p>
              <p className="text-2xl font-bold text-slate-900">
                {report ? `Nível ${report.maturityLevel}` : "—"}
              </p>
              {report && (
                <div className="mt-1.5">
                  <Badge text={report.maturityLabel} tone={maturityTone(report.maturityLevel)} />
                </div>
              )}
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-4">
              <p className="text-xs text-slate-500 mb-1">Execução do plano</p>
              <p className="text-2xl font-bold text-slate-900">
                {executionPct === null ? "—" : `${executionPct}%`}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {doneCount} de {allTasks.length} ações concluídas
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-4">
              <p className="text-xs text-slate-500 mb-1">Pendências abertas</p>
              <p className="text-2xl font-bold text-slate-900">{pending.length}</p>
              <p className="text-[11px] text-slate-400 mt-1">
                {overdueIds.size} atrasada{overdueIds.size === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        </Card>

        {/* Pendências */}
        <Card id="pendencias">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <ListChecksIcon className="w-5 h-5 text-blue-700" />
              Pendências
            </h2>
            <Badge text={`${pending.length} abertas`} tone={pending.length > 0 ? "warning" : "good"} />
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Ações do plano de execução ainda não concluídas — prioridade da Arca e do comitê.
          </p>
          {pending.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <EmptyBoxIcon className="w-10 h-10 text-slate-300" />
              <p className="text-sm text-slate-500">Nenhuma pendência em aberto. Bom trabalho!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pending.map((task) => (
                <div
                  key={task.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">{task.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {task.areaName} · {task.responsible ? `Responsável: ${task.responsible}` : "Sem responsável"}
                      {task.dueDate && ` · Prazo: ${formatDate(task.dueDate)}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    {overdueIds.has(task.id) && <Badge text="Atrasada" tone="critical" />}
                    <Badge text={task.priority} tone={priorityTone(task.priority)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Histórico de decisões */}
        <Card id="decisoes">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold text-slate-900">Histórico de Decisões</h2>
            <Badge text={`${decisions.length} registradas`} tone="neutral" />
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Decisões estratégicas registradas no portal e as decisões extraídas das atas de reunião.
          </p>

          <form action={addDecision.bind(null, id)} className="grid grid-cols-1 sm:grid-cols-2 gap-3 border border-slate-200 rounded-xl p-4 bg-slate-50 mb-5">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Decisão *</span>
              <input
                name="title"
                required
                maxLength={160}
                placeholder="Ex.: Aprovado orçamento anual 2026"
                className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Data</span>
              <input
                type="date"
                name="decidedAt"
                defaultValue={today}
                className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="block text-xs font-medium text-slate-600 mb-1">Detalhes (opcional)</span>
              <textarea
                name="summary"
                rows={2}
                maxLength={500}
                className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
              />
            </label>
            <input type="hidden" name="decidedBy" value="" />
            <div className="sm:col-span-2">
              <SubmitButton
                pendingText="Registrando..."
                className="rounded-lg bg-blue-700 text-white text-sm font-semibold px-4 py-2 hover:bg-blue-800 transition-colors"
              >
                Registrar decisão
              </SubmitButton>
            </div>
          </form>

          {decisions.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">
              Nenhuma decisão registrada ainda.
            </p>
          ) : (
            <div className="space-y-3">
              {decisions.map((decision, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
                  <TrendingUpIcon className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800">{decision.title}</p>
                    {decision.summary && (
                      <p className="text-xs text-slate-500 mt-0.5">{decision.summary}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">
                      {formatDate(decision.decidedAt)}
                      {decision.decidedBy && ` · ${decision.decidedBy}`}
                      {decision.source === "ata" && " · origem: ata de reunião"}
                    </p>
                  </div>
                  {decision.source === "ata" && <SparklesIcon className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Comunicação */}
        <Card id="comunicacao">
          <h2 className="text-xl font-bold text-slate-900 mb-1">Comunicação com a Arca</h2>
          <p className="text-xs text-slate-500 mb-4">
            Canal direto com a consultoria — tire dúvidas e acompanhe o andamento do trabalho.
          </p>

          <div className="space-y-3 mb-4 max-h-80 overflow-y-auto pr-1">
            {company.messages.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">
                Nenhuma mensagem ainda — comece a conversa.
              </p>
            ) : (
              company.messages.map((message) => {
                const fromClient = message.authorRole === "cliente";
                return (
                  <div key={message.id} className={`flex ${fromClient ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-sm ${
                        fromClient
                          ? "bg-blue-700 text-white rounded-br-sm"
                          : "bg-slate-100 text-slate-800 rounded-bl-sm"
                      }`}
                    >
                      <p className={`text-[11px] font-semibold mb-0.5 ${fromClient ? "text-blue-100" : "text-slate-500"}`}>
                        {message.authorName} · {ROLE_DISPLAY[message.authorRole] ?? message.authorRole}
                      </p>
                      <p className="whitespace-pre-wrap wrap-break-word">{message.body}</p>
                      <p className={`text-[10px] mt-1 ${fromClient ? "text-blue-200" : "text-slate-400"}`}>
                        {new Date(message.createdAt).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form action={sendMessage.bind(null, id)} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <input
              name="body"
              required
              maxLength={2000}
              placeholder="Escreva sua mensagem para a Arca..."
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <SubmitButton
              pendingText="Enviando..."
              className="rounded-lg bg-blue-700 text-white text-sm font-semibold px-5 py-2 hover:bg-blue-800 transition-colors"
            >
              Enviar
            </SubmitButton>
          </form>
        </Card>

        {/* Comitê de Gestão — relatórios mensais */}
        <Card id="comite">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
            <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <DocumentIcon className="w-5 h-5 text-blue-700" />
              Comitê de Gestão · Relatórios Mensais
            </h2>
            <form action={generateMonthlyReport.bind(null, id)}>
              <SubmitButton
                pendingText="Gerando..."
                className="rounded-lg bg-blue-700 text-white text-sm font-semibold px-4 py-2 hover:bg-blue-800 transition-colors"
              >
                Gerar relatório do mês
              </SubmitButton>
            </form>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Scorecard automático gerado no 1º dia de cada mês (cron) ou sob demanda. Alimenta o
            comitê com nota, nível de maturidade, execução e pendências.
          </p>

          {company.monthlyReports.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">
              Nenhum relatório mensal gerado ainda — clique em &ldquo;Gerar relatório do mês&rdquo;.
            </p>
          ) : (
            <div className="space-y-3">
              {company.monthlyReports.map((reportRow) => {
                const taskStats = JSON.parse(reportRow.taskStats) as {
                  total: number;
                  done: number;
                  pct: number;
                  overdue: number;
                  noOwner: number;
                };
                return (
                  <details key={reportRow.id} className="group rounded-lg border border-slate-200 open:bg-slate-50/60">
                    <summary className="flex items-center gap-3 cursor-pointer select-none px-4 py-3 list-none">
                      <span className="text-slate-400 text-xs transition-transform group-open:rotate-90">▶</span>
                      <span className="font-semibold text-slate-900 flex-1">
                        {reportRow.period} · {reportRow.overallAverage.toFixed(1)}/5
                      </span>
                      <Badge text={`Nível ${reportRow.maturityLevel} · ${reportRow.maturityLabel}`} tone={maturityTone(reportRow.maturityLevel)} />
                    </summary>
                    <div className="px-4 pb-4 pt-1 space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="rounded-lg bg-white border border-slate-200 p-3">
                          <p className="text-[11px] text-slate-500">Execução</p>
                          <p className="text-lg font-bold text-slate-900">{taskStats.pct}%</p>
                          <p className="text-[11px] text-slate-400">
                            {taskStats.done} de {taskStats.total} ações
                          </p>
                        </div>
                        <div className="rounded-lg bg-white border border-slate-200 p-3">
                          <p className="text-[11px] text-slate-500">Pendências</p>
                          <p className="text-lg font-bold text-slate-900">{reportRow.pendingCount}</p>
                          <p className="text-[11px] text-slate-400">
                            {taskStats.overdue} atrasada{taskStats.overdue === 1 ? "" : "s"}
                          </p>
                        </div>
                        <div className="rounded-lg bg-white border border-slate-200 p-3">
                          <p className="text-[11px] text-slate-500">Decisões</p>
                          <p className="text-lg font-bold text-slate-900">{reportRow.decisionsCount}</p>
                        </div>
                        <div className="rounded-lg bg-white border border-slate-200 p-3">
                          <p className="text-[11px] text-slate-500">Indicadores (KPIs)</p>
                          <p className="text-lg font-bold text-slate-900">{reportRow.kpiCount}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                          Maturidade por área
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                          {(JSON.parse(reportRow.areaAverages) as { areaName: string; average: number }[]).map(
                            (a) => (
                              <div key={a.areaName} className="flex items-center gap-2 text-sm">
                                <span className="text-slate-600 flex-1 truncate">{a.areaName}</span>
                                <ScoreBar score={a.average} className="h-1.5 w-20" />
                                <span className="text-slate-500 w-8 text-right">{a.average.toFixed(1)}</span>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
