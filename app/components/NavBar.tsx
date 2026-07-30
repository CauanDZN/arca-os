import Link from "next/link";

const LINKS = [
  { href: "/empresas", label: "Empresas" },
  { href: "/agentes", label: "Agentes de IA" },
  { href: "/integracoes", label: "Integrações" },
];

export function NavBar() {
  return (
    <header className="print:hidden border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-slate-900">
          Arca<span className="text-blue-700">OS</span>
        </Link>
        <nav className="flex gap-5 text-sm font-medium text-slate-600">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-slate-900">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
