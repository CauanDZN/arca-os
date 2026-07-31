import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import { AREAS } from "@/lib/areas";
import type { Session } from "@/lib/session";

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

const mockGetSession = vi.hoisted(() => vi.fn());
const mockSetSessionCookie = vi.hoisted(() => vi.fn());
const mockClearSessionCookie = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  getSession: mockGetSession,
  setSessionCookie: mockSetSessionCookie,
  clearSessionCookie: mockClearSessionCookie,
}));

const ADMIN_SESSION: Session = {
  userId: "admin-test",
  name: "Admin Teste",
  email: "admin@test.com",
  role: "admin",
  title: "CEO / Head BTO",
};

// Every existing test in this file predates the RBAC layer and assumes
// unrestricted access — default the mocked session to admin so none of them
// need to know about auth. Tests that specifically exercise the "cliente"
// scoping override this per-test.
beforeEach(() => {
  mockGetSession.mockReset();
  mockGetSession.mockResolvedValue(ADMIN_SESSION);
  mockSetSessionCookie.mockReset();
  mockClearSessionCookie.mockReset();
});

import { prisma } from "@/lib/prisma";
import { createDiagnostic, saveAreaAnswers } from "@/app/actions";
import {
  approveActionPlan,
  moveTask,
  updateTaskDetails,
  createSprint,
  deleteSprint,
  createEpic,
  deleteEpic,
} from "@/app/actions-project";
import { uploadDocument, deleteDocument } from "@/app/actions-documents";
import { generateVerticalInsightAction } from "@/app/actions-vertical";
import { createMeetingNote, deleteMeetingNote } from "@/app/actions-meetings";
import { upsertKpiEntry, deleteKpiEntry, applyKpiSuggestion, rejectKpiSuggestion } from "@/app/actions-kpis";
import { login, logout } from "@/app/actions-auth";

async function expectRedirect(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    const message = (error as Error).message;
    expect(message).toMatch(/^REDIRECT:/);
    return message.replace("REDIRECT:", "");
  }
  throw new Error("expected a redirect, but the action returned normally");
}

async function expectNotFound(promise: Promise<unknown>): Promise<void> {
  await expect(promise).rejects.toThrow("NOT_FOUND");
}

function minimalCompanyForm(name: string, extraObjectives: string[] = ["Organizar gestão"]) {
  const fd = new FormData();
  fd.set("name", name);
  fd.set("segment", "Tecnologia");
  fd.set("marketAge", "3 anos");
  fd.set("employees", "10");
  fd.set("avgRevenue", "R$ 50.000");
  fd.set("margin", "15%");
  fd.set("activeClients", "20");
  fd.set("productsServices", "Software");
  fd.set("cities", "Remoto");
  fd.set("painPoints", "Falta de processos");
  for (const objective of extraObjectives) fd.append("objectives", objective);
  return fd;
}

function areaAnswersForm(areaKey: string, score: number) {
  const area = AREAS.find((a) => a.key === areaKey)!;
  const fd = new FormData();
  for (const q of area.questions) {
    fd.set(q.id, String(score));
    fd.set(`${q.id}__evidence`, `evidência de teste para ${q.id}`);
    fd.set(`${q.id}__responsible`, "Responsável Teste");
    fd.set(`${q.id}__impact`, "Alto");
    fd.set(`${q.id}__urgency`, "Alta");
    fd.set(`${q.id}__risk`, "Financeiro");
  }
  return fd;
}

