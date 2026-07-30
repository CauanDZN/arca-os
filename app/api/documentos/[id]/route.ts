import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) {
    return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
  }

  const filePath = path.join(UPLOAD_ROOT, doc.companyId, doc.storedName);
  try {
    const buffer = await fs.readFile(filePath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.originalName)}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Arquivo não encontrado no disco" }, { status: 404 });
  }
}
