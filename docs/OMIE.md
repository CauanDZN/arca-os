# Integração com a Omie

Mapa exato do que o ArcaOS consome da API da Omie hoje. Cada empresa cliente tem sua **própria**
conta Omie e suas próprias credenciais — não existe uma conta Omie única da Arca fazendo chamadas
por todo mundo. Implementação em [`lib/omie.ts`](../lib/omie.ts), disparada por
[`app/actions-omie.ts`](../app/actions-omie.ts).

## Como a chamada funciona

A API da Omie não é REST — é JSON-RPC-like. Toda chamada é um `POST` pro mesmo formato de URL,
mudando só `{modulo}/{recurso}`, com o nome do método dentro do corpo (`call`):

```
POST https://app.omie.com.br/api/v1/{modulo}/{recurso}/
Content-Type: application/json

{
  "call": "NomeDoMetodo",
  "app_key": "...",
  "app_secret": "...",
  "param": [{ ...parâmetros específicos do método... }]
}
```

Erro vem como `200 OK` com `{ "faultstring": "...", "faultcode": "..." }` no corpo — não como
status HTTP de erro. `omieCall()` (função interna de `lib/omie.ts`) detecta esse formato e lança
uma `Error` com a `faultstring`.

**Não existe schema público confiável pra essas respostas** — os nomes de campo usados no código
(`valor_documento`, `status_titulo`, `conta_receber_cadastro`/`conta_pagar_cadastro`,
`total_de_registros`) vieram de respostas reais da API, não da documentação da Omie. Se a Omie
mudar o formato de resposta sem aviso, isso quebra silenciosamente (os campos ficam `undefined`) —
não há validação de schema na resposta.

## Endpoints realmente chamados

| Módulo/Recurso | `call` | Usado em | Pra quê |
|---|---|---|---|
| `geral/categorias` | `ListarCategorias` | `testOmieConnection()` | Valida App Key/Secret antes de salvar (pede 1 registro só — resposta rápida mesmo em conta grande, ao contrário de paginar contas a pagar/receber inteiras) |
| `financas/contareceber` | `ListarContasReceber` | `fetchOmieFinancialSummary()` | Soma o valor de títulos com `status_titulo = "ATRASADO"` → indicador **Inadimplência** |
| `financas/contapagar` | `ListarContasPagar` | `fetchOmieFinancialSummary()` | Soma o valor de títulos com status em aberto (`ATRASADO`, `VENCE HOJE`, `A VENCER`) → indicador **Endividamento** |

`ListarContasReceber` e `ListarContasPagar` são **paginados** (`registros_por_pagina: 200`) — o
código pede página por página até `registros.length >= total_de_registros`.

`ListarClientes` foi testado manualmente durante o desenvolvimento (é onde vieram alguns dos nomes
de campo confirmados) mas **não é chamado por nenhuma função hoje** — não há feature que consuma
dado de clientes da Omie no momento.

## Onde isso entra no produto

1. **Conectar** (`saveOmieCredentials`, botão "Conectar" em `/empresas/[id]`): valida a credencial
   chamando `ListarCategorias` antes de salvar em `ErpConnection` (`provider: "omie"`) — evita
   guardar uma credencial que nunca vai funcionar.
2. **Sincronizar** (`syncOmieFinancials`, botão "Sincronizar agora" em `/empresas/[id]/indicadores`):
   busca `ListarContasReceber` + `ListarContasPagar`, calcula os dois totais, e grava como
   `KpiEntry` do mês corrente na área `financeiro` — **reaproveita os indicadores "Inadimplência" e
   "Endividamento" que já existem no Cockpit de Performance** (`lib/areas.ts`) em vez de criar uma
   tabela paralela só pra dado de ERP. Não há sincronização automática/agendada — é sempre sob
   demanda, um clique por vez.
3. **Desconectar** (`disconnectOmie`): apaga o `ErpConnection`, nada é revertido no histórico de
   `KpiEntry` já sincronizado.

## Extensão pra outros ERPs (TOTVS, Voalle)

`ErpConnection` já é genérico (`provider` livre, hoje só `"omie"` existe) — plugar um novo ERP não
exige migration nova, só um `lib/<provider>.ts` no mesmo molde de `lib/omie.ts` e as Server Actions
correspondentes. **Isso ainda não foi feito** porque não há credencial de teste de TOTVS/Voalle
disponível — é trabalho parado por falta de acesso, não recusado.
