"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCompanyAccess } from "@/lib/access";
import { VERTICALS } from "@/lib/verticals";
import { computeFeeValue } from "@/lib/contracts";
import {
  contractSchema,
  contractPerformanceRecordSchema,
  CONTRACT_STATUSES,
} from "@/lib/validation";
import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";

const VERTICAL_KEYS = new Set(VERTICALS.map((v) => v.key));
const CONTRACT_STATUS_SET = new Set<string>(CONTRACT_STATUSES);

export async function createContract(companyId: string, formData: FormData) {
  const session = await getSession();
  if (!session || session.role === "cliente") notFound();
  assertCompanyAccess(session, companyId);

  const rawValue = String(formData.get("value") ?? "").trim();
  const rawFeePercent = String(formData.get("feePercent") ?? "").trim();
  const rawVerticalKey = String(formData.get("verticalKey") ?? "").trim();

  const parsed = contractSchema.safeParse({
    type: formData.get("type"),
    verticalKey: VERTICAL_KEYS.has(rawVerticalKey) ? rawVerticalKey : "",
    value: rawValue === "" ? undefined : rawValue,
    feePercent: rawFeePercent === "" ? undefined : rawFeePercent,
    status: "ativo",
    startDate: formData.get("startDate"),
    endDate: String(formData.get("endDate") ?? ""),
    notes: formData.get("notes"),
  });
  if (!parsed.success) redirect(`/empresas/${companyId}?error=contrato-invalido`);

  await prisma.contract.create({ data: { companyId, ...parsed.data } });

  revalidatePath(`/empresas/${companyId}`);
  redirect(`/empresas/${companyId}?sucesso=contrato-criado`);
}

export async function updateContractStatus(companyId: string, contractId: string, formData: FormData) {
  const session = await getSession();
  if (!session || session.role === "cliente") notFound();
  assertCompanyAccess(session, companyId);

  const contract = await prisma.contract.findUnique({ where: { id: contractId } });
  if (!contract || contract.companyId !== companyId) notFound();

  const status = String(formData.get("status") ?? "");
  if (!CONTRACT_STATUS_SET.has(status)) redirect(`/empresas/${companyId}?error=validacao`);

  await prisma.contract.update({ where: { id: contractId }, data: { status } });

  revalidatePath(`/empresas/${companyId}`);
  redirect(`/empresas/${companyId}`);
}

export async function deleteContract(companyId: string, contractId: string) {
  const session = await getSession();
  if (!session || session.role === "cliente") notFound();
  assertCompanyAccess(session, companyId);

  const contract = await prisma.contract.findUnique({ where: { id: contractId } });
  if (!contract || contract.companyId !== companyId) notFound();

  await prisma.contract.delete({ where: { id: contractId } });

  revalidatePath(`/empresas/${companyId}`);
  redirect(`/empresas/${companyId}`);
}

// Apuração periódica de um contrato performance_fee — gainValue é o ganho em
// R$ que o cliente teve no período (entrada manual, ver lib/contracts.ts pro
// porquê); feeValue é calculado e congelado no momento da apuração.
export async function createPerformanceRecord(companyId: string, contractId: string, formData: FormData) {
  const session = await getSession();
  if (!session || session.role === "cliente") notFound();
  assertCompanyAccess(session, companyId);

  const contract = await prisma.contract.findUnique({ where: { id: contractId } });
  if (!contract || contract.companyId !== companyId) notFound();
  if (contract.type !== "performance_fee" || contract.feePercent == null) {
    redirect(`/empresas/${companyId}?error=contrato-invalido`);
  }

  const parsed = contractPerformanceRecordSchema.safeParse({
    period: formData.get("period"),
    gainValue: formData.get("gainValue"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) redirect(`/empresas/${companyId}?error=contrato-invalido`);

  const feeValue = computeFeeValue(parsed.data.gainValue, contract.feePercent);

  await prisma.contractPerformanceRecord.create({
    data: { contractId, period: parsed.data.period, gainValue: parsed.data.gainValue, feeValue, notes: parsed.data.notes },
  });

  revalidatePath(`/empresas/${companyId}`);
  redirect(`/empresas/${companyId}`);
}

export async function deletePerformanceRecord(companyId: string, contractId: string, recordId: string) {
  const session = await getSession();
  if (!session || session.role === "cliente") notFound();
  assertCompanyAccess(session, companyId);

  const record = await prisma.contractPerformanceRecord.findUnique({ where: { id: recordId } });
  if (!record || record.contractId !== contractId) notFound();

  const contract = await prisma.contract.findUnique({ where: { id: contractId } });
  if (!contract || contract.companyId !== companyId) notFound();

  await prisma.contractPerformanceRecord.delete({ where: { id: recordId } });

  revalidatePath(`/empresas/${companyId}`);
  redirect(`/empresas/${companyId}`);
}
