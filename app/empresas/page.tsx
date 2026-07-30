import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function EmpresasPage() {
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    include: { diagnostics: true, documents: true },
  });

  return (
    <main className="flex-1 bg-slate-50 py-10 px-4">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-700 uppercase mb-1">
              Cockpit ArcaOS
            </p>
            <h1 className="text-2xl font-bold text-slate-900">Empresas</h1>
          </div>
          <Link
            href="/diagnostico/novo"
            className="rounded-lg bg-blue-700 text-white font-semibold px-4 py-2 text-sm hover:bg-blue-800 transition-colors"
          >
            + Novo diagnóstico
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {companies.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-10">
              Nenhuma empresa cadastrada ainda.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200 bg-slate-50">
                  <th className="py-3 px-4">Empresa</th>
                  <th className="py-3 px-4">Segmento</th>
                  <th className="py-3 px-4">Diagnósticos</th>
                  <th className="py-3 px-4">Documentos</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 px-4 font-medium text-slate-800">{c.name}</td>
                    <td className="py-3 px-4 text-slate-600">{c.segment || "—"}</td>
                    <td className="py-3 px-4 text-slate-600">{c.diagnostics.length}</td>
                    <td className="py-3 px-4 text-slate-600">{c.documents.length}</td>
                    <td className="py-3 px-4 text-right">
                      <Link href={`/empresas/${c.id}`} className="text-blue-700 font-medium hover:underline">
                        Ver detalhes →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
