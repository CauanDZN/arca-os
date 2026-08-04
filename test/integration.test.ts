import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AREAS, getResumeAreaKey } from "@/lib/areas";
import type { Session } from "@/lib/session";

// @vercel/blob makes a real HTTP call to Vercel's storage API and needs
// BLOB_READ_WRITE_TOKEN — mocked the same way @google/genai is mocked below,
// to keep the Data Room test hermetic and fast (no real network/credentials).
const mockBlobPut = vi.hoisted(() => vi.fn());
const mockBlobDel = vi.hoisted(() => vi.fn());
vi.mock("@vercel/blob", () => ({
  put: mockBlobPut,
  del: mockBlobDel,
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

// revalidatePath requires a real Next.js request-scoped store (it throws
// "Invariant: static generation store missing" outside of one) — reorderTasks
// is called directly here as a plain async function, not through a request,
// so there's nothing to revalidate and the call is a no-op in tests.
vi.mock("next/cache", () => ({
  revalidatePath: () => {},
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
  mockBlobPut.mockReset();
  mockBlobDel.mockReset();
});

import { prisma } from "@/lib/prisma";
import { createDiagnostic, saveAreaAnswers, generateNarrativeAction } from "@/app/actions";
import {
  approveActionPlan,
  moveTask,
  reorderTasks,
  updateTaskDetails,
  createSprint,
  deleteSprint,
  createEpic,
  deleteEpic,
} from "@/app/actions-project";
import { uploadDocument, deleteDocument } from "@/app/actions-documents";
import {
  generateWebhookToken,
  revokeWebhookToken,
  deleteWebhookEvent,
  setOutboundWebhookUrl,
  sendTestOutboundEvent,
} from "@/app/actions-webhooks";
import { POST as receiveWebhook } from "@/app/api/webhooks/[companyId]/route";
import { generateVerticalInsightAction } from "@/app/actions-vertical";
import { startVerticalDiagnostic, approveVerticalActionPlan } from "@/app/actions-module";
import { getPlaybookByVertical } from "@/lib/playbooks";
import { createMeetingNote, deleteMeetingNote } from "@/app/actions-meetings";
import { upsertKpiEntry, deleteKpiEntry, applyKpiSuggestion, rejectKpiSuggestion } from "@/app/actions-kpis";
import { login, logout } from "@/app/actions-auth";
import { createUser, updateUserRole, deleteUser } from "@/app/actions-users";
import { deleteCompany } from "@/app/actions-empresas";
import {
  createPartner,
  updatePartnerHomologation,
  updatePartnerNps,
  deletePartner,
  createPartnerReferral,
  updatePartnerReferralStatus,
  updatePartnerReferralFeedback,
  markReferralResponded,
  deletePartnerReferral,
} from "@/app/actions-partners";
import {
  createContract,
  updateContractStatus,
  deleteContract,
  createPerformanceRecord,
  deletePerformanceRecord,
} from "@/app/actions-contracts";

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

async function createTestCompanyId(name: string): Promise<string> {
  await expectRedirect(createDiagnostic(minimalCompanyForm(name)));
  const company = await prisma.company.findFirstOrThrow({ where: { name } });
  return company.id;
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

  it("resumes to the first area when the questionnaire was started but nothing was answered", async () => {
    const diagnosticId = await createTestCompany("Empresa Integração Continuar Vazio");
    const diagnostic = await prisma.diagnostic.findUniqueOrThrow({
      where: { id: diagnosticId },
      include: { answers: true },
    });
    expect(diagnostic.answers).toHaveLength(0);

    // the "Continuar" link on the empresa cockpit must never end in a 404:
    // without any answers it points at the first area, never an empty key
    const resumeKey = getResumeAreaKey(diagnostic.answers);
    expect(resumeKey).toBe(AREAS[0].key);
    expect(`/diagnostico/${diagnosticId}/questionario/${resumeKey}`).toBe(
      `/diagnostico/${diagnosticId}/questionario/${AREAS[0].key}`
    );
  });

  it("resumes at the first area still missing answers, not the first answered one", async () => {
    const diagnosticId = await createTestCompany("Empresa Integração Continuar Parcial");
    const firstArea = AREAS[0];
    await expectRedirect(saveAreaAnswers(diagnosticId, firstArea.key, areaAnswersForm(firstArea.key, 3)));

    const diagnostic = await prisma.diagnostic.findUniqueOrThrow({
      where: { id: diagnosticId },
      include: { answers: true },
    });
    expect(getResumeAreaKey(diagnostic.answers)).toBe(AREAS[1].key);
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

describe("generateNarrativeAction (análise consultiva sob demanda)", () => {
  it("generates the narrative after completion, falling back gracefully without a key", async () => {
    expect(process.env.GEMINI_API_KEY).toBeUndefined();

    const diagnosticId = await createTestCompany("Empresa Integração Narrativa");
    const lastArea = AREAS[AREAS.length - 1];

    // the last area saves instantly and redirects — no Gemini call blocks it
    const redirectUrl = await expectRedirect(
      saveAreaAnswers(diagnosticId, lastArea.key, areaAnswersForm(lastArea.key, 2))
    );
    expect(redirectUrl).toBe(`/diagnostico/${diagnosticId}/relatorio`);

    // generating the narrative is a separate, explicit action afterwards
    const narrativeRedirect = await expectRedirect(generateNarrativeAction(diagnosticId));
    expect(narrativeRedirect).toBe(`/diagnostico/${diagnosticId}/relatorio#sumario`);

    const diagnostic = await prisma.diagnostic.findUniqueOrThrow({ where: { id: diagnosticId } });
    // no GEMINI_API_KEY in the test env — must fall back gracefully, not crash
    expect(diagnostic.status).toBe("concluido");
    expect(diagnostic.aiNarrative).toBeNull();
  });

  it("blocks a cliente session from generating the narrative of another company's diagnostic", async () => {
    const diagnosticId = await createTestCompany("Empresa Integração Narrativa RBAC");
    await completeAllAreas(diagnosticId, 0);

    mockGetSession.mockResolvedValue({
      userId: "cliente-test",
      name: "Cliente Teste",
      email: "cliente@test.com",
      role: "cliente",
      title: "Sponsor",
      companyId: "empresa-de-outro-cliente",
    } satisfies Session);

    await expectNotFound(generateNarrativeAction(diagnosticId));
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

  it("reorderTasks persists drag-and-drop order and logs a TaskEvent only on a real status change", async () => {
    const diagnosticId = await createTestCompany("Empresa Integração Kanban Drag");
    await completeAllAreas(diagnosticId, 0);
    await expectRedirect(approveActionPlan(diagnosticId));
    const todoTasks = await prisma.task.findMany({
      where: { diagnosticId, status: "todo" },
      orderBy: { position: "asc" },
    });
    expect(todoTasks.length).toBeGreaterThanOrEqual(2);
    const [first, second] = todoTasks;

    // reordering within the same column: swap the first two, status unchanged
    await reorderTasks(diagnosticId, second.id, "todo", [second.id, first.id]);
    const reordered = await prisma.task.findMany({
      where: { diagnosticId, status: "todo" },
      orderBy: { position: "asc" },
    });
    expect(reordered[0].id).toBe(second.id);
    expect(reordered[1].id).toBe(first.id);
    expect(await prisma.taskEvent.count({ where: { taskId: second.id } })).toBe(0);

    // dragging across columns: status changes and a TaskEvent is logged
    await reorderTasks(diagnosticId, first.id, "doing", [first.id]);
    const moved = await prisma.task.findUniqueOrThrow({ where: { id: first.id } });
    expect(moved.status).toBe("doing");
    const events = await prisma.taskEvent.findMany({ where: { taskId: first.id } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ fromStatus: "todo", toStatus: "doing" });
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

describe("approveVerticalActionPlan (Playbook de Execução)", () => {
  it("creates a plano-de-ação epic and a separate playbook epic seeded from lib/playbooks.ts", async () => {
    const companyId = await createTestCompanyId("Empresa Integração Playbook");
    const redirectUrl = await expectRedirect(startVerticalDiagnostic(companyId, "financeiro"));
    const diagnosticId = redirectUrl.match(/\/diagnostico\/([^/]+)\//)![1];

    await expectRedirect(saveAreaAnswers(diagnosticId, "financeiro", areaAnswersForm("financeiro", 0)));
    await expectRedirect(approveVerticalActionPlan(diagnosticId));

    const epics = await prisma.epic.findMany({ where: { diagnosticId } });
    expect(epics).toHaveLength(2);

    const playbook = getPlaybookByVertical("financeiro")!;
    const playbookEpic = epics.find((e) => e.name.startsWith("Playbook de Execução"))!;
    expect(playbookEpic).toBeDefined();
    expect(playbookEpic.description).toBe(playbook.summary);

    const playbookTasks = await prisma.task.findMany({ where: { diagnosticId, epicId: playbookEpic.id } });
    expect(playbookTasks).toHaveLength(playbook.steps.length);
    expect(playbookTasks.map((t) => t.title).sort()).toEqual([...playbook.steps].sort());
    expect(playbookTasks.every((t) => t.status === "todo" && t.priority === "Média")).toBe(true);

    const planEpic = epics.find((e) => e.id !== playbookEpic.id)!;
    const planTasks = await prisma.task.findMany({ where: { diagnosticId, epicId: planEpic.id } });
    expect(planTasks.length).toBeGreaterThan(0);
  });

  it("is idempotent: approving twice does not duplicate the playbook tasks", async () => {
    const companyId = await createTestCompanyId("Empresa Integração Playbook Idempotente");
    const redirectUrl = await expectRedirect(startVerticalDiagnostic(companyId, "financeiro"));
    const diagnosticId = redirectUrl.match(/\/diagnostico\/([^/]+)\//)![1];
    await expectRedirect(saveAreaAnswers(diagnosticId, "financeiro", areaAnswersForm("financeiro", 0)));

    await expectRedirect(approveVerticalActionPlan(diagnosticId));
    const firstCount = await prisma.task.count({ where: { diagnosticId } });

    await expectRedirect(approveVerticalActionPlan(diagnosticId));
    const secondCount = await prisma.task.count({ where: { diagnosticId } });

    expect(secondCount).toBe(firstCount);
  });
});

describe("Data Room (upload/download)", () => {
  it("uploads a document to Blob storage, persists it in the database, then deletes both", async () => {
    const diagnosticId = await createTestCompany("Empresa Integração Data Room");
    const diagnostic = await prisma.diagnostic.findUniqueOrThrow({ where: { id: diagnosticId } });
    const companyId = diagnostic.companyId;

    const fileContent = "extrato bancário de teste";
    const file = new File([fileContent], "extrato-teste.txt", { type: "text/plain" });
    const fd = new FormData();
    fd.set("category", "financeiro");
    fd.set("file", file);

    const fakeBlobUrl = `https://blob.example.com/${companyId}/fake-stored-name.txt`;
    mockBlobPut.mockResolvedValue({ url: fakeBlobUrl });

    const redirectUrl = await expectRedirect(uploadDocument(companyId, fd));
    expect(redirectUrl).toBe(`/empresas/${companyId}/documentos`);

    expect(mockBlobPut).toHaveBeenCalledTimes(1);
    const [pathname, uploadedBuffer, options] = mockBlobPut.mock.calls[0];
    expect(pathname).toContain(companyId);
    expect(Buffer.from(uploadedBuffer).toString("utf-8")).toBe(fileContent);
    expect(options).toMatchObject({ access: "public", contentType: "text/plain" });

    const doc = await prisma.document.findFirstOrThrow({ where: { companyId } });
    expect(doc.originalName).toBe("extrato-teste.txt");
    expect(doc.category).toBe("financeiro");
    expect(doc.storedUrl).toBe(fakeBlobUrl);
    expect(doc.size).toBe(Buffer.byteLength(fileContent));
    // no GEMINI_API_KEY in the test env — classification must fail gracefully, not throw
    expect(doc.aiSuggestedCategory).toBeNull();
    expect(doc.aiConfidence).toBeNull();
    // same for the Agente de Extração de Indicadores — no key means no suggestions,
    // not a crash, even though the document was filed under a specific area
    expect(await prisma.kpiSuggestion.count({ where: { documentId: doc.id } })).toBe(0);

    mockBlobDel.mockResolvedValue(undefined);
    await expectRedirect(deleteDocument(companyId, doc.id));

    expect(mockBlobDel).toHaveBeenCalledWith(fakeBlobUrl);
    expect(await prisma.document.findUnique({ where: { id: doc.id } })).toBeNull();
  });
});

describe("Webhook (generateWebhookToken/revokeWebhookToken + rota de recebimento)", () => {
  it("gera um token, aceita evento com o token correto e rejeita token errado ou ausente", async () => {
    const diagnosticId = await createTestCompany("Empresa Integração Webhook");
    const diagnostic = await prisma.diagnostic.findUniqueOrThrow({ where: { id: diagnosticId } });
    const companyId = diagnostic.companyId;

    const redirectUrl = await expectRedirect(generateWebhookToken(companyId));
    expect(redirectUrl).toBe(`/empresas/${companyId}/documentos`);

    const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    expect(company.webhookToken).toMatch(/^[0-9a-f]{48}$/);
    const token = company.webhookToken!;

    const wrongTokenReq = new Request(`http://localhost/api/webhooks/${companyId}?token=errado`, {
      method: "POST",
      body: JSON.stringify({ hello: "world" }),
    });
    const wrongTokenRes = await receiveWebhook(wrongTokenReq, { params: Promise.resolve({ companyId }) });
    expect(wrongTokenRes.status).toBe(404);
    expect(await prisma.webhookEvent.count({ where: { companyId } })).toBe(0);

    const validReq = new Request(
      `http://localhost/api/webhooks/${companyId}?token=${token}&source=erp-teste`,
      { method: "POST", body: JSON.stringify({ evento: "pedido_criado", valor: 1200 }) }
    );
    const validRes = await receiveWebhook(validReq, { params: Promise.resolve({ companyId }) });
    expect(validRes.status).toBe(200);

    const event = await prisma.webhookEvent.findFirstOrThrow({ where: { companyId } });
    expect(event.source).toBe("erp-teste");
    expect(JSON.parse(event.payload)).toMatchObject({ evento: "pedido_criado", valor: 1200 });

    await expectRedirect(deleteWebhookEvent(companyId, event.id));
    expect(await prisma.webhookEvent.count({ where: { companyId } })).toBe(0);

    await expectRedirect(revokeWebhookToken(companyId));
    const revoked = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    expect(revoked.webhookToken).toBeNull();

    // token revoked — the same request that worked before must now 404
    const afterRevokeReq = new Request(`http://localhost/api/webhooks/${companyId}?token=${token}`, {
      method: "POST",
      body: "{}",
    });
    const afterRevokeRes = await receiveWebhook(afterRevokeReq, { params: Promise.resolve({ companyId }) });
    expect(afterRevokeRes.status).toBe(404);
  });
});

describe("Webhook de saída (setOutboundWebhookUrl/sendTestOutboundEvent + disparos automáticos)", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("valida a URL, persiste, e sendTestOutboundEvent faz POST nela", async () => {
    const diagnosticId = await createTestCompany("Empresa Integração Webhook Saída");
    const diagnostic = await prisma.diagnostic.findUniqueOrThrow({ where: { id: diagnosticId } });
    const companyId = diagnostic.companyId;

    const invalidFd = new FormData();
    invalidFd.set("url", "não-é-uma-url");
    await expect(setOutboundWebhookUrl(companyId, invalidFd)).rejects.toThrow();

    const fd = new FormData();
    fd.set("url", "https://erp-do-cliente.example.com/webhooks/arcaos");
    await expectRedirect(setOutboundWebhookUrl(companyId, fd));

    const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    expect(company.outboundWebhookUrl).toBe("https://erp-do-cliente.example.com/webhooks/arcaos");

    const mockFetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    global.fetch = mockFetch;

    await expectRedirect(sendTestOutboundEvent(companyId));

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://erp-do-cliente.example.com/webhooks/arcaos");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({ event: "webhook.test", companyId });
  });

  it("não chama fetch quando a empresa não configurou URL de saída", async () => {
    const diagnosticId = await createTestCompany("Empresa Integração Webhook Saída Vazio");
    const diagnostic = await prisma.diagnostic.findUniqueOrThrow({ where: { id: diagnosticId } });

    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    await expectRedirect(sendTestOutboundEvent(diagnostic.companyId));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("dispara plan.approved e task.status_changed automaticamente quando a URL está configurada", async () => {
    const diagnosticId = await createTestCompany("Empresa Integração Webhook Saída Eventos");
    const diagnostic = await prisma.diagnostic.findUniqueOrThrow({ where: { id: diagnosticId } });
    const companyId = diagnostic.companyId;

    const fd = new FormData();
    fd.set("url", "https://erp-do-cliente.example.com/webhooks/arcaos");
    await expectRedirect(setOutboundWebhookUrl(companyId, fd));

    // completeAllAreas itself fires a "diagnostic.completed" event on the last
    // area — set up the mock only after that, to isolate the events this test
    // actually asserts on (plan.approved, then task.status_changed).
    await completeAllAreas(diagnosticId, 0);

    const mockFetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    global.fetch = mockFetch;

    await expectRedirect(approveActionPlan(diagnosticId));

    expect(mockFetch).toHaveBeenCalledTimes(1);
    let body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.event).toBe("plan.approved");

    const [task] = await prisma.task.findMany({ where: { diagnosticId } });
    await expectRedirect(moveTask(diagnosticId, task.id, "forward"));

    expect(mockFetch).toHaveBeenCalledTimes(2);
    body = JSON.parse((mockFetch.mock.calls[1][1] as RequestInit).body as string);
    expect(body).toMatchObject({ event: "task.status_changed", companyId });
    expect(body.data).toMatchObject({ fromStatus: "todo", toStatus: "doing" });
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
        storedUrl: "https://blob.example.com/fake-stored-name.pdf",
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

  it("só deixa cliente logar quando o usuário está vinculado a uma empresa real", async () => {
    // Os usuários do seed são só Cauan e Cícero (migration remove_seed_users).
    // Cria aqui um cliente "sem vínculo" para o cenário.
    await prisma.user.create({
      data: {
        id: "cliente-teste",
        name: "Cliente Teste",
        email: "cliente-teste@arcaconsulting.com",
        password: "cliente123",
        role: "cliente",
        title: "Sponsor do Cliente",
      },
    });
    const clientFd = () => {
      const fd = new FormData();
      fd.set("email", "cliente-teste@arcaconsulting.com");
      fd.set("password", "cliente123");
      return fd;
    };

    // Sem vínculo (companyId null), o login falha mesmo que a empresa exista.
    const errorRedirect = await expectRedirect(login(clientFd()));
    expect(errorRedirect).toBe("/login?error=empresa");
    expect(mockSetSessionCookie).not.toHaveBeenCalled();

    const diagnosticId = await createTestCompany("Ótica Visão Clara");
    const diagnostic = await prisma.diagnostic.findUniqueOrThrow({ where: { id: diagnosticId } });
    const companyId = diagnostic.companyId;

    // Criar a empresa por si só não vincula — é preciso atrelar na tela /usuarios.
    const stillError = await expectRedirect(login(clientFd()));
    expect(stillError).toBe("/login?error=empresa");

    const cliente = await prisma.user.findUniqueOrThrow({ where: { email: "cliente-teste@arcaconsulting.com" } });
    const roleFd = new FormData();
    roleFd.set("role", "cliente");
    roleFd.set("companyId", companyId);
    await expectRedirect(updateUserRole(cliente.id, roleFd));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: cliente.id } })).companyId).toBe(companyId);

    const successRedirect = await expectRedirect(login(clientFd()));
    expect(successRedirect).toBe(`/empresas/${companyId}`);
    expect(mockSetSessionCookie).toHaveBeenCalledWith(
      expect.objectContaining({ role: "cliente", companyId })
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

describe("Gestão de usuários (createUser/updateUserRole/deleteUser)", () => {
  it("cria um usuário, muda o papel, atrela/desatrela empresa e o remove", async () => {
    const fd = new FormData();
    fd.set("name", "Nova Consultora");
    fd.set("email", "nova@arcaconsulting.com");
    fd.set("password", "senha123");
    fd.set("role", "consultor");
    fd.set("title", "Consultora Líder");
    const redirectUrl = await expectRedirect(createUser(fd));
    expect(redirectUrl).toBe("/usuarios?sucesso=criado");

    const user = await prisma.user.findUniqueOrThrow({ where: { email: "nova@arcaconsulting.com" } });
    expect(user.role).toBe("consultor");
    expect(user.title).toBe("Consultora Líder");
    expect(user.companyId).toBeNull();

    const roleFd = new FormData();
    roleFd.set("role", "admin");
    await expectRedirect(updateUserRole(user.id, roleFd));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).role).toBe("admin");

    // Atrela a usuária a uma empresa real (vira cliente).
    const companyDiagnosticId = await createTestCompany("Empresa da Nova Consultora");
    const companyDiagnostic = await prisma.diagnostic.findUniqueOrThrow({
      where: { id: companyDiagnosticId },
    });
    const clientFd = new FormData();
    clientFd.set("role", "cliente");
    clientFd.set("companyId", companyDiagnostic.companyId);
    await expectRedirect(updateUserRole(user.id, clientFd));
    const linked = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(linked.role).toBe("cliente");
    expect(linked.companyId).toBe(companyDiagnostic.companyId);

    // Sair do papel cliente limpa o vínculo.
    const backToAdmin = new FormData();
    backToAdmin.set("role", "admin");
    await expectRedirect(updateUserRole(user.id, backToAdmin));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).companyId).toBeNull();

    await expectRedirect(deleteUser(user.id));
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
  });

  it("rejeita criar um cliente sem empresa vinculada", async () => {
    const fd = new FormData();
    fd.set("name", "Cliente Sem Empresa");
    fd.set("email", "cliente-sem-empresa@test.com");
    fd.set("password", "senha123");
    fd.set("role", "cliente");
    fd.set("title", "Sponsor");
    const redirectUrl = await expectRedirect(createUser(fd));
    expect(redirectUrl).toBe("/usuarios?error=empresa-obrigatoria");
    expect(await prisma.user.findUnique({ where: { email: "cliente-sem-empresa@test.com" } })).toBeNull();
  });

  it("rejeita um e-mail que já existe", async () => {
    const fd = new FormData();
    fd.set("name", "Duplicado");
    fd.set("email", "cauan@arcaconsulting.com"); // já seedado pela migration add_users
    fd.set("password", "senha123");
    fd.set("role", "consultor");
    fd.set("title", "X");
    const redirectUrl = await expectRedirect(createUser(fd));
    expect(redirectUrl).toBe("/usuarios?error=email-existe");
  });

  // roda por último: derruba os admins seedados, então não pode rodar antes
  // dos testes de login que dependem deles
  it("não deixa excluir o último admin restante", async () => {
    const admins = await prisma.user.findMany({ where: { role: "admin" }, orderBy: { email: "asc" } });
    expect(admins.length).toBeGreaterThanOrEqual(2);

    // derruba todos os admins, deixando só um
    for (const admin of admins.slice(1)) {
      await expectRedirect(deleteUser(admin.id));
    }

    const last = admins[0];
    const blocked = await expectRedirect(deleteUser(last.id));
    expect(blocked).toBe("/usuarios?error=ultimo-admin");
    expect(await prisma.user.findUnique({ where: { id: last.id } })).not.toBeNull();
  });

  it("bloqueia um cliente de gerenciar usuários", async () => {
    mockGetSession.mockResolvedValue({
      userId: "cliente-test",
      name: "Cliente Teste",
      email: "cliente@test.com",
      role: "cliente",
      title: "Sponsor",
      companyId: "empresa-de-outro-cliente",
    } satisfies Session);

    await expectNotFound(createUser(new FormData()));
    await expectNotFound(deleteUser("u1"));
  });
});

describe("deleteCompany (zona de perigo)", () => {
  it("exclui a empresa, os blobs e toda a árvore de dados de uma vez", async () => {
    const diagnosticId = await createTestCompany("Empresa Integração Excluir");
    const diagnostic = await prisma.diagnostic.findUniqueOrThrow({ where: { id: diagnosticId } });
    const companyId = diagnostic.companyId;
    await completeAllAreas(diagnosticId, 0);
    await expectRedirect(approveActionPlan(diagnosticId));

    mockBlobPut.mockResolvedValue({ url: `https://blob.example.com/${companyId}/arquivo.txt` });
    const file = new File(["conteúdo"], "arquivo.txt", { type: "text/plain" });
    const fd = new FormData();
    fd.set("category", "geral");
    fd.set("file", file);
    await expectRedirect(uploadDocument(companyId, fd));

    const redirectUrl = await expectRedirect(deleteCompany(companyId));
    expect(redirectUrl).toBe("/empresas");

    expect(mockBlobDel).toHaveBeenCalled();
    expect(await prisma.company.findUnique({ where: { id: companyId } })).toBeNull();
    expect(await prisma.diagnostic.count({ where: { companyId } })).toBe(0);
    expect(await prisma.answer.count({ where: { diagnosticId } })).toBe(0);
    expect(await prisma.task.count({ where: { diagnosticId } })).toBe(0);
    expect(await prisma.document.count({ where: { companyId } })).toBe(0);
  });

  it("bloqueia um cliente de excluir até a própria empresa", async () => {
    const diagnosticId = await createTestCompany("Empresa Integração Excluir Cliente");
    const diagnostic = await prisma.diagnostic.findUniqueOrThrow({ where: { id: diagnosticId } });

    mockGetSession.mockResolvedValue({
      userId: "cliente-test",
      name: "Cliente Teste",
      email: "cliente@test.com",
      role: "cliente",
      title: "Sponsor",
      companyId: diagnostic.companyId,
    } satisfies Session);

    await expectNotFound(deleteCompany(diagnostic.companyId));
    expect(await prisma.company.findUnique({ where: { id: diagnostic.companyId } })).not.toBeNull();
  });
});

describe("Vertical Parceira (createPartner/updatePartnerHomologation/deletePartner)", () => {
  it("creates a partner with default 'pendente' homologation and lets it be homologated", async () => {
    const fd = new FormData();
    fd.set("name", "Escritório XPTO Advocacia");
    fd.set("type", "operacional");
    fd.set("category", "Jurídico");
    fd.set("contactInfo", "contato@xpto.adv.br");
    fd.set("slaHours", "48");

    const redirectUrl = await expectRedirect(createPartner(fd));
    expect(redirectUrl).toBe("/parceiros?sucesso=criado");

    const partner = await prisma.partner.findFirstOrThrow({ where: { name: "Escritório XPTO Advocacia" } });
    expect(partner.homologationStatus).toBe("pendente");
    expect(partner.slaHours).toBe(48);

    const statusFd = new FormData();
    statusFd.set("homologationStatus", "homologado");
    await expectRedirect(updatePartnerHomologation(partner.id, statusFd));

    const updated = await prisma.partner.findUniqueOrThrow({ where: { id: partner.id } });
    expect(updated.homologationStatus).toBe("homologado");
  });

  it("leaves slaHours null when the field is left blank", async () => {
    const fd = new FormData();
    fd.set("name", "Parceiro Sem SLA");
    fd.set("type", "estrategica");
    fd.set("category", "SaaS");
    fd.set("contactInfo", "");
    fd.set("slaHours", "");

    await expectRedirect(createPartner(fd));
    const partner = await prisma.partner.findFirstOrThrow({ where: { name: "Parceiro Sem SLA" } });
    expect(partner.slaHours).toBeNull();
  });

  it("rejects an invalid homologation status", async () => {
    const fd = new FormData();
    fd.set("name", "Parceiro Status Inválido");
    fd.set("type", "comercial");
    fd.set("category", "Franquia");
    await expectRedirect(createPartner(fd));
    const partner = await prisma.partner.findFirstOrThrow({ where: { name: "Parceiro Status Inválido" } });

    const statusFd = new FormData();
    statusFd.set("homologationStatus", "aprovado-por-engano");
    const redirectUrl = await expectRedirect(updatePartnerHomologation(partner.id, statusFd));
    expect(redirectUrl).toBe("/parceiros?error=validacao");

    const unchanged = await prisma.partner.findUniqueOrThrow({ where: { id: partner.id } });
    expect(unchanged.homologationStatus).toBe("pendente");
  });

  it("only an admin can delete a partner", async () => {
    const fd = new FormData();
    fd.set("name", "Parceiro Pra Excluir");
    fd.set("type", "operacional");
    fd.set("category", "Facilities");
    await expectRedirect(createPartner(fd));
    const partner = await prisma.partner.findFirstOrThrow({ where: { name: "Parceiro Pra Excluir" } });

    mockGetSession.mockResolvedValue({
      userId: "consultor-test",
      name: "Consultor Teste",
      email: "consultor@test.com",
      role: "consultor",
      title: "Consultor",
    } satisfies Session);
    await expectNotFound(deletePartner(partner.id));
    expect(await prisma.partner.findUnique({ where: { id: partner.id } })).not.toBeNull();

    mockGetSession.mockResolvedValue(ADMIN_SESSION);
    await expectRedirect(deletePartner(partner.id));
    expect(await prisma.partner.findUnique({ where: { id: partner.id } })).toBeNull();
  });
});

describe("Indicação de parceiro (createPartnerReferral/updatePartnerReferralStatus/deletePartnerReferral)", () => {
  it("creates a referral linking a homologated partner to a company, defaulting to 'indicado'", async () => {
    const companyId = await createTestCompanyId("Empresa Integração Indicação");

    const partnerFd = new FormData();
    partnerFd.set("name", "Contador Parceiro");
    partnerFd.set("type", "estrategica");
    partnerFd.set("category", "Contábil");
    await expectRedirect(createPartner(partnerFd));
    const partner = await prisma.partner.findFirstOrThrow({ where: { name: "Contador Parceiro" } });

    const referralFd = new FormData();
    referralFd.set("partnerId", partner.id);
    referralFd.set("notes", "Cliente precisa de suporte contábil urgente");
    const redirectUrl = await expectRedirect(createPartnerReferral(companyId, referralFd));
    expect(redirectUrl).toBe(`/empresas/${companyId}`);

    const referral = await prisma.partnerReferral.findFirstOrThrow({ where: { companyId, partnerId: partner.id } });
    expect(referral.status).toBe("indicado");
    expect(referral.notes).toBe("Cliente precisa de suporte contábil urgente");

    const statusFd = new FormData();
    statusFd.set("status", "concluido");
    await expectRedirect(updatePartnerReferralStatus(companyId, referral.id, statusFd));
    const updated = await prisma.partnerReferral.findUniqueOrThrow({ where: { id: referral.id } });
    expect(updated.status).toBe("concluido");

    await expectRedirect(deletePartnerReferral(companyId, referral.id));
    expect(await prisma.partnerReferral.findUnique({ where: { id: referral.id } })).toBeNull();
  });

  it("rejects a referral to a partner that does not exist", async () => {
    const companyId = await createTestCompanyId("Empresa Integração Indicação Inválida");
    const referralFd = new FormData();
    referralFd.set("partnerId", "id-que-nao-existe");
    const redirectUrl = await expectRedirect(createPartnerReferral(companyId, referralFd));
    expect(redirectUrl).toBe(`/empresas/${companyId}?error=parceiro-invalido`);
    expect(await prisma.partnerReferral.count({ where: { companyId } })).toBe(0);
  });

  it("blocks updating a referral that belongs to a different company", async () => {
    const companyId = await createTestCompanyId("Empresa Integração Indicação Dono");
    const otherCompanyId = await createTestCompanyId("Empresa Integração Indicação Intrusa");

    const partnerFd = new FormData();
    partnerFd.set("name", "Parceiro Cross-Company");
    partnerFd.set("type", "operacional");
    partnerFd.set("category", "Engenharia");
    await expectRedirect(createPartner(partnerFd));
    const partner = await prisma.partner.findFirstOrThrow({ where: { name: "Parceiro Cross-Company" } });

    const referralFd = new FormData();
    referralFd.set("partnerId", partner.id);
    await expectRedirect(createPartnerReferral(companyId, referralFd));
    const referral = await prisma.partnerReferral.findFirstOrThrow({ where: { companyId } });

    const statusFd = new FormData();
    statusFd.set("status", "concluido");
    await expectNotFound(updatePartnerReferralStatus(otherCompanyId, referral.id, statusFd));

    const unchanged = await prisma.partnerReferral.findUniqueOrThrow({ where: { id: referral.id } });
    expect(unchanged.status).toBe("indicado");
  });

  it("records a negotiated commission and client satisfaction on a referral, and clears them when left blank", async () => {
    const companyId = await createTestCompanyId("Empresa Integração Comissão");
    const partnerFd = new FormData();
    partnerFd.set("name", "Parceiro Comissionado");
    partnerFd.set("type", "comercial");
    partnerFd.set("category", "Franquia");
    await expectRedirect(createPartner(partnerFd));
    const partner = await prisma.partner.findFirstOrThrow({ where: { name: "Parceiro Comissionado" } });

    const referralFd = new FormData();
    referralFd.set("partnerId", partner.id);
    await expectRedirect(createPartnerReferral(companyId, referralFd));
    const referral = await prisma.partnerReferral.findFirstOrThrow({ where: { companyId } });

    const feedbackFd = new FormData();
    feedbackFd.set("commissionPercent", "10");
    feedbackFd.set("commissionValue", "1500");
    feedbackFd.set("clientSatisfaction", "95");
    await expectRedirect(updatePartnerReferralFeedback(companyId, referral.id, feedbackFd));

    const withFeedback = await prisma.partnerReferral.findUniqueOrThrow({ where: { id: referral.id } });
    expect(withFeedback.commissionPercent).toBe(10);
    expect(withFeedback.commissionValue).toBe(1500);
    expect(withFeedback.clientSatisfaction).toBe(95);

    const clearFd = new FormData();
    clearFd.set("commissionPercent", "");
    clearFd.set("commissionValue", "");
    clearFd.set("clientSatisfaction", "");
    await expectRedirect(updatePartnerReferralFeedback(companyId, referral.id, clearFd));

    const cleared = await prisma.partnerReferral.findUniqueOrThrow({ where: { id: referral.id } });
    expect(cleared.commissionPercent).toBeNull();
    expect(cleared.commissionValue).toBeNull();
    expect(cleared.clientSatisfaction).toBeNull();
  });
});

describe("Vertical Parceira — modelos de receita e KPIs (p. 16 e 19 do plano)", () => {
  it("creates partners under each of the 5 revenue models from the plan", async () => {
    const models = ["comissionamento", "coparticipacao", "fee_curadoria", "revenue_share", "white_label"] as const;
    for (const model of models) {
      const fd = new FormData();
      fd.set("name", `Parceiro ${model}`);
      fd.set("type", "estrategica");
      fd.set("category", "SaaS");
      fd.set("revenueModel", model);
      if (model === "fee_curadoria") fd.set("curationFeeValue", "5000");
      if (model === "revenue_share") fd.set("revenueSharePercent", "8");
      await expectRedirect(createPartner(fd));
    }

    const created = await prisma.partner.findMany({
      where: { name: { in: models.map((m) => `Parceiro ${m}`) } },
    });
    expect(created.map((p) => p.revenueModel).sort()).toEqual([...models].sort());

    const curadoria = created.find((p) => p.revenueModel === "fee_curadoria")!;
    expect(curadoria.curationFeeValue).toBe(5000);
    const revShare = created.find((p) => p.revenueModel === "revenue_share")!;
    expect(revShare.revenueSharePercent).toBe(8);
  });

  it("defaults to 'comissionamento' when no revenue model is chosen", async () => {
    const fd = new FormData();
    fd.set("name", "Parceiro Modelo Padrão");
    fd.set("type", "operacional");
    fd.set("category", "Jurídico");
    await expectRedirect(createPartner(fd));
    const partner = await prisma.partner.findFirstOrThrow({ where: { name: "Parceiro Modelo Padrão" } });
    expect(partner.revenueModel).toBe("comissionamento");
  });

  it("updates the NPS Arca Partner score for a partner", async () => {
    const fd = new FormData();
    fd.set("name", "Parceiro NPS");
    fd.set("type", "comercial");
    fd.set("category", "Associação");
    await expectRedirect(createPartner(fd));
    const partner = await prisma.partner.findFirstOrThrow({ where: { name: "Parceiro NPS" } });

    const npsFd = new FormData();
    npsFd.set("npsScore", "88");
    await expectRedirect(updatePartnerNps(partner.id, npsFd));

    const updated = await prisma.partner.findUniqueOrThrow({ where: { id: partner.id } });
    expect(updated.npsScore).toBe(88);
  });

  it("rejects an out-of-range NPS score", async () => {
    const fd = new FormData();
    fd.set("name", "Parceiro NPS Inválido");
    fd.set("type", "comercial");
    fd.set("category", "Associação");
    await expectRedirect(createPartner(fd));
    const partner = await prisma.partner.findFirstOrThrow({ where: { name: "Parceiro NPS Inválido" } });

    const npsFd = new FormData();
    npsFd.set("npsScore", "150");
    const redirectUrl = await expectRedirect(updatePartnerNps(partner.id, npsFd));
    expect(redirectUrl).toBe("/parceiros?error=validacao");

    const unchanged = await prisma.partner.findUniqueOrThrow({ where: { id: partner.id } });
    expect(unchanged.npsScore).toBeNull();
  });

  it("marks a referral as responded, recording respondedAt for SLA tracking", async () => {
    const companyId = await createTestCompanyId("Empresa Integração SLA");
    const partnerFd = new FormData();
    partnerFd.set("name", "Parceiro SLA");
    partnerFd.set("type", "operacional");
    partnerFd.set("category", "Facilities");
    partnerFd.set("slaHours", "48");
    await expectRedirect(createPartner(partnerFd));
    const partner = await prisma.partner.findFirstOrThrow({ where: { name: "Parceiro SLA" } });

    const referralFd = new FormData();
    referralFd.set("partnerId", partner.id);
    await expectRedirect(createPartnerReferral(companyId, referralFd));
    const referral = await prisma.partnerReferral.findFirstOrThrow({ where: { companyId } });
    expect(referral.respondedAt).toBeNull();

    await expectRedirect(markReferralResponded(companyId, referral.id));

    const responded = await prisma.partnerReferral.findUniqueOrThrow({ where: { id: referral.id } });
    expect(responded.respondedAt).not.toBeNull();
  });

  it("blocks marking a referral as responded for a company mismatch", async () => {
    const companyId = await createTestCompanyId("Empresa Integração SLA Dono");
    const otherCompanyId = await createTestCompanyId("Empresa Integração SLA Intrusa");
    const partnerFd = new FormData();
    partnerFd.set("name", "Parceiro SLA Cross-Company");
    partnerFd.set("type", "operacional");
    partnerFd.set("category", "Facilities");
    await expectRedirect(createPartner(partnerFd));
    const partner = await prisma.partner.findFirstOrThrow({ where: { name: "Parceiro SLA Cross-Company" } });

    const referralFd = new FormData();
    referralFd.set("partnerId", partner.id);
    await expectRedirect(createPartnerReferral(companyId, referralFd));
    const referral = await prisma.partnerReferral.findFirstOrThrow({ where: { companyId } });

    await expectNotFound(markReferralResponded(otherCompanyId, referral.id));
    const unchanged = await prisma.partnerReferral.findUniqueOrThrow({ where: { id: referral.id } });
    expect(unchanged.respondedAt).toBeNull();
  });
});

describe("Estrutura de receita (createContract/updateContractStatus/deleteContract)", () => {
  it("creates a MRR contract with default 'ativo' status", async () => {
    const companyId = await createTestCompanyId("Empresa Integração Contrato MRR");
    const fd = new FormData();
    fd.set("type", "mrr");
    fd.set("verticalKey", "financeiro");
    fd.set("value", "8000");
    fd.set("startDate", "2026-01-01");
    fd.set("endDate", "");
    fd.set("notes", "Retainer mensal do módulo Financeiro");

    const redirectUrl = await expectRedirect(createContract(companyId, fd));
    expect(redirectUrl).toBe(`/empresas/${companyId}?sucesso=contrato-criado`);

    const contract = await prisma.contract.findFirstOrThrow({ where: { companyId } });
    expect(contract.status).toBe("ativo");
    expect(contract.value).toBe(8000);
    expect(contract.verticalKey).toBe("financeiro");
    expect(contract.endDate).toBeNull();
  });

  it("rejects an unknown verticalKey by silently falling back to 'empresa toda'", async () => {
    const companyId = await createTestCompanyId("Empresa Integração Contrato Vertical Inválida");
    const fd = new FormData();
    fd.set("type", "setup");
    fd.set("verticalKey", "vertical-que-nao-existe");
    fd.set("value", "20000");
    fd.set("startDate", "2026-01-01");

    await expectRedirect(createContract(companyId, fd));
    const contract = await prisma.contract.findFirstOrThrow({ where: { companyId } });
    expect(contract.verticalKey).toBeNull();
  });

  it("requires a value for setup/mrr/projeto_avulso and rejects when missing", async () => {
    const companyId = await createTestCompanyId("Empresa Integração Contrato Sem Valor");
    const fd = new FormData();
    fd.set("type", "setup");
    fd.set("startDate", "2026-01-01");

    const redirectUrl = await expectRedirect(createContract(companyId, fd));
    expect(redirectUrl).toBe(`/empresas/${companyId}?error=contrato-invalido`);
    expect(await prisma.contract.count({ where: { companyId } })).toBe(0);
  });

  it("requires a feePercent for performance_fee and rejects when missing", async () => {
    const companyId = await createTestCompanyId("Empresa Integração Contrato Sem Fee");
    const fd = new FormData();
    fd.set("type", "performance_fee");
    fd.set("startDate", "2026-01-01");

    const redirectUrl = await expectRedirect(createContract(companyId, fd));
    expect(redirectUrl).toBe(`/empresas/${companyId}?error=contrato-invalido`);
    expect(await prisma.contract.count({ where: { companyId } })).toBe(0);
  });

  it("updates and deletes a contract, blocked for a company mismatch", async () => {
    const companyId = await createTestCompanyId("Empresa Integração Contrato Status");
    const otherCompanyId = await createTestCompanyId("Empresa Integração Contrato Status Intrusa");
    const fd = new FormData();
    fd.set("type", "projeto_avulso");
    fd.set("value", "30000");
    fd.set("startDate", "2026-01-01");
    await expectRedirect(createContract(companyId, fd));
    const contract = await prisma.contract.findFirstOrThrow({ where: { companyId } });

    const statusFd = new FormData();
    statusFd.set("status", "encerrado");
    await expectNotFound(updateContractStatus(otherCompanyId, contract.id, statusFd));
    await expectRedirect(updateContractStatus(companyId, contract.id, statusFd));

    const updated = await prisma.contract.findUniqueOrThrow({ where: { id: contract.id } });
    expect(updated.status).toBe("encerrado");

    await expectNotFound(deleteContract(otherCompanyId, contract.id));
    await expectRedirect(deleteContract(companyId, contract.id));
    expect(await prisma.contract.findUnique({ where: { id: contract.id } })).toBeNull();
  });
});

describe("Apuração de Performance Fee (createPerformanceRecord/deletePerformanceRecord)", () => {
  it("computes feeValue from gainValue and the contract's feePercent, and freezes it", async () => {
    const companyId = await createTestCompanyId("Empresa Integração Performance Fee");
    const contractFd = new FormData();
    contractFd.set("type", "performance_fee");
    contractFd.set("feePercent", "10");
    contractFd.set("startDate", "2026-01-01");
    await expectRedirect(createContract(companyId, contractFd));
    const contract = await prisma.contract.findFirstOrThrow({ where: { companyId } });

    const recordFd = new FormData();
    recordFd.set("period", "2026-T1");
    recordFd.set("gainValue", "12000");
    recordFd.set("notes", "Redução de inadimplência no trimestre");
    await expectRedirect(createPerformanceRecord(companyId, contract.id, recordFd));

    const record = await prisma.contractPerformanceRecord.findFirstOrThrow({ where: { contractId: contract.id } });
    expect(record.gainValue).toBe(12000);
    expect(record.feeValue).toBe(1200); // 10% de 12000

    await expectRedirect(deletePerformanceRecord(companyId, contract.id, record.id));
    expect(await prisma.contractPerformanceRecord.findUnique({ where: { id: record.id } })).toBeNull();
  });

  it("rejects an apuração for a contract that is not performance_fee", async () => {
    const companyId = await createTestCompanyId("Empresa Integração Performance Fee Inválido");
    const contractFd = new FormData();
    contractFd.set("type", "mrr");
    contractFd.set("value", "5000");
    contractFd.set("startDate", "2026-01-01");
    await expectRedirect(createContract(companyId, contractFd));
    const contract = await prisma.contract.findFirstOrThrow({ where: { companyId } });

    const recordFd = new FormData();
    recordFd.set("period", "2026-T1");
    recordFd.set("gainValue", "5000");
    const redirectUrl = await expectRedirect(createPerformanceRecord(companyId, contract.id, recordFd));
    expect(redirectUrl).toBe(`/empresas/${companyId}?error=contrato-invalido`);
    expect(await prisma.contractPerformanceRecord.count({ where: { contractId: contract.id } })).toBe(0);
  });
});
