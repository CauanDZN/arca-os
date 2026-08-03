import { GoogleGenAI } from "@google/genai";
import type { Report } from "@/lib/scoring";

// Duplicado de lib/document-extract.ts de propósito: aquele módulo importa
// pdf-parse (ESM-only, pesado) no topo do arquivo, e lib/ai.ts é importado
// por praticamente toda página do app — um import estático de lá arrastaria
// pdf-parse pro bundle de todas elas (mesma causa do FUNCTION_INVOCATION_FAILED
// que actions-documents.ts documenta evitar com import dinâmico).
const OCR_CAPABLE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

export type AiNarrative = {
  executiveSummary: string;
  areaInsights: {
    areaKey: string;
    causaRaiz: string;
    recomendacao: string;
  }[];
};

type CompanyInfo = {
  name: string;
  segment: string;
  painPoints: string;
  objectives: string[];
};

function buildPrompt(company: CompanyInfo, report: Report): string {
  const areasResumo = report.areaScores
    .filter((a) => a.status !== "Otimizado")
    .map((a) => {
      const gaps = a.weakestQuestions.map((q) => `- ${q.text} (nota ${q.score})`).join("\n");
      return `Área: ${a.area.name} (chave: ${a.area.key})\nNota: ${a.average.toFixed(1)}/5 — Status: ${a.status}\nPrincipais gaps:\n${gaps || "- (sem gaps específicos identificados)"}`;
    })
    .join("\n\n");

  return `Você é um consultor sênior de gestão empresarial da Arca Consulting, especializado em diagnóstico de PMEs (pequenas e médias empresas).

Empresa: ${company.name}
Segmento: ${company.segment}
Dores relatadas pelo cliente: ${company.painPoints || "não informado"}
Objetivo do diagnóstico: ${company.objectives.join(", ") || "não informado"}

Nota geral de maturidade: ${report.overallAverage.toFixed(1)}/5 (${report.overallStatus})

Resultado por área com gaps identificados:

${areasResumo}

Tarefa: escreva um sumário executivo consultivo (3 a 5 frases, tom direto e profissional, em português do Brasil) resumindo a situação geral da empresa, e para cada área acima, uma causa raiz provável (1 frase) e uma recomendação prática da Arca (1 frase).

Responda APENAS com um JSON válido no formato exato abaixo, sem markdown, sem texto adicional:
{
  "executiveSummary": "...",
  "areaInsights": [
    { "areaKey": "...", "causaRaiz": "...", "recomendacao": "..." }
  ]
}`;
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (fenced ? fenced[1] : text).trim();
}

export async function generateAiNarrative(
  company: CompanyInfo,
  report: Report
): Promise<AiNarrative | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: buildPrompt(company, report),
    });

    const text = response.text;
    if (!text) return null;

    const parsed = JSON.parse(extractJson(text));
    if (typeof parsed.executiveSummary !== "string" || !Array.isArray(parsed.areaInsights)) {
      return null;
    }

    return parsed as AiNarrative;
  } catch (error) {
    console.error("generateAiNarrative failed:", error);
    return null;
  }
}

/**
 * Agente de Evolução de Maturidade: compares the two most recent diagnostics
 * of a company and explains what changed. Computed on demand (not persisted) —
 * there is no natural "completion" event to hang caching off, unlike the
 * per-diagnostic narrative above.
 */
export async function generateMaturityEvolution(
  companyName: string,
  previous: { date: Date; report: Report },
  current: { date: Date; report: Report }
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const ai = new GoogleGenAI({ apiKey });

    const areaDeltas = current.report.areaScores
      .map((a) => {
        const prev = previous.report.areaScores.find((p) => p.area.key === a.area.key);
        const delta = prev ? Math.round((a.average - prev.average) * 10) / 10 : 0;
        const sign = delta >= 0 ? "+" : "";
        return `${a.area.name}: ${prev?.average.toFixed(1) ?? "—"} → ${a.average.toFixed(1)} (${sign}${delta})`;
      })
      .join("\n");

    const prompt = `Você é o Agente de Evolução de Maturidade da Arca Consulting. Compare os dois diagnósticos abaixo da empresa ${companyName} e explique, em um parágrafo curto (3 a 5 frases, português do Brasil, tom consultivo), o que mudou: quais áreas melhoraram, quais pioraram ou estagnaram, e o que isso sugere para os próximos passos.

Diagnóstico anterior (${previous.date.toLocaleDateString("pt-BR")}): nota geral ${previous.report.overallAverage.toFixed(1)}/5 (${previous.report.overallStatus})
Diagnóstico atual (${current.date.toLocaleDateString("pt-BR")}): nota geral ${current.report.overallAverage.toFixed(1)}/5 (${current.report.overallStatus})

Evolução por área:
${areaDeltas}

Responda apenas com o parágrafo, sem markdown, sem título.`;

    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
    });

    const text = response.text?.trim();
    return text || null;
  } catch (error) {
    console.error("generateMaturityEvolution failed:", error);
    return null;
  }
}