async function createTestCompany(name: string): Promise<string> {
  const redirectUrl = await expectRedirect(createDiagnostic(minimalCompanyForm(name)));
  const company = await prisma.company.findFirstOrThrow({ where: { name } });
  const diagnosticId = redirectUrl.match(/\/diagnostico\/([^/]+)\//)![1];
  const diagnostic = await prisma.diagnostic.findFirstOrThrow({ where: { companyId: company.id } });
  expect(diagnosticId).toBe(diagnostic.id);
  return diagnostic.id;
}

async function completeAllAreas(diagnosticId: string, score: number) {
  for (const area of AREAS) {
    await expectRedirect(saveAreaAnswers(diagnosticId, area.key, areaAnswersForm(area.key, score)));
  }
}

describe("createDiagnostic", () => {
  it("creates the Company and Diagnostic and redirects to the first area", async () => {
    const diagnosticId = await createTestCompany("Empresa Integração Criação");
    const diagnostic = await prisma.diagnostic.findUniqueOrThrow({ where: { id: diagnosticId } });
    expect(diagnostic.status).toBe("em_andamento");

    const company = await prisma.company.findUniqueOrThrow({ where: { id: diagnostic.companyId } });
    expect(company.name).toBe("Empresa Integração Criação");
    expect(JSON.parse(company.objectives)).toEqual(["Organizar gestão"]);
  });
});

describe("saveAreaAnswers", () => {
  it("persists score plus evidência/responsável/impacto/urgência/risco and advances to the next area", async () => {
    const diagnosticId = await createTestCompany("Empresa Integração Área");
    const firstArea = AREAS[0];

    const redirectUrl = await expectRedirect(
      saveAreaAnswers(diagnosticId, firstArea.key, areaAnswersForm(firstArea.key, 3))
    );
    expect(redirectUrl).toBe(`/diagnostico/${diagnosticId}/questionario/${AREAS[1].key}`);

    const answers = await prisma.answer.findMany({ where: { diagnosticId, areaKey: firstArea.key } });
    expect(answers).toHaveLength(firstArea.questions.length);
    for (const answer of answers) {
      expect(answer.score).toBe(3);
      expect(answer.evidence).toContain("evidência de teste");
      expect(answer.responsible).toBe("Responsável Teste");
      expect(answer.impact).toBe("Alto");
      expect(answer.urgency).toBe("Alta");
      expect(answer.risk).toBe("Financeiro");
    }
  });

  it("completing the last area marks the diagnostic as concluido, with AI narrative gracefully null without a key", async () => {
    expect(process.env.GEMINI_API_KEY).toBeUndefined();

    const diagnosticId = await createTestCompany("Empresa Integração Conclusão");
    const lastArea = AREAS[AREAS.length - 1];

    const redirectUrl = await expectRedirect(
      saveAreaAnswers(diagnosticId, lastArea.key, areaAnswersForm(lastArea.key, 2))
    );
    expect(redirectUrl).toBe(`/diagnostico/${diagnosticId}/relatorio`);

    const diagnostic = await prisma.diagnostic.findUniqueOrThrow({ where: { id: diagnosticId } });
    expect(diagnostic.status).toBe("concluido");
    expect(diagnostic.aiNarrative).toBeNull();
  });
});

describe("approveActionPlan + moveTask (Kanban)", () => {
  it("generates one task per action-plan item and lets tasks move across the board", async () => {
    const diagnosticId = await createTestCompany("Empresa Integração Kanban");
    await completeAllAreas(diagnosticId, 0);

    const redirectUrl = await expectRedirect(approveActionPlan(diagnosticId));
    expect(redirectUrl).toBe(`/diagnostico/${diagnosticId}/projeto`);

    const tasks = await prisma.task.findMany({ where: { diagnosticId } });
    // an all-zero, fully answered diagnostic yields 3 weakest questions per area (12 areas)
    expect(tasks).toHaveLength(12 * 3);
    expect(tasks.every((t) => t.status === "todo")).toBe(true);

    const diagnostic = await prisma.diagnostic.findUniqueOrThrow({ where: { id: diagnosticId } });
    expect(diagnostic.status).toBe("em_execucao");

    const [task] = tasks;
    await expectRedirect(moveTask(diagnosticId, task.id, "forward"));
    let moved = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(moved.status).toBe("doing");

    await expectRedirect(moveTask(diagnosticId, task.id, "forward"));
    moved = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(moved.status).toBe("done");

    // forward from "done" is a no-op clamp, not an error
    await expectRedirect(moveTask(diagnosticId, task.id, "forward"));
    moved = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(moved.status).toBe("done");
  });

  it("auto-creates one épico per area touched by the plan and leaves rootCause blank without an AI narrative", async () => {
    const diagnosticId = await createTestCompany("Empresa Integração Épicos");
    await completeAllAreas(diagnosticId, 0);
    await expectRedirect(approveActionPlan(diagnosticId));

    const tasks = await prisma.task.findMany({ where: { diagnosticId } });
    const areaKeys = new Set(tasks.map((t) => t.areaKey));
    const epics = await prisma.epic.findMany({ where: { diagnosticId } });

    expect(epics).toHaveLength(areaKeys.size);
    expect(tasks.every((t) => t.epicId !== null)).toBe(true);
    // no GEMINI_API_KEY in the test env — aiNarrative is null, so there's no
    // causaRaiz to auto-populate; rootCause must fall back to "", not crash
    expect(tasks.every((t) => t.rootCause === "")).toBe(true);
  });

  it("is idempotent: approving an already-approved plan does not duplicate tasks", async () => {
    const diagnosticId = await createTestCompany("Empresa Integração Kanban Idempotente");
    await completeAllAreas(diagnosticId, 0);

    await expectRedirect(approveActionPlan(diagnosticId));
    const firstCount = await prisma.task.count({ where: { diagnosticId } });

    await expectRedirect(approveActionPlan(diagnosticId));
    const secondCount = await prisma.task.count({ where: { diagnosticId } });

    expect(secondCount).toBe(firstCount);
  });

  it("moveTask records a TaskEvent per status change but not on a clamped no-op", async () => {
    const diagnosticId = await createTestCompany("Empresa Integração Kanban Eventos");
    await completeAllAreas(diagnosticId, 0);
    await expectRedirect(approveActionPlan(diagnosticId));
    const [task] = await prisma.task.findMany({ where: { diagnosticId } });

    await expectRedirect(moveTask(diagnosticId, task.id, "forward"));
    await expectRedirect(moveTask(diagnosticId, task.id, "forward"));
    // clamped: already "done", forward is a no-op and must not log a fake event
    await expectRedirect(moveTask(diagnosticId, task.id, "forward"));

    const events = await prisma.taskEvent.findMany({
      where: { taskId: task.id },
      orderBy: { createdAt: "asc" },
    });
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ fromStatus: "todo", toStatus: "doing" });
    expect(events[1]).toMatchObject({ fromStatus: "doing", toStatus: "done" });
  });

  it("updateTaskDetails persists a standardized responsible name and due date", async () => {
    const diagnosticId = await createTestCompany("Empresa Integração Kanban Detalhes");
    await completeAllAreas(diagnosticId, 0);
    await expectRedirect(approveActionPlan(diagnosticId));
    const [task] = await prisma.task.findMany({ where: { diagnosticId } });

    const fd = new FormData();
    fd.set("responsible", "  Ana Souza  ");
    fd.set("dueDate", "2026-01-01");
    await expectRedirect(updateTaskDetails(diagnosticId, task.id, fd));

    const updated = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(updated.responsible).toBe("Ana Souza");
    expect(updated.dueDate?.toISOString().slice(0, 10)).toBe("2026-01-01");
  });

  it("createSprint validates the date range and lets tasks be assigned to it via updateTaskDetails", async () => {
    const diagnosticId = await createTestCompany("Empresa Integração Sprints");
    await completeAllAreas(diagnosticId, 0);
    await expectRedirect(approveActionPlan(diagnosticId));
    const [task] = await prisma.task.findMany({ where: { diagnosticId } });

    const fd = new FormData();
    fd.set("name", "Sprint 1 — Organização Financeira");
    fd.set("goal", "Implantar DRE gerencial");
    fd.set("startDate", "2026-08-01");
    fd.set("endDate", "2026-08-15");
    const redirectUrl = await expectRedirect(createSprint(diagnosticId, fd));
    expect(redirectUrl).toBe(`/diagnostico/${diagnosticId}/projeto`);

    const sprint = await prisma.sprint.findFirstOrThrow({ where: { diagnosticId } });
    expect(sprint.name).toBe("Sprint 1 — Organização Financeira");

    const invalidFd = new FormData();
    invalidFd.set("name", "Sprint invertido");
    invalidFd.set("startDate", "2026-08-15");
    invalidFd.set("endDate", "2026-08-01");
    await expect(createSprint(diagnosticId, invalidFd)).rejects.toThrow();

    const assignFd = new FormData();
    assignFd.set("responsible", "");
    assignFd.set("dueDate", "");
    assignFd.set("sprintId", sprint.id);
    await expectRedirect(updateTaskDetails(diagnosticId, task.id, assignFd));
    let updatedTask = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(updatedTask.sprintId).toBe(sprint.id);

    await expectRedirect(deleteSprint(diagnosticId, sprint.id));
    expect(await prisma.sprint.findUnique({ where: { id: sprint.id } })).toBeNull();
    // deleting a sprint unassigns its tasks instead of deleting them (onDelete: SetNull)
    updatedTask = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(updatedTask.sprintId).toBeNull();
  });

  it("createEpic/deleteEpic manage a custom épico independent of the auto-created ones", async () => {
    const diagnosticId = await createTestCompany("Empresa Integração Épicos Manuais");
    await completeAllAreas(diagnosticId, 0);
    await expectRedirect(approveActionPlan(diagnosticId));
    const [task] = await prisma.task.findMany({ where: { diagnosticId } });

    const fd = new FormData();
    fd.set("name", "Governança e Compliance");
    fd.set("description", "Itens transversais");
    const redirectUrl = await expectRedirect(createEpic(diagnosticId, fd));
    expect(redirectUrl).toBe(`/diagnostico/${diagnosticId}/projeto`);

    const epic = await prisma.epic.findFirstOrThrow({ where: { diagnosticId, name: "Governança e Compliance" } });

    const assignFd = new FormData();
    assignFd.set("responsible", "");
    assignFd.set("dueDate", "");
    assignFd.set("epicId", epic.id);
    await expectRedirect(updateTaskDetails(diagnosticId, task.id, assignFd));
    let updatedTask = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(updatedTask.epicId).toBe(epic.id);

    await expectRedirect(deleteEpic(diagnosticId, epic.id));
    expect(await prisma.epic.findUnique({ where: { id: epic.id } })).toBeNull();
    updatedTask = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(updatedTask.epicId).toBeNull();
  });

  it("updateTaskDetails persists indicador de sucesso, dependências e evidência de conclusão", async () => {
    const diagnosticId = await createTestCompany("Empresa Integração Campos Plano");
    await completeAllAreas(diagnosticId, 0);
    await expectRedirect(approveActionPlan(diagnosticId));
    const [task] = await prisma.task.findMany({ where: { diagnosticId } });

    const fd = new FormData();
    fd.set("responsible", "");
    fd.set("dueDate", "");
    fd.set("successIndicator", "DRE fechado até o 5º dia útil");
    fd.set("dependencies", "Acesso ao sistema financeiro");
    fd.set("completionEvidence", "Print do relatório assinado");
    await expectRedirect(updateTaskDetails(diagnosticId, task.id, fd));

    const updated = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(updated.successIndicator).toBe("DRE fechado até o 5º dia útil");
    expect(updated.dependencies).toBe("Acesso ao sistema financeiro");
    expect(updated.completionEvidence).toBe("Print do relatório assinado");
  });
});

