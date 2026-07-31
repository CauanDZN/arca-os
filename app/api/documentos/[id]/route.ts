import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) {
    return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
  }

  const session = await getSession();
  if (!session || (session.role === "cliente" && session.companyId !== doc.companyId)) {
    return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
  }

  // Proxied through our own route (not a direct link to the blob URL) so the
  // session/role check above runs on every download, same as when this read
  // straight from local disk.
  const blobResponse = await fetch(doc.storedUrl);
  if (!blobResponse.ok || !blobResponse.body) {
    return NextResponse.json({ error: "Arquivo não encontrado no armazenamento" }, { status: 404 });
  }

  return new NextResponse(blobResponse.body, {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.originalName)}"`,
    },
  });
}
