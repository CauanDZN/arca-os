import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { createPartner, updatePartnerHomologation, updatePartnerNps, deletePartner } from "@/app/actions-partners";
import { PARTNER_TYPES, PARTNER_HOMOLOGATION_STATUSES, PARTNER_REVENUE_MODELS } from "@/lib/validation";
import { averageClientSatisfaction, averageNps, repeatPartnerRate, slaComplianceRate } from "@/lib/partners";
import { Card } from "@/app/components/Card";
import { Badge } from "@/app/components/Badge";
import { ConfirmButton } from "@/app/components/ConfirmButton";
import { SubmitButton } from "@/app/components/SubmitButton";
import { HandshakeIcon, EmptyBoxIcon } from "@/app/components/icons";
import type { BadgeTone } from "@/lib/badge-tones";

const TYPE_LABEL: Record<string, string> = {
  operacional: "Operacional",
  estrategica: "Estratégica",
  comercial: "Comercial",
};

const TYPE_DESCRIPTION: Record<string, string> = {
  operacional: "Execução técnica sob supervisão Arca — jurídico, engenharia, assessoria ambiental, facilities.",
  estrategica: "Somar expertise pra escalar — SaaS, instituições financeiras, fintechs, escolas corporativas.",
  comercial: "Conectar pra crescer juntos — representantes, franquias regionais, associações empresariais.",
};

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  homologado: "Homologado",
  suspenso: "Suspenso",
};

const STATUS_TONE: Record<string, BadgeTone> = {
  pendente: "warning",
  homologado: "good",
  suspenso: "critical",
};

// Os 5 modelos de receita de parceria do plano estratégico (p. 19).
const REVENUE_MODEL_LABEL: Record<string, string> = {
  comissionamento: "Comissionamento (%)",
  coparticipacao: "Coparticipação (Split)",
  fee_curadoria: "Fee de Curadoria",
  revenue_share: "Revenue Share",
  white_label: "White Label",
};

const ERROR_MESSAGE: Record<string, string> = {
  validacao: "Dados inválidos — confira os campos obrigatórios e as faixas numéricas (NPS: -100 a 100).",
};

const SUCCESS_MESSAGE: Record<string, string> = {
  criado: "Parceiro cadastrado com sucesso.",
};

