"use server";

import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCompanyAccess, assertVerticalAccess } from "@/lib/access";
import { VERTICALS } from "@/lib/verticals";
import { contractSchema } from "@/lib/validation";
import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";

/**
 * Catálogo Comercial Arca modular (plano estratégico, "Ferramentas Oficiais
 * Arca BTO", p. 22): monta várias verticais numa proposta só, cada uma com
 * seu tipo de contrato, em vez de criar um Contract por vez. Tudo entra como
 * status "pendente" — não libera vertical contratada nem vira receita ativa
 * até activatePendingContracts aprovar. Um consultor escopado (ver
 * lib/access.ts) só propõe dentro do seu próprio escopo, mesmo que o form
 * tenha vindo adulterado com outras verticais.
 */
export async function createProposal(companyId: string, formData: FormData) {
  const session = await getSession();
  if (!session || session.role === "cliente") notFound();
  assertCompanyAccess(session, companyId);

  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");
  const notes = String(formData.get("notes") ?? "");

  const selected = VERTICALS.filter((v) => formData.get(`include_${v.key}`));
  if (selected.length === 0) redirect(`/empresas/${companyId}/proposta?error=vazia`);

  const rows: (z.infer<typeof contractSchema> & { companyId: string })[] = [];
  for (const vertical of selected) {
    assertVerticalAccess(session, vertical.key);

    const rawValue = String(formData.get(`value_${vertical.key}`) ?? "").trim();
    const rawFeePercent = String(formData.get(`feePercent_${vertical.key}`) ?? "").trim();

    const parsed = contractSchema.safeParse({
      type: formData.get(`type_${vertical.key}`),
      verticalKey: vertical.key,
      value: rawValue === "" ? undefined : rawValue,
      feePercent: rawFeePercent === "" ? undefined : rawFeePercent,
      status: "pendente",
      startDate,
      endDate,
      notes,
    });
    if (!parsed.success) redirect(`/empresas/${companyId}/proposta?error=proposta-invalida`);

    rows.push({ companyId, ...parsed.data });
  }

  await prisma.contract.createMany({ data: rows });

  revalidatePath(`/empresas/${companyId}`);
  revalidatePath(`/empresas/${companyId}/proposta`);
  redirect(`/empresas/${companyId}/proposta?sucesso=proposta-criada`);
}

// Aprova a proposta inteira de uma vez: todo contrato "pendente" da empresa
// vira "ativo" e a vertical dele entra em contractedVerticals (união com o
// que já estava lá) — é isso que libera o módulo (/empresas/[id]/modulo/[x])
// pra vertical proposta. Contratos "empresa toda" (verticalKey null) só
// ativam, sem mexer em contractedVerticals.
export async function activatePendingContracts(companyId: string) {
  const session = await getSession();
  if (!session || session.role === "cliente") notFound();
  assertCompanyAccess(session, companyId);

  const [pending, company] = await Promise.all([
    prisma.contract.findMany({ where: { companyId, status: "pendente" } }),
    prisma.company.findUnique({ where: { id: companyId }, select: { contractedVerticals: true } }),
  ]);
  if (!company) notFound();
  if (pending.length === 0) redirect(`/empresas/${companyId}/proposta`);

  const contracted = new Set<string>(JSON.parse(company.contractedVerticals || "[]"));
  for (const contract of pending) {
    if (contract.verticalKey) contracted.add(contract.verticalKey);
  }

  await prisma.$transaction([
    prisma.contract.updateMany({ where: { companyId, status: "pendente" }, data: { status: "ativo" } }),
    prisma.company.update({
      where: { id: companyId },
      data: { contractedVerticals: JSON.stringify([...contracted]) },
    }),
  ]);

  revalidatePath(`/empresas/${companyId}`);
  revalidatePath(`/empresas/${companyId}/proposta`);
  redirect(`/empresas/${companyId}?sucesso=proposta-ativada`);
}

export async function discardPendingContracts(companyId: string) {
  const session = await getSession();
  if (!session || session.role === "cliente") notFound();
  assertCompanyAccess(session, companyId);

  await prisma.contract.deleteMany({ where: { companyId, status: "pendente" } });

  revalidatePath(`/empresas/${companyId}`);
  revalidatePath(`/empresas/${companyId}/proposta`);
  redirect(`/empresas/${companyId}/proposta`);
}
