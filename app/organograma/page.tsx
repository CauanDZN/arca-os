import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { VERTICALS } from "@/lib/verticals";
import { SENIORITY_LEVELS, SENIORITY_LABEL, isSeniority } from "@/lib/seniority";
import { Card } from "@/app/components/Card";
import { UsersIcon } from "@/app/components/icons";

export default async function OrganogramaPage() {
  const session = await getSession();
  if (!session || session.role === "cliente") redirect("/");

  const consultores = await prisma.user.findMany({
    where: { role: "consultor" },
    orderBy: { name: "asc" },
  });
  const direcao = await prisma.user.findMany({ where: { role: "admin" }, orderBy: { name: "asc" } });

  const semVertical = consultores.filter((u) => JSON.parse(u.assignedVerticals || "[]").length === 0);

  return (
    <main className="flex-1 bg-slate-50 py-10 px-4">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <Link href="/usuarios" className="text-sm text-slate-500 hover:text-slate-800">
            ← Voltar para Usuários
          </Link>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-blue-700 uppercase tracking-wide mt-2 mb-1">
            <UsersIcon className="w-4 h-4" />
            Estrutura de Responsabilidade
          </p>
          <h1 className="text-2xl font-bold text-slate-900">Organograma por Vertical</h1>
          <p className="text-slate-600 mt-1">
            Sócio → Gerente → Coordenador → Analista → Assistente, repetido sob cada vertical (plano
            estratégico, p. 22). Um consultor aparece em toda vertical atribuída a ele; sem
            senioridade classificada, ele conta pra vertical mas não pra nenhuma linha da escada.
          </p>
        </div>

        <Card>
          <h2 className="font-semibold text-slate-900 mb-3">Direção Executiva</h2>
          {direcao.length === 0 ? (
            <p className="text-xs text-slate-400">Nenhum administrador cadastrado.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {direcao.map((u) => (
                <li key={u.id} className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-sm text-slate-800">
                  {u.name}
                  {u.title && <span className="text-slate-500"> · {u.title}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {VERTICALS.map((vertical) => {
            const equipe = consultores.filter((u) =>
              (JSON.parse(u.assignedVerticals || "[]") as string[]).includes(vertical.key)
            );
            return (
              <Card key={vertical.key} className="p-4">
                <h3 className="font-semibold text-slate-900 text-sm mb-3">{vertical.name}</h3>
                {equipe.length === 0 ? (
                  <p className="text-xs text-slate-400">Nenhum consultor atribuído.</p>
                ) : (
                  <div className="space-y-2">
                    {SENIORITY_LEVELS.map((level) => {
                      const nesteNivel = equipe.filter((u) => u.seniority === level);
                      if (nesteNivel.length === 0) return null;
                      return (
                        <div key={level}>
                          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                            {SENIORITY_LABEL[level]}
                          </p>
                          <p className="text-sm text-slate-800">{nesteNivel.map((u) => u.name).join(", ")}</p>
                        </div>
                      );
                    })}
                    {equipe.some((u) => !isSeniority(u.seniority)) && (
                      <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                          Sem senioridade classificada
                        </p>
                        <p className="text-sm text-slate-500">
                          {equipe
                            .filter((u) => !isSeniority(u.seniority))
                            .map((u) => u.name)
                            .join(", ")}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <Card>
          <h2 className="font-semibold text-slate-900 mb-3">Sem vertical atribuída (carteira inteira)</h2>
          {semVertical.length === 0 ? (
            <p className="text-xs text-slate-400">Todo consultor tem ao menos uma vertical atribuída.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {semVertical.map((u) => (
                <li key={u.id} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700">
                  {u.name}
                  {isSeniority(u.seniority) && <span className="text-slate-500"> · {SENIORITY_LABEL[u.seniority]}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </main>
  );
}
