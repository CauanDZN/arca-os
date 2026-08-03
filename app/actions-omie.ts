"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCompanyAccess } from "@/lib/access";
import { omieCredentialsSchema } from "@/lib/validation";
import { testOmieConnection, fetchOmieFinancialSummary } from "@/lib/omie";
import { currentPeriod } from "@/lib/monthly-report";
import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";

// Valida as credenciais contra a API real antes de salvar (ListarCategorias é
// a chamada mais barata) — evita guardar uma App Key/Secret que nunca vai
// funcionar e só descobrir isso na hora da sincronização.
export async function saveOmieCredentials(companyId: string, formData: FormData) {
  const session = await getSession();
  if (!session || session.role === "cliente") notFound();
  assertCompanyAccess(session, companyId);

  const parsed = omieCredentialsSchema.safeParse({
    omieAppKey: formData.get("omieAppKey"),
    omieAppSecret: formData.get("omieAppSecret"),
  });
  if (!parsed.success) redirect(`/empresas/${companyId}?error=omie-validacao`);

  try {
    await testOmieConnection({ appKey: parsed.data.omieAppKey, appSecret: parsed.data.omieAppSecret });
  } catch {
    redirect(`/empresas/${companyId}?error=omie-credenciais`);
  }

  await prisma.company.update({
    where: { id: companyId },
    data: { omieAppKey: parsed.data.omieAppKey, omieAppSecret: parsed.data.omieAppSecret },
  });

  revalidatePath(`/empresas/${companyId}`);
  redirect(`/empresas/${companyId}?sucesso=omie-conectado`);
}

export async function disconnectOmie(companyId: string) {
  const session = await getSession();
  if (!session || session.role === "cliente") notFound();
  assertCompanyAccess(session, companyId);

  await prisma.company.update({
    where: { id: companyId },
    data: { omieAppKey: null, omieAppSecret: null },
  });

  revalidatePath(`/empresas/${companyId}`);
  redirect(`/empresas/${companyId}`);
}

// Traz contas a pagar/receber da Omie e grava como KpiEntry do mês corrente,
// na área "financeiro" — reaproveita os indicadores "Inadimplência" e
// "Endividamento" já existentes no Cockpit de Performance (lib/areas.ts) em
// vez de criar uma tela/tabela paralela só pra dado vindo de ERP.
export async function syncOmieFinancials(companyId: string) {
  const session = await getSession();
  if (!session || session.role === "cliente") notFound();
  assertCompanyAccess(session, companyId);

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) notFound();
  if (!company.omieAppKey || !company.omieAppSecret) redirect(`/empresas/${companyId}?error=omie-desconectado`);

  const month = currentPeriod();

  try {
    const summary = await fetchOmieFinancialSummary({
      appKey: company.omieAppKey,
      appSecret: company.omieAppSecret,
    });

    await prisma.$transaction([
      prisma.kpiEntry.upsert({
        where: { companyId_areaKey_indicatorName_month: { companyId, areaKey: "financeiro", indicatorName: "Inadimplência", month } },
        update: { value: summary.inadimplenciaValue },
        create: { companyId, areaKey: "financeiro", indicatorName: "Inadimplência", month, value: summary.inadimplenciaValue },
      }),
      prisma.kpiEntry.upsert({
        where: { companyId_areaKey_indicatorName_month: { companyId, areaKey: "financeiro", indicatorName: "Endividamento", month } },
        update: { value: summary.endividamentoValue },
        create: { companyId, areaKey: "financeiro", indicatorName: "Endividamento", month, value: summary.endividamentoValue },
      }),
    ]);
  } catch {
    redirect(`/empresas/${companyId}/indicadores?error=omie-sync`);
  }

  revalidatePath(`/empresas/${companyId}/indicadores`);
  redirect(`/empresas/${companyId}/indicadores?sucesso=omie-sincronizado`);
}
