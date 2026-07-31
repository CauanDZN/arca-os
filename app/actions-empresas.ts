"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";

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
