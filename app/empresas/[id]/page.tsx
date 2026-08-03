import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getResumeAreaKey } from "@/lib/areas";
import { buildReport } from "@/lib/scoring";
import { statusTone } from "@/lib/badge-tones";
import type { MeetingMinutes } from "@/lib/ai";
import { findAtRiskTasks } from "@/lib/pmo";
import { buildOnboardingChecklist } from "@/lib/onboarding";
import { findVerticalSynergies } from "@/lib/synergy";
import { VERTICALS } from "@/lib/verticals";
import { getSession } from "@/lib/auth";
import { deleteCompany, updateOnboardingResponsible, updateContractedVerticals } from "@/app/actions-empresas";
import { saveOmieCredentials, disconnectOmie, syncOmieFinancials } from "@/app/actions-omie";
import { createPartnerReferral, updatePartnerReferralStatus, deletePartnerReferral } from "@/app/actions-partners";
import { PARTNER_REFERRAL_STATUSES } from "@/lib/validation";
import { Card } from "@/app/components/Card";
import { Badge } from "@/app/components/Badge";
import { ConfirmButton } from "@/app/components/ConfirmButton";
import { ScoreBar } from "@/app/components/ScoreBar";
import { SubmitButton } from "@/app/components/SubmitButton";
import type { BadgeTone } from "@/lib/badge-tones";
import {
  FolderIcon,
  TrendingUpIcon,
  EmptyBoxIcon,
  SparklesIcon,
  ListChecksIcon,
  DocumentIcon,
  PlayCircleIcon,
  HandshakeIcon,
} from "@/app/components/icons";

const REFERRAL_STATUS_LABEL: Record<string, string> = {
  indicado: "Indicado",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  perdido: "Perdido",
};

const REFERRAL_STATUS_TONE: Record<string, BadgeTone> = {
  indicado: "neutral",
  em_andamento: "managed",
  concluido: "good",
  perdido: "critical",
};

const PAGE_ERROR_MESSAGE: Record<string, string> = {
  "omie-validacao": "Informe a App Key e o App Secret da Omie.",
  "omie-credenciais": "Não foi possível conectar à Omie com essas credenciais — confira App Key e App Secret.",
  "omie-desconectado": "Conecte a Omie antes de sincronizar.",
  "parceiro-invalido": "Selecione um parceiro válido.",
};

const PAGE_SUCCESS_MESSAGE: Record<string, string> = {
  "omie-conectado": "Conectado à Omie com sucesso.",
};

