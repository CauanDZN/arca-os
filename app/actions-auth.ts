"use server";

import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/session";
import { setSessionCookie, clearSessionCookie } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  // Users live in the DB (seeded by the add_users migration, managed via the
  // /usuarios page) — no more static list in lib/auth-users.ts.
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.password !== password) {
    redirect("/login?error=credenciais");
  }

  let companyId: string | undefined;
  if (user.role === "cliente") {
    // Vínculo real definido na tela /usuarios (companyId) — não existe mais a
    // resolução por nome da migration add_users.
    if (!user.companyId) {
      redirect("/login?error=empresa");
    }
    companyId = user.companyId;
  }

  let assignedVerticals: string[] | undefined;
  if (user.role === "consultor") {
    const parsed: unknown = JSON.parse(user.assignedVerticals || "[]");
    if (Array.isArray(parsed) && parsed.length > 0) assignedVerticals = parsed as string[];
  }

  await setSessionCookie({
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role as Role,
    title: user.title,
    companyId,
    assignedVerticals,
  });

  redirect(user.role === "cliente" ? `/empresas/${companyId}` : "/empresas");
}

export async function logout() {
  await clearSessionCookie();
  redirect("/login");
}
