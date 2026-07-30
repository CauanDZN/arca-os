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
