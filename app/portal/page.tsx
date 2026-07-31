import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";

// /portal não tem conteúdo próprio: cliente vai direto pro portal da própria
// empresa; admin/consultor caem na lista de empresas (de onde abrem o portal
// de qualquer uma).
export default async function PortalIndexPage() {
  const session = await getSession();
  if (!session) notFound();

  if (session.role === "cliente" && session.companyId) {
    redirect(`/portal/${session.companyId}`);
  }
  redirect("/empresas");
}
