import { describe, it, expect } from "vitest";
import { aggregateDashboard, buildObservations, type CompanyForDashboard } from "@/lib/dashboard";
import { AREAS } from "@/lib/areas";
import { VERTICALS } from "@/lib/verticals";

type TaskInput = Partial<CompanyForDashboard["diagnostics"][number]["tasks"][number]>;

function makeCompany(name: string, segment: string, score: number, tasks: TaskInput[] = []): CompanyForDashboard {
  const answers = AREAS.flatMap((area) =>
    area.questions.map((q) => ({ areaKey: area.key, questionId: q.id, score }))
  );
  const fullTasks = tasks.map((t, i) => ({
    id: t.id ?? `${name}-task-${i}`,
    title: t.title ?? `Tarefa ${i}`,
    areaName: t.areaName ?? "Financeiro e Controladoria",
    status: t.status ?? "todo",
    dueDate: t.dueDate ?? null,
    responsible: t.responsible ?? "Alguém",
  }));
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
        tasks: fullTasks,
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
    expect(data.verticalAverages).toHaveLength(VERTICALS.length);
    for (const vertical of data.verticalAverages) {
      expect(vertical.average).toBeCloseTo(3.7, 1);
    }
    // Alfa (4) e Gama (5) caem no Nível 5, Beta (2) no Nível 3 — ver limiares em maturityLevelForScore.
    expect(data.levelDistribution.find((l) => l.level === 5)?.count).toBe(2);
    expect(data.levelDistribution.find((l) => l.level === 3)?.count).toBe(1);
    expect(data.levelDistribution.reduce((acc, l) => acc + l.count, 0)).toBe(3);
  });

  it("aponta tarefas atrasadas e sem responsável entre as empresas", () => {
    const past = new Date("2020-01-01");
    const data = aggregateDashboard([
      makeCompany("Alfa", "Varejo", 3, [
        { id: "t-atrasada", title: "Fechar DRE", areaName: "Financeiro", status: "todo", dueDate: past, responsible: "Ana" },
        { id: "t-sem-dono", title: "Montar funil", areaName: "Comercial", status: "doing", dueDate: null, responsible: "" },
        { id: "t-ok", title: "Ok", status: "done", dueDate: past, responsible: "" },
      ]),
    ]);

    const byId = Object.fromEntries(data.atRiskTasks.map((t) => [t.taskId, t]));
    expect(byId["t-atrasada"].reason).toBe("atrasada");
    expect(byId["t-atrasada"].companyName).toBe("Alfa");
    expect(byId["t-sem-dono"].reason).toBe("sem_responsavel");
    expect(byId["t-ok"]).toBeUndefined();
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

describe("buildObservations", () => {
  it("não gera observações quando não há nada para analisar", () => {
    const empty = makeCompany("Só Esqueleto", "Varejo", 3);
    empty.diagnostics = [];
    const data = aggregateDashboard([empty]);

    expect(buildObservations(data)).toEqual([]);
  });

  it("aponta gargalo, ponto forte e pendências em risco", () => {
    const data = aggregateDashboard([
      makeCompany("Alfa", "Varejo", 4, [
        { id: "t1", status: "todo", dueDate: new Date("2020-01-01"), responsible: "Ana" },
      ]),
    ]);

    const observations = buildObservations(data);
    expect(observations.some((o) => o.text.startsWith("Maior gargalo:"))).toBe(true);
    expect(observations.some((o) => o.text.includes("pendência") && o.text.includes("atrasada"))).toBe(true);
  });

  it("aponta grande dispersão de maturidade quando a carteira é heterogênea", () => {
    const data = aggregateDashboard([makeCompany("Topo", "Varejo", 5), makeCompany("Base", "Varejo", 1)]);

    const observations = buildObservations(data);
    expect(observations.some((o) => o.text.startsWith("Grande dispersão"))).toBe(true);
  });
});
