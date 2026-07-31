"use server";

import { prisma } from "@/lib/prisma";
import { MOCK_USERS } from "@/lib/auth-users";
import { setSessionCookie, clearSessionCookie } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const user = MOCK_USERS.find((u) => u.email.toLowerCase() === email && u.password === password);
  if (!user) {
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
    role: user.role,
    title: user.title,
    companyId,
  });

  redirect(user.role === "cliente" ? `/empresas/${companyId}` : "/empresas");
}

export async function logout() {
  await clearSessionCookie();
  redirect("/login");
}
