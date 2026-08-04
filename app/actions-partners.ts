"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCompanyAccess } from "@/lib/access";
import {
  partnerSchema,
  partnerNpsSchema,
  partnerReferralSchema,
  partnerReferralFeedbackSchema,
  PARTNER_HOMOLOGATION_STATUSES,
  PARTNER_REFERRAL_STATUSES,
} from "@/lib/validation";
import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";

const HOMOLOGATION_STATUS_SET = new Set<string>(PARTNER_HOMOLOGATION_STATUSES);
const REFERRAL_STATUS_SET = new Set<string>(PARTNER_REFERRAL_STATUSES);

export async function createPartner(formData: FormData) {
  const session = await getSession();
  if (!session || session.role === "cliente") notFound();

  const rawSla = String(formData.get("slaHours") ?? "").trim();
  const rawCurationFee = String(formData.get("curationFeeValue") ?? "").trim();
  const rawRevenueShare = String(formData.get("revenueSharePercent") ?? "").trim();
  const rawRevenueModel = String(formData.get("revenueModel") ?? "").trim();

  const parsed = partnerSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    category: formData.get("category"),
    contactInfo: formData.get("contactInfo"),
    slaHours: rawSla === "" ? undefined : rawSla,
    revenueModel: rawRevenueModel === "" ? undefined : rawRevenueModel,
    curationFeeValue: rawCurationFee === "" ? undefined : rawCurationFee,
    revenueSharePercent: rawRevenueShare === "" ? undefined : rawRevenueShare,
  });
  if (!parsed.success) redirect("/parceiros?error=validacao");

  await prisma.partner.create({ data: parsed.data });

  revalidatePath("/parceiros");
  redirect("/parceiros?sucesso=criado");
}

export async function updatePartnerHomologation(partnerId: string, formData: FormData) {
  const session = await getSession();
  if (!session || session.role === "cliente") notFound();

  const status = String(formData.get("homologationStatus") ?? "");
  if (!HOMOLOGATION_STATUS_SET.has(status)) redirect("/parceiros?error=validacao");

  await prisma.partner.update({ where: { id: partnerId }, data: { homologationStatus: status } });

  revalidatePath("/parceiros");
  redirect("/parceiros");
}

// NPS Arca Partner (plano, KPI da vertical Parceira) — leitura mais recente,
// atualizada manualmente sempre que a Arca aplicar a pesquisa.
export async function updatePartnerNps(partnerId: string, formData: FormData) {
  const session = await getSession();
  if (!session || session.role === "cliente") notFound();

  const parsed = partnerNpsSchema.safeParse({ npsScore: formData.get("npsScore") });
  if (!parsed.success) redirect("/parceiros?error=validacao");

  await prisma.partner.update({ where: { id: partnerId }, data: { npsScore: parsed.data.npsScore } });

  revalidatePath("/parceiros");
  redirect("/parceiros");
}

export async function deletePartner(partnerId: string) {
  const session = await getSession();
  if (!session || session.role !== "admin") notFound();

  await prisma.partner.delete({ where: { id: partnerId } });

  revalidatePath("/parceiros");
  redirect("/parceiros");
}

