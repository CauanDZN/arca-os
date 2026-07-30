import { describe, it, expect, vi } from "vitest";
import fs from "fs/promises";
import path from "path";
import { AREAS } from "@/lib/areas";

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import { prisma } from "@/lib/prisma";
import { createDiagnostic, saveAreaAnswers } from "@/app/actions";
import { approveActionPlan, moveTask } from "@/app/actions-project";
import { uploadDocument, deleteDocument } from "@/app/actions-documents";

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

  it("is idempotent: approving an already-approved plan does not duplicate tasks", async () => {
    const diagnosticId = await createTestCompany("Empresa Integração Kanban Idempotente");
    await completeAllAreas(diagnosticId, 0);

    await expectRedirect(approveActionPlan(diagnosticId));
    const firstCount = await prisma.task.count({ where: { diagnosticId } });

    await expectRedirect(approveActionPlan(diagnosticId));
    const secondCount = await prisma.task.count({ where: { diagnosticId } });

    expect(secondCount).toBe(firstCount);
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

    const filePath = path.join(process.cwd(), "uploads", companyId, doc.storedName);
    expect(await fs.readFile(filePath, "utf-8")).toBe(fileContent);

    await expectRedirect(deleteDocument(companyId, doc.id));

    expect(await prisma.document.findUnique({ where: { id: doc.id } })).toBeNull();
    await expect(fs.access(filePath)).rejects.toThrow();

    // don't leave test artifacts in the real project's uploads/ directory
    await fs.rm(path.join(process.cwd(), "uploads", companyId), { recursive: true, force: true });
  });
});
