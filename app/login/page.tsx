import { login } from "@/app/actions-auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/app/components/Card";
import { SubmitButton } from "@/app/components/SubmitButton";

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  consultor: "Consultor",
  cliente: "Cliente",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <main className="flex-1 bg-slate-50 py-10 px-4 flex items-center justify-center">
      <div className="w-full max-w-md space-y-6">
        <Card>
          <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide mb-1">ArcaOS</p>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Entrar</h1>
          <p className="text-slate-600 mb-6 text-sm">
            Login mockado — a senha não é verificada contra um cofre real, mas os usuários vivem no
            banco (semeados pela migration <code>add_users</code>). Use um dos usuários abaixo, ou
            digite as credenciais manualmente.
          </p>

          {error && (
            <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error === "empresa"
                ? "Este usuário ainda não está vinculado a nenhuma empresa. Um administrador precisa vincular uma empresa na tela de Usuários."
                : "E-mail ou senha inválidos."}
            </p>
          )}

          <form action={login} className="space-y-3">
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
              <span className="block text-xs font-medium text-slate-600 mb-1">Senha</span>
              <input
                type="password"
                name="password"
                required
                className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/40 focus:border-blue-600 transition-shadow"
              />
            </label>
            <SubmitButton
              pendingText="Entrando..."
              className="w-full rounded-lg bg-blue-700 text-white font-semibold px-4 py-2 hover:bg-blue-800 transition-colors"
            >
              Entrar
            </SubmitButton>
          </form>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Usuários de teste</h2>
          <p className="text-xs text-slate-500 mb-3">
            Cada um mapeia pra um cargo da estrutura organizacional do plano da Arca.
          </p>
          <div className="space-y-2">
            {users.map((u) => (
              <form
                key={u.id}
                action={login}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2"
              >
                <input type="hidden" name="email" value={u.email} />
                <input type="hidden" name="password" value={u.password} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{u.name}</p>
                  <p className="text-xs text-slate-500 truncate">{u.title}</p>
                </div>
                <SubmitButton
                  pendingText="Entrando..."
                  className="shrink-0 rounded-md border border-slate-300 text-xs font-semibold px-2.5 py-1.5 hover:bg-slate-100 transition-colors whitespace-nowrap"
                >
                  Entrar como {ROLE_LABEL[u.role]}
                </SubmitButton>
              </form>
            ))}
          </div>
        </Card>
      </div>
    </main>
  );
}
