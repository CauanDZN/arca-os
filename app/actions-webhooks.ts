"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCompanyAccess } from "@/lib/access";
import { outboundWebhookUrlSchema } from "@/lib/validation";
import { fireOutboundWebhook } from "@/lib/outbound-webhook";
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

export async function setOutboundWebhookUrl(companyId: string, formData: FormData) {
  assertCompanyAccess(await getSession(), companyId);

  const result = outboundWebhookUrlSchema.safeParse(String(formData.get("url") ?? ""));
  if (!result.success) throw new Error(result.error.issues[0]?.message ?? "URL inválida");

  await prisma.company.update({
    where: { id: companyId },
    data: { outboundWebhookUrl: result.data },
  });

  redirect(`/empresas/${companyId}/documentos`);
}

export async function sendTestOutboundEvent(companyId: string) {
  assertCompanyAccess(await getSession(), companyId);

  await fireOutboundWebhook(companyId, "webhook.test", {
    message: "Evento de teste disparado manualmente pelo ArcaOS.",
  });

  redirect(`/empresas/${companyId}/documentos`);
}
