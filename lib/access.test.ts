import { describe, it, expect } from "vitest";
import { getConsultorVerticalScope, isCompanyInConsultorScope } from "@/lib/access";
import type { Session } from "@/lib/session";

function session(overrides: Partial<Session>): Session {
  return {
    userId: "u1",
    name: "Teste",
    email: "teste@arca.com",
    role: "consultor",
    title: "",
    ...overrides,
  };
}

describe("getConsultorVerticalScope", () => {
  it("retorna null para admin, independente de assignedVerticals", () => {
    expect(getConsultorVerticalScope(session({ role: "admin", assignedVerticals: ["financeiro"] }))).toBeNull();
  });

  it("retorna null para consultor sem verticais atribuídas", () => {
    expect(getConsultorVerticalScope(session({ assignedVerticals: [] }))).toBeNull();
    expect(getConsultorVerticalScope(session({ assignedVerticals: undefined }))).toBeNull();
  });

  it("retorna o array de verticais para consultor escopado", () => {
    expect(getConsultorVerticalScope(session({ assignedVerticals: ["financeiro", "comercial"] }))).toEqual([
      "financeiro",
      "comercial",
    ]);
  });

  it("retorna null para sessão nula", () => {
    expect(getConsultorVerticalScope(null)).toBeNull();
  });
});

describe("isCompanyInConsultorScope", () => {
  it("sempre visível pra admin/cliente ou consultor sem escopo", () => {
    expect(isCompanyInConsultorScope(session({ role: "admin" }), ["financeiro"])).toBe(true);
    expect(isCompanyInConsultorScope(session({ assignedVerticals: [] }), [])).toBe(true);
  });

  it("visível se houver interseção entre contratadas e escopo do consultor", () => {
    const s = session({ assignedVerticals: ["financeiro"] });
    expect(isCompanyInConsultorScope(s, ["financeiro", "comercial"])).toBe(true);
  });

  it("invisível se não houver interseção", () => {
    const s = session({ assignedVerticals: ["financeiro"] });
    expect(isCompanyInConsultorScope(s, ["comercial", "marketing"])).toBe(false);
  });

  it("invisível pra empresa sem nenhuma vertical contratada, pra consultor escopado", () => {
    const s = session({ assignedVerticals: ["financeiro"] });
    expect(isCompanyInConsultorScope(s, [])).toBe(false);
  });
});