describe("Data Room (upload/download)", () => {
  it("uploads a document, persists it on disk and in the database, then deletes both", async () => {
    const diagnosticId = await createTestCompany("Empresa Integração Data Room");
    const diagnostic = await prisma.diagnostic.findUniqueOrThrow({ where: { id: diagnosticId } });
    const companyId = diagnostic.companyId;

    const fileContent = "extrato bancário de teste";
    const file = new File([fileContent], "extrato-teste.txt", { type: "text/plain" });
    const fd = new FormData();
    fd.set("category", "financeiro");
    fd.set("file", file);

    const redirectUrl = await expectRedirect(uploadDocument(companyId, fd));
    expect(redirectUrl).toBe(`/empresas/${companyId}/documentos`);

    const doc = await prisma.document.findFirstOrThrow({ where: { companyId } });
    expect(doc.originalName).toBe("extrato-teste.txt");
    expect(doc.category).toBe("financeiro");
    expect(doc.size).toBe(Buffer.byteLength(fileContent));
    // no GEMINI_API_KEY in the test env — classification must fail gracefully, not throw
    expect(doc.aiSuggestedCategory).toBeNull();
    expect(doc.aiConfidence).toBeNull();
    // same for the Agente de Extração de Indicadores — no key means no suggestions,
    // not a crash, even though the document was filed under a specific area
    expect(await prisma.kpiSuggestion.count({ where: { documentId: doc.id } })).toBe(0);

    const filePath = path.join(process.cwd(), "uploads", companyId, doc.storedName);
    expect(await fs.readFile(filePath, "utf-8")).toBe(fileContent);

    await expectRedirect(deleteDocument(companyId, doc.id));

    expect(await prisma.document.findUnique({ where: { id: doc.id } })).toBeNull();
    await expect(fs.access(filePath)).rejects.toThrow();

    // don't leave test artifacts in the real project's uploads/ directory
    await fs.rm(path.join(process.cwd(), "uploads", companyId), { recursive: true, force: true });
  });
});

