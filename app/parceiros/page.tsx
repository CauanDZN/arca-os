import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { createPartner, updatePartnerHomologation, deletePartner } from "@/app/actions-partners";
import { PARTNER_TYPES, PARTNER_HOMOLOGATION_STATUSES } from "@/lib/validation";
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

const ERROR_MESSAGE: Record<string, string> = {
  validacao: "Dados inválidos — confira nome, tipo e categoria.",
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
            <label className="block sm:col-span-2">
              <span className="block text-xs font-medium text-slate-600 mb-1">Contato (opcional)</span>
              <input
                type="text"
                name="contactInfo"
                placeholder="E-mail, telefone ou responsável"
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
                <div
                  key={p.id}
                  className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 rounded-lg border border-slate-200 p-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500">
                      {p.category} · {TYPE_LABEL[p.type]}
                      {p.slaHours != null && ` · SLA ${p.slaHours}h`}
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
              ))}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