export type SprintEvent = {
  taskTitle: string;
  areaName: string;
  fromStatus: string;
  toStatus: string;
  createdAt: Date;
};

const KANBAN_STATUS_LABEL: Record<string, string> = {
  todo: "A Fazer",
  doing: "Em Andamento",
  done: "Concluído",
};

/**
 * Agente de Relatório de Sprint: summarizes Kanban card movements (TaskEvent
 * rows) within a period into a short paragraph for a management review. Unlike
 * the narrative agents above, an empty period is a normal, expected case (no
 * movement yet) — the caller renders that state itself instead of calling this.
 */
export async function generateSprintReport(
  companyName: string,
  events: SprintEvent[],
  periodDays: number
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || events.length === 0) return null;

  try {
    const ai = new GoogleGenAI({ apiKey });

    const eventLines = events
      .map((e) => {
        const from = KANBAN_STATUS_LABEL[e.fromStatus] ?? e.fromStatus;
        const to = KANBAN_STATUS_LABEL[e.toStatus] ?? e.toStatus;
        return `${e.createdAt.toLocaleDateString("pt-BR")} — [${e.areaName}] "${e.taskTitle}": ${from} → ${to}`;
      })
      .join("\n");

    const prompt = `Você é o Agente de Relatório de Sprint da Arca Consulting. Resuma, em um parágrafo curto (3 a 5 frases, português do Brasil, tom objetivo para um comitê de gestão), o progresso da execução do plano de ação da empresa ${companyName} nos últimos ${periodDays} dias, com base nas movimentações abaixo do quadro Kanban.

Movimentações no período:
${eventLines}

Responda apenas com o parágrafo, sem markdown, sem título.`;

    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
    });

    const text = response.text?.trim();
    return text || null;
  } catch (error) {
    console.error("generateSprintReport failed:", error);
    return null;
  }
}

export type DocumentClassification = {
  category: string;
  confidence: "alta" | "baixa";
};

const DOCUMENT_TYPES = [
  "Extrato bancário",
  "DRE",
  "Contrato",
  "Nota fiscal",
  "Folha de pagamento",
  "Planilha de indicadores",
  "Outro",
];

/**
 * Agente Classificador de Documentos: classifica pelo texto extraído quando
 * existe; quando não existe mas o formato é imagem/PDF escaneado, manda os
 * bytes direto pro Gemini (multimodal — OCR de verdade, sem lib separada);
 * só cai pra "confiança baixa" só-pelo-nome quando nem isso é possível
 * (planilha, Office).
 */
export async function classifyDocument(
  originalName: string,
  mimeType: string,
  extractedText: string | null,
  fileBytes?: Buffer | null
): Promise<DocumentClassification | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const canUseOcr = !extractedText && !!fileBytes && OCR_CAPABLE_MIME_TYPES.has(mimeType);

  try {
    const ai = new GoogleGenAI({ apiKey });

    const contentBlock = extractedText
      ? `Conteúdo extraído (trecho):\n${extractedText}`
      : canUseOcr
        ? "Conteúdo anexado abaixo como imagem/PDF — leia diretamente o que estiver escrito nele."
        : "Conteúdo não pôde ser lido (formato não suportado para extração de texto) — classifique apenas pelo nome do arquivo e marque confiança baixa.";

    const prompt = `Você é o Agente Classificador de Documentos do Data Room da Arca Consulting. Classifique o documento abaixo em UM dos tipos: ${DOCUMENT_TYPES.join(", ")}.

Nome do arquivo: ${originalName}
Tipo MIME: ${mimeType}
${contentBlock}

Responda APENAS com um JSON válido no formato exato abaixo, sem markdown, sem texto adicional:
{ "category": "um dos tipos listados", "confidence": "alta" ou "baixa" }`;

    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: canUseOcr
        ? [{ text: prompt }, { inlineData: { mimeType, data: fileBytes!.toString("base64") } }]
        : prompt,
    });

    const text = response.text;
    if (!text) return null;

    const parsed = JSON.parse(extractJson(text));
    if (
      typeof parsed.category !== "string" ||
      (parsed.confidence !== "alta" && parsed.confidence !== "baixa")
    ) {
      return null;
    }

    return parsed as DocumentClassification;
  } catch (error) {
    console.error("classifyDocument failed:", error);
    return null;
  }
}