describe("generateVerticalInsightAction", () => {
  it("redirects back to the report and leaves no VerticalInsight without a Gemini key", async () => {
    const diagnosticId = await createTestCompany("Empresa Integração Vertical");
    await completeAllAreas(diagnosticId, 2);

    const redirectUrl = await expectRedirect(generateVerticalInsightAction(diagnosticId, "financeiro"));
    expect(redirectUrl).toBe(`/diagnostico/${diagnosticId}/relatorio#especialistas`);

    const insight = await prisma.verticalInsight.findUnique({
      where: { diagnosticId_areaKey: { diagnosticId, areaKey: "financeiro" } },
    });
    expect(insight).toBeNull();
  });

  it("rejects an area outside the 5 verticals instead of silently generating something", async () => {
    const diagnosticId = await createTestCompany("Empresa Integração Vertical Inválida");
    await completeAllAreas(diagnosticId, 2);

    await expect(generateVerticalInsightAction(diagnosticId, "estrategia")).rejects.toThrow();
  });
});

describe("Atas de Reunião (createMeetingNote/deleteMeetingNote)", () => {
  it("creates a meeting note with a null summary without a Gemini key, then deletes it", async () => {
    const diagnosticId = await createTestCompany("Empresa Integração Atas");
    const diagnostic = await prisma.diagnostic.findUniqueOrThrow({ where: { id: diagnosticId } });
    const companyId = diagnostic.companyId;

    const fd = new FormData();
    fd.set("rawNotes", "Reunião com a diretoria: decidido adiar o lançamento. Ana fica com a vaga do gerente.");
    const redirectUrl = await expectRedirect(createMeetingNote(companyId, fd));
    expect(redirectUrl).toBe(`/empresas/${companyId}/reunioes`);

    const note = await prisma.meetingNote.findFirstOrThrow({ where: { companyId } });
    expect(note.rawNotes).toContain("adiar o lançamento");
    expect(note.summary).toBeNull();

    await expectRedirect(deleteMeetingNote(companyId, note.id));
    expect(await prisma.meetingNote.findUnique({ where: { id: note.id } })).toBeNull();
  });
});

