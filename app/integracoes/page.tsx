import Link from "next/link";
import { Card } from "@/app/components/Card";
import { Badge } from "@/app/components/Badge";
import { PlugIcon } from "@/app/components/icons";

type Integration = {
  name: string;
  description: string;
  category: string;
};

const INTEGRATIONS: Integration[] = [
  { name: "ERP", description: "Sincronização de financeiro, estoque e faturamento.", category: "Sistemas de gestão" },
  { name: "CRM", description: "Importação de funil comercial, leads e oportunidades.", category: "Comercial" },
  { name: "Bancos / Open Finance", description: "Leitura automática de extratos e conciliação bancária.", category: "Financeiro" },
  { name: "WhatsApp Business", description: "Envio de alertas de plano de ação e coleta de evidências pelo chat.", category: "Comunicação" },
  { name: "Google Drive / OneDrive", description: "Sincronização automática de documentos com o Data Room.", category: "Documentos" },
  { name: "Assinatura Digital", description: "Assinatura de propostas e contratos gerados pela Arca.", category: "Documentos" },
  { name: "Emissão de Notas Fiscais", description: "Leitura de NF-e/NFS-e para alimentar o diagnóstico fiscal.", category: "Fiscal" },
  { name: "BI / Dashboards", description: "Exportação dos indicadores do cockpit para ferramentas de BI externas.", category: "Indicadores" },
];

export default function IntegracoesPage() {
  return (
    <main className="flex-1 bg-slate-50 py-10 px-4">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href="/empresas" className="text-sm text-slate-500 hover:text-slate-800">
          ← Empresas
        </Link>

        <Card>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-blue-700 uppercase tracking-wide mb-1">
            <PlugIcon className="w-4 h-4" />
            ArcaOS
          </p>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Integrações</h1>
          <p className="text-slate-600">
            A visão de longo prazo é a Arca ser uma camada inteligente acima dos sistemas do
            cliente. Esta tela mostra as integrações previstas — nenhuma está conectada nesta
            versão do MVP.
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
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70 transition-colors"
                >
                  <td className="py-3 px-4">
                    <p className="font-medium text-slate-800">{integration.name}</p>
                    <p className="text-xs text-slate-500">{integration.description}</p>
                  </td>
                  <td className="py-3 px-4 text-slate-600">{integration.category}</td>
                  <td className="py-3 px-4">
                    <Badge text="Não conectado" tone="neutral" />
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      disabled
                      title="Em breve"
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-400 cursor-not-allowed"
                    >
                      Conectar
                    </button>
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
