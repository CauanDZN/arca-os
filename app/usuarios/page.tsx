import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { createUser, updateUserRole, deleteUser } from "@/app/actions-users";
import { Card } from "@/app/components/Card";
import { Badge } from "@/app/components/Badge";
import { ConfirmButton } from "@/app/components/ConfirmButton";
import { SubmitButton } from "@/app/components/SubmitButton";
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

const ROLE_OPTIONS = ["admin", "consultor", "cliente"] as const;

const ERROR_MESSAGE: Record<string, string> = {
  validacao: "Dados inválidos — confira nome, e-mail, senha (mín. 6) e cargo.",
  "email-existe": "Já existe um usuário com esse e-mail.",
  "empresa-obrigatoria": "Usuários com papel Cliente precisam de uma empresa vinculada.",
  "empresa-invalida": "A empresa selecionada não existe mais.",
  autoexclusao: "Você não pode excluir o próprio usuário.",
  "ultimo-admin": "Não é possível excluir o último administrador.",
};

const SUCCESS_MESSAGE: Record<string, string> = {
  criado: "Usuário criado com sucesso.",
};

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sucesso?: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/");

  const { error, sucesso } = await searchParams;

  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" }, include: { company: true } });
  const companies = await prisma.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });

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
            Usuários persistidos no banco (modelo <code>User</code>, semeados pela migration{" "}
            <code>add_users</code>). O login consulta esta tabela — criar, mudar o cargo ou excluir
            um usuário tem efeito imediato.
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
          <h2 className="text-xl font-bold text-slate-900 mb-4">Novo usuário</h2>
          <form action={createUser} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Nome</span>
              <input
                type="text"
                name="name"
                required
                className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/40 focus:border-blue-600 transition-shadow"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">E-mail</span>
              <input
                type="email"
                name="email"
                required
                className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/40 focus:border-blue-600 transition-shadow"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Senha (mín. 6)</span>
              <input
                type="password"
                name="password"
                required
                minLength={6}
                className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/40 focus:border-blue-600 transition-shadow"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Cargo</span>
              <input
                type="text"
                name="title"
                placeholder="Ex.: Consultor Líder"
                className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/40 focus:border-blue-600 transition-shadow"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Papel</span>
              <select
                name="role"
                defaultValue="consultor"
                className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/40 focus:border-blue-600 transition-shadow bg-white"
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABEL[role]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">
                Empresa (só para Cliente)
              </span>
              <select
                name="companyId"
                defaultValue=""
                className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/40 focus:border-blue-600 transition-shadow bg-white"
              >
                <option value="">Selecionar empresa...</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="sm:col-span-2">
              <SubmitButton
                pendingText="Criando..."
                className="rounded-lg bg-blue-700 text-white font-semibold px-4 py-2 text-sm hover:bg-blue-800 transition-colors"
              >
                + Criar usuário
              </SubmitButton>
            </div>
          </form>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-slate-900 mb-4">
            {users.length} {users.length === 1 ? "usuário" : "usuários"}
          </h2>
          <div className="space-y-2">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 rounded-lg border border-slate-200 p-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {u.name}
                    {u.id === session.userId && (
                      <span className="ml-2 text-xs text-slate-400">(você)</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">{u.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{u.email}</p>
                  {u.company && (
                    <p className="text-xs text-blue-700 mt-0.5">Empresa: {u.company.name}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  <Badge text={ROLE_LABEL[u.role]} tone={ROLE_TONE[u.role]} />
                  <form
                    action={updateUserRole.bind(null, u.id)}
                    className="flex items-center gap-1.5 flex-wrap justify-end"
                  >
                    <select
                      name="role"
                      defaultValue={u.role}
                      aria-label={`Papel de ${u.name}`}
                      className="rounded-md border border-slate-300 px-1.5 py-1 text-xs focus:outline-none bg-white"
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABEL[role]}
                        </option>
                      ))}
                    </select>
                    <select
                      name="companyId"
                      defaultValue={u.companyId ?? ""}
                      aria-label={`Empresa de ${u.name}`}
                      className="rounded-md border border-slate-300 px-1.5 py-1 text-xs focus:outline-none bg-white max-w-44 truncate"
                    >
                      <option value="">Sem empresa</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
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
                  <form action={deleteUser.bind(null, u.id)}>
                    <ConfirmButton
                      confirmText={`Excluir ${u.name}? Essa ação não pode ser desfeita.`}
                      pendingText="Excluindo..."
                      className="rounded-md border border-red-200 text-red-700 text-xs font-semibold px-2 py-1 hover:bg-red-50 transition-colors"
                    >
                      Excluir
                    </ConfirmButton>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </main>
  );
}