describe("Cockpit de Performance (upsertKpiEntry/deleteKpiEntry)", () => {
  it("creates a KPI entry, upserts the same month/indicator instead of duplicating, then deletes it", async () => {
    const diagnosticId = await createTestCompany("Empresa Integração Indicadores");
    const diagnostic = await prisma.diagnostic.findUniqueOrThrow({ where: { id: diagnosticId } });
    const companyId = diagnostic.companyId;

    const fd = new FormData();
    fd.set("indicator", "financeiro::Receita mensal");
    fd.set("month", "2026-07");
    fd.set("value", "310000");
    const redirectUrl = await expectRedirect(upsertKpiEntry(companyId, fd));
    expect(redirectUrl).toBe(`/empresas/${companyId}/indicadores`);

    const entry = await prisma.kpiEntry.findFirstOrThrow({ where: { companyId } });
    expect(entry.areaKey).toBe("financeiro");
    expect(entry.indicatorName).toBe("Receita mensal");
    expect(entry.value).toBe(310000);

    const updateFd = new FormData();
    updateFd.set("indicator", "financeiro::Receita mensal");
    updateFd.set("month", "2026-07");
    updateFd.set("value", "325000");
    await expectRedirect(upsertKpiEntry(companyId, updateFd));

    const count = await prisma.kpiEntry.count({ where: { companyId } });
    expect(count).toBe(1);
    const updated = await prisma.kpiEntry.findFirstOrThrow({ where: { companyId } });
    expect(updated.value).toBe(325000);

    await expectRedirect(deleteKpiEntry(companyId, entry.id));
    expect(await prisma.kpiEntry.findUnique({ where: { id: entry.id } })).toBeNull();
  });

  it("rejects an indicator name that doesn't belong to the selected area", async () => {
    const diagnosticId = await createTestCompany("Empresa Integração Indicadores Inválido");
    const diagnostic = await prisma.diagnostic.findUniqueOrThrow({ where: { id: diagnosticId } });

    const fd = new FormData();
    fd.set("indicator", "financeiro::Indicador Que Não Existe");
    fd.set("month", "2026-07");
    fd.set("value", "100");
    await expect(upsertKpiEntry(diagnostic.companyId, fd)).rejects.toThrow();
  });

  it("persists an optional target and leaves it null when omitted", async () => {
    const diagnosticId = await createTestCompany("Empresa Integração Meta");
    const diagnostic = await prisma.diagnostic.findUniqueOrThrow({ where: { id: diagnosticId } });
    const companyId = diagnostic.companyId;

    const withTarget = new FormData();
    withTarget.set("indicator", "financeiro::Receita mensal");
    withTarget.set("month", "2026-07");
    withTarget.set("value", "310000");
    withTarget.set("target", "350000");
    await expectRedirect(upsertKpiEntry(companyId, withTarget));

    const entry = await prisma.kpiEntry.findFirstOrThrow({ where: { companyId } });
    expect(entry.target).toBe(350000);

    const withoutTarget = new FormData();
    withoutTarget.set("indicator", "comercial::Ticket médio");
    withoutTarget.set("month", "2026-07");
    withoutTarget.set("value", "150");
    await expectRedirect(upsertKpiEntry(companyId, withoutTarget));

    const untargeted = await prisma.kpiEntry.findFirstOrThrow({
      where: { companyId, indicatorName: "Ticket médio" },
    });
    expect(untargeted.target).toBeNull();
  });
});

