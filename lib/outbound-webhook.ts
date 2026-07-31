import { prisma } from "@/lib/prisma";

const TIMEOUT_MS = 5000;

/**
 * Fire-and-forget notification to the client's own ERP/CRM webhook receiver.
 * Never throws — a slow or broken external endpoint must not break the
 * Server Action that triggered it (same "never blocks the user" principle
 * as the AI agents in lib/ai.ts).
 */
export async function fireOutboundWebhook(
  companyId: string,
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { outboundWebhookUrl: true },
  });
  if (!company?.outboundWebhookUrl) return;

  try {
    await fetch(company.outboundWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, companyId, timestamp: new Date().toISOString(), data }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    console.error(`failed to fire outbound webhook for company ${companyId} (event ${event}):`, error);
  }
}
