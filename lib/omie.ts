// Integração com a API da Omie (ERP). Cada empresa cliente tem sua própria
// conta Omie e suas próprias credenciais (ErpConnection, provider "omie") —
// não existe uma conta Omie única da Arca. Formato de chamada é JSON-RPC-like:
// POST para /api/v1/{modulo}/{recurso}/ com { call, app_key, app_secret, param: [{...}] }.
// Confirmado com chamadas reais em ListarClientes, ListarContasReceber,
// ListarContasPagar e ListarCategorias — não documentado por schema público
// utilizável, então os nomes de campo abaixo (valor_documento, status_titulo,
// conta_receber_cadastro/conta_pagar_cadastro) vieram de respostas reais da API.

const OMIE_BASE_URL = "https://app.omie.com.br/api/v1";

export type OmieCredentials = {
  appKey: string;
  appSecret: string;
};

type OmieErrorResponse = {
  faultstring: string;
  faultcode: string;
};

async function omieCall<T>(
  module: string,
  resource: string,
  call: string,
  credentials: OmieCredentials,
  param: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${OMIE_BASE_URL}/${module}/${resource}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      call,
      app_key: credentials.appKey,
      app_secret: credentials.appSecret,
      param: [param],
    }),
  });

  const json = await res.json();
  if (json && typeof json === "object" && "faultstring" in json) {
    throw new Error((json as OmieErrorResponse).faultstring);
  }
  return json as T;
}

// Status abertos (ainda não liquidados) observados na API — usados tanto pra
// contas a receber quanto a pagar. "ATRASADO" é o único que conta como
// inadimplência; os outros dois só entram no total de endividamento em aberto.
const OPEN_STATUSES = new Set(["ATRASADO", "VENCE HOJE", "A VENCER"]);

type ContaReceber = { valor_documento: number; status_titulo: string };
type ContaPagar = { valor_documento: number; status_titulo: string };

type ListarContasReceberResponse = {
  conta_receber_cadastro?: ContaReceber[];
  total_de_registros: number;
};

type ListarContasPagarResponse = {
  conta_pagar_cadastro?: ContaPagar[];
  total_de_registros: number;
};

export type OmieFinancialSummary = {
  inadimplenciaValue: number;
  endividamentoValue: number;
  contasReceberCount: number;
  contasPagarCount: number;
};

async function listAllContasReceber(credentials: OmieCredentials): Promise<ContaReceber[]> {
  const registros: ContaReceber[] = [];
  let pagina = 1;
  for (;;) {
    const page = await omieCall<ListarContasReceberResponse>(
      "financas",
      "contareceber",
      "ListarContasReceber",
      credentials,
      { pagina, registros_por_pagina: 200, apenas_importado_api: "N" }
    );
    registros.push(...(page.conta_receber_cadastro ?? []));
    if (registros.length >= page.total_de_registros || !page.conta_receber_cadastro?.length) break;
    pagina += 1;
  }
  return registros;
}

async function listAllContasPagar(credentials: OmieCredentials): Promise<ContaPagar[]> {
  const registros: ContaPagar[] = [];
  let pagina = 1;
  for (;;) {
    const page = await omieCall<ListarContasPagarResponse>(
      "financas",
      "contapagar",
      "ListarContasPagar",
      credentials,
      { pagina, registros_por_pagina: 200, apenas_importado_api: "N" }
    );
    registros.push(...(page.conta_pagar_cadastro ?? []));
    if (registros.length >= page.total_de_registros || !page.conta_pagar_cadastro?.length) break;
    pagina += 1;
  }
  return registros;
}

// Agrega contas a pagar/receber da Omie nos dois indicadores que o Cockpit de
// Performance (KpiEntry) já usa na área financeira (lib/areas.ts) — reaproveita
// o catálogo existente em vez de inventar indicadores novos.
export async function fetchOmieFinancialSummary(credentials: OmieCredentials): Promise<OmieFinancialSummary> {
  const [contasReceber, contasPagar] = await Promise.all([
    listAllContasReceber(credentials),
    listAllContasPagar(credentials),
  ]);

  const inadimplenciaValue = contasReceber
    .filter((c) => c.status_titulo === "ATRASADO")
    .reduce((sum, c) => sum + c.valor_documento, 0);

  const endividamentoValue = contasPagar
    .filter((c) => OPEN_STATUSES.has(c.status_titulo))
    .reduce((sum, c) => sum + c.valor_documento, 0);

  // Arredonda pra centavos — soma em ponto flutuante de valores monetários
  // gera ruído tipo 34830.270000000004.
  return {
    inadimplenciaValue: Math.round(inadimplenciaValue * 100) / 100,
    endividamentoValue: Math.round(endividamentoValue * 100) / 100,
    contasReceberCount: contasReceber.length,
    contasPagarCount: contasPagar.length,
  };
}

// Chamada leve só pra validar que App Key/Secret são de fato válidos antes de
// salvar — usa o endpoint de categorias porque devolve rápido mesmo em contas
// grandes (não pagina contas a pagar/receber inteiras).
export async function testOmieConnection(credentials: OmieCredentials): Promise<void> {
  await omieCall("geral", "categorias", "ListarCategorias", credentials, { pagina: 1, registros_por_pagina: 1 });
}
