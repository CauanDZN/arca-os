"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions-auth";
import type { Session } from "@/lib/session";
import { SubmitButton } from "@/app/components/SubmitButton";
import {
  BuildingIcon,
  DashboardIcon,
  DocumentIcon,
  SparklesIcon,
  PlugIcon,
  UsersIcon,
  PortalIcon,
  HandshakeIcon,
} from "@/app/components/icons";

const LINKS = [
  { href: "/empresas", label: "Empresas", icon: BuildingIcon, roles: ["admin", "consultor"] },
  { href: "/relatorios", label: "Relatórios", icon: DocumentIcon, roles: ["admin", "consultor"] },
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon, roles: ["admin", "consultor", "cliente"] },
  { href: "/portal", label: "Portal", icon: PortalIcon, roles: ["cliente"] },
  { href: "/agentes", label: "Agentes de IA", icon: SparklesIcon, roles: ["admin", "consultor", "cliente"] },
  { href: "/integracoes", label: "Integrações", icon: PlugIcon, roles: ["admin", "consultor", "cliente"] },
  { href: "/parceiros", label: "Parceiros", icon: HandshakeIcon, roles: ["admin", "consultor"] },
];

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  consultor: "Consultor",
  cliente: "Cliente",
};

function isActive(pathname: string | null, href: string): boolean {
  return pathname === href || (href !== "/" && pathname?.startsWith(`${href}/`)) || false;
}

export function NavBar({ session }: { session: Session | null }) {
  const pathname = usePathname();

  const links = [
    ...LINKS.filter((link) => link.roles.includes(session?.role ?? "")),
    ...(session?.role === "admin" ? [{ href: "/usuarios", label: "Usuários", icon: UsersIcon }] : []),
  ];

  return (
    <header className="print:hidden sticky top-0 z-10 bg-white/90 backdrop-blur-sm">
      <div className="border-b border-slate-200">
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between gap-3">
          <Link href="/" className="leading-tight shrink-0">
            <p className="font-bold text-slate-900">
              Arca<span className="text-blue-700">OS</span>
            </p>
            <p className="text-[11px] text-slate-400 -mt-0.5">Diagnóstico · Execução · Performance</p>
          </Link>

          {session && (
            <div className="flex items-center gap-3 min-w-0">
              <div className="text-right leading-tight hidden md:block">
                <p className="text-sm font-medium text-slate-800 truncate max-w-48">{session.name}</p>
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
      </div>

      {session && links.length > 0 && (
        <nav className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-2 sm:px-4">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar -mx-2 px-2 sm:mx-0 sm:px-0 py-1.5">
              {links.map((link) => {
                const active = isActive(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <link.icon className="w-4 h-4 shrink-0" />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
