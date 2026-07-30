"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

export async function uploadDocument(companyId: string, formData: FormData) {
  const file = formData.get("file");
  const category = String(formData.get("category") ?? "geral");

  if (!(file instanceof File) || file.size === 0) {
    redirect(`/empresas/${companyId}/documentos`);
  }

  const companyDir = path.join(UPLOAD_ROOT, companyId);
  await fs.mkdir(companyDir, { recursive: true });

  const ext = path.extname(file.name);
  const storedName = `${crypto.randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(companyDir, storedName), buffer);

  await prisma.document.create({
    data: {
      companyId,
      category,
      originalName: file.name,
      storedName,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
    },
  });

  redirect(`/empresas/${companyId}/documentos`);
}

export async function deleteDocument(companyId: string, documentId: string) {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (doc && doc.companyId === companyId) {
    await fs.rm(path.join(UPLOAD_ROOT, companyId, doc.storedName), { force: true });
    await prisma.document.delete({ where: { id: documentId } });
  }
  redirect(`/empresas/${companyId}/documentos`);
}
