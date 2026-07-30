import { describe, it, expect } from "vitest";
import { renderReportPdf } from "@/lib/pdf";
import { buildReport, type AnswerInput } from "@/lib/scoring";
import { AREAS } from "@/lib/areas";
import type { AiNarrative } from "@/lib/ai";

function isPdfBuffer(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}

describe("renderReportPdf", () => {
  it("renders a valid PDF for a report with no answers", async () => {
    const report = buildReport([]);
    const buffer = await renderReportPdf({
      companyName: "Empresa Teste",
      segment: "Varejo",
      objectives: ["Organizar gestão"],
      report,
      aiNarrative: null,
    });
    expect(buffer.length).toBeGreaterThan(0);
    expect(isPdfBuffer(buffer)).toBe(true);
  });

  it("renders a valid PDF including AI narrative and area insights", async () => {
    const answers: AnswerInput[] = AREAS.flatMap((area) =>
      area.questions.map((q) => ({ areaKey: area.key, questionId: q.id, score: 0 }))
    );
    const report = buildReport(answers);

    const aiNarrative: AiNarrative = {
      executiveSummary: "A empresa está em estágio inicial de estruturação.",
      areaInsights: [
        {
          areaKey: "financeiro",
          causaRaiz: "Ausência de controle de caixa.",
          recomendacao: "Implantar fluxo de caixa semanal.",
        },
      ],
    };

    const buffer = await renderReportPdf({
      companyName: "Empresa Crítica",
      segment: "Serviços",
      objectives: ["Corrigir crise financeira"],
      report,
      aiNarrative,
    });

    expect(isPdfBuffer(buffer)).toBe(true);
    // a full 12-area critical report with the action plan should span multiple pages
    expect(buffer.length).toBeGreaterThan(2000);
  });
});
