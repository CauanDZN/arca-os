import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const MAX_PAYLOAD_CHARS = 20000;

// Unauthenticated on purpose — this is called by external systems (ERP/CRM/
// automation tools), not by a logged-in browser session. The per-company
// webhookToken (generated on demand in the Data Room UI) is the only guard,
// same trust model as any other webhook receiver: a long random secret in
// the URL instead of a cookie.
export async function POST(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { webhookToken: true },
  });

  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? request.headers.get("x-webhook-token");

  if (!company || !company.webhookToken || token !== company.webhookToken) {
    return NextResponse.json({ error: "Webhook não encontrado ou token inválido" }, { status: 404 });
  }

  const rawBody = await request.text();
  const payload = rawBody.length > MAX_PAYLOAD_CHARS ? rawBody.slice(0, MAX_PAYLOAD_CHARS) : rawBody;
  const source = url.searchParams.get("source") ?? request.headers.get("user-agent") ?? "";

  await prisma.webhookEvent.create({
    data: { companyId, source: source.slice(0, 200), payload },
  });

  return NextResponse.json({ ok: true });
}
