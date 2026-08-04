"use server";

import { prisma } from "@/lib/prisma";
import { userSchema } from "@/lib/validation";
import { getSession } from "@/lib/auth";
import type { Session } from "@/lib/session";
import { VERTICALS } from "@/lib/verticals";
import { isSeniority } from "@/lib/seniority";
import { redirect, notFound } from "next/navigation";

const VERTICAL_KEYS = new Set(VERTICALS.map((v) => v.key));

// Só role "consultor" carrega escopo — atribuir verticais a admin/cliente não
// tem efeito (admin sempre vê tudo, cliente é escopado pela própria empresa),
// então a gente nem grava lixo no banco pra esses papéis.
function resolveAssignedVerticals(role: string, formData: FormData): string {
  if (role !== "consultor") return "[]";
  const selected = formData.getAll("assignedVerticals").map(String).filter((key) => VERTICAL_KEYS.has(key));
  return JSON.stringify(selected);
}

// Mesmo raciocínio de resolveAssignedVerticals: senioridade só faz sentido
// pra consultor (é o organograma da equipe da Arca, não do cliente/admin).
function resolveSeniority(role: string, formData: FormData): string {
  if (role !== "consultor") return "";
  const raw = String(formData.get("seniority") ?? "");
  return isSeniority(raw) ? raw : "";
}

async function requireAdmin(): Promise<Session> {
  const session = await getSession();
  if (!session || session.role !== "admin") notFound();
  return session;
}

// Cliente precisa estar vinculado a uma empresa real — sem isso o login não
// tem companyId pra escopar o acesso (lib/access.ts). Papéis não-cliente
// sempre limpam o vínculo.
async function resolveCompanyId(role: string, companyId: string | null): Promise<string | null> {
  if (role !== "cliente") return null;
  if (!companyId) redirect("/usuarios?error=empresa-obrigatoria");
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) redirect("/usuarios?error=empresa-invalida");
  return companyId;
}

export async function createUser(formData: FormData) {
  await requireAdmin();

  const parsed = userSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
    title: formData.get("title"),
    companyId: formData.get("companyId"),
  });
  if (!parsed.success) redirect("/usuarios?error=validacao");

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) redirect("/usuarios?error=email-existe");

  const companyId = await resolveCompanyId(parsed.data.role, parsed.data.companyId);
  const assignedVerticals = resolveAssignedVerticals(parsed.data.role, formData);
  const seniority = resolveSeniority(parsed.data.role, formData);

  await prisma.user.create({ data: { ...parsed.data, email, companyId, assignedVerticals, seniority } });
  redirect("/usuarios?sucesso=criado");
}

export async function updateUserRole(userId: string, formData: FormData) {
  await requireAdmin();

  const role = String(formData.get("role") ?? "");
  if (role !== "admin" && role !== "consultor" && role !== "cliente") {
    redirect("/usuarios?error=validacao");
  }

  const rawCompanyId = String(formData.get("companyId") ?? "").trim();
  const companyId = await resolveCompanyId(role, rawCompanyId === "" ? null : rawCompanyId);
  const assignedVerticals = resolveAssignedVerticals(role, formData);
  const seniority = resolveSeniority(role, formData);

  await prisma.user.update({ where: { id: userId }, data: { role, companyId, assignedVerticals, seniority } });
  redirect("/usuarios");
}

export async function deleteUser(userId: string) {
  const session = await requireAdmin();

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) redirect("/usuarios");

  if (target.id === session.userId) redirect("/usuarios?error=autoexclusao");

  if (target.role === "admin") {
    const adminCount = await prisma.user.count({ where: { role: "admin" } });
    if (adminCount <= 1) redirect("/usuarios?error=ultimo-admin");
  }

  await prisma.user.delete({ where: { id: userId } });
  redirect("/usuarios");
}
