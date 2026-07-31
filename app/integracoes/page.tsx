import Link from "next/link";
import { Card } from "@/app/components/Card";
import { Badge } from "@/app/components/Badge";
import { PlugIcon } from "@/app/components/icons";
import type { BadgeTone } from "@/lib/badge-tones";

type IntegrationStatus = "disponivel" | "workaround" | "indisponivel";

type Integration = {
  name: string;
  description: string;
  category: string;
  status: IntegrationStatus;
  /** Only for "workaround" — the manual path that already works today. */
  workaround?: string;
  /** Overrides the default CTA label for "disponivel"/"workaround" rows. */
  ctaLabel?: string;
};

const STATUS_LABEL: Record<IntegrationStatus, string> = {
  disponivel: "Disponível",
  workaround: "Funciona via Data Room",
  indisponivel: "Não conectado",
};

const STATUS_TONE: Record<IntegrationStatus, BadgeTone> = {
  disponivel: "good",
  workaround: "managed",
  indisponivel: "neutral",
};

const INTEGRATIONS: Integration[] = [
  {
    name: "Webhook — entrada",
    description:
      "URL própria por empresa pra receber eventos de qualquer ERP, CRM ou automação — sem precisar de um conector específico pra cada sistema.",
    category: "Sistemas de gestão",
    status: "disponivel",
    workaround:
      "Gere a URL na página de Data Room da empresa e aponte o webhook do seu ERP/CRM pra ela. Cada evento recebido fica registrado e disponível pra consulta.",
    ctaLabel: "Gerar URL",
  },
  {
    name: "Webhook — saída",
    description:
      "O ArcaOS avisa o seu ERP/CRM quando algo muda por aqui — diagnóstico concluído, plano de ação aprovado, ação do Kanban muda de status.",
    category: "Sistemas de gestão",
    status: "disponivel",
    workaround:
      "Configure a URL do seu sistema na mesma página de Data Room da empresa, na seção \"Enviar eventos\" — dá pra disparar um evento de teste antes de confiar na integração.",
    ctaLabel: "Configurar",
  },
  {
    name: "ERP",
    description: "Sincronização de financeiro, estoque e faturamento.",
    category: "Sistemas de gestão",
    status: "workaround",
    workaround:
      "Sem conector dedicado pra um ERP específico, mas o ERP pode apontar seu webhook de eventos pra URL da empresa (veja \"Webhook\" acima) — ou exporte um relatório em PDF/CSV e envie pelo Data Room, que o Classificador e o Agente de Diagnóstico Vertical já leem.",
  },
  {
    name: "CRM",
    description: "Importação de funil comercial, leads e oportunidades.",
    category: "Comercial",
    status: "workaround",
    workaround:
      "Mesma ideia do ERP: aponte o webhook do CRM pra URL da empresa, ou exporte um relatório de funil/leads em PDF ou CSV e envie pelo Data Room, categoria Comercial.",
  },
  {
    name: "Bancos / Open Finance",
    description: "Leitura automática de extratos e conciliação bancária.",
    category: "Financeiro",
    status: "workaround",
    workaround:
      "Baixe o extrato em PDF/CSV do internet banking e envie pelo Data Room — é o mesmo fluxo que o Agente de Extração de Indicadores já processa hoje.",
  },
  {
    name: "WhatsApp Business",
    description: "Envio de alertas de plano de ação e coleta de evidências pelo chat.",
    category: "Comunicação",
    status: "indisponivel",
  },
  {
    name: "Google Drive / OneDrive",
    description: "Sincronização automática de documentos com o Data Room.",
    category: "Documentos",
    status: "workaround",
    workaround:
      "Baixe do Drive/OneDrive e envie pelo Data Room — sem sincronização automática, mas o conteúdo já é lido pelos agentes assim que chega.",
  },
  {
    name: "Assinatura Digital",
    description: "Assinatura de propostas e contratos gerados pela Arca.",
    category: "Documentos",
    status: "indisponivel",
  },
  {
    name: "Emissão de Notas Fiscais",
    description: "Leitura de NF-e/NFS-e para alimentar o diagnóstico fiscal.",
    category: "Fiscal",
    status: "workaround",
    workaround:
      "Envie o PDF (DANFE) ou o XML da nota pelo Data Room, categoria Fiscal — já é classificado como \"Nota fiscal\" e lido pelo Agente de Diagnóstico Vertical.",
  },
  {
    name: "BI / Dashboards",
    description: "Exportação dos indicadores do cockpit para ferramentas de BI externas.",
    category: "Indicadores",
    status: "disponivel",
  },
];

export default function IntegracoesPage() {
  return (
    <main className="flex-1 bg-slate-50 py-10 px-4">
      <div className="mx-auto max-w-4xl space-y-6">
        <Card>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-blue-700 uppercase tracking-wide mb-1">
            <PlugIcon className="w-4 h-4" />
            ArcaOS
          </p>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Integrações</h1>
          <p className="text-slate-600">
            A visão de longo prazo é a Arca ser uma camada inteligente acima dos sistemas do cliente.
            Nenhuma dessas integrações tem um conector dedicado nesta versão — mas duas coisas já
            funcionam hoje na prática: suba o documento no{" "}
            <Link href="/empresas" className="text-blue-700 hover:underline">
              Data Room
            </Link>{" "}
            e os agentes de classificação, diagnóstico vertical e extração de indicadores já leem o
            conteúdo sem precisar de API nem OAuth; ou aponte o webhook de eventos do seu sistema pra
            uma URL própria da empresa, sem depender de um conector específico pra cada ERP/CRM do
            mercado.
          </p>
        </Card>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200 bg-slate-50">
                <th className="py-3 px-4">Integração</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {INTEGRATIONS.map((integration) => (
                <tr
                  key={integration.name}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70 transition-colors align-top"
                >
                  <td className="py-3 px-4">
                    <p className="font-medium text-slate-800">{integration.name}</p>
                    <p className="text-xs text-slate-500">{integration.description}</p>
                    {integration.workaround && (
                      <p className="text-xs text-blue-700 mt-1">{integration.workaround}</p>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-600">{integration.category}</td>
                  <td className="py-3 px-4">
                    <Badge text={STATUS_LABEL[integration.status]} tone={STATUS_TONE[integration.status]} />
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    {integration.status === "disponivel" ? (
                      <Link
                        href="/empresas"
                        className="rounded-lg bg-blue-700 text-white px-3 py-1.5 text-xs font-semibold hover:bg-blue-800 transition-colors"
                      >
                        {integration.ctaLabel ?? "Ver exportação"}
                      </Link>
                    ) : integration.status === "workaround" ? (
                      <Link
                        href="/empresas"
                        className="rounded-lg border border-blue-300 text-blue-700 px-3 py-1.5 text-xs font-semibold hover:bg-blue-50 transition-colors"
                      >
                        {integration.ctaLabel ?? "Ir pro Data Room"}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled
                        title="Em breve"
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-400 cursor-not-allowed"
                      >
                        Conectar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
