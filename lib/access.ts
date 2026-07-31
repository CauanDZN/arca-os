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
