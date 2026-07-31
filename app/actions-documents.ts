"use server";

import { prisma } from "@/lib/prisma";
import { extractDocumentText } from "@/lib/document-extract";
import { classifyDocument, extractKpiSuggestions } from "@/lib/ai";
import { documentCategorySchema } from "@/lib/validation";
import { getSession } from "@/lib/auth";
import { assertCompanyAccess } from "@/lib/access";
import { getAreaByKey } from "@/lib/areas";
import { redirect } from "next/navigation";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

export async function uploadDocument(companyId: string, formData: FormData) {
  assertCompanyAccess(await getSession(), companyId);

  const file = formData.get("file");
  const categoryResult = documentCategorySchema.safeParse(String(formData.get("category") ?? "geral"));
  const category = categoryResult.success ? categoryResult.data : "geral";

  if (!(file instanceof File) || file.size === 0) {
    redirect(`/empresas/${companyId}/documentos`);
  }

  const companyDir = path.join(UPLOAD_ROOT, companyId);
  await fs.mkdir(companyDir, { recursive: true });

  const ext = path.extname(file.name);
  const storedName = `${crypto.randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(companyDir, storedName), buffer);

  const mimeType = file.type || "application/octet-stream";
  const extractedText = await extractDocumentText(buffer, mimeType);
  const classification = await classifyDocument(file.name, mimeType, extractedText);

  const document = await prisma.document.create({
    data: {
      companyId,
      category,
      originalName: file.name,
      storedName,
      mimeType,
      size: file.size,
      aiSuggestedCategory: classification?.category ?? null,
      aiConfidence: classification?.confidence ?? null,
    },
  });

  // Only attempt KPI extraction when the document was filed under a specific
  // area — "geral" has no fixed indicator vocabulary to constrain the model to.
  const area = getAreaByKey(category);
  if (area && extractedText) {
    const suggestions = await extractKpiSuggestions(area.name, area.indicators, extractedText);
    if (suggestions && suggestions.length > 0) {
      await prisma.kpiSuggestion.createMany({
        data: suggestions.map((s) => ({
          documentId: document.id,
          companyId,
          areaKey: area.key,
          indicatorName: s.indicatorName,
          month: s.month,
          value: s.value,
        })),
      });
    }
  }

  redirect(`/empresas/${companyId}/documentos`);
}

export async function deleteDocument(companyId: string, documentId: string) {
  assertCompanyAccess(await getSession(), companyId);

  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (doc && doc.companyId === companyId) {
    await fs.rm(path.join(UPLOAD_ROOT, companyId, doc.storedName), { force: true });
    await prisma.document.delete({ where: { id: documentId } });
  }
  redirect(`/empresas/${companyId}/documentos`);
}