describe("Agente de Extração de Indicadores (applyKpiSuggestion/rejectKpiSuggestion)", () => {
  async function seedSuggestion(companyId: string) {
    const doc = await prisma.document.create({
      data: {
        companyId,
        category: "financeiro",
        originalName: "extrato.pdf",
        storedName: "fake-stored-name.pdf",
        mimeType: "application/pdf",
        size: 100,
      },
    });
    return prisma.kpiSuggestion.create({
      data: {
        documentId: doc.id,
        companyId,
        areaKey: "financeiro",
        indicatorName: "Receita mensal",
        month: "2026-07",
        value: 310000,
      },
    });
  }

  it("applyKpiSuggestion creates the KpiEntry and marks the suggestion aplicada", async () => {
    const diagnosticId = await createTestCompany("Empresa Integração Sugestão Aplicar");
    const diagnostic = await prisma.diagnostic.findUniqueOrThrow({ where: { id: diagnosticId } });
    const companyId = diagnostic.companyId;
    const suggestion = await seedSuggestion(companyId);

    const redirectUrl = await expectRedirect(applyKpiSuggestion(companyId, suggestion.id));
    expect(redirectUrl).toBe(`/empresas/${companyId}/indicadores`);

    const entry = await prisma.kpiEntry.findFirstOrThrow({ where: { companyId } });
    expect(entry.value).toBe(310000);
    const updatedSuggestion = await prisma.kpiSuggestion.findUniqueOrThrow({ where: { id: suggestion.id } });
    expect(updatedSuggestion.status).toBe("aplicada");
  });

  it("rejectKpiSuggestion marks it rejeitada without creating a KpiEntry", async () => {
    const diagnosticId = await createTestCompany("Empresa Integração Sugestão Rejeitar");
    const diagnostic = await prisma.diagnostic.findUniqueOrThrow({ where: { id: diagnosticId } });
    const companyId = diagnostic.companyId;
    const suggestion = await seedSuggestion(companyId);

    await expectRedirect(rejectKpiSuggestion(companyId, suggestion.id));

    const updatedSuggestion = await prisma.kpiSuggestion.findUniqueOrThrow({ where: { id: suggestion.id } });
    expect(updatedSuggestion.status).toBe("rejeitada");
    expect(await prisma.kpiEntry.count({ where: { companyId } })).toBe(0);
  });

  it("applyKpiSuggestion is a no-op for an already-processed suggestion", async () => {
    const diagnosticId = await createTestCompany("Empresa Integração Sugestão Processada");
    const diagnostic = await prisma.diagnostic.findUniqueOrThrow({ where: { id: diagnosticId } });
    const companyId = diagnostic.companyId;
    const suggestion = await seedSuggestion(companyId);

    await expectRedirect(rejectKpiSuggestion(companyId, suggestion.id));
    await expectRedirect(applyKpiSuggestion(companyId, suggestion.id));

    // rejected first, so applying afterwards must not silently resurrect it as a real entry
    expect(await prisma.kpiEntry.count({ where: { companyId } })).toBe(0);
  });
});

