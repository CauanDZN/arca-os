import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { VERTICALS } from "@/lib/verticals";
import { getSession } from "@/lib/auth";
import { assertCompanyAccess, getConsultorVerticalScope, isCompanyInConsultorScope } from "@/lib/access";
import { createProposal, activatePendingContracts, discardPendingContracts } from "@/app/actions-proposal";
import { Card } from "@/app/components/Card";
import { Badge } from "@/app/components/Badge";
import { SubmitButton } from "@/app/components/SubmitButton";
import { ConfirmButton } from "@/app/components/ConfirmButton";
import { ProposalRows } from "@/app/components/ProposalRows";
import { TrendingUpIcon } from "@/app/components/icons";

const CONTRACT_TYPE_LABEL: Record<string, string> = {
  setup: "Setup Inicial",
  mrr: "Mensalidade (MRR)",
  performance_fee: "Performance Fee",
  projeto_avulso: "Projeto Avulso",
};

const ERROR_MESSAGE: Record<string, string> = {
  vazia: "Selecione ao menos uma vertical pra montar a proposta.",
  "proposta-invalida":
    "Confira os valores — Setup/MRR/Projeto Avulso exigem valor em R$, Performance Fee exige o percentual.",
};

const SUCCESS_MESSAGE: Record<string, string> = {
  "proposta-criada": "Proposta salva como pendente — aprove abaixo pra ativar os contratos.",
};

export default async function PropostaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; sucesso?: string }>;
}) {
  const { id } = await params;
  const { error, sucesso } = await searchParams;
  const session = await getSession();
  if (session?.role === "cliente") notFound();
  assertCompanyAccess(session, id);

  const company = await prisma.company.findUnique({
    where: { id },
    include: { contracts: { where: { status: "pendente" }, orderBy: { createdAt: "desc" } } },
  });
  if (!company) notFound();
  if (!isCompanyInConsultorScope(session, JSON.parse(company.contractedVerticals || "[]"))) notFound();

  const scope = getConsultorVerticalScope(session);
  const availableVerticals = scope ? VERTICALS.filter((v) => scope.includes(v.key)) : VERTICALS;

  return (
    <main className="flex-1 bg-slate-50 py-10 px-4">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <Link href={`/empresas/${id}`} className="text-sm text-slate-500 hover:text-slate-800">
            ← Voltar para {company.name}
          </Link>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-blue-700 uppercase tracking-wide mt-2 mb-1">
            <TrendingUpIcon className="w-4 h-4" />
            Catálogo Comercial Arca · Proposta modular
          </p>
          <h1 className="text-2xl font-bold text-slate-900">{company.name}</h1>
        </div>

        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {ERROR_MESSAGE[error] ?? "Algo deu errado."}
          </p>
        )}
        {sucesso && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            {SUCCESS_MESSAGE[sucesso] ?? "Feito."}
          </p>
        )}

        <Card>
          <h2 className="font-semibold text-slate-900 mb-1">Montar proposta</h2>
          <p className="text-xs text-slate-500 mb-4">
            Marque as verticais propostas pra esta empresa, o tipo de contrato de cada uma (Setup,
            MRR, Performance Fee ou Projeto Avulso) e o valor. Os contratos entram como{" "}
            <strong>pendentes</strong> — nada vira ativo nem libera o módulo até você aprovar a
            proposta abaixo.
          </p>
          {availableVerticals.length === 0 ? (
            <p className="text-xs text-slate-400">
              Nenhuma vertical no seu escopo de consultor — fale com um administrador.
            </p>
          ) : (
            <form action={createProposal.bind(null, id)} className="space-y-4">
              <ProposalRows verticals={availableVerticals} />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block">
                  <span className="block text-xs font-medium text-slate-600 mb-1">
                    Início (todos os contratos)
                  </span>
                  <input
                    type="date"
                    name="startDate"
                    required
                    className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="block text-xs font-medium text-slate-600 mb-1">Fim (opcional)</span>
                  <input type="date" name="endDate" className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm" />
                </label>
                <label className="block">
                  <span className="block text-xs font-medium text-slate-600 mb-1">Observações (opcional)</span>
                  <input type="text" name="notes" className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm" />
                </label>
              </div>
              <SubmitButton
                pendingText="Salvando proposta..."
                className="rounded-lg bg-blue-700 text-white text-sm font-semibold px-4 py-2 hover:bg-blue-800 transition-colors"
              >
                Salvar proposta (pendente)
              </SubmitButton>
            </form>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-semibold text-slate-900">Proposta em aberto</h2>
            <Badge
              text={`${company.contracts.length} pendente${company.contracts.length === 1 ? "" : "s"}`}
              tone={company.contracts.length > 0 ? "warning" : "neutral"}
            />
          </div>
          {company.contracts.length === 0 ? (
            <p className="text-xs text-slate-400">Nenhum contrato pendente — monte uma proposta acima.</p>
          ) : (
            <>
              <ul className="space-y-1.5 mb-4">
                {company.contracts.map((c) => {
                  const vertical = c.verticalKey ? VERTICALS.find((v) => v.key === c.verticalKey) : null;
                  return (
                    <li
                      key={c.id}
                      className="text-sm text-slate-700 flex items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2"
                    >
                      <span>
                        {CONTRACT_TYPE_LABEL[c.type]}
                        {vertical && <span className="text-slate-400"> · {vertical.name}</span>}
                      </span>
                      <span className="text-xs text-slate-500">
                        {c.type === "performance_fee"
                          ? `${c.feePercent}%`
                          : `R$ ${c.value?.toLocaleString("pt-BR")}${c.type === "mrr" ? "/mês" : ""}`}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="flex items-center gap-2 flex-wrap">
                <form action={activatePendingContracts.bind(null, id)}>
                  <SubmitButton
                    pendingText="Ativando..."
                    className="rounded-lg bg-green-700 text-white text-sm font-semibold px-4 py-2 hover:bg-green-800 transition-colors"
                  >
                    Aprovar proposta → ativar contratos
                  </SubmitButton>
                </form>
                <form action={discardPendingContracts.bind(null, id)}>
                  <ConfirmButton
                    confirmText="Descartar a proposta pendente inteira? Essa ação não pode ser desfeita."
                    pendingText="Descartando..."
                    className="rounded-lg border border-red-200 text-red-700 text-sm font-semibold px-4 py-2 hover:bg-red-50 transition-colors"
                  >
                    Descartar proposta
                  </ConfirmButton>
                </form>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Aprovar ativa todos os contratos pendentes e adiciona as verticais propostas às{" "}
                <Link href={`/empresas/${id}`} className="text-blue-700 hover:underline">
                  verticais contratadas
                </Link>{" "}
                da empresa, liberando o módulo (diagnóstico, Data Room e agentes próprios).
              </p>
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
