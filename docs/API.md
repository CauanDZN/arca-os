# API HTTP do ArcaOS

**Leia isto primeiro:** o ArcaOS é uma aplicação Next.js (App Router) com Server Actions —
**não é NestJS, não é uma API REST tradicional**. A esmagadora maioria das mutações do sistema
(criar diagnóstico, aprovar plano, mover card no Kanban, criar contrato...) não passa por uma rota
HTTP própria: é uma função `"use server"` chamada diretamente pelo `<form action={...}>` do React,
serializada pelo protocolo interno do Next.js. Não existe endpoint pra documentar em Swagger nesse
caso — quem quiser saber "que mutações existem" deve ler [`SERVER_ACTIONS.md`](./SERVER_ACTIONS.md),
não este arquivo.

Este arquivo documenta as **6 rotas HTTP reais** do projeto — as únicas que existem porque
precisam ser chamadas de fora do React (download de binário, cron externo, webhook de terceiro) ou
retornar algo que uma Server Action não retorna (um arquivo, não um redirect).

## Autenticação

Todas as rotas `GET` abaixo (exceto o cron) leem a sessão do cookie `arca_session` via
`getSession()` (`lib/auth.ts`) — mesma sessão mockada usada no resto do app. Um `cliente` só
acessa recursos da própria empresa; `admin`/`consultor` acessam qualquer um. Sem sessão válida ou
fora do escopo, a rota responde **404** (não 401/403) — mesmo padrão de `assertCompanyAccess`
(`lib/access.ts`): não revela que o recurso existe pra quem não tem acesso.

---

## `GET /api/documentos/[id]`

Baixa um documento do Data Room.

- **Auth:** sessão obrigatória; `cliente` só baixa documento da própria empresa.
- **Params:** `id` — id do `Document`.
- **Resposta 200:** binário do arquivo, com `Content-Type` do `mimeType` salvo e
  `Content-Disposition: attachment`. O arquivo é buscado do Vercel Blob (`doc.storedUrl`) e
  **proxiado** por esta rota — nunca um link direto pro blob — pra rodar a checagem de sessão em
  todo download.
- **Resposta 404:** `{ "error": "Documento não encontrado" }` — documento inexistente ou fora do
  escopo do `cliente`.

## `GET /api/diagnostico/[id]/pdf`

Gera e baixa o PDF do relatório executivo de um diagnóstico.

- **Auth:** sessão obrigatória; `cliente` só do próprio diagnóstico.
- **Params:** `id` — id do `Diagnostic`.
- **Resposta 200:** `application/pdf`, gerado em memória por `lib/pdf.tsx`
  (`@react-pdf/renderer`) — sem Chromium headless. Inclui a narrativa de IA se
  `Diagnostic.aiNarrative` já tiver sido gerada.
- **Resposta 404:** diagnóstico inexistente ou fora do escopo.

## `GET /api/diagnostico/[id]/export`

Exporta as notas por área do diagnóstico em CSV.

- **Auth:** igual à rota de PDF.
- **Params:** `id` — id do `Diagnostic`.
- **Resposta 200:** `text/csv`, gerado por `lib/csv.ts` (`reportAreasToCsv`).

## `GET /api/empresas/[id]/kpis/export`

Exporta o histórico completo de indicadores do Cockpit de Performance de uma empresa.

- **Auth:** sessão obrigatória; `cliente` só da própria empresa.
- **Params:** `id` — id da `Company`.
- **Resposta 200:** `text/csv` com todos os `KpiEntry` (área, indicador, mês, valor, meta),
  ordenados por área → indicador → mês. Pensado pra alimentar um BI externo.

## `GET /api/cron/mensal`

Gera/atualiza o Relatório Mensal (scorecard do Comitê de Gestão) de toda empresa com diagnóstico
respondido. Agendado no Vercel via `cron.json` pro dia 1 de cada mês, 9h UTC.

- **Auth:** **não usa sessão de usuário** — exige o header `Authorization: Bearer $CRON_SECRET`.
  Sem `CRON_SECRET` configurado no ambiente, a rota sempre responde 401 (fail-closed, não
  fail-open). Pra rodar manualmente: `curl -H "Authorization: Bearer $CRON_SECRET" https://.../api/cron/mensal`.
- **Resposta 200:** `{ "ok": true, "period": "AAAA-MM", "generated": <n> }`.
- **Resposta 401:** `{ "error": "Não autorizado" }`.

## `POST /api/webhooks/[companyId]`

**A única rota de escrita de fora do app.** Recebe eventos de sistemas externos (ERP/CRM/automação
do cliente) e só arquiva o payload bruto (`WebhookEvent`) — não interpreta nem reage a ele.

- **Auth:** **não autenticado por sessão, de propósito** — quem chama é um sistema externo, não um
  navegador logado. A proteção é um token longo e aleatório por empresa
  (`Company.webhookToken`, gerado sob demanda em `/empresas/[id]/documentos`), mandado via
  `?token=...` na URL **ou** header `x-webhook-token`. Empresa sem webhook habilitado
  (`webhookToken` null) sempre responde 404.
- **Params:** `companyId` — id da `Company`. Query opcional `?source=...` (rotulagem livre;
  se ausente, usa o header `User-Agent`).
- **Body:** texto livre — aceita qualquer coisa, JSON ou não; truncado em 20.000 caracteres antes
  de salvar.
- **Resposta 200:** `{ "ok": true }`.
- **Resposta 404:** `{ "error": "Webhook não encontrado ou token inválido" }`.

---

## Eventos de saída (ArcaOS → sistema do cliente)

Além de **receber** webhooks, o ArcaOS **dispara** POSTs pro sistema do cliente quando
`Company.outboundWebhookUrl` está configurado (`/empresas/[id]/documentos` → aba de Integrações →
Webhooks). Implementado em `lib/outbound-webhook.ts` (`fireOutboundWebhook`) — fire-and-forget,
timeout de 5s, nunca lança erro (uma falha no endpoint do cliente não pode quebrar a Server Action
que disparou o evento).

Formato do body: `{ "event": "...", "companyId": "...", "timestamp": "ISO-8601", "data": {...} }`.

| Evento | Disparado quando | De onde |
|---|---|---|
| `diagnostic.completed` | Diagnóstico é concluído (último bloco do questionário salvo) | `app/actions.ts` |
| `plan.approved` | Plano de ação é aprovado (vira épicos/tarefas no Kanban) | `app/actions-project.ts` |
| `task.status_changed` | Uma tarefa muda de coluna no Kanban | `app/actions-project.ts` |
| `webhook.test` | Botão "Disparar evento de teste" em `/empresas/[id]/documentos` | `app/actions-webhooks.ts` |

Não existe retry nem fila — se o endpoint do cliente estiver fora do ar no momento do disparo, o
evento se perde (só fica logado no `console.error` do servidor). Isso é aceitável pro MVP porque
nenhuma lógica interna do ArcaOS depende do evento chegar — é notificação, não sincronização.
