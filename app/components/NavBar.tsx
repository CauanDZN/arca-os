"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BuildingIcon, DocumentIcon, SparklesIcon, PlugIcon } from "@/app/components/icons";

const LINKS = [
  { href: "/empresas", label: "Empresas", icon: BuildingIcon },
  { href: "/relatorios", label: "Relatórios", icon: DocumentIcon },
  { href: "/agentes", label: "Agentes de IA", icon: SparklesIcon },
  { href: "/integracoes", label: "Integrações", icon: PlugIcon },
];

export function NavBar() {
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
        <nav className="flex gap-1 text-sm font-medium">
          {LINKS.map((link) => {
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
        </nav>
      </div>
    </header>
  );
}
