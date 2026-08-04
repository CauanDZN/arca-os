import { describe, it, expect } from "vitest";
import { averageClientSatisfaction, averageNps, repeatPartnerRate, slaComplianceRate } from "@/lib/partners";

describe("averageClientSatisfaction", () => {
  it("averages only scored referrals", () => {
    expect(
      averageClientSatisfaction([{ clientSatisfaction: 90 }, { clientSatisfaction: 80 }, { clientSatisfaction: null }])
    ).toBe(85);
  });

  it("returns null when nothing is scored", () => {
    expect(averageClientSatisfaction([{ clientSatisfaction: null }])).toBeNull();
    expect(averageClientSatisfaction([])).toBeNull();
  });
});

describe("averageNps", () => {
  it("averages only scored partners", () => {
    expect(averageNps([{ npsScore: 90 }, { npsScore: 70 }, { npsScore: null }])).toBe(80);
  });

  it("returns null when nothing is scored", () => {
    expect(averageNps([{ npsScore: null }])).toBeNull();
  });
});

describe("repeatPartnerRate", () => {
  it("computes the % of partners with 2+ concluded referrals among those with at least 1", () => {
    const referrals = [
      { partnerId: "a", status: "concluido" },
      { partnerId: "a", status: "concluido" }, // parceiro A: 2 concluídas -> recompra
      { partnerId: "b", status: "concluido" }, // parceiro B: 1 concluída -> sem recompra
      { partnerId: "c", status: "indicado" }, // parceiro C: nenhuma concluída -> fora da conta
    ];
    // 1 de 2 parceiros com ao menos 1 concluída teve recompra = 50%
    expect(repeatPartnerRate(referrals)).toBe(50);
  });

  it("returns null when no partner has a concluded referral", () => {
    expect(repeatPartnerRate([{ partnerId: "a", status: "indicado" }])).toBeNull();
    expect(repeatPartnerRate([])).toBeNull();
  });

  it("returns 100 when every partner with a concluded referral has a repeat", () => {
    const referrals = [
      { partnerId: "a", status: "concluido" },
      { partnerId: "a", status: "concluido" },
      { partnerId: "b", status: "concluido" },
      { partnerId: "b", status: "concluido" },
    ];
    expect(repeatPartnerRate(referrals)).toBe(100);
  });
});

describe("slaComplianceRate", () => {
  it("computes the % of responded referrals within the partner's SLA target", () => {
    const referrals = [
      {
        createdAt: new Date("2026-01-01T00:00:00Z"),
        respondedAt: new Date("2026-01-02T00:00:00Z"), // 24h — dentro do SLA de 48h
        partner: { slaHours: 48 },
      },
      {
        createdAt: new Date("2026-01-01T00:00:00Z"),
        respondedAt: new Date("2026-01-05T00:00:00Z"), // 96h — fora do SLA de 48h
        partner: { slaHours: 48 },
      },
    ];
    expect(slaComplianceRate(referrals)).toBe(50);
  });

  it("ignores referrals without a response or without a SLA target on the partner", () => {
    const referrals = [
      { createdAt: new Date("2026-01-01T00:00:00Z"), respondedAt: null, partner: { slaHours: 48 } },
      {
        createdAt: new Date("2026-01-01T00:00:00Z"),
        respondedAt: new Date("2026-01-02T00:00:00Z"),
        partner: { slaHours: null },
      },
    ];
    expect(slaComplianceRate(referrals)).toBeNull();
  });

  it("treats exactly-on-time responses as compliant", () => {
    const referrals = [
      {
        createdAt: new Date("2026-01-01T00:00:00Z"),
        respondedAt: new Date("2026-01-03T00:00:00Z"), // exatamente 48h
        partner: { slaHours: 48 },
      },
    ];
    expect(slaComplianceRate(referrals)).toBe(100);
  });
});
