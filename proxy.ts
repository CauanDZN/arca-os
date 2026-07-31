import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, decodeSession } from "@/lib/session";

/**
 * Route-level RBAC for the mocked login. Named `proxy.ts` (not `middleware.ts`
 * — Next.js 16 renamed the convention, `middleware.ts` still works but logs a
 * deprecation warning). This file intentionally does no DB lookups: it only
 * decodes the (unsigned) session cookie and applies routing rules that don't
 * need real data. Resolving whether a /diagnostico/[id] belongs to the
 * logged-in cliente's company requires a Prisma query — that check happens
 * per-page via lib/access.ts instead.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/login") {
    return NextResponse.next();
  }

  const raw = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? decodeSession(raw) : null;

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // "/" is the marketing splash for logged-out visitors — a logged-in user
  // landing here (clicking the logo, a bookmark, the bare domain) should go
  // straight to their dashboard instead of seeing it again.
  if (pathname === "/") {
    const destination = session.role === "cliente" && session.companyId
      ? `/empresas/${session.companyId}`
      : "/empresas";
    return NextResponse.redirect(new URL(destination, request.url));
  }

  if (pathname.startsWith("/usuarios") && session.role !== "admin") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (session.role === "cliente" && session.companyId) {
    if (pathname === "/empresas" || pathname === "/relatorios" || pathname === "/diagnostico/novo") {
      return NextResponse.redirect(new URL(`/empresas/${session.companyId}`, request.url));
    }
    const companyMatch = pathname.match(/^\/empresas\/([^/]+)/);
    if (companyMatch && companyMatch[1] !== session.companyId) {
      return NextResponse.redirect(new URL(`/empresas/${session.companyId}`, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