export type VerticalAnswerDetail = {
  questionText: string;
  score: number;
  evidence: string;
  responsible: string;
  impact: string;
  urgency: string;
  risk: string;
};

export type VerticalDocument = { name: string; text: string };

export type VerticalInsight = {
  analysis: string;
  recommendations: string[];
};

function buildVerticalPrompt(
  companyName: string,
  areaName: string,
  average: number,
  status: string,
  answers: VerticalAnswerDetail[],
  documents: VerticalDocument[]
): string {
  const answersBlock = answers
    .map((a) => {
      const evidence = a.evidence ? ` — evidência: ${a.evidence}` : "";
      const responsible = a.responsible ? ` — responsável: ${a.responsible}` : "";
      return `- ${a.questionText} (nota ${a.score}, impacto ${a.impact}, urgência ${a.urgency}, risco ${a.risk})${evidence}${responsible}`;
    })
    .join("\n");

  const documentsBlock =
    documents.length > 0
      ? documents.map((d) => `Documento "${d.name}":\n${d.text}`).join("\n\n")
      : "Nenhum documento do Data Room está categorizado nesta área — baseie-se apenas nas respostas do questionário.";

  return `Você é o Agente de Diagnóstico Especialista em ${areaName} da Arca Consulting. Aprofunde a análise desta área específica da empresa ${companyName}, cruzando as respostas do questionário com os documentos do Data Room categorizados nesta área.

Nota da área: ${average.toFixed(1)}/5 (${status})

Respostas do questionário:
${answersBlock || "- (nenhuma resposta registrada)"}

Documentos do Data Room desta categoria:
${documentsBlock}

Tarefa: escreva uma análise aprofundada (4 a 6 frases, português do Brasil, tom consultivo e específico da área — não repita o resumo executivo geral) e de 2 a 4 recomendações práticas e específicas que a Arca daria para essa empresa nesta área.

Responda APENAS com um JSON válido no formato exato abaixo, sem markdown, sem texto adicional:
{ "analysis": "...", "recommendations": ["...", "..."] }`;
}

/**
 * Agente de Diagnóstico Vertical: a deeper, area-specific pass for the 5
 * verticals in VERTICAL_AGENT_AREAS. Unlike the executive summary (one shot
 * over all areas), this reads every evidence field for the area plus the
 * actual text of any Data Room documents filed under that category — real
 * grounding, not a hallucinated financial/legal opinion.
 */
export async function generateVerticalInsight(
  companyName: string,
  areaName: string,
  average: number,
  status: string,
  answers: VerticalAnswerDetail[],
  documents: VerticalDocument[]
): Promise<VerticalInsight | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: buildVerticalPrompt(companyName, areaName, average, status, answers, documents),
    });

    const text = response.text;
    if (!text) return null;

    const parsed = JSON.parse(extractJson(text));
    if (typeof parsed.analysis !== "string" || !Array.isArray(parsed.recommendations)) {
      return null;
    }

    return parsed as VerticalInsight;
  } catch (error) {
    console.error("generateVerticalInsight failed:", error);
    return null;
  }
}

export type MeetingMinutes = {
  summary: string;
  decisions: string[];
  pending: string[];
};

/**
 * Agente Gerador de Ata de Reunião: structures raw, manually-typed meeting
 * notes. There is no calendar/transcription integration behind this — the
 * input surface IS the textarea on /empresas/[id]/reunioes, which is honest
 * and works without any external system.
 */
export async function generateMeetingMinutes(
  companyName: string,
  rawNotes: string
): Promise<MeetingMinutes | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Você é o Agente Gerador de Ata de Reunião da Arca Consulting. Organize as anotações brutas de reunião abaixo, da empresa ${companyName}, em uma ata estruturada.

Anotações brutas:
${rawNotes}

Tarefa: escreva um resumo curto (2 a 4 frases) do que foi discutido, liste as decisões tomadas e liste as pendências/próximos passos (com responsável, se mencionado nas anotações). Se as anotações não mencionarem decisões ou pendências, devolva uma lista vazia para o campo correspondente — não invente conteúdo.

