import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildReport } from "@/lib/scoring";

const mockGenerateContent = vi.hoisted(() => vi.fn());

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(function () {
    return { models: { generateContent: mockGenerateContent } };
  }),
}));

import {
  generateAiNarrative,
  generateMaturityEvolution,
  generateSprintReport,
  classifyDocument,
  generateVerticalInsight,
  generateMeetingMinutes,
  generatePerformanceInsight,
  extractKpiSuggestions,
  extractFinancialTransactions,
} from "@/lib/ai";

const company = { name: "Empresa Teste", segment: "Varejo", painPoints: "", objectives: [] };
const report = buildReport([]);

describe("generateAiNarrative", () => {
  const originalKey = process.env.GEMINI_API_KEY;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockGenerateContent.mockReset();
    // generateAiNarrative logs failures via console.error on purpose (useful in production
    // when the AI call breaks silently) — several tests below intentionally trigger that
    // failure path, so silence the expected noise here instead of removing the real log.
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  });

  it("returns null and never calls the API when no key is configured", async () => {
    delete process.env.GEMINI_API_KEY;
    const result = await generateAiNarrative(company, report);
    expect(result).toBeNull();
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it("returns null when the API call rejects", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    mockGenerateContent.mockRejectedValueOnce(new Error("network down"));
    const result = await generateAiNarrative(company, report);
    expect(result).toBeNull();
  });

  it("returns null when the response text is not valid JSON", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    mockGenerateContent.mockResolvedValueOnce({ text: "isso não é json" });
    const result = await generateAiNarrative(company, report);
    expect(result).toBeNull();
  });

  it("returns null when the response text is empty", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    mockGenerateContent.mockResolvedValueOnce({ text: "" });
    const result = await generateAiNarrative(company, report);
    expect(result).toBeNull();
  });

  it("returns null when parsed JSON is missing required fields", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    mockGenerateContent.mockResolvedValueOnce({ text: JSON.stringify({ foo: "bar" }) });
    const result = await generateAiNarrative(company, report);
    expect(result).toBeNull();
  });

  it("parses a valid JSON response", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    const payload = {
      executiveSummary: "Resumo de teste.",
      areaInsights: [
        { areaKey: "financeiro", causaRaiz: "Falta de controle", recomendacao: "Implantar DRE" },
      ],
    };
    mockGenerateContent.mockResolvedValueOnce({ text: JSON.stringify(payload) });
    const result = await generateAiNarrative(company, report);
    expect(result).toEqual(payload);
  });

  it("strips markdown code fences before parsing", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    const payload = { executiveSummary: "Resumo.", areaInsights: [] };
    mockGenerateContent.mockResolvedValueOnce({
      text: "```json\n" + JSON.stringify(payload) + "\n```",
    });
    const result = await generateAiNarrative(company, report);
    expect(result).toEqual(payload);
  });
});

describe("generateMaturityEvolution", () => {
  const originalKey = process.env.GEMINI_API_KEY;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  const previous = { date: new Date("2026-01-01"), report: buildReport([]) };
  const current = { date: new Date("2026-06-01"), report };

  beforeEach(() => {
    mockGenerateContent.mockReset();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  });

  it("returns null and never calls the API when no key is configured", async () => {
    delete process.env.GEMINI_API_KEY;
    const result = await generateMaturityEvolution("Empresa Teste", previous, current);
    expect(result).toBeNull();
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it("returns null when the API call rejects", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    mockGenerateContent.mockRejectedValueOnce(new Error("network down"));
    const result = await generateMaturityEvolution("Empresa Teste", previous, current);
    expect(result).toBeNull();
  });

  it("returns null when the response text is empty", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    mockGenerateContent.mockResolvedValueOnce({ text: "" });
    const result = await generateMaturityEvolution("Empresa Teste", previous, current);
    expect(result).toBeNull();
  });

  it("returns the trimmed paragraph on success", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    mockGenerateContent.mockResolvedValueOnce({ text: "  A empresa evoluiu bem.  " });
    const result = await generateMaturityEvolution("Empresa Teste", previous, current);
    expect(result).toBe("A empresa evoluiu bem.");
  });
});

