"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCompanyAccess } from "@/lib/access";
import { onboardingResponsibleSchema } from "@/lib/validation";
import { VERTICALS } from "@/lib/verticals";
import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";

/**
 * Exclui a empresa e TUDO o que está vinculado a ela de uma vez: diagnósticos
 * (respostas, tarefas, sprints, épicos, eventos, insights verticais), Data
 * Room (documentos + blobs no Vercel Blob), atas, indicadores, sugestões de
 * KPI e webhooks. Só admin — nem o próprio cliente da empresa pode fazer isso.
 */
export async function deleteCompany(companyId: string) {
  const session = await getSession();
  if (!session || session.role !== "admin") notFound();

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { documents: { select: { storedUrl: true } } },
  });
  if (!company) notFound();

  // Lazy import, mesmo motivo de actions-documents.ts: @vercel/blob não deve
  // entrar no bundle de nenhuma página que importe esta Server Action.
  const { del } = await import("@vercel/blob");
  await Promise.allSettled(company.documents.map((doc) => del(doc.storedUrl)));

  // As FKs de Company já são ON DELETE CASCADE (ver schema.prisma) — um único
  // delete derruba a árvore inteira.
  await prisma.company.delete({ where: { id: companyId } });
  redirect("/empresas");
}

// Trilha 1 (Onboarding): define quem na Arca é o responsável por essa
// empresa — o único campo do checklist que não é derivado de outro dado já
// existente no banco. É atribuição interna da Arca, não do cliente.
export async function updateOnboardingResponsible(companyId: string, formData: FormData) {
  const session = await getSession();
  if (!session || session.role === "cliente") notFound();
  assertCompanyAccess(session, companyId);

  const parsed = onboardingResponsibleSchema.safeParse({
    onboardingResponsible: formData.get("onboardingResponsible"),
  });
  if (!parsed.success) redirect(`/empresas/${companyId}`);

  await prisma.company.update({
    where: { id: companyId },
    data: { onboardingResponsible: parsed.data.onboardingResponsible },
  });

  revalidatePath(`/empresas/${companyId}`);
  redirect(`/empresas/${companyId}`);
}

const VERTICAL_KEYS = new Set(VERTICALS.map((v) => v.key));

/**
 * Escalabilidade da comercialização modular: uma empresa pode ter 0, 1 ou
 * quantas verticais contratadas fizerem sentido, cada uma independente das
 * outras — isso é o que controla quais módulos (/empresas/[id]/modulo/[x])
 * aparecem pra ela. Atribuição comercial da Arca, não do cliente.
 */
export async function updateContractedVerticals(companyId: string, formData: FormData) {
  const session = await getSession();
  if (!session || session.role === "cliente") notFound();
  assertCompanyAccess(session, companyId);

  const selected = formData.getAll("verticals").map(String).filter((key) => VERTICAL_KEYS.has(key));

  await prisma.company.update({
    where: { id: companyId },
    data: { contractedVerticals: JSON.stringify(selected) },
  });

  revalidatePath(`/empresas/${companyId}`);
  redirect(`/empresas/${companyId}`);
}
