import { describe, it, expect } from "vitest";
import { auditDataQuality, type CompanyAuditInput } from "@/lib/data-quality";

function baseCompany(overrides: Partial<CompanyAuditInput> = {}): CompanyAuditInput {
  return {
    companyId: "c1",
    companyName: "Empresa Teste",
    diagnostics: [],
    openTasksWithoutResponsible: 0,
    ...overrides,
  };
}

describe("auditDataQuality", () => {
  it("flags a company whose only diagnostics never left em_andamento", () => {
    const issues = auditDataQuality([
      baseCompany({ diagnostics: [{ id: "d1", status: "em_andamento", answers: [] }] }),
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe("sem_diagnostico_concluido");
  });

  it("does not flag a company with no diagnostics at all (freshly created, not abandoned mid-flow)", () => {
    const issues = auditDataQuality([baseCompany({ diagnostics: [] })]);
    expect(issues).toHaveLength(0);
  });

  it("flags a finished diagnostic where every answer has blank evidence", () => {
    const issues = auditDataQuality([
      baseCompany({
        diagnostics: [
          { id: "d1", status: "concluido", answers: [{ score: 3, evidence: "" }, { score: 1, evidence: "  " }] },
        ],
      }),
    ]);
    expect(issues.map((i) => i.type)).toContain("sem_evidencia");
  });

  it("does not flag a diagnostic where at least one answer has evidence", () => {
    const issues = auditDataQuality([
      baseCompany({
        diagnostics: [
          { id: "d1", status: "concluido", answers: [{ score: 3, evidence: "print anexado" }, { score: 1, evidence: "" }] },
        ],
      }),
    ]);
    expect(issues.map((i) => i.type)).not.toContain("sem_evidencia");
  });

  it("flags a finished diagnostic where every score is 0 (likely test data)", () => {
    const issues = auditDataQuality([
      baseCompany({
        diagnostics: [{ id: "d1", status: "em_execucao", answers: [{ score: 0, evidence: "" }, { score: 0, evidence: "" }] }],
      }),
    ]);
    expect(issues.map((i) => i.type)).toContain("notas_zeradas");
  });

  it("does not flag a diagnostic with mixed scores", () => {
    const issues = auditDataQuality([
      baseCompany({
        diagnostics: [{ id: "d1", status: "concluido", answers: [{ score: 0, evidence: "" }, { score: 3, evidence: "" }] }],
      }),
    ]);
    expect(issues.map((i) => i.type)).not.toContain("notas_zeradas");
  });

  it("flags open tasks without a responsible", () => {
    const issues = auditDataQuality([baseCompany({ openTasksWithoutResponsible: 4 })]);
    expect(issues).toHaveLength(1);
    expect(issues[0].detail).toContain("4");
  });

  it("returns no issues for a clean company", () => {
    const issues = auditDataQuality([
      baseCompany({
        diagnostics: [
          { id: "d1", status: "concluido", answers: [{ score: 3, evidence: "evidência real" }] },
        ],
        openTasksWithoutResponsible: 0,
      }),
    ]);
    expect(issues).toHaveLength(0);
  });
});
