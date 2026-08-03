import { describe, it, expect } from "vitest";
import { VERTICALS, verticalAverages, verticalForArea } from "@/lib/verticals";
import { AREAS } from "@/lib/areas";

describe("verticals", () => {
  it("has exactly 9 verticais and covers every area", () => {
    expect(VERTICALS).toHaveLength(9);
    const covered = new Set(VERTICALS.flatMap((v) => v.areaKeys));
    expect(covered.size).toBe(AREAS.length);
    for (const area of AREAS) {
      expect(covered.has(area.key)).toBe(true);
    }
  });

  it("maps each area to exactly one vertical", () => {
    for (const area of AREAS) {
      const match = VERTICALS.filter((v) => v.areaKeys.includes(area.key));
      expect(match).toHaveLength(1);
    }
  });

  it("verticalForArea resolves single and composite verticais", () => {
    expect(verticalForArea("financeiro")?.name).toBe("Financeiro e Controladoria");
    expect(verticalForArea("comercial")?.name).toBe("Comercial, Growth e Sucesso do Cliente");
    expect(verticalForArea("marketing")?.name).toBe("Marketing e Comunicação");
    expect(verticalForArea("compras")?.name).toBe("Operações e Suprimentos");
    expect(verticalForArea("fiscal")?.name).toBe("Fiscal, Jurídico e Compliance");
  });

  it("computes vertical averages from area scores, ignoring unscored areas", () => {
    const averages = verticalAverages([
      { areaKey: "financeiro", average: 4 },
      { areaKey: "comercial", average: 2 },
      { areaKey: "marketing", average: 2 },
      { areaKey: "atendimento", average: 5 },
    ]);

    const financeiro = averages.find((v) => v.key === "financeiro");
    const comercial = averages.find((v) => v.key === "comercial");
    const marketing = averages.find((v) => v.key === "marketing");
    const operacoes = averages.find((v) => v.key === "operacoes");

    expect(financeiro?.average).toBe(4);
    // (2 + 5) / 2 = 3.5 — comercial e atendimento
    expect(comercial?.average).toBe(3.5);
    // vertical própria, 1 área só
    expect(marketing?.average).toBe(2);
    // nenhuma área de Operações foi respondida -> 0
    expect(operacoes?.average).toBe(0);
  });
});
