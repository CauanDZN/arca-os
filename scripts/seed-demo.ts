// One-off seed script for a polished demo company: an "antes" (weak) diagnostic
// and a "depois" (strong) diagnostic, so the report, Kanban and the Agente de
// Evolução de Maturidade all have something good to show. Not part of the app
// runtime — run manually with `npx tsx scripts/seed-demo.ts`.
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local" });

import { prisma } from "../lib/prisma";
import { AREAS } from "../lib/areas";
import { buildReport, type ActionItem } from "../lib/scoring";
import { generateAiNarrative } from "../lib/ai";

const AREA_TARGETS_BEFORE: Record<string, number> = {
  estrategia: 3,
  financeiro: 2,
  comercial: 3,
  marketing: 2,
  operacoes: 3,
  atendimento: 3,
  pessoas: 2,
  tecnologia: 2,
  fiscal: 3,
  juridico: 3,
  compras: 3,
  indicadores: 2,
};

const AREA_TARGETS_AFTER: Record<string, number> = {
  estrategia: 4,
  financeiro: 5,
  comercial: 5,
  marketing: 3,
  operacoes: 4,
  atendimento: 5,
  pessoas: 3,
  tecnologia: 3,
  fiscal: 4,
  juridico: 4,
  compras: 4,
  indicadores: 3,
};

const EVIDENCE_BY_AREA: Record<string, string> = {
  estrategia: "Ata da reunião de planejamento anual, registrada no Data Room.",
  financeiro: "DRE gerencial mensal exportado do sistema financeiro.",
  comercial: "Relatório do CRM com funil e metas por vendedor.",
  marketing: "Calendário de conteúdo e print do painel de campanhas.",
  operacoes: "Checklist de padronização de atendimento nas 3 filiais.",
  atendimento: "Pesquisa de satisfação (NPS) do último trimestre.",
  pessoas: "Plano de cargos e avaliação de desempenho semestral.",
  tecnologia: "Print do ERP integrado com o e-commerce e o financeiro.",
  fiscal: "Certidões negativas atualizadas anexadas pela contabilidade.",
  juridico: "Contratos-padrão revisados pelo jurídico em 2026.",
  compras: "Planilha de cotação comparativa dos 3 principais fornecedores.",
  indicadores: "Painel de indicadores semanal compartilhado com os sócios.",
};

function scoresForArea(questionCount: number, target: number): number[] {
  const base = Math.round(target);
  const pattern = [base - 1, base, base + 1, base];
  return Array.from({ length: questionCount }, (_, i) =>
    Math.max(0, Math.min(5, pattern[i % pattern.length]))
  );
}

async function createDiagnostic(opts: {
  companyId: string;
  createdAt: Date;
  targets: Record<string, number>;
  withEvidence: boolean;
}) {
  const diagnostic = await prisma.diagnostic.create({
    data: { companyId: opts.companyId, status: "concluido", createdAt: opts.createdAt },
  });

  for (const area of AREAS) {
    const target = opts.targets[area.key] ?? 3;
    const scores = scoresForArea(area.questions.length, target);
    for (let i = 0; i < area.questions.length; i++) {
      const question = area.questions[i];
      const score = scores[i];
      await prisma.answer.create({
        data: {
          diagnosticId: diagnostic.id,
          areaKey: area.key,
          questionId: question.id,
          score,
          evidence: opts.withEvidence && score <= 2 ? EVIDENCE_BY_AREA[area.key] : "",
          responsible: "Sócia-diretora",
          impact: score <= 2 ? "Alto" : "Médio",
          urgency: score <= 2 ? "Alta" : "Média",
          risk: "Operacional",
        },
      });
    }
  }

  return diagnostic;
}

async function main() {
  const company = await prisma.company.create({
    data: {
      name: "Ótica Visão Clara",
      segment: "Varejo · Óptica",
      marketAge: "8 anos",
      employees: "22",
      avgRevenue: "R$ 310.000",
      margin: "24%",
      activeClients: "1.850",
      productsServices: "Óculos de grau, lentes de contato, óculos de sol, exames de vista",
      cities: "Recife, Olinda",
      painPoints:
        "Crescimento estagnado nas duas filiais mais novas, dificuldade em reter vendedores, decisões tomadas sem dados consistentes.",
      objectives: JSON.stringify(["Crescer faturamento", "Profissionalizar time", "Implantar controles"]),
    },
  });

  const before = await createDiagnostic({
    companyId: company.id,
    createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
    targets: AREA_TARGETS_BEFORE,
    withEvidence: true,
  });

  const after = await createDiagnostic({
    companyId: company.id,
    createdAt: new Date(),
    targets: AREA_TARGETS_AFTER,
    withEvidence: true,
  });

  // Generate the AI narrative for the current ("depois") diagnostic, same as
  // the real completion flow in app/actions.ts.
  const afterAnswers = await prisma.answer.findMany({ where: { diagnosticId: after.id } });
  const afterReport = buildReport(
    afterAnswers.map((a) => ({ areaKey: a.areaKey, questionId: a.questionId, score: a.score }))
  );
  const narrative = await generateAiNarrative(
    {
      name: company.name,
      segment: company.segment,
      painPoints: company.painPoints,
      objectives: JSON.parse(company.objectives),
    },
    afterReport
  );
  if (narrative) {
    await prisma.diagnostic.update({
      where: { id: after.id },
      data: { aiNarrative: JSON.stringify(narrative) },
    });
    console.log("✔ Narrativa de IA gerada para o diagnóstico 'depois'.");
  } else {
    console.log("○ Sem GEMINI_API_KEY configurada — narrativa de IA pulada (fallback normal).");
  }

  // Approve the action plan for the current diagnostic and mark a couple of
  // tasks as already in progress / done, so the Kanban isn't just "todo".
  const allItems: ActionItem[] = [
    ...afterReport.actionPlan.days30,
    ...afterReport.actionPlan.days90,
    ...afterReport.actionPlan.months12,
  ];
  await prisma.task.createMany({
    data: allItems.map((item, index) => ({
      diagnosticId: after.id,
      areaKey: item.areaKey,
      areaName: item.areaName,
      title: item.action,
      priority: item.priority,
      timeframe: item.timeframe,
      status: index === 0 ? "done" : index === 1 ? "doing" : "todo",
      position: index,
    })),
  });
  await prisma.diagnostic.update({ where: { id: after.id }, data: { status: "em_execucao" } });

  console.log("\n=== Empresa de demonstração criada ===");
  console.log(`Empresa: ${company.name} (${company.id})`);
  console.log(`Diagnóstico "antes":  http://localhost:3000/diagnostico/${before.id}/relatorio`);
  console.log(`Diagnóstico "depois": http://localhost:3000/diagnostico/${after.id}/relatorio`);
  console.log(`Projeto (Kanban):     http://localhost:3000/diagnostico/${after.id}/projeto`);
  console.log(`Cockpit da empresa:   http://localhost:3000/empresas/${company.id}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