Responda APENAS com um JSON válido no formato exato abaixo, sem markdown, sem texto adicional:
{ "summary": "...", "decisions": ["..."], "pending": ["..."] }`;

    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
    });

    const text = response.text;
    if (!text) return null;

    const parsed = JSON.parse(extractJson(text));
    if (
      typeof parsed.summary !== "string" ||
      !Array.isArray(parsed.decisions) ||
      !Array.isArray(parsed.pending)
    ) {
      return null;
    }

    return parsed as MeetingMinutes;
  } catch (error) {
    console.error("generateMeetingMinutes failed:", error);
    return null;
  }
}

export type PerformanceKpiEntry = {
  areaName: string;
  indicatorName: string;
  month: string;
  value: number;
};

/**
 * Agente de Performance por Área: reads the Cockpit de Performance's manual
 * KPI history and narrates trends. Deliberately one generic agent instead of
 * separate "Financeiro/Comercial/Margem/Produtividade" agents — it works off
 * whatever indicators the company actually tracks, area by area.
 */
export async function generatePerformanceInsight(
  companyName: string,
  entries: PerformanceKpiEntry[]
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || entries.length === 0) return null;

  try {
    const ai = new GoogleGenAI({ apiKey });

    const byIndicator = new Map<string, PerformanceKpiEntry[]>();
    for (const entry of entries) {
      const key = `${entry.areaName} — ${entry.indicatorName}`;
      byIndicator.set(key, [...(byIndicator.get(key) ?? []), entry]);
    }

    const seriesBlock = [...byIndicator.entries()]
      .map(([label, series]) => {
        const sorted = [...series].sort((a, b) => a.month.localeCompare(b.month));
        const points = sorted.map((e) => `${e.month}: ${e.value}`).join(", ");
        return `${label}: ${points}`;
      })
      .join("\n");

    const prompt = `Você é o Agente de Performance por Área da Arca Consulting. Analise o histórico de indicadores abaixo da empresa ${companyName}, registrado manualmente pela equipe (sem integração bancária ou de ERP).

Séries históricas (indicador: mês: valor, ...):
${seriesBlock}

Tarefa: escreva um parágrafo curto (3 a 5 frases, português do Brasil, tom consultivo objetivo) destacando as tendências mais relevantes — o que melhorou, o que piorou, o que está estagnado — e o que a Arca recomendaria observar de perto no próximo mês. Não invente indicador que não está na lista.

Responda apenas com o parágrafo, sem markdown, sem título.`;

    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
    });

    const text = response.text?.trim();
    return text || null;
  } catch (error) {
    console.error("generatePerformanceInsight failed:", error);
    return null;
  }
}

export type KpiSuggestionResult = {
  indicatorName: string;
  month: string;
  value: number;
};

/**
 * Agente de Extração de Indicadores: reads a Data Room document's extracted
 * text and proposes KPI values to feed the Cockpit de Performance — the
 * "agente identifica entradas e saídas... analista revisa e valida" mechanism
 * from the pitch. Constrained to the area's own indicator vocabulary (same
 * pattern as classifyDocument's fixed category list) so it can't invent a
 * metric name the rest of the app doesn't recognize. Suggestions are never
 * auto-applied — the caller stores them as KpiSuggestion rows pending review.
 */
export async function extractKpiSuggestions(
  areaName: string,
  allowedIndicators: string[],
  documentText: string
): Promise<KpiSuggestionResult[] | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || documentText.trim() === "") return null;

  try {
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Você é o Agente de Extração de Indicadores da Arca Consulting. Leia o trecho de documento abaixo (categoria: ${areaName}) e identifique valores numéricos que correspondam EXATAMENTE a um destes indicadores:

${allowedIndicators.map((i) => `- ${i}`).join("\n")}

Trecho do documento:
${documentText}

Tarefa: extraia apenas o que estiver claramente presente no texto — não estime, não infira valor que não esteja escrito. Para cada valor encontrado, identifique o mês de referência (formato AAAA-MM; se o documento não deixar claro o mês, não inclua esse valor). Se nada corresponder com confiança, devolva uma lista vazia.

Responda APENAS com um JSON válido no formato exato abaixo, sem markdown, sem texto adicional:
{ "suggestions": [ { "indicatorName": "um dos indicadores listados", "month": "AAAA-MM", "value": 0 } ] }`;

    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
    });

    const text = response.text;
    if (!text) return null;

    const parsed = JSON.parse(extractJson(text));
    if (!Array.isArray(parsed.suggestions)) return null;

    const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
    return parsed.suggestions.filter(
      (s: unknown): s is KpiSuggestionResult =>
        typeof s === "object" &&
        s !== null &&
        typeof (s as KpiSuggestionResult).indicatorName === "string" &&
        allowedIndicators.includes((s as KpiSuggestionResult).indicatorName) &&
        typeof (s as KpiSuggestionResult).month === "string" &&
        monthPattern.test((s as KpiSuggestionResult).month) &&
        typeof (s as KpiSuggestionResult).value === "number"
    );
  } catch (error) {
    console.error("extractKpiSuggestions failed:", error);
    return null;
  }
}