export default async function EmpresaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; sucesso?: string }>;
}) {
  const { id } = await params;
  const { error, sucesso } = await searchParams;

  const session = await getSession();

  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      diagnostics: {
        orderBy: { createdAt: "asc" },
        include: { answers: true, tasks: true },
      },
      documents: { orderBy: { createdAt: "desc" }, take: 4 },
      meetingNotes: { orderBy: { createdAt: "desc" }, take: 2 },
      erpConnections: true,
      partnerReferrals: { orderBy: { createdAt: "desc" }, include: { partner: true } },
    },
  });
  if (!company) notFound();

  const omieConnection = company.erpConnections.find((c) => c.provider === "omie") ?? null;

  const allPartners =
    session?.role !== "cliente" ? await prisma.partner.findMany({ orderBy: { name: "asc" } }) : [];

  const totalDocuments = await prisma.document.count({ where: { companyId: id } });

  const onboardingItems = buildOnboardingChecklist({
    onboardingResponsible: company.onboardingResponsible,
    documentCount: totalDocuments,
    diagnosticCount: company.diagnostics.length,
    hasCompletedDiagnostic: company.diagnostics.some(
      (d) => d.status === "concluido" || d.status === "em_execucao"
    ),
  });
  const onboardingDone = onboardingItems.filter((i) => i.done).length;

  const contractedVerticalKeys: string[] = JSON.parse(company.contractedVerticals || "[]");
  const contractedVerticals = VERTICALS.filter((v) => contractedVerticalKeys.includes(v.key));

  const diagnosticsWithScore = company.diagnostics.map((d) => {
    const report = buildReport(
      d.answers.map((a) => ({ areaKey: a.areaKey, questionId: a.questionId, score: a.score }))
    );
    return { diagnostic: d, report };
  });

  // Agente de Sinergia entre Verticais: junta a resposta mais recente de
  // cada pergunta em qualquer diagnóstico da empresa (completo ou de uma
  // vertical isolada) — company.diagnostics já vem em ordem ascendente de
  // criação, então um Map por areaKey+questionId naturalmente fica só com a
  // versão mais nova quando a mesma pergunta aparece em mais de um
  // diagnóstico ao longo do tempo.
  const latestAnswerByQuestion = new Map<string, { areaKey: string; questionId: string; score: number }>();
  for (const diagnostic of company.diagnostics) {
    for (const answer of diagnostic.answers) {
      latestAnswerByQuestion.set(`${answer.areaKey}::${answer.questionId}`, {
        areaKey: answer.areaKey,
        questionId: answer.questionId,
        score: answer.score,
      });
    }
  }
  const synergyAlerts = findVerticalSynergies([...latestAnswerByQuestion.values()]);

  // Generated on demand, from the report page (generateNarrativeAction in
  // app/actions.ts) — reading it here is free; it never calls Gemini live.
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
      <div className="mx-auto max-w-6xl space-y-6">
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
            {contractedVerticals.map((v) => (
              <Link
                key={v.key}
                href={`/empresas/${id}/modulo/${v.key}`}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <TrendingUpIcon className="w-4 h-4" />
                Módulo {v.name}
              </Link>
            ))}
            <Link
              href={`/portal/${id}`}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <SparklesIcon className="w-4 h-4" />
              Portal do Cliente
            </Link>
            <Link
              href="/diagnostico/novo"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              + Novo diagnóstico
            </Link>
          </div>
        </Card>

        {session?.role !== "cliente" && (
          <Card>
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="font-semibold text-slate-900">Onboarding</h2>
              <Badge
                text={`${onboardingDone}/${onboardingItems.length}`}
                tone={onboardingDone === onboardingItems.length ? "good" : "warning"}
              />
            </div>
            <ul className="space-y-1.5 mb-4">
              {onboardingItems.map((item) => (
                <li key={item.key} className="flex items-center gap-2 text-sm">
                  <span className={item.done ? "text-green-600" : "text-slate-300"}>
                    {item.done ? "✓" : "○"}
                  </span>
                  <span className={item.done ? "text-slate-700" : "text-slate-400"}>{item.label}</span>
                </li>
              ))}
            </ul>
            <form action={updateOnboardingResponsible.bind(null, id)} className="flex flex-col sm:flex-row gap-2">
              <input
                name="onboardingResponsible"
                defaultValue={company.onboardingResponsible}
                placeholder="Responsável Arca por essa empresa"
                maxLength={120}
                className="flex-1 rounded-md border border-slate-300 px-2.5 py-2 text-sm"
              />
              <SubmitButton
                pendingText="Salvando..."
                className="rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold px-4 py-2 hover:bg-slate-100 transition-colors"
              >
                Salvar
              </SubmitButton>
            </form>
          </Card>
        )}

        {(error && PAGE_ERROR_MESSAGE[error] || sucesso && PAGE_SUCCESS_MESSAGE[sucesso]) && (
          <p
            className={
              error
                ? "text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
                : "text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2"
            }
          >
            {error ? PAGE_ERROR_MESSAGE[error] : PAGE_SUCCESS_MESSAGE[sucesso!]}
          </p>
        )}

        {session?.role !== "cliente" && (
          <Card>
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="font-semibold text-slate-900">Integração com a Omie</h2>
              <Badge text={omieConnection ? "Conectado" : "Não conectado"} tone={omieConnection ? "good" : "neutral"} />
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Traz contas a pagar/receber da Omie e alimenta os indicadores &quot;Inadimplência&quot; e
              &quot;Endividamento&quot; do Cockpit de Performance automaticamente, sem digitação manual.
            </p>
            {omieConnection ? (
              <div className="flex flex-wrap items-center gap-2">
                <form action={syncOmieFinancials.bind(null, id)}>
                  <SubmitButton
                    pendingText="Sincronizando..."
                    className="rounded-lg bg-blue-700 text-white text-sm font-semibold px-4 py-2 hover:bg-blue-800 transition-colors"
                  >
                    Sincronizar agora
                  </SubmitButton>
                </form>
                <form action={disconnectOmie.bind(null, id)}>
                  <ConfirmButton
                    confirmText="Desconectar a Omie desta empresa? A sincronização automática para de funcionar."
                    pendingText="Desconectando..."
                    className="rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold px-4 py-2 hover:bg-slate-100 transition-colors"
                  >
                    Desconectar
                  </ConfirmButton>
                </form>
              </div>
            ) : (
              <form action={saveOmieCredentials.bind(null, id)} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  name="omieAppKey"
                  placeholder="App Key"
                  required
                  className="rounded-md border border-slate-300 px-2.5 py-2 text-sm"
                />
                <input
                  name="omieAppSecret"
                  placeholder="App Secret"
                  required
                  type="password"
                  className="rounded-md border border-slate-300 px-2.5 py-2 text-sm"
                />
                <SubmitButton
                  pendingText="Conectando..."
                  className="rounded-lg bg-blue-700 text-white text-sm font-semibold px-4 py-2 hover:bg-blue-800 transition-colors sm:col-span-2 self-start"
                >
                  Conectar à Omie
                </SubmitButton>
              </form>
            )}
          </Card>
        )}

        {session?.role !== "cliente" && (
          <Card>
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="flex items-center gap-1.5 font-semibold text-slate-900">
                <HandshakeIcon className="w-4 h-4 text-slate-400" />
                Parceiros indicados
              </h2>
              <Link href="/parceiros" className="text-xs text-blue-700 hover:underline">
                Ver todos os parceiros →
              </Link>
            </div>
            {allPartners.length === 0 ? (
              <p className="text-xs text-slate-400">
                Nenhum parceiro cadastrado ainda —{" "}
                <Link href="/parceiros" className="text-blue-700 hover:underline">
                  cadastre um
                </Link>{" "}
                pra poder indicar.
              </p>
            ) : (
              <form
                action={createPartnerReferral.bind(null, id)}
                className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 mb-4"
              >
                <select name="partnerId" required className="rounded-md border border-slate-300 px-2.5 py-2 text-sm bg-white">
                  <option value="">Selecionar parceiro...</option>
                  {allPartners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.category})
                    </option>
                  ))}
                </select>
                <input
                  name="notes"
                  placeholder="Observação (opcional)"
                  className="rounded-md border border-slate-300 px-2.5 py-2 text-sm"
                />
                <SubmitButton
                  pendingText="Indicando..."
                  className="rounded-lg bg-blue-700 text-white text-sm font-semibold px-4 py-2 hover:bg-blue-800 transition-colors"
                >
                  Indicar
                </SubmitButton>
              </form>
            )}
            {company.partnerReferrals.length === 0 ? (
              <p className="text-xs text-slate-400">Nenhum parceiro indicado pra essa empresa ainda.</p>
            ) : (
              <div className="space-y-2">
                {company.partnerReferrals.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">
                        {r.partner.name} <span className="text-xs text-slate-400">({r.partner.category})</span>
                      </p>
                      {r.notes && <p className="text-xs text-slate-500">{r.notes}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge text={REFERRAL_STATUS_LABEL[r.status]} tone={REFERRAL_STATUS_TONE[r.status]} />
                      <form action={updatePartnerReferralStatus.bind(null, id, r.id)} className="flex items-center gap-1">
                        <select
                          name="status"
                          defaultValue={r.status}
                          aria-label={`Status da indicação de ${r.partner.name}`}
                          className="rounded-md border border-slate-300 px-1.5 py-1 text-xs bg-white"
                        >
                          {PARTNER_REFERRAL_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {REFERRAL_STATUS_LABEL[status]}
                            </option>
                          ))}
                        </select>
                        <SubmitButton
                          pendingText="..."
                          className="rounded-md border border-slate-300 text-xs font-semibold px-2 py-1 hover:bg-slate-100 transition-colors"
                        >
                          Salvar
                        </SubmitButton>
                      </form>
                      <form action={deletePartnerReferral.bind(null, id, r.id)}>
                        <SubmitButton
                          pendingText="..."
                          className="text-xs text-red-600 hover:underline disabled:no-underline"
                        >
                          Remover
                        </SubmitButton>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {session?.role !== "cliente" && (
          <Card>
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="font-semibold text-slate-900">Verticais contratadas</h2>
              <Badge text={`${contractedVerticals.length}/${VERTICALS.length}`} tone="managed" />
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Cada vertical marcada vira um módulo independente (Arca Checkup) pra essa empresa —
              diagnóstico, Data Room e relatório próprios, sem exigir as demais.
            </p>
            <form action={updateContractedVerticals.bind(null, id)} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {VERTICALS.map((v) => (
                  <label key={v.key} className="flex items-start gap-2 text-sm rounded-lg border border-slate-200 px-3 py-2">
                    <input
                      type="checkbox"
                      name="verticals"
                      value={v.key}
                      defaultChecked={contractedVerticalKeys.includes(v.key)}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block font-medium text-slate-800">{v.name}</span>
                      <span className="block text-xs text-slate-500">{v.description}</span>
                    </span>
                  </label>
                ))}
              </div>
              <SubmitButton
                pendingText="Salvando..."
                className="rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold px-4 py-2 hover:bg-slate-100 transition-colors"
              >
                Salvar verticais contratadas
              </SubmitButton>
            </form>
          </Card>
        )}

        {session?.role !== "cliente" && synergyAlerts.length > 0 && (
          <Card className="border-blue-200 bg-blue-50/50">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-blue-700 uppercase tracking-wide mb-1">
              <SparklesIcon className="w-4 h-4" />
              Agente de Sinergia entre Verticais
            </p>
            <p className="text-xs text-slate-500 mb-3">
              Cruza perguntas fracas de verticais diferentes que descrevem o mesmo problema por dois
              ângulos — cada módulo sozinho não veria a conexão.
            </p>
            <div className="space-y-3">
              {synergyAlerts.map((alert) => (
                <div key={alert.key} className="rounded-lg border border-blue-100 bg-white p-3">
                  <p className="text-sm font-semibold text-slate-900 mb-1">{alert.title}</p>
                  <p className="text-sm text-slate-700 mb-2">{alert.insight}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    {alert.findings.map((f, i) => (
                      <span key={i}>
                        <span className="font-medium text-slate-600">{f.areaName}:</span> {f.questionText} (nota{" "}
                        {f.score})
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

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
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
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
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition-colors"
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
                      Nota geral: {report.overallAverage.toFixed(1)}/5 · Nível {report.maturityLevel} ·{" "}
                      {report.maturityLabel}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
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

        {session?.role === "admin" && (
          <Card>
            <h2 className="text-xl font-bold text-red-800 mb-2">Zona de perigo</h2>
            <p className="text-sm text-slate-600 mb-4">
              Exclui <strong>{company.name}</strong> e todos os dados vinculados de uma vez:
              diagnósticos (respostas, plano de ação, sprints, épicos), Data Room (documentos e
              blobs), atas, indicadores e webhooks. Esta ação não pode ser desfeita.
            </p>
            <form action={deleteCompany.bind(null, id)}>
              <ConfirmButton
                confirmText={`Excluir ${company.name} e todos os dados vinculados? Esta ação não pode ser desfeita.`}
                pendingText="Excluindo..."
                className="rounded-lg bg-red-700 text-white text-sm font-semibold px-4 py-2 hover:bg-red-800 transition-colors"
              >
                Excluir empresa
              </ConfirmButton>
            </form>
          </Card>
        )}
      </div>
    </main>
  );
}
