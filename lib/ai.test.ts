import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildReport } from "@/lib/scoring";

const mockGenerateContent = vi.hoisted(() => vi.fn());

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(function () {
    return { models: { generateContent: mockGenerateContent } };
  }),
}));

import { generateAiNarrative } from "@/lib/ai";

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
