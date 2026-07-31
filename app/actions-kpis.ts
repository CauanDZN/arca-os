"use server";

import { prisma } from "@/lib/prisma";
import { getAreaByKey } from "@/lib/areas";
import { kpiEntrySchema } from "@/lib/validation";
import { getSession } from "@/lib/auth";
import { assertCompanyAccess } from "@/lib/access";
import { redirect } from "next/navigation";

export async function upsertKpiEntry(companyId: string, formData: FormData) {
  assertCompanyAccess(await getSession(), companyId);

  const [areaKey, indicatorName] = String(formData.get("indicator") ?? "").split("::");
  const rawTarget = String(formData.get("target") ?? "").trim();

  const fields = kpiEntrySchema.parse({
    areaKey,
    indicatorName,
    month: String(formData.get("month") ?? ""),
    value: formData.get("value"),
    target: rawTarget === "" ? undefined : rawTarget,
  });

  const area = getAreaByKey(fields.areaKey);
  if (!area || !area.indicators.includes(fields.indicatorName)) {
    throw new Error("Indicador inválido para a área selecionada");
  }

  await prisma.kpiEntry.upsert({
    where: {
      companyId_areaKey_indicatorName_month: {
        companyId,
        areaKey: fields.areaKey,
        indicatorName: fields.indicatorName,
        month: fields.month,
      },
    },
    update: { value: fields.value, target: fields.target ?? null },
    create: { companyId, ...fields, target: fields.target ?? null },
  });

  redirect(`/empresas/${companyId}/indicadores`);
}

export async function deleteKpiEntry(companyId: string, entryId: string) {
  assertCompanyAccess(await getSession(), companyId);

  const entry = await prisma.kpiEntry.findUnique({ where: { id: entryId } });
  if (entry && entry.companyId === companyId) {
    await prisma.kpiEntry.delete({ where: { id: entryId } });
  }
  redirect(`/empresas/${companyId}/indicadores`);
}

export async function applyKpiSuggestion(companyId: string, suggestionId: string) {
  assertCompanyAccess(await getSession(), companyId);

  const suggestion = await prisma.kpiSuggestion.findUnique({ where: { id: suggestionId } });
  if (suggestion && suggestion.companyId === companyId && suggestion.status === "pendente") {
    await prisma.$transaction([
      prisma.kpiEntry.upsert({
        where: {
          companyId_areaKey_indicatorName_month: {
            companyId,
            areaKey: suggestion.areaKey,
            indicatorName: suggestion.indicatorName,
            month: suggestion.month,
          },
        },
        update: { value: suggestion.value },
        create: {
          companyId,
          areaKey: suggestion.areaKey,
          indicatorName: suggestion.indicatorName,
          month: suggestion.month,
          value: suggestion.value,
        },
      }),
      prisma.kpiSuggestion.update({ where: { id: suggestionId }, data: { status: "aplicada" } }),
    ]);
  }
  redirect(`/empresas/${companyId}/indicadores`);
}

export async function rejectKpiSuggestion(companyId: string, suggestionId: string) {
  assertCompanyAccess(await getSession(), companyId);

  const suggestion = await prisma.kpiSuggestion.findUnique({ where: { id: suggestionId } });
  if (suggestion && suggestion.companyId === companyId) {
    await prisma.kpiSuggestion.update({ where: { id: suggestionId }, data: { status: "rejeitada" } });
  }
  redirect(`/empresas/${companyId}/indicadores`);
}
