import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getVerticalByKey, VERTICALS } from "@/lib/verticals";
import { getAreaByKey } from "@/lib/areas";
import { buildVerticalReport } from "@/lib/vertical-diagnostic";
import { statusTone } from "@/lib/badge-tones";
import { getSession } from "@/lib/auth";
import { assertCompanyAccess, assertVerticalAccess } from "@/lib/access";
import { startVerticalDiagnostic } from "@/app/actions-module";
import { uploadDocument, deleteDocument } from "@/app/actions-documents";
import { Card } from "@/app/components/Card";
import { Badge } from "@/app/components/Badge";
import { SubmitButton } from "@/app/components/SubmitButton";
import { TrendingUpIcon, FolderIcon, SparklesIcon, DocumentIcon, EmptyBoxIcon } from "@/app/components/icons";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function ModuloVerticalPage({
  params,
}: {
  params: Promise<{ id: string; verticalKey: string }>;
}) {
  const { id, verticalKey } = await params;
  const session = await getSession();
  assertCompanyAccess(session, id);
  assertVerticalAccess(session, verticalKey);

  const vertical = getVerticalByKey(verticalKey);
  if (!vertical) notFound();

  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      diagnostics: {
        where: { scope: verticalKey },
        orderBy: { createdAt: "desc" },
        include: { answers: true, tasks: true },
      },
      documents: {
        where: { category: { in: vertical.areaKeys } },
        orderBy: { createdAt: "desc" },
        include: { transactions: true },
      },
    },
  });
  if (!company) notFound();

  const inProgress = company.diagnostics.find((d) => d.status === "em_andamento");
  const latestCompleted = company.diagnostics.find((d) => d.status !== "em_andamento");
  const startAction = startVerticalDiagnostic.bind(null, id, verticalKey);
  const uploadAction = uploadDocument.bind(null, id);
  const hasFinanceiro = vertical.areaKeys.includes("financeiro");

  return (
    <main className="flex-1 bg-slate-50 py-10 px-4">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href={`/empresas/${id}`} className="text-sm text-slate-500 hover:text-slate-800">
          ← Voltar para {company.name}
        </Link>

        <Card>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-blue-700 uppercase tracking-wide mb-1">
            <TrendingUpIcon className="w-4 h-4" />
            Arca Checkup · Módulo comercializado isoladamente
          </p>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">
            Módulo {vertical.name} — {company.name}
          </h1>
          <p className="text-slate-600 mb-4">
            {vertical.description} Diagnóstico, Data Room, agentes e relatório próprios desta
            vertical, sem depender das outras contratadas ou não pela empresa.
          </p>
          {inProgress ? (
            <Link
              href={`/diagnostico/${inProgress.id}/questionario/${vertical.areaKeys[0]}`}
              className="inline-block rounded-lg bg-blue-700 text-white text-sm font-semibold px-4 py-2 hover:bg-blue-800 transition-colors"
            >
              Continuar diagnóstico em andamento →
            </Link>
          ) : (
            <form action={startAction}>
              <SubmitButton
                pendingText="Iniciando..."
                className="rounded-lg bg-blue-700 text-white text-sm font-semibold px-4 py-2 hover:bg-blue-800 transition-colors"
              >
                Iniciar novo Diagnóstico {vertical.name} (Arca Checkup) →
              </SubmitButton>
            </form>
          )}
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Diagnósticos — {vertical.name}</h2>
          {company.diagnostics.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <EmptyBoxIcon className="w-10 h-10 text-slate-300" />
              <p className="text-sm text-slate-500">Nenhum diagnóstico desta vertical realizado ainda.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {company.diagnostics.map((diagnostic) => {
                const report = buildVerticalReport(
                  vertical,
                  diagnostic.answers.map((a) => ({
                    areaKey: a.areaKey,
                    questionId: a.questionId,
                    score: a.score,
                  }))
                );
                return (
                  <div
                    key={diagnostic.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg border border-slate-200 p-4"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {new Date(diagnostic.createdAt).toLocaleDateString("pt-BR")} ·{" "}
                        {diagnostic.status === "em_andamento" ? "Em andamento" : "Concluído"}
                      </p>
                      {diagnostic.status !== "em_andamento" && (
                        <p className="text-xs text-slate-500">
                          Nota: {report.average.toFixed(1)}/5 · Nível {report.maturityLevel} ·{" "}
                          {report.maturityLabel}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {diagnostic.status !== "em_andamento" && (
                        <Badge text={report.status} tone={statusTone(report.status)} />
                      )}
                      {diagnostic.status === "em_andamento" ? (
                        <Link
                          href={`/diagnostico/${diagnostic.id}/questionario/${vertical.areaKeys[0]}`}
                          className="rounded-lg bg-blue-700 text-white text-sm font-semibold px-3 py-1.5 hover:bg-blue-800 transition-colors"
                        >
                          Continuar
                        </Link>
                      ) : (
                        <>
                          <Link
                            href={`/empresas/${id}/modulo/${verticalKey}/relatorio/${diagnostic.id}`}
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
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-blue-700 uppercase tracking-wide mb-1">
            <FolderIcon className="w-4 h-4" />
            Data Room · {vertical.name}
          </p>
          <p className="text-slate-600 mb-4 text-sm">
            Escopado só a esta vertical — mesmo Data Room da empresa, filtrado pel
            {vertical.areaKeys.length > 1 ? "as categorias" : "a categoria"}{" "}
            {vertical.areaKeys.map((k) => getAreaByKey(k)?.name ?? k).join(", ")}.
          </p>

          <form
            action={uploadAction}
            className="flex flex-col sm:flex-row gap-3 items-start sm:items-end border border-slate-200 rounded-xl p-4 bg-slate-50 mb-4"
          >
            {vertical.areaKeys.length > 1 ? (
              <label className="block w-full sm:w-48">
                <span className="block text-xs font-medium text-slate-600 mb-1">Área</span>
                <select
                  name="category"
                  className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm bg-white"
                >
                  {vertical.areaKeys.map((k) => (
                    <option key={k} value={k}>
                      {getAreaByKey(k)?.name ?? k}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <input type="hidden" name="category" value={vertical.areaKeys[0]} />
            )}
            <label className="block flex-1 w-full">
              <span className="block text-xs font-medium text-slate-600 mb-1">Arquivo</span>
              <input
                type="file"
                name="file"
                required
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white"
              />
            </label>
            <SubmitButton
              pendingText="Enviando e lendo com IA..."
              className="rounded-lg bg-blue-700 text-white font-semibold px-5 py-2 hover:bg-blue-800 transition-colors whitespace-nowrap"
            >
              Enviar
            </SubmitButton>
          </form>

          {company.documents.length === 0 ? (
            <p className="text-xs text-slate-400">Nenhum documento enviado ainda nesta vertical.</p>
          ) : (
            <ul className="space-y-2">
              {company.documents.map((doc) => (
                <li
                  key={doc.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <DocumentIcon className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <a
                        href={`/api/documentos/${doc.id}`}
                        className="font-medium text-blue-700 hover:underline truncate block"
                      >
                        {doc.originalName}
                      </a>
                      <span className="text-xs text-slate-400">
                        {formatSize(doc.size)} · {new Date(doc.createdAt).toLocaleDateString("pt-BR")}
                        {doc.transactions.length > 0 && ` · ${doc.transactions.length} transações extraídas`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {doc.aiSuggestedCategory && (
                      <Badge
                        text={`IA: ${doc.aiSuggestedCategory}`}
                        tone={doc.aiConfidence === "alta" ? "good" : "neutral"}
                      />
                    )}
                    <form action={deleteDocument.bind(null, id, doc.id)}>
                      <SubmitButton
                        pendingText="Removendo..."
                        className="text-xs text-red-600 hover:underline disabled:no-underline"
                      >
                        Remover
                      </SubmitButton>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-blue-700 uppercase tracking-wide mb-3">
            <SparklesIcon className="w-4 h-4" />
            Agentes do módulo
          </p>
          <ul className="space-y-2 text-sm text-slate-700">
            <li>
              <span className="font-medium">Agente de Auditoria de Evidências</span> — sinaliza
              respostas críticas (nota ≤ 2) sem evidência anexada, pra elas não entrarem no plano
              de ação sem nada que sustente a nota.
              {latestCompleted && (
                <>
                  {" "}
                  Ver no{" "}
                  <Link
                    href={`/empresas/${id}/modulo/${verticalKey}/relatorio/${latestCompleted.id}`}
                    className="text-blue-700 hover:underline"
                  >
                    relatório
                  </Link>
                  .
                </>
              )}
            </li>
            {hasFinanceiro && (
              <li>
                <span className="font-medium">Agente de Extração Financeira</span> — lê extratos
                bancários enviados acima (texto ou OCR) e extrai transações, sinalizando possíveis
                despesas pessoais e inconsistências.
              </li>
            )}
            <li>
              <span className="font-medium">Agente de Performance por Área</span> — narrativa de
              tendência sobre os indicadores lançados no{" "}
              <Link href={`/empresas/${id}/indicadores`} className="text-blue-700 hover:underline">
                Cockpit de Performance
              </Link>
              .
            </li>
          </ul>
        </Card>

        <p className="text-xs text-slate-400 text-center">
          {VERTICALS.length} verticais comercializáveis no total — este módulo é uma delas.
        </p>
      </div>
    </main>
  );
}
