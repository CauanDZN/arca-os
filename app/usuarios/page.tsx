import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { MOCK_USERS } from "@/lib/auth-users";
import { Card } from "@/app/components/Card";
import { Badge } from "@/app/components/Badge";
import { UsersIcon } from "@/app/components/icons";
import type { BadgeTone } from "@/lib/badge-tones";

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  consultor: "Consultor",
  cliente: "Cliente",
};

const ROLE_TONE: Record<string, BadgeTone> = {
  admin: "critical",
  consultor: "managed",
  cliente: "neutral",
};

export default async function UsuariosPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/");

  return (
    <main className="flex-1 bg-slate-50 py-10 px-4">
      <div className="mx-auto max-w-4xl space-y-6">
        <Card>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-blue-700 uppercase tracking-wide mb-1">
            <UsersIcon className="w-4 h-4" />
            Administração
          </p>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Usuários</h1>
          <p className="text-slate-600">
            Login mockado — esta lista é estática (<code>lib/auth-users.ts</code>), não persistida no
            banco. Não há criação, edição ou remoção de usuários nesta versão; cada um mapeia pra um
            cargo da estrutura organizacional do plano da Arca.
          </p>
        </Card>

        <Card>
          <div className="space-y-2">
            {MOCK_USERS.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{u.name}</p>
                  <p className="text-xs text-slate-500">{u.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{u.email}</p>
                  {u.companyName && (
                    <p className="text-xs text-blue-700 mt-0.5">Empresa: {u.companyName}</p>
                  )}
                </div>
                <Badge text={ROLE_LABEL[u.role]} tone={ROLE_TONE[u.role]} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </main>
  );
}
