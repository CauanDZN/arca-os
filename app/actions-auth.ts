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
  if (user.role === "cliente" && user.companyName) {
    const company = await prisma.company.findFirst({ where: { name: user.companyName } });
    if (!company) {
      redirect("/login?error=empresa");
    }
    companyId = company.id;
  }

  await setSessionCookie({
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role as Role,
    title: user.title,
    companyId,
  });

  redirect(user.role === "cliente" ? `/empresas/${companyId}` : "/empresas");
}

export async function logout() {
  await clearSessionCookie();
  redirect("/login");
}
