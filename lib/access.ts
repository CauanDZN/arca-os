import { notFound } from "next/navigation";
import type { Session } from "@/lib/session";

/**
 * Cliente role is scoped to their own company; admin/consultor see
 * everything. Used both in pages (after fetching a diagnostic/company, since
 * middleware can't do the DB lookup) and in every mutating Server Action, so
 * a crafted request that bypasses the UI can't reach another company's data.
 */
export function assertCompanyAccess(session: Session | null, companyId: string): void {
  if (!session) notFound();
  if (session.role === "cliente" && session.companyId !== companyId) notFound();
}

/**
 * A "consultor" with assignedVerticals set only works the companies/verticals
 * atribuídas a ele (organograma por vertical do plano estratégico) — sem
 * atribuição (array vazio/ausente), o consultor vê a carteira inteira, igual
 * ao comportamento anterior a esse recurso. Retorna null = sem restrição.
 */
export function getConsultorVerticalScope(session: Session | null): string[] | null {
  if (!session || session.role !== "consultor") return null;
  if (!session.assignedVerticals || session.assignedVerticals.length === 0) return null;
  return session.assignedVerticals;
}

// Uma empresa é visível pra um consultor escopado se pelo menos uma das
// verticais contratadas por ela estiver no escopo dele. Empresa sem nenhuma
// vertical contratada ainda não aparece pra consultor escopado — quem monta
// o contrato inicial é admin ou um consultor sem escopo.
export function isCompanyInConsultorScope(
  session: Session | null,
  contractedVerticalKeys: string[]
): boolean {
  const scope = getConsultorVerticalScope(session);
  if (!scope) return true;
  return contractedVerticalKeys.some((key) => scope.includes(key));
}

export function assertVerticalAccess(session: Session | null, verticalKey: string): void {
  const scope = getConsultorVerticalScope(session);
  if (scope && !scope.includes(verticalKey)) notFound();
}
