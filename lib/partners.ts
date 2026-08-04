// KPIs da Vertical Parceira (plano estratégico, p. 16): +50 parceiros
// homologados ativos, ≥90% satisfação, ≤48h SLA, 15% receita indireta,
// ≥70% taxa de recompra, ≥85 NPS Arca Partner. Receita indireta já é
// somável direto de PartnerReferral.commissionValue — os outros 4 precisam
// de agregação, que é o que este arquivo faz. Funções puras, sem consulta
// ao banco, pro mesmo motivo de lib/contracts.ts: testável sem Postgres.

export type ReferralForSatisfaction = { clientSatisfaction: number | null };

export function averageClientSatisfaction(referrals: ReferralForSatisfaction[]): number | null {
  const scored = referrals.filter((r) => r.clientSatisfaction != null) as { clientSatisfaction: number }[];
  if (scored.length === 0) return null;
  const sum = scored.reduce((acc, r) => acc + r.clientSatisfaction, 0);
  return Math.round((sum / scored.length) * 10) / 10;
}

export type PartnerForNps = { npsScore: number | null };

export function averageNps(partners: PartnerForNps[]): number | null {
  const scored = partners.filter((p) => p.npsScore != null) as { npsScore: number }[];
  if (scored.length === 0) return null;
  const sum = scored.reduce((acc, p) => acc + p.npsScore, 0);
  return Math.round(sum / scored.length);
}

export type ReferralForRepeatRate = { partnerId: string; status: string };

// "Taxa de recompra de parceiros": entre os parceiros com ao menos uma
// indicação concluída, qual % teve uma SEGUNDA indicação concluída — sinal
// de que o cliente voltou a pedir aquele parceiro, não só experimentou uma vez.
export function repeatPartnerRate(referrals: ReferralForRepeatRate[]): number | null {
  const concludedCountByPartner = new Map<string, number>();
  for (const r of referrals) {
    if (r.status !== "concluido") continue;
    concludedCountByPartner.set(r.partnerId, (concludedCountByPartner.get(r.partnerId) ?? 0) + 1);
  }
  const partnersWithAtLeastOne = concludedCountByPartner.size;
  if (partnersWithAtLeastOne === 0) return null;
  const partnersWithRepeat = [...concludedCountByPartner.values()].filter((count) => count >= 2).length;
  return Math.round((partnersWithRepeat / partnersWithAtLeastOne) * 1000) / 10;
}

export type ReferralForSla = { createdAt: Date; respondedAt: Date | null; partner: { slaHours: number | null } };

// SLA realizado: entre as indicações já respondidas por um parceiro com meta
// de SLA definida, qual % respondeu dentro do prazo. Indicações sem resposta
// ainda ou sem meta de SLA no parceiro não entram na conta — não são nem
// sucesso nem falha, são "ainda não sei".
export function slaComplianceRate(referrals: ReferralForSla[]): number | null {
  const measurable = referrals.filter((r) => r.respondedAt !== null && r.partner.slaHours != null);
  if (measurable.length === 0) return null;

  const withinSla = measurable.filter((r) => {
    const hoursElapsed = (r.respondedAt!.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60);
    return hoursElapsed <= r.partner.slaHours!;
  }).length;

  return Math.round((withinSla / measurable.length) * 1000) / 10;
}
