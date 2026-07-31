"use server";

import { prisma } from "@/lib/prisma";
import { classifyDocument, extractKpiSuggestions } from "@/lib/ai";
import { documentCategorySchema } from "@/lib/validation";
import { getSession } from "@/lib/auth";
import { assertCompanyAccess } from "@/lib/access";
import { getAreaByKey } from "@/lib/areas";
import { redirect } from "next/navigation";
import crypto from "crypto";

// @vercel/blob and lib/document-extract (which pulls in pdf-parse/pdfjs-dist,
// an ESM-only dependency) are loaded lazily inside the actions instead of at
// module load. Pages import this file for the Server Actions, and statically
// importing those heavy deps here dragged them into the page bundle — that's
// what made /empresas/[id]/documentos fail at runtime with
// FUNCTION_INVOCATION_FAILED even though the build passed locally.

export async function uploadDocument(companyId: string, formData: FormData) {
  assertCompanyAccess(await getSession(), companyId);

  const file = formData.get("file");
  const categoryResult = documentCategorySchema.safeParse(String(formData.get("category") ?? "geral"));
  const category = categoryResult.success ? categoryResult.data : "geral";

  if (!(file instanceof File) || file.size === 0) {
    redirect(`/empresas/${companyId}/documentos`);
  }

  const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  const storedName = `${crypto.randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "application/octet-stream";

  // Blobs are public-by-URL (Vercel Blob has no private-access tier yet), but
  // that URL is never shown to the browser directly — the Data Room UI links
  // to our own /api/documentos/[id] route, which re-checks session/role
  // before proxying the bytes. Same access-gating as the old local-disk setup.
  const { put } = await import("@vercel/blob");
  const blob = await put(`${companyId}/${storedName}`, buffer, {
    access: "public",
    contentType: mimeType,
  });

  const { extractDocumentText } = await import("@/lib/document-extract");
  const extractedText = await extractDocumentText(buffer, mimeType);
  const classification = await classifyDocument(file.name, mimeType, extractedText);

  const document = await prisma.document.create({
    data: {
      companyId,
      category,
      originalName: file.name,
      storedUrl: blob.url,
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
    const { del } = await import("@vercel/blob");
    await del(doc.storedUrl);
    await prisma.document.delete({ where: { id: documentId } });
  }
  redirect(`/empresas/${companyId}/documentos`);
}