export type FinancialTransactionCategory =
  | "fornecedor"
  | "imposto"
  | "despesa_pessoal"
  | "emprestimo"
  | "outro";

export type ExtractedTransaction = {
  date: string;
  description: string;
  amount: number;
  category: FinancialTransactionCategory;
  flagged: boolean;
  flagReason: string;
};

const TRANSACTION_CATEGORIES = new Set<string>([
  "fornecedor",
  "imposto",
  "despesa_pessoal",
  "emprestimo",
  "outro",
]);
const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/**
 * Agente de Extração Financeira (Grupo 2 · Operacionais): consequência
 * direta do OCR — em vez de só classificar "isto é um extrato", lê o
 * conteúdo (texto extraído ou, na falta dele, os bytes da imagem/PDF via
 * OCR) e devolve cada transação encontrada, já sinalizando o que parece
 * inconsistente (despesa pessoal misturada na conta da empresa, valor
 * recorrente sem explicação etc.). Nunca inventa transação fora do
 * documento; a Server Action que chama isso persiste tudo como "pendente"
 * — revisão humana antes de virar dado oficial, mesmo padrão do
 * KpiSuggestion.
 */
export async function extractFinancialTransactions(
  documentText: string | null,
  fileBytes: Buffer | null,
  mimeType: string
): Promise<ExtractedTransaction[] | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const canUseOcr = !documentText && !!fileBytes && OCR_CAPABLE_MIME_TYPES.has(mimeType);
  if (!documentText && !canUseOcr) return null;

  try {
    const ai = new GoogleGenAI({ apiKey });

    const contentBlock = documentText
      ? `Conteúdo do documento:\n${documentText}`
      : "Conteúdo anexado abaixo como imagem/PDF — leia diretamente.";

    const prompt = `Você é o Agente de Extração Financeira da Arca Consulting. Leia o extrato bancário abaixo (documento real de um cliente) e extraia CADA transação que conseguir identificar com clareza — não invente nenhuma que não esteja no documento.

Para cada transação, identifique:
- date: data no formato AAAA-MM-DD (se não estiver clara, não inclua essa transação)
- description: descrição curta, como aparece no extrato
- amount: valor numérico — positivo para entrada/crédito, negativo para saída/débito
- category: "fornecedor" (pagamento a fornecedor/prestador), "imposto" (tributo, taxa, DAS, INSS...), "despesa_pessoal" (gasto que parece pessoal do dono, não da empresa), "emprestimo" (empréstimo, financiamento, parcela de dívida) ou "outro"
- flagged: true se merecer atenção humana (possível despesa pessoal na conta da empresa, valor alto recorrente sem explicação, indício de empréstimo não declarado)
- flagReason: se flagged, uma frase curta do motivo; senão, string vazia

Se o documento não for um extrato bancário reconhecível, devolva uma lista vazia.

${contentBlock}

Responda APENAS com um JSON válido no formato exato abaixo, sem markdown, sem texto adicional:
{ "transactions": [ { "date": "AAAA-MM-DD", "description": "...", "amount": 0, "category": "fornecedor|imposto|despesa_pessoal|emprestimo|outro", "flagged": false, "flagReason": "" } ] }`;

    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: canUseOcr
        ? [{ text: prompt }, { inlineData: { mimeType, data: fileBytes!.toString("base64") } }]
        : prompt,
    });

    const text = response.text;
    if (!text) return null;

    const parsed = JSON.parse(extractJson(text));
    if (!Array.isArray(parsed.transactions)) return null;

    return parsed.transactions.filter((t: unknown): t is ExtractedTransaction => {
      if (typeof t !== "object" || t === null) return false;
      const r = t as Record<string, unknown>;
      return (
        typeof r.date === "string" &&
        DATE_PATTERN.test(r.date) &&
        typeof r.description === "string" &&
        r.description.trim() !== "" &&
        typeof r.amount === "number" &&
        typeof r.category === "string" &&
        TRANSACTION_CATEGORIES.has(r.category) &&
        typeof r.flagged === "boolean" &&
        typeof r.flagReason === "string"
      );
    });
  } catch (error) {
    console.error("extractFinancialTransactions failed:", error);
    return null;
  }
}