// Registra que um parceiro homologado foi indicado pra uma empresa cliente —
// o vínculo comercial explícito que a vertical Parceira do plano descreve
// ("Conectar para crescer juntos"), sem duplicar o cadastro do parceiro.
export async function createPartnerReferral(companyId: string, formData: FormData) {
  const session = await getSession();
  if (!session || session.role === "cliente") notFound();
  assertCompanyAccess(session, companyId);

  const parsed = partnerReferralSchema.safeParse({
    partnerId: formData.get("partnerId"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) redirect(`/empresas/${companyId}?error=parceiro-invalido`);

  const partner = await prisma.partner.findUnique({ where: { id: parsed.data.partnerId } });
  if (!partner) redirect(`/empresas/${companyId}?error=parceiro-invalido`);

  await prisma.partnerReferral.create({
    data: { partnerId: parsed.data.partnerId, companyId, notes: parsed.data.notes },
  });

  revalidatePath(`/empresas/${companyId}`);
  redirect(`/empresas/${companyId}`);
}

export async function updatePartnerReferralStatus(companyId: string, referralId: string, formData: FormData) {
  const session = await getSession();
  if (!session || session.role === "cliente") notFound();
  assertCompanyAccess(session, companyId);

  const status = String(formData.get("status") ?? "");
  if (!REFERRAL_STATUS_SET.has(status)) redirect(`/empresas/${companyId}?error=validacao`);

  const referral = await prisma.partnerReferral.findUnique({ where: { id: referralId } });
  if (!referral || referral.companyId !== companyId) notFound();

  await prisma.partnerReferral.update({ where: { id: referralId }, data: { status } });

  revalidatePath(`/empresas/${companyId}`);
  redirect(`/empresas/${companyId}`);
}

// Comissão (plano: "Comissionamento (%)", um dos 5 modelos de receita de
// parceria) + satisfação do cliente com essa indicação específica — separado
// do status pra não misturar "onde a indicação está" com "quanto valeu".
export async function updatePartnerReferralFeedback(companyId: string, referralId: string, formData: FormData) {
  const session = await getSession();
  if (!session || session.role === "cliente") notFound();
  assertCompanyAccess(session, companyId);

  const referral = await prisma.partnerReferral.findUnique({ where: { id: referralId } });
  if (!referral || referral.companyId !== companyId) notFound();

  const rawPercent = String(formData.get("commissionPercent") ?? "").trim();
  const rawValue = String(formData.get("commissionValue") ?? "").trim();
  const rawSatisfaction = String(formData.get("clientSatisfaction") ?? "").trim();

  const parsed = partnerReferralFeedbackSchema.safeParse({
    commissionPercent: rawPercent === "" ? undefined : rawPercent,
    commissionValue: rawValue === "" ? undefined : rawValue,
    clientSatisfaction: rawSatisfaction === "" ? undefined : rawSatisfaction,
  });
  if (!parsed.success) redirect(`/empresas/${companyId}?error=validacao`);

  await prisma.partnerReferral.update({
    where: { id: referralId },
    data: {
      commissionPercent: parsed.data.commissionPercent ?? null,
      commissionValue: parsed.data.commissionValue ?? null,
      clientSatisfaction: parsed.data.clientSatisfaction ?? null,
    },
  });

  revalidatePath(`/empresas/${companyId}`);
  redirect(`/empresas/${companyId}`);
}

// SLA realizado (plano: "≤48h SLA de atendimento"): marca o instante em que o
// parceiro de fato respondeu/engajou com a indicação — lib/partners.ts usa
// isso contra Partner.slaHours pra calcular o % dentro do prazo.
export async function markReferralResponded(companyId: string, referralId: string) {
  const session = await getSession();
  if (!session || session.role === "cliente") notFound();
  assertCompanyAccess(session, companyId);

  const referral = await prisma.partnerReferral.findUnique({ where: { id: referralId } });
  if (!referral || referral.companyId !== companyId) notFound();

  await prisma.partnerReferral.update({ where: { id: referralId }, data: { respondedAt: new Date() } });

  revalidatePath(`/empresas/${companyId}`);
  redirect(`/empresas/${companyId}`);
}

export async function deletePartnerReferral(companyId: string, referralId: string) {
  const session = await getSession();
  if (!session || session.role === "cliente") notFound();
  assertCompanyAccess(session, companyId);

  const referral = await prisma.partnerReferral.findUnique({ where: { id: referralId } });
  if (!referral || referral.companyId !== companyId) notFound();

  await prisma.partnerReferral.delete({ where: { id: referralId } });

  revalidatePath(`/empresas/${companyId}`);
  redirect(`/empresas/${companyId}`);
}
