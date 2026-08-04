import { describe, it, expect } from "vitest";
import { KPI_TARGET_SUGGESTIONS, suggestionsForVertical } from "@/lib/kpi-targets";
import { AREAS } from "@/lib/areas";
import { VERTICALS, getVerticalByKey } from "@/lib/verticals";

describe("KPI_TARGET_SUGGESTIONS", () => {
  it("toda sugestão aponta pra uma vertical real", () => {
    for (const s of KPI_TARGET_SUGGESTIONS) {
      expect(VERTICALS.some((v) => v.key === s.verticalKey), `vertical desconhecida: ${s.verticalKey}`).toBe(true);
    }
  });

  it("toda sugestão aponta pra uma área que pertence à vertical declarada", () => {
    for (const s of KPI_TARGET_SUGGESTIONS) {
      const vertical = getVerticalByKey(s.verticalKey);
      expect(vertical?.areaKeys, `vertical ${s.verticalKey} não encontrada`).toBeDefined();
      expect(
        vertical!.areaKeys.includes(s.areaKey),
        `área ${s.areaKey} não pertence à vertical ${s.verticalKey}`
      ).toBe(true);
    }
  });

  it("todo indicatorName existe de fato na área correspondente em lib/areas.ts", () => {
    for (const s of KPI_TARGET_SUGGESTIONS) {
      const area = AREAS.find((a) => a.key === s.areaKey);
      expect(area, `área desconhecida: ${s.areaKey}`).toBeDefined();
      expect(
        area!.indicators.includes(s.indicatorName),
        `indicador "${s.indicatorName}" não existe na área ${s.areaKey}`
      ).toBe(true);
    }
  });

  it("sugestões kind=nivel sempre têm value numérico; kind=delta nunca têm", () => {
    for (const s of KPI_TARGET_SUGGESTIONS) {
      if (s.kind === "nivel") {
        expect(s.value, `${s.verticalKey}/${s.indicatorName} é nivel mas value é null`).not.toBeNull();
      } else {
        expect(s.value, `${s.verticalKey}/${s.indicatorName} é delta mas value não é null`).toBeNull();
      }
    }
  });

  it("suggestionsForVertical filtra corretamente", () => {
    const comercial = suggestionsForVertical("comercial");
    expect(comercial.length).toBeGreaterThan(0);
    expect(comercial.every((s) => s.verticalKey === "comercial")).toBe(true);

    expect(suggestionsForVertical("gestao_rotina")).toEqual([]);
  });
});
