import { GoogleGenAI } from "@google/genai";
import type { Report } from "@/lib/scoring";

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