describe("login/logout", () => {
  it("logs in a valid admin user and redirects to /empresas", async () => {
    const fd = new FormData();
    fd.set("email", "cauan@arcaconsulting.com");
    fd.set("password", "arca123");

    const redirectUrl = await expectRedirect(login(fd));
    expect(redirectUrl).toBe("/empresas");
    expect(mockSetSessionCookie).toHaveBeenCalledWith(
      expect.objectContaining({ role: "admin", email: "cauan@arcaconsulting.com" })
    );
  });

  it("rejects invalid credentials without setting a session", async () => {
    const fd = new FormData();
    fd.set("email", "cauan@arcaconsulting.com");
    fd.set("password", "senha-errada");

    const redirectUrl = await expectRedirect(login(fd));
    expect(redirectUrl).toBe("/login?error=credenciais");
    expect(mockSetSessionCookie).not.toHaveBeenCalled();
  });

  it("resolves a cliente user's companyId by name, or errors gracefully if the company doesn't exist yet", async () => {
    const missingCompanyFd = new FormData();
    missingCompanyFd.set("email", "roberto@oticavisaoclara.com.br");
    missingCompanyFd.set("password", "cliente123");
    const errorRedirect = await expectRedirect(login(missingCompanyFd));
    expect(errorRedirect).toBe("/login?error=empresa");
    expect(mockSetSessionCookie).not.toHaveBeenCalled();

    const diagnosticId = await createTestCompany("Ótica Visão Clara");
    const diagnostic = await prisma.diagnostic.findUniqueOrThrow({ where: { id: diagnosticId } });

    const fd = new FormData();
    fd.set("email", "roberto@oticavisaoclara.com.br");
    fd.set("password", "cliente123");
    const successRedirect = await expectRedirect(login(fd));
    expect(successRedirect).toBe(`/empresas/${diagnostic.companyId}`);
    expect(mockSetSessionCookie).toHaveBeenCalledWith(
      expect.objectContaining({ role: "cliente", companyId: diagnostic.companyId })
    );
  });

  it("logout clears the session and redirects to /login", async () => {
    const redirectUrl = await expectRedirect(logout());
    expect(redirectUrl).toBe("/login");
    expect(mockClearSessionCookie).toHaveBeenCalled();
  });
});

describe("assertCompanyAccess (cliente role scoping)", () => {
  it("blocks a cliente session from mutating another company's data", async () => {
    const diagnosticId = await createTestCompany("Empresa Integração RBAC Bloqueado");
    await completeAllAreas(diagnosticId, 0);
    await expectRedirect(approveActionPlan(diagnosticId));
    const [task] = await prisma.task.findMany({ where: { diagnosticId } });

    mockGetSession.mockResolvedValue({
      userId: "cliente-test",
      name: "Cliente Teste",
      email: "cliente@test.com",
      role: "cliente",
      title: "Sponsor",
      companyId: "empresa-de-outro-cliente",
    } satisfies Session);

    await expectNotFound(moveTask(diagnosticId, task.id, "forward"));

    const unchanged = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(unchanged.status).toBe("todo");
  });

  it("allows a cliente session scoped to the correct company", async () => {
    const diagnosticId = await createTestCompany("Empresa Integração RBAC Permitido");
    const diagnostic = await prisma.diagnostic.findUniqueOrThrow({ where: { id: diagnosticId } });
    await completeAllAreas(diagnosticId, 0);
    await expectRedirect(approveActionPlan(diagnosticId));
    const [task] = await prisma.task.findMany({ where: { diagnosticId } });

    mockGetSession.mockResolvedValue({
      userId: "cliente-test",
      name: "Cliente Teste",
      email: "cliente@test.com",
      role: "cliente",
      title: "Sponsor",
      companyId: diagnostic.companyId,
    } satisfies Session);

    await expectRedirect(moveTask(diagnosticId, task.id, "forward"));
    const moved = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(moved.status).toBe("doing");
  });

  it("blocks a cliente from creating a brand-new company/diagnostic", async () => {
    mockGetSession.mockResolvedValue({
      userId: "cliente-test",
      name: "Cliente Teste",
      email: "cliente@test.com",
      role: "cliente",
      title: "Sponsor",
      companyId: "any-company",
    } satisfies Session);

    await expectNotFound(createDiagnostic(minimalCompanyForm("Empresa Bloqueada Para Cliente")));
  });
});
