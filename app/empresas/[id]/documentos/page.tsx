import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AREAS } from "@/lib/areas";
import { uploadDocument, deleteDocument } from "@/app/actions-documents";

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
    include: { documents: { orderBy: { createdAt: "desc" } } },
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

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <p className="text-sm font-semibold text-blue-700 uppercase mb-1">Data Room</p>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">{company.name}</h1>
          <p className="text-slate-600 mb-6">
            Envie extratos, DRE, contratos, planilhas e outros documentos organizados por área.
            Eles alimentam a análise consultiva e servem de evidência do diagnóstico.
          </p>

          <form action={uploadAction} className="flex flex-col sm:flex-row gap-3 items-start sm:items-end border border-slate-200 rounded-lg p-4 bg-slate-50">
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
            <button
              type="submit"
              className="rounded-lg bg-blue-700 text-white font-semibold px-5 py-2 hover:bg-blue-800 transition-colors whitespace-nowrap"
            >
              Enviar
            </button>
          </form>
        </div>

        <div className="space-y-4">
          {categories
            .filter((c) => grouped.has(c.key))
            .map((c) => (
              <div key={c.key} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h2 className="font-semibold text-slate-900 mb-3">{c.name}</h2>
                <ul className="space-y-2">
                  {grouped.get(c.key)!.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
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
                      <form action={deleteDocument.bind(null, id, doc.id)}>
                        <button
                          type="submit"
                          className="text-xs text-red-600 hover:underline whitespace-nowrap"
                        >
                          Remover
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          {company.documents.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-8">
              Nenhum documento enviado ainda.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