export default async function ParceirosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sucesso?: string }>;
}) {
  const session = await getSession();
  if (!session || session.role === "cliente") redirect("/");

  const { error, sucesso } = await searchParams;

  const partners = await prisma.partner.findMany({
    orderBy: { createdAt: "asc" },
    include: { referrals: true },
  });

  // KPIs da Vertical Parceira (plano, p. 16): +50 parceiros homologados
  // ativos, ≥90% satisfação, ≤48h SLA, 15% receita indireta, ≥70% recompra,
  // ≥85 NPS. Receita indireta é soma direta; os outros vêm de lib/partners.ts.
  const homologatedCount = partners.filter((p) => p.homologationStatus === "homologado").length;
  const allReferrals = partners.flatMap((p) => p.referrals.map((r) => ({ ...r, partner: p })));
  const indirectRevenue = allReferrals.reduce((sum, r) => sum + (r.commissionValue ?? 0), 0);
  const satisfaction = averageClientSatisfaction(allReferrals);
  const nps = averageNps(partners);
  const repeatRate = repeatPartnerRate(allReferrals);
  const slaRate = slaComplianceRate(allReferrals);

  return (
    <main className="flex-1 bg-slate-50 py-10 px-4">
      <div className="mx-auto max-w-6xl space-y-6">
        <Card>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-blue-700 uppercase tracking-wide mb-1">
            <HandshakeIcon className="w-4 h-4" />
            Vertical Parceira
          </p>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Parceiros</h1>
          <p className="text-slate-600">
            Ecossistema de parceiros homologados da Arca (plano estratégico, vertical Parceira) —
            parcerias operacionais, estratégicas e comerciais. Indicar um parceiro pra uma empresa
            cliente específica é feito na página da própria empresa.
          </p>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-4">
            KPIs da Vertical Parceira (2026)
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <p className="text-2xl font-bold text-slate-900">{homologatedCount}</p>
              <p className="text-xs text-slate-500">Parceiros homologados ativos</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {satisfaction != null ? `${satisfaction}%` : "—"}
              </p>
              <p className="text-xs text-slate-500">Satisfação com parceiros</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{slaRate != null ? `${slaRate}%` : "—"}</p>
              <p className="text-xs text-slate-500">SLA cumprido</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {indirectRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
              <p className="text-xs text-slate-500">Receita indireta apurada</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{repeatRate != null ? `${repeatRate}%` : "—"}</p>
              <p className="text-xs text-slate-500">Taxa de recompra</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{nps ?? "—"}</p>
              <p className="text-xs text-slate-500">NPS Arca Partner</p>
            </div>
          </div>
        </Card>

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
          <h2 className="text-xl font-bold text-slate-900 mb-4">Novo parceiro</h2>
          <form action={createPartner} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Nome</span>
              <input
                type="text"
                name="name"
                required
                className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Categoria</span>
              <input
                type="text"
                name="category"
                placeholder="Ex.: Jurídico, Engenharia, SaaS, Fintech"
                required
                className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Tipo de parceria</span>
              <select
                name="type"
                defaultValue="operacional"
                className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm bg-white"
              >
                {PARTNER_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {TYPE_LABEL[type]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">SLA de atendimento (horas, opcional)</span>
              <input
                type="number"
                name="slaHours"
                min={0}
                max={720}
                placeholder="Ex.: 48"
                className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Modelo de receita</span>
              <select
                name="revenueModel"
                defaultValue="comissionamento"
                className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm bg-white"
              >
                {PARTNER_REVENUE_MODELS.map((model) => (
                  <option key={model} value={model}>
                    {REVENUE_MODEL_LABEL[model]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Contato (opcional)</span>
              <input
                type="text"
                name="contactInfo"
                placeholder="E-mail, telefone ou responsável"
                className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">
                Fee de Curadoria (R$) — só esse modelo
              </span>
              <input
                type="number"
                name="curationFeeValue"
                min={0}
                step="0.01"
                placeholder="Ex.: 5000"
                className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">
                Revenue Share (%) — só esse modelo
              </span>
              <input
                type="number"
                name="revenueSharePercent"
                min={0}
                max={100}
                step="0.1"
                placeholder="Ex.: 8"
                className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
              />
            </label>
            <div className="sm:col-span-2">
              <SubmitButton
                pendingText="Cadastrando..."
                className="rounded-lg bg-blue-700 text-white font-semibold px-4 py-2 text-sm hover:bg-blue-800 transition-colors"
              >
                + Cadastrar parceiro
              </SubmitButton>
            </div>
          </form>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-slate-900 mb-4">
            {partners.length} {partners.length === 1 ? "parceiro" : "parceiros"}
          </h2>
          {partners.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <EmptyBoxIcon className="w-10 h-10 text-slate-300" />
              <p className="text-sm text-slate-500">Nenhum parceiro cadastrado ainda.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {partners.map((p) => (
                <div key={p.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{p.name}</p>
                      <p className="text-xs text-slate-500">
                        {p.category} · {TYPE_LABEL[p.type]}
                        {p.slaHours != null && ` · SLA ${p.slaHours}h`} · {REVENUE_MODEL_LABEL[p.revenueModel]}
                        {p.revenueModel === "fee_curadoria" &&
                          p.curationFeeValue != null &&
                          ` (R$ ${p.curationFeeValue.toLocaleString("pt-BR")})`}
                        {p.revenueModel === "revenue_share" &&
                          p.revenueSharePercent != null &&
                          ` (${p.revenueSharePercent}%)`}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{TYPE_DESCRIPTION[p.type]}</p>
                      {p.contactInfo && <p className="text-xs text-slate-400 mt-0.5">{p.contactInfo}</p>}
                      <p className="text-xs text-blue-700 mt-0.5">
                        {p.referrals.length} {p.referrals.length === 1 ? "indicação" : "indicações"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      <Badge text={STATUS_LABEL[p.homologationStatus]} tone={STATUS_TONE[p.homologationStatus]} />
                      <form action={updatePartnerHomologation.bind(null, p.id)} className="flex items-center gap-1.5">
                        <select
                          name="homologationStatus"
                          defaultValue={p.homologationStatus}
                          aria-label={`Status de homologação de ${p.name}`}
                          className="rounded-md border border-slate-300 px-1.5 py-1 text-xs bg-white"
                        >
                          {PARTNER_HOMOLOGATION_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {STATUS_LABEL[status]}
                            </option>
                          ))}
                        </select>
                        <SubmitButton
                          pendingText="Salvando..."
                          className="rounded-md border border-slate-300 text-xs font-semibold px-2 py-1 hover:bg-slate-100 transition-colors"
                        >
                          Salvar
                        </SubmitButton>
                      </form>
                      {session.role === "admin" && (
                        <form action={deletePartner.bind(null, p.id)}>
                          <ConfirmButton
                            confirmText={`Excluir ${p.name}? As indicações vinculadas também são removidas.`}
                            pendingText="Excluindo..."
                            className="rounded-md border border-red-200 text-red-700 text-xs font-semibold px-2 py-1 hover:bg-red-50 transition-colors"
                          >
                            Excluir
                          </ConfirmButton>
                        </form>
                      )}
                    </div>
                  </div>
                  <form
                    action={updatePartnerNps.bind(null, p.id)}
                    className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100"
                  >
                    <span className="text-[11px] text-slate-400">NPS Arca Partner:</span>
                    <input
                      type="number"
                      name="npsScore"
                      min={-100}
                      max={100}
                      step="1"
                      placeholder="-100 a 100"
                      defaultValue={p.npsScore ?? ""}
                      aria-label={`NPS de ${p.name}`}
                      className="w-24 rounded-md border border-slate-300 px-1.5 py-1 text-xs"
                    />
                    <SubmitButton pendingText="..." className="rounded-md border border-slate-300 text-xs font-semibold px-2 py-1 hover:bg-slate-100 transition-colors">
                      Salvar
                    </SubmitButton>
                  </form>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