describe("generateSprintReport", () => {
  const originalKey = process.env.GEMINI_API_KEY;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  const events = [
    {
      taskTitle: "Implantar DRE mensal",
      areaName: "Financeiro e Controladoria",
      fromStatus: "todo",
      toStatus: "doing",
      createdAt: new Date("2026-07-15"),
    },
  ];

  beforeEach(() => {
    mockGenerateContent.mockReset();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  });

  it("returns null and never calls the API when no key is configured", async () => {
    delete process.env.GEMINI_API_KEY;
    const result = await generateSprintReport("Empresa Teste", events, 30);
    expect(result).toBeNull();
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it("returns null without calling the API when there are no events in the period", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    const result = await generateSprintReport("Empresa Teste", [], 30);
    expect(result).toBeNull();
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it("returns null when the API call rejects", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    mockGenerateContent.mockRejectedValueOnce(new Error("network down"));
    const result = await generateSprintReport("Empresa Teste", events, 30);
    expect(result).toBeNull();
  });

  it("returns the trimmed paragraph on success", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    mockGenerateContent.mockResolvedValueOnce({ text: "  Boa evolução no período.  " });
    const result = await generateSprintReport("Empresa Teste", events, 30);
    expect(result).toBe("Boa evolução no período.");
  });
});

describe("classifyDocument", () => {
  const originalKey = process.env.GEMINI_API_KEY;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockGenerateContent.mockReset();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  });

  it("returns null and never calls the API when no key is configured", async () => {
    delete process.env.GEMINI_API_KEY;
    const result = await classifyDocument("extrato.pdf", "application/pdf", "texto extraído");
    expect(result).toBeNull();
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it("returns null when the API call rejects", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    mockGenerateContent.mockRejectedValueOnce(new Error("network down"));
    const result = await classifyDocument("extrato.pdf", "application/pdf", "texto extraído");
    expect(result).toBeNull();
  });

  it("returns null when the response is missing a valid confidence value", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({ category: "DRE", confidence: "talvez" }),
    });
    const result = await classifyDocument("extrato.pdf", "application/pdf", "texto extraído");
    expect(result).toBeNull();
  });

  it("parses a valid JSON response", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    const payload = { category: "Extrato bancário", confidence: "alta" };
    mockGenerateContent.mockResolvedValueOnce({ text: JSON.stringify(payload) });
    const result = await classifyDocument("extrato.pdf", "application/pdf", "texto extraído");
    expect(result).toEqual(payload);
  });

  it("still classifies (with low confidence expected from the prompt) when there is no extracted text and no file bytes", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    const payload = { category: "Outro", confidence: "baixa" };
    mockGenerateContent.mockResolvedValueOnce({ text: JSON.stringify(payload) });
    const result = await classifyDocument("foto.jpg", "image/jpeg", null);
    expect(result).toEqual(payload);
    const call = mockGenerateContent.mock.calls[0][0];
    expect(typeof call.contents).toBe("string");
  });

  it("sends the image bytes as inlineData (OCR) when there is no extracted text but the file bytes are available", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    const payload = { category: "Nota fiscal", confidence: "alta" };
    mockGenerateContent.mockResolvedValueOnce({ text: JSON.stringify(payload) });
    const fileBytes = Buffer.from("fake-image-bytes");
    const result = await classifyDocument("foto-nf.jpg", "image/jpeg", null, fileBytes);
    expect(result).toEqual(payload);
    const call = mockGenerateContent.mock.calls[0][0];
    expect(Array.isArray(call.contents)).toBe(true);
    expect(call.contents[1]).toEqual({
      inlineData: { mimeType: "image/jpeg", data: fileBytes.toString("base64") },
    });
  });

  it("does not use inlineData for a mime type Gemini can't read directly (e.g. spreadsheet)", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({ category: "Planilha de indicadores", confidence: "baixa" }),
    });
    const fileBytes = Buffer.from("fake-spreadsheet-bytes");
    await classifyDocument(
      "planilha.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      null,
      fileBytes
    );
    const call = mockGenerateContent.mock.calls[0][0];
    expect(typeof call.contents).toBe("string");
  });
});

describe("generateVerticalInsight", () => {
  const originalKey = process.env.GEMINI_API_KEY;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  const answers = [
    {
      questionText: "A empresa possui DRE mensal gerencial?",
      score: 2,
      evidence: "planilha manual desatualizada",
      responsible: "Ana",
      impact: "Alto",
      urgency: "Alta",
      risk: "Financeiro",
    },
  ];

  beforeEach(() => {
    mockGenerateContent.mockReset();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  });

  it("returns null and never calls the API when no key is configured", async () => {
    delete process.env.GEMINI_API_KEY;
    const result = await generateVerticalInsight("Empresa Teste", "Financeiro e Controladoria", 2, "Frágil", answers, []);
    expect(result).toBeNull();
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it("returns null when the API call rejects", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    mockGenerateContent.mockRejectedValueOnce(new Error("network down"));
    const result = await generateVerticalInsight("Empresa Teste", "Financeiro e Controladoria", 2, "Frágil", answers, []);
    expect(result).toBeNull();
  });

  it("returns null when the response is missing recommendations", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    mockGenerateContent.mockResolvedValueOnce({ text: JSON.stringify({ analysis: "..." }) });
    const result = await generateVerticalInsight("Empresa Teste", "Financeiro e Controladoria", 2, "Frágil", answers, []);
    expect(result).toBeNull();
  });

  it("parses a valid JSON response, with or without Data Room documents", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    const payload = { analysis: "Análise aprofundada.", recommendations: ["Implantar DRE mensal"] };
    mockGenerateContent.mockResolvedValueOnce({ text: JSON.stringify(payload) });
    const result = await generateVerticalInsight(
      "Empresa Teste",
      "Financeiro e Controladoria",
      2,
      "Frágil",
      answers,
      [{ name: "extrato.pdf", text: "saldo em conta: R$ 10.000" }]
    );
    expect(result).toEqual(payload);
  });
});

