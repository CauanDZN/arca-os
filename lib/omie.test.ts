import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchOmieFinancialSummary, testOmieConnection } from "./omie";

const credentials = { appKey: "app-key", appSecret: "app-secret" };

function jsonResponse(body: unknown) {
  return { json: async () => body } as Response;
}

describe("fetchOmieFinancialSummary", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("soma inadimplência (ATRASADO) e endividamento (status em aberto)", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("contareceber")) {
        return jsonResponse({
          total_de_registros: 2,
          conta_receber_cadastro: [
            { valor_documento: 100, status_titulo: "ATRASADO" },
            { valor_documento: 50, status_titulo: "A VENCER" },
          ],
        });
      }
      return jsonResponse({
        total_de_registros: 2,
        conta_pagar_cadastro: [
          { valor_documento: 30, status_titulo: "A VENCER" },
          { valor_documento: 20, status_titulo: "ATRASADO" },
        ],
      });
    });

    const summary = await fetchOmieFinancialSummary(credentials);

    expect(summary.inadimplenciaValue).toBe(100);
    expect(summary.endividamentoValue).toBe(50);
    expect(summary.contasReceberCount).toBe(2);
    expect(summary.contasPagarCount).toBe(2);
  });

  it("pagina até completar total_de_registros", async () => {
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      const pagina = body.param[0].pagina;
      if (url.includes("contareceber")) {
        if (pagina === 1) {
          return jsonResponse({
            total_de_registros: 3,
            conta_receber_cadastro: [
              { valor_documento: 10, status_titulo: "ATRASADO" },
              { valor_documento: 10, status_titulo: "ATRASADO" },
            ],
          });
        }
        return jsonResponse({
          total_de_registros: 3,
          conta_receber_cadastro: [{ valor_documento: 10, status_titulo: "ATRASADO" }],
        });
      }
      return jsonResponse({ total_de_registros: 0, conta_pagar_cadastro: [] });
    });

    const summary = await fetchOmieFinancialSummary(credentials);

    expect(summary.contasReceberCount).toBe(3);
    expect(summary.inadimplenciaValue).toBe(30);
  });

  it("propaga erro da Omie (faultstring) quando as credenciais são inválidas", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ faultstring: "A chave de acesso não está preenchida ou não é válida.", faultcode: "SOAP-ENV:Server" })
    );

    await expect(fetchOmieFinancialSummary(credentials)).rejects.toThrow(
      "A chave de acesso não está preenchida ou não é válida."
    );
  });
});

describe("testOmieConnection", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("não lança quando a chamada é bem-sucedida", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ pagina: 1, categoria_cadastro: [] }));
    await expect(testOmieConnection(credentials)).resolves.toBeUndefined();
  });

  it("lança quando a Omie retorna faultstring", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ faultstring: "inválido", faultcode: "X" }));
    await expect(testOmieConnection(credentials)).rejects.toThrow("inválido");
  });
});
