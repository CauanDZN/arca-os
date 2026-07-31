export type DataQualityIssue = {
  companyId: string;
  companyName: string;
  diagnosticId?: string;
  type: "sem_diagnostico_concluido" | "sem_evidencia" | "notas_zeradas" | "tarefas_sem_responsavel";
  detail: string;
};

type AnswerInput = { score: number; evidence: string };

type DiagnosticInput = {
  id: string;
  status: string;
  answers: AnswerInput[];
};

export type CompanyAuditInput = {
  companyId: string;
  companyName: string;
  diagnostics: DiagnosticInput[];
  openTasksWithoutResponsible: number;
};

const FINISHED_STATUSES = new Set(["concluido", "em_execucao"]);

/**
 * Agente de Qualidade de Dados: pure rule, no AI, platform-wide (not scoped
 * to one company) — audits the data governing every other agent, not the
 * business itself. A diagnostic with every score at 0 or every evidence
 * field blank isn't a real finding, it's test/placeholder data quietly
 * skewing reports and plans.
 */
export function auditDataQuality(companies: CompanyAuditInput[]): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];

  for (const company of companies) {
    const finished = company.diagnostics.filter((d) => FINISHED_STATUSES.has(d.status));

    if (company.diagnostics.length > 0 && finished.length === 0) {
      issues.push({
        companyId: company.companyId,
        companyName: company.companyName,
        type: "sem_diagnostico_concluido",
        detail: "Nenhum diagnóstico concluído — cadastro parece abandonado no meio do questionário.",
      });
    }

    for (const diagnostic of finished) {
      if (diagnostic.answers.length === 0) continue;

      if (diagnostic.answers.every((a) => a.evidence.trim() === "")) {
        issues.push({
          companyId: company.companyId,
          companyName: company.companyName,
          diagnosticId: diagnostic.id,
          type: "sem_evidencia",
          detail: "Nenhuma resposta do diagnóstico tem evidência anexada.",
        });
      }

      if (diagnostic.answers.every((a) => a.score === 0)) {
        issues.push({
          companyId: company.companyId,
          companyName: company.companyName,
          diagnosticId: diagnostic.id,
          type: "notas_zeradas",
          detail: "Todas as notas do diagnóstico são 0 — provável dado de teste, não diagnóstico real.",
        });
      }
    }

    if (company.openTasksWithoutResponsible > 0) {
      issues.push({
        companyId: company.companyId,
        companyName: company.companyName,
        type: "tarefas_sem_responsavel",
        detail: `${company.openTasksWithoutResponsible} ação(ões) aberta(s) sem responsável definido.`,
      });
    }
  }

  return issues;
}
