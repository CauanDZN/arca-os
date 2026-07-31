import { describe, it, expect } from "vitest";
import { aggregateDashboard, type CompanyForDashboard } from "@/lib/dashboard";
import { AREAS } from "@/lib/areas";

function makeCompany(name: string, segment: string, score: number, tasks: { status: string }[] = []): CompanyForDashboard {
  const answers = AREAS.flatMap((area) =>
    area.questions.map((q) => ({ areaKey: area.key, questionId: q.id, score }))
  );
  return {
    id: name,
    name,
    segment,
    diagnostics: [
      {
        id: `${name}-d1`,
        status: "concluido",
        createdAt: new Date("2026-01-15"),
        answers,
        tasks,
      },
    ],
  };
}

describe("aggregateDashboard", () => {
  it("calcula nota média, ranking e médias por área", () => {
    const data = aggregateDashboard([
      makeCompany("Alfa", "Varejo", 4),
      makeCompany("Beta", "Varejo", 2),
      makeCompany("Gama", "Serviços", 5),
    ]);

    expect(data.companyCount).toBe(3);
    expect(data.avgScore).toBeCloseTo(3.7, 1);
    expect(data.avgStatus).toBe("Gerenciado");
    expect(data.ranking.map((r) => r.name)).toEqual(["Gama", "Alfa", "Beta"]);
    expect(data.ranking[0].score).toBe(5);
    expect(data.ranking[2].score).toBe(2);
    expect(data.segments).toEqual([
      { segment: "Varejo", count: 2 },
      { segment: "Serviços", count: 1 },
    ]);
    expect(data.areaAverages).toHaveLength(AREAS.length);
    for (const area of data.areaAverages) {
      expect(area.average).toBeCloseTo(3.7, 1);
    }
  });

  it("ignora diagnóstico sem respostas na média, mas conta a empresa", () => {
    const empty = makeCompany("Vazia", "Indústria", 3);
    empty.diagnostics = [
      { id: "vazia-d1", status: "em_andamento", createdAt: new Date(), answers: [], tasks: [] },
    ];

    const data = aggregateDashboard([empty, makeCompany("Cheia", "Indústria", 3)]);

    expect(data.companyCount).toBe(2);
    expect(data.diagnosticCount).toBe(2);
    expect(data.avgScore).toBeCloseTo(3, 1);
    expect(data.ranking).toHaveLength(1);
    expect(data.ranking[0].name).toBe("Cheia");
  });

  it("calcula a execução do plano de ação", () => {
    const data = aggregateDashboard([
      makeCompany("Alfa", "Varejo", 3, [{ status: "done" }, { status: "done" }, { status: "todo" }]),
      makeCompany("Beta", "Varejo", 3, [{ status: "todo" }]),
    ]);

    expect(data.totalTasks).toBe(4);
    expect(data.doneTasks).toBe(2);
    expect(data.executionPct).toBe(50);
  });

  it("retorna nulls quando não há nada para analisar", () => {
    const empty = makeCompany("Só Esqueleto", "Varejo", 3);
    empty.diagnostics = [];

    const data = aggregateDashboard([empty]);

    expect(data.avgScore).toBeNull();
    expect(data.executionPct).toBeNull();
    expect(data.ranking).toHaveLength(0);
    expect(data.segments).toEqual([{ segment: "Varejo", count: 1 }]);
  });
});
