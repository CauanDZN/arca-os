"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions-auth";
import type { Session } from "@/lib/session";
import { SubmitButton } from "@/app/components/SubmitButton";
import { BuildingIcon, DocumentIcon, SparklesIcon, PlugIcon } from "@/app/components/icons";

const LINKS = [
  { href: "/empresas", label: "Empresas", icon: BuildingIcon, roles: ["admin", "consultor"] },
  { href: "/relatorios", label: "Relatórios", icon: DocumentIcon, roles: ["admin", "consultor"] },
  { href: "/agentes", label: "Agentes de IA", icon: SparklesIcon, roles: ["admin", "consultor", "cliente"] },
  { href: "/integracoes", label: "Integrações", icon: PlugIcon, roles: ["admin", "consultor", "cliente"] },
];

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  consultor: "Consultor",
  cliente: "Cliente",
};

export function NavBar({ session }: { session: Session | null }) {
  const pathname = usePathname();

  return (
    <header className="print:hidden sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
        <Link href="/" className="leading-tight">
          <p className="font-bold text-slate-900">
            Arca<span className="text-blue-700">OS</span>
          </p>
          <p className="text-[11px] text-slate-400 -mt-0.5">Diagnóstico · Execução · Performance</p>
        </Link>

        {session && (
          <nav className="hidden sm:flex gap-1 text-sm font-medium">
            {LINKS.filter((link) => link.roles.includes(session.role)).map((link) => {
              const active = pathname === link.href || pathname?.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors ${
                    active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <link.icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
            {session.role === "admin" && (
              <Link
                href="/usuarios"
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors ${
                  pathname === "/usuarios" || pathname?.startsWith("/usuarios/")
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <BuildingIcon className="w-4 h-4" />
                Usuários
              </Link>
            )}
          </nav>
        )}

        {session && (
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight hidden md:block">
              <p className="text-sm font-medium text-slate-800">{session.name}</p>
              <p className="text-[11px] text-slate-400">
                {ROLE_LABEL[session.role]} · {session.title}
              </p>
            </div>
            <form action={logout}>
              <SubmitButton
                pendingText="Saindo..."
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 border border-slate-300 rounded-lg px-3 py-1.5 hover:bg-slate-100 transition-colors"
              >
                Sair
              </SubmitButton>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
