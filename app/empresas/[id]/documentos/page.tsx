import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AREAS } from "@/lib/areas";
import { uploadDocument, deleteDocument } from "@/app/actions-documents";
import { generateWebhookToken, revokeWebhookToken, deleteWebhookEvent } from "@/app/actions-webhooks";
import { Card } from "@/app/components/Card";
import { Badge } from "@/app/components/Badge";
import { SubmitButton } from "@/app/components/SubmitButton";
import { WebhookUrlBox } from "@/app/components/WebhookUrlBox";
import { DocumentIcon, EmptyBoxIcon, PlugIcon } from "@/app/components/icons";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function DocumentosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      documents: { orderBy: { createdAt: "desc" } },
      webhookEvents: { orderBy: { receivedAt: "desc" }, take: 20 },
    },
  });
  if (!company) notFound();

  const categories = [{ key: "geral", name: "Geral" }, ...AREAS.map((a) => ({ key: a.key, name: a.name }))];
  const uploadAction = uploadDocument.bind(null, id);

  const grouped = new Map<string, typeof company.documents>();
  for (const doc of company.documents) {
    grouped.set(doc.category, [...(grouped.get(doc.category) ?? []), doc]);
  }

  return (
    <main className="flex-1 bg-slate-50 py-10 px-4">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href={`/empresas/${id}`} className="text-sm text-slate-500 hover:text-slate-800">
          ← Voltar para {company.name}
        </Link>

        <Card>
          <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide mb-1">Data Room</p>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">{company.name}</h1>
          <p className="text-slate-600 mb-6">
            Envie extratos, DRE, contratos, planilhas e outros documentos organizados por área.
            Eles alimentam a análise consultiva e servem de evidência do diagnóstico.
          </p>

          <form action={uploadAction} className="flex flex-col sm:flex-row gap-3 items-start sm:items-end border border-slate-200 rounded-xl p-4 bg-slate-50">
            <label className="block flex-1 w-full">
              <span className="block text-xs font-medium text-slate-600 mb-1">Categoria</span>
              <select name="category" className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm">
                {categories.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
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
        </Card>

        <Card>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-blue-700 uppercase tracking-wide mb-1">
            <PlugIcon className="w-4 h-4" />
            Webhook
          </p>
          <p className="text-slate-600 mb-4">
            Em vez de uma integração fechada com um ERP ou CRM específico, aponte o webhook do seu
            sistema pra essa URL — qualquer evento recebido fica registrado aqui, pra consulta ou
            leitura futura pelos agentes de IA.
          </p>

          {company.webhookToken ? (
            <div className="space-y-3">
              <WebhookUrlBox path={`/api/webhooks/${id}?token=${company.webhookToken}`} />
              <form action={revokeWebhookToken.bind(null, id)}>
                <SubmitButton
                  pendingText="Revogando..."
                  className="text-xs text-red-600 hover:underline disabled:no-underline"
                >
                  Revogar URL
                </SubmitButton>
              </form>
            </div>
          ) : (
            <form action={generateWebhookToken.bind(null, id)}>
              <SubmitButton
                pendingText="Gerando..."
                className="rounded-lg bg-blue-700 text-white text-sm font-semibold px-4 py-2 hover:bg-blue-800 transition-colors"
              >
                Gerar URL de webhook
              </SubmitButton>
            </form>
          )}

          {company.webhookEvents.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Últimos eventos recebidos
              </p>
              {company.webhookEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">
                      {new Date(event.receivedAt).toLocaleString("pt-BR")}
                      {event.source && ` · ${event.source}`}
                    </p>
                    <p className="text-xs font-mono text-slate-700 truncate">{event.payload}</p>
                  </div>
                  <form action={deleteWebhookEvent.bind(null, id, event.id)} className="shrink-0">
                    <SubmitButton
                      pendingText="Removendo..."
                      className="text-xs text-red-600 hover:underline disabled:no-underline"
                    >
                      Remover
                    </SubmitButton>
                  </form>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-4">
          {categories
            .filter((c) => grouped.has(c.key))
            .map((c) => (
              <Card key={c.key} className="p-6">
                <h2 className="font-semibold text-slate-900 mb-3">{c.name}</h2>
                <ul className="space-y-2">
                  {grouped.get(c.key)!.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:border-slate-300 transition-colors"
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
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {doc.aiSuggestedCategory && (
                          <Badge
                            text={`IA: ${doc.aiSuggestedCategory} · confiança ${doc.aiConfidence}`}
                            tone={doc.aiConfidence === "alta" ? "good" : "neutral"}
                          />
                        )}
                        <form action={deleteDocument.bind(null, id, doc.id)}>
                          <SubmitButton
                            pendingText="Removendo..."
                            className="text-xs text-red-600 hover:underline whitespace-nowrap disabled:no-underline"
                          >
                            Remover
                          </SubmitButton>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          {company.documents.length === 0 && (
            <Card className="flex flex-col items-center gap-2 text-center py-12">
              <EmptyBoxIcon className="w-10 h-10 text-slate-300" />
              <p className="text-sm text-slate-500">Nenhum documento enviado ainda.</p>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