describe("generateMeetingMinutes", () => {
  const originalKey = process.env.GEMINI_API_KEY;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockGenerateContent.mockReset();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  });

  it("returns null and never calls the API when no key is configured", async () => {
    delete process.env.GEMINI_API_KEY;
    const result = await generateMeetingMinutes("Empresa Teste", "Discutimos o atraso na contratação.");
    expect(result).toBeNull();
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it("returns null when the API call rejects", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    mockGenerateContent.mockRejectedValueOnce(new Error("network down"));
    const result = await generateMeetingMinutes("Empresa Teste", "Discutimos o atraso na contratação.");
    expect(result).toBeNull();
  });

  it("returns null when the response is missing the pending list", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({ summary: "...", decisions: [] }),
    });
    const result = await generateMeetingMinutes("Empresa Teste", "Discutimos o atraso na contratação.");
    expect(result).toBeNull();
  });

  it("parses a valid JSON response", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    const payload = {
      summary: "Reunião sobre contratação do gerente comercial.",
      decisions: ["Adiar lançamento da nova linha para setembro"],
      pending: ["Ana fecha a vaga de gerente comercial até sexta"],
    };
    mockGenerateContent.mockResolvedValueOnce({ text: JSON.stringify(payload) });
    const result = await generateMeetingMinutes("Empresa Teste", "Discutimos o atraso na contratação.");
    expect(result).toEqual(payload);
  });
});

describe("generatePerformanceInsight", () => {
  const originalKey = process.env.GEMINI_API_KEY;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  const entries = [
    { areaName: "Financeiro e Controladoria", indicatorName: "Receita mensal", month: "2026-06", value: 100000 },
    { areaName: "Financeiro e Controladoria", indicatorName: "Receita mensal", month: "2026-07", value: 80000 },
  ];

  beforeEach(() => {
    mockGenerateContent.mockReset();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  });

  it("returns null and never calls the API when no key is configured", async () => {
    delete process.env.GEMINI_API_KEY;
    const result = await generatePerformanceInsight("Empresa Teste", entries);
    expect(result).toBeNull();
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it("returns null without calling the API when there are no KPI entries", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    const result = await generatePerformanceInsight("Empresa Teste", []);
    expect(result).toBeNull();
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it("returns null when the API call rejects", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    mockGenerateContent.mockRejectedValueOnce(new Error("network down"));
    const result = await generatePerformanceInsight("Empresa Teste", entries);
    expect(result).toBeNull();
  });

  it("returns the trimmed paragraph on success", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    mockGenerateContent.mockResolvedValueOnce({ text: "  Receita em queda no último mês.  " });
    const result = await generatePerformanceInsight("Empresa Teste", entries);
    expect(result).toBe("Receita em queda no último mês.");
  });
});

describe("extractKpiSuggestions", () => {
  const originalKey = process.env.GEMINI_API_KEY;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  const allowedIndicators = ["Receita mensal", "Margem bruta"];

  beforeEach(() => {
    mockGenerateContent.mockReset();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  });

  it("returns null and never calls the API when no key is configured", async () => {
    delete process.env.GEMINI_API_KEY;
    const result = await extractKpiSuggestions("Financeiro e Controladoria", allowedIndicators, "Receita de julho: R$ 310.000");
    expect(result).toBeNull();
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it("returns null without calling the API when the document text is empty", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    const result = await extractKpiSuggestions("Financeiro e Controladoria", allowedIndicators, "   ");
    expect(result).toBeNull();
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it("returns null when the API call rejects", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    mockGenerateContent.mockRejectedValueOnce(new Error("network down"));
    const result = await extractKpiSuggestions("Financeiro e Controladoria", allowedIndicators, "texto qualquer");
    expect(result).toBeNull();
  });

  it("parses a valid JSON response", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    const payload = { suggestions: [{ indicatorName: "Receita mensal", month: "2026-07", value: 310000 }] };
    mockGenerateContent.mockResolvedValueOnce({ text: JSON.stringify(payload) });
    const result = await extractKpiSuggestions("Financeiro e Controladoria", allowedIndicators, "Receita de julho: R$ 310.000");
    expect(result).toEqual(payload.suggestions);
  });

  it("filters out a suggestion whose indicator isn't in the allowed list", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    const payload = {
      suggestions: [
        { indicatorName: "Receita mensal", month: "2026-07", value: 310000 },
        { indicatorName: "Indicador Inventado", month: "2026-07", value: 999 },
      ],
    };
    mockGenerateContent.mockResolvedValueOnce({ text: JSON.stringify(payload) });
    const result = await extractKpiSuggestions("Financeiro e Controladoria", allowedIndicators, "texto");
    expect(result).toEqual([{ indicatorName: "Receita mensal", month: "2026-07", value: 310000 }]);
  });

  it("filters out a suggestion with a malformed month", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    const payload = { suggestions: [{ indicatorName: "Receita mensal", month: "julho de 2026", value: 310000 }] };
    mockGenerateContent.mockResolvedValueOnce({ text: JSON.stringify(payload) });
    const result = await extractKpiSuggestions("Financeiro e Controladoria", allowedIndicators, "texto");
    expect(result).toEqual([]);
  });

  it("returns an empty array (not null) when the model finds nothing", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    mockGenerateContent.mockResolvedValueOnce({ text: JSON.stringify({ suggestions: [] }) });
    const result = await extractKpiSuggestions("Financeiro e Controladoria", allowedIndicators, "texto sem número nenhum");
    expect(result).toEqual([]);
  });
});

