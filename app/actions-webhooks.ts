"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCompanyAccess } from "@/lib/access";
import { redirect } from "next/navigation";
import crypto from "crypto";

export async function generateWebhookToken(companyId: string) {
  assertCompanyAccess(await getSession(), companyId);

  await prisma.company.update({
    where: { id: companyId },
    data: { webhookToken: crypto.randomBytes(24).toString("hex") },
  });

  redirect(`/empresas/${companyId}/documentos`);
}

export async function revokeWebhookToken(companyId: string) {
  assertCompanyAccess(await getSession(), companyId);

  await prisma.company.update({
    where: { id: companyId },
    data: { webhookToken: null },
  });

  redirect(`/empresas/${companyId}/documentos`);
}

export async function deleteWebhookEvent(companyId: string, eventId: string) {
  assertCompanyAccess(await getSession(), companyId);

  const event = await prisma.webhookEvent.findUnique({ where: { id: eventId } });
  if (event && event.companyId === companyId) {
    await prisma.webhookEvent.delete({ where: { id: eventId } });
  }
  redirect(`/empresas/${companyId}/documentos`);
}