describe("extractFinancialTransactions", () => {
  const originalKey = process.env.GEMINI_API_KEY;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  const validPayload = {
    transactions: [
      {
        date: "2026-06-10",
        description: "PIX RECEBIDO - CLIENTE X",
        amount: 5000,
        category: "outro",
        flagged: false,
        flagReason: "",
      },
      {
        date: "2026-06-12",
        description: "SUPERMERCADO ABC",
        amount: -450.3,
        category: "despesa_pessoal",
        flagged: true,
        flagReason: "Gasto de supermercado misturado na conta da empresa.",
      },
    ],
  };

  beforeEach(() => {
    mockGenerateContent.mockReset();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  });

  it("returns null and never calls the API when no key is configured", async () => {
    delete process.env.GEMINI_API_KEY;
    const result = await extractFinancialTransactions("texto do extrato", null, "application/pdf");
    expect(result).toBeNull();
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it("returns null without calling the API when there is no text and no usable file bytes", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    const result = await extractFinancialTransactions(null, null, "application/pdf");
    expect(result).toBeNull();
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it("returns null without calling the API when there is no text and the mime type isn't OCR-capable", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    const result = await extractFinancialTransactions(
      null,
      Buffer.from("bytes"),
      "application/vnd.ms-excel"
    );
    expect(result).toBeNull();
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it("uses inlineData (OCR) when there is no text but the file bytes are OCR-capable", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    mockGenerateContent.mockResolvedValueOnce({ text: JSON.stringify(validPayload) });
    const fileBytes = Buffer.from("fake-image-bytes");
    const result = await extractFinancialTransactions(null, fileBytes, "image/jpeg");
    expect(result).toHaveLength(2);
    const call = mockGenerateContent.mock.calls[0][0];
    expect(Array.isArray(call.contents)).toBe(true);
    expect(call.contents[1]).toEqual({
      inlineData: { mimeType: "image/jpeg", data: fileBytes.toString("base64") },
    });
  });

  it("returns null when the API call rejects", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    mockGenerateContent.mockRejectedValueOnce(new Error("network down"));
    const result = await extractFinancialTransactions("texto do extrato", null, "application/pdf");
    expect(result).toBeNull();
  });

  it("parses valid transactions from a text-based extract", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    mockGenerateContent.mockResolvedValueOnce({ text: JSON.stringify(validPayload) });
    const result = await extractFinancialTransactions("texto do extrato", null, "application/pdf");
    expect(result).toEqual(validPayload.transactions);
  });

  it("filters out a transaction with an invalid date", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        transactions: [
          { date: "10/06/2026", description: "x", amount: 10, category: "outro", flagged: false, flagReason: "" },
        ],
      }),
    });
    const result = await extractFinancialTransactions("texto", null, "application/pdf");
    expect(result).toEqual([]);
  });

  it("filters out a transaction with an unknown category", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        transactions: [
          { date: "2026-06-10", description: "x", amount: 10, category: "salario", flagged: false, flagReason: "" },
        ],
      }),
    });
    const result = await extractFinancialTransactions("texto", null, "application/pdf");
    expect(result).toEqual([]);
  });

  it("returns an empty list when the document isn't a recognizable bank statement", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    mockGenerateContent.mockResolvedValueOnce({ text: JSON.stringify({ transactions: [] }) });
    const result = await extractFinancialTransactions("um contrato qualquer", null, "application/pdf");
    expect(result).toEqual([]);
  });
});
