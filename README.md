# ArcaOS — Diagnóstico 360, Plano de Ação e Execução para PMEs

MVP da plataforma **ArcaOS**, da Arca Consulting: diagnóstico empresarial digital em 12 áreas de
gestão — mapeadas nas **9 verticais** do modelo BTO (Business Transformation Outsourcing) da Arca
— relatório executivo com análise consultiva gerada por IA, **motor de maturidade Nível 1–5**
(Empresa informal → Escalável), plano de ação priorizado e execução acompanhada em Kanban —
seguindo o ciclo **Diagnóstico Estratégico → Plano de Ação → Execução & Implantação →
Monitoramento → Transformação Contínua** do plano estratégico da Arca (ver `/metodologia` no app).

A jornada do cliente: **Cadastro → Questionário (12 áreas, ~140 perguntas) → Relatório Executivo →
Aprovação do Plano de Ação → Execução em Kanban**, com Data Room para documentos, um cockpit de
empresas com histórico comparativo entre diagnósticos e um **Portal do Cliente** (pendências,
histórico de decisões e comunicação com a Arca). A gestão é contínua: um **relatório mensal
automático** (cron) alimenta o **Comitê de Gestão** por empresa.

Cada uma das 9 verticais também é **comercializável isoladamente** (Arca Checkup por vertical): uma
empresa pode contratar só Financeiro, só Marketing etc., cada módulo com diagnóstico, Data Room,
agentes e relatório próprios (`/empresas/[id]/modulo/[verticalKey]`). Uma proposta com várias
verticais de uma vez é montada no **Catálogo Comercial** (`/empresas/[id]/proposta`) e, ao ser
aprovada, ativa os contratos e libera os módulos de uma só vez. Consultores podem ser **escopados a
verticais específicas** (`/usuarios`), restringindo quais empresas e módulos eles enxergam, e
aparecem no **Organograma por Vertical** (`/organograma`) agrupados por senioridade. Cada módulo
mostra também um **Selo de Nível de Serviço** (Diagnóstico → Execução → Performance → Especialista)
— eixo diferente da maturidade 1–5, que mede em que estágio da relação comercial a Arca está com
aquela empresa naquela vertical.

## Stack

| Camada | Tecnologia | Por quê |
|---|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript | Server Actions cobrem toda mutação sem precisar de uma API REST separada |
| Estilo | Tailwind CSS 4 | Utilitário direto no JSX, sem CSS separado |
| Banco | SQLite em arquivo + Prisma 7 (`@prisma/adapter-better-sqlite3`) | Zero infraestrutura externa — roda inteiro em `npm run dev` |
| IA generativa | Google Gemini (`@google/genai`, modelo `gemini-flash-latest`) | Camada gratuita real no Google AI Studio, sem cartão de crédito |
| PDF | `@react-pdf/renderer` | Gera PDF binário de verdade em memória, sem navegador headless |
| Upload de arquivos | Server Actions nativas do Next.js + filesystem local (`uploads/`) | Suficiente para o MVP local, sem bucket externo |
| Testes | Vitest | Unitário (regras de negócio) + integração (Server Actions contra um banco SQLite real, populado com as migrations de produção) |

## Como rodar

Precisa de um Postgres — local via Docker (mais simples) ou um banco gerenciado (Neon,
Vercel Postgres, Supabase etc.).

### Com Docker (recomendado pra dev local)

```bash
docker compose up -d db   # sobe só o Postgres — cria arcaos_dev e arcaos_test automaticamente
npm install
npm run dev
```

`DATABASE_URL` de dev aponta pro Postgres do Docker — veja `.env.local` (não commitado):

```bash
DATABASE_URL="postgresql://arcaos:arcaos@localhost:5432/arcaos_dev"
```

`docker compose up --build` (sem `-d db`) sobe o stack inteiro, incluindo a imagem de
produção do app (`Dockerfile`) — útil pra conferir o build containerizado antes de hospedar
em outro lugar que não a Vercel. Pro dia a dia com hot reload, use `npm run dev` de fora do
Docker com só o `db` de pé.

### Sem Docker

```bash
npm install
npx prisma migrate deploy   # aplica as migrations no Postgres apontado por DATABASE_URL
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Como rodar os testes

```bash
npm test
```

Isso levanta **um banco SQLite temporário próprio** (fora do `dev.db` de desenvolvimento), aplica
todas as migrations reais nele, e roda:

- **Testes unitários** (`lib/*.test.ts`): motor de pontuação e maturidade (`scoring.ts`), integridade
  dos dados do questionário (`areas.ts`), mapeamento das 8 verticais (`verticals.ts`), relatório
  mensal (`monthly-report.ts`), geração de narrativa por IA com fallback gracioso (`ai.ts`, com o
  Gemini mockado — não consome sua chave nem precisa de rede), e geração de PDF (`pdf.tsx`).
- **Teste de integração** (`test/integration.test.ts`): chama as Server Actions de verdade
  (`createDiagnostic`, `saveAreaAnswers`, `approveActionPlan`, `moveTask`, `uploadDocument`,
  `deleteDocument`) contra esse banco real, validando o fluxo completo ponta a ponta — cadastro →
  questionário com todos os campos extras → conclusão do diagnóstico → aprovação do plano →
  Kanban → upload/exclusão de documento no disco.

> `npm test` precisa de um `TEST_DATABASE_URL` em `.env.test.local` (gitignored) — a suíte de
> integração re-cria o schema public do Postgres de teste. Para rodar **só os unitários puros**,
> sem banco nenhum, use o config dedicado:
>
> ```bash
> npx vitest run --config vitest.unit.config.ts lib/
> ```
>
> (15 arquivos, 127 testes, todos passando.)

## Variáveis de ambiente

Crie um `.env.local` (já está no `.gitignore`, nunca é commitado):

```bash
GEMINI_API_KEY="sua-chave-aqui"
CRON_SECRET="um-segredo-aleatorio-aqui"   # protege /api/cron/mensal
```

- **Sem a chave**: o app funciona normalmente. O motor de pontuação e o plano de ação (baseados em
  regras) continuam gerando o relatório completo; só o texto consultivo em linguagem natural
  (sumário executivo, causa raiz, recomendação) não aparece — fallback gracioso, sem erro. Isso é
  testado automaticamente (`lib/ai.test.ts` e o teste de conclusão do diagnóstico em
  `test/integration.test.ts`).
- **Como gerar uma chave gratuita**: [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
  (Google AI Studio tem camada gratuita, sem cartão de crédito).
- `CRON_SECRET` protege a rota `/api/cron/mensal` (relatório mensal automático): a requisição deve
  mandar `Authorization: Bearer $CRON_SECRET`. Na Vercel, defina a variável e aponte o agendador do
  Vercel para `/api/cron/mensal` com `cron` de dia 1 de cada mês (ver `cron.json`).
- `DATABASE_URL` já vem definida em `.env` como `file:./dev.db` — não precisa alterar para uso local.

## Estrutura de pastas

```
proxy.ts                                  RBAC de rota (login obrigatório, escopo do papel "cliente")

app/
  page.tsx                                Landing page
  layout.tsx                              Layout raiz + NavBar global (busca a sessão)
  login/page.tsx                          Tela de login mockado
  dashboard/                              Dashboard de análise (carteira ou escopo do cliente)
  usuarios/page.tsx                       CRUD de usuários no banco (admin only)
  actions-auth.ts                         Server actions: login, logout
  components/NavBar.tsx                   Navegação (varia por papel) + usuário logado/logout

  portal/                                 Portal do Cliente — lista as empresas do usuário (redireciona)
  portal/[companyId]/                     Portal do Cliente: pendências, decisões, comunicação,
                                          comitê de gestão (relatórios mensais)
  actions-portal.ts                       Server actions: addDecision, sendMessage, generateMonthlyReport
  api/cron/mensal/route.ts                Cron do relatório mensal automático (protegido por CRON_SECRET)

  diagnostico/novo/                       Etapa 1 — cadastro da empresa
  diagnostico/[id]/questionario/[areaKey]/  Etapa 2 — wizard de 12 passos, com evidência/
                                           responsável/impacto/urgência/risco por pergunta
  diagnostico/[id]/relatorio/              Etapa 3 — relatório executivo + narrativa de IA +
                                           aprovação do plano + export PDF/impressão
  diagnostico/[id]/projeto/                Kanban do plano de ação aprovado

  empresas/                               Lista de empresas cadastradas (filtrada pelo escopo do
                                           consultor, se ele tiver verticais atribuídas)
  empresas/[id]/                          Cockpit: histórico de diagnósticos, evolução da
                                           maturidade, contratos, verticais contratadas
  empresas/[id]/documentos/                Data Room (upload/download por categoria/área)
  empresas/[id]/modulo/[verticalKey]/     Arca Checkup por vertical — diagnóstico, Data Room,
                                           agentes e relatório próprios do módulo comercializado
                                           isoladamente
  empresas/[id]/proposta/                 Catálogo Comercial: monta proposta com várias verticais
                                           de uma vez (contratos "pendentes"), aprovar ativa tudo e
                                           libera os módulos

  agentes/                                Central de Agentes de IA (status ativo vs planejado)
  integracoes/                            Tela de integrações externas (mockup, nada conectado)
  parceiros/                              Vertical Parceira: parceiros homologados, indicações e
                                           os 6 KPIs do plano estratégico
  metodologia/                            Metodologia Arca BTO v1.0 — 5 princípios + ciclo de 5
                                           etapas, cada etapa linkando pra onde está implementada
  organograma/                            Consultores agrupados por vertical × senioridade

  api/documentos/[id]/route.ts            Download de documento do Data Room
  api/diagnostico/[id]/pdf/route.ts       Geração do PDF do relatório

  actions.ts                              Server actions: criar diagnóstico, salvar respostas de área
  actions-documents.ts                    Server actions: upload/exclusão de documentos
  actions-project.ts                      Server actions: aprovar plano, mover tarefa no Kanban
  actions-module.ts                       Server actions: diagnóstico e plano de ação por vertical
  actions-contracts.ts                    Server actions: CRUD de Contract e apuração de Performance Fee
  actions-proposal.ts                     Server actions: montar/aprovar/descartar proposta em lote
  actions-partners.ts                     Server actions: parceiros, indicações, SLA, NPS
  actions-users.ts                        CRUD de usuários (admin): createUser, updateUserRole, deleteUser
  actions-empresas.ts                     deleteCompany, updateContractedVerticals — exclui empresa
                                           + blobs + cascade, ou atualiza módulos contratados
  components/BarChart.tsx                 Barras horizontais CSS puras (gráficos do dashboard)
  components/ProposalRows.tsx             Linhas da proposta modular com total somado ao vivo
  components/KpiSuggestions.tsx           Chips de meta sugerida por vertical no Cockpit de Performance

lib/
  areas.ts (+ .test.ts)                   As 12 áreas e ~140 perguntas do diagnóstico
  scoring.ts (+ .test.ts)                 Motor de pontuação, maturidade Nível 1–5, priorização,
                                           plano de ação, relatório
  verticals.ts (+ .test.ts)               Mapeamento das 12 áreas nas 9 verticais da Arca
  monthly-report.ts (+ .test.ts)          Relatório mensal do Comitê de Gestão (função pura)
  dashboard.ts (+ .test.ts)               Agregação de dados pro dashboard (buildDashboardData),
                                           escopada por empresa (cliente) ou vertical (consultor)
  contracts.ts                            Estrutura de receita: totalActiveMrr, computeFeeValue
  partners.ts (+ .test.ts)                Os 6 KPIs da Vertical Parceira (receita indireta, NPS,
                                           satisfação, recompra, SLA)
  kpi-targets.ts (+ .test.ts)             Metas de KPI do plano estratégico por vertical (nível
                                           absoluto pré-preenche, delta relativo é só referência)
  service-tier.ts (+ .test.ts)            Nível de Serviço 1-4 por módulo (Diagnóstico/Execução/
                                           Performance detectados; Especialista nunca é automático)
  seniority.ts                            Os 5 níveis do organograma (Sócio → Assistente)
  ai.ts (+ .test.ts)                      Integração com Gemini para o texto consultivo
  pdf.tsx (+ .test.ts)                    Layout do PDF (@react-pdf/renderer)
  validation.ts                           Schemas zod (empresa, usuário, decisão, mensagem, contrato,
                                           parceiro)
  badge-tones.ts                          Mapeia nível/status pra cor de Badge
  prisma.ts                               Cliente Prisma singleton
  session.ts (+ .test.ts)                 Tipo Session + encode/decode do cookie (puro, Edge-safe)
  auth.ts                                 getSession/setSessionCookie/clearSessionCookie (Node only)
  access.ts (+ .test.ts)                  assertCompanyAccess (papel "cliente" só na própria
                                           empresa) e o escopo de consultor por vertical
                                           (assertVerticalAccess, isCompanyInConsultorScope)

prisma/schema.prisma                      Modelos: Company, User, Diagnostic, Answer, Document, Task,
                                          Decision, Message, MonthlyReport, Contract,
                                          ContractPerformanceRecord, Partner, PartnerReferral
test/integration.test.ts                  Teste de integração ponta a ponta
vitest.config.ts                          Provisiona o banco de teste com as migrations reais
vitest.unit.config.ts                     Roda só os unitários puros (sem banco)
cron.json                                 Agenda do relatório mensal (dia 1 do mês, 9h)
```

## Modelo de dados

```
Company 1—N Diagnostic 1—N Answer   (uma resposta por pergunta, com evidência/responsável/
                          1—N Task    impacto/urgência/risco; Task é criada ao aprovar o plano)
                                     Diagnostic.scope = "completo" (140 perguntas) ou a areaKey de
                                     um módulo/vertical isolada — mesma tabela pros dois casos
Company 1—N Document                (Data Room, categorizado por área)
Company 1—N Decision                (histórico de decisões — manual no portal + extraído de atas)
Company 1—N Message                 (comunicação com a Arca no portal do cliente)
Company 1—N MonthlyReport           (scorecard do comitê de gestão — um por mês, upsert por companyId+period)
Company 1—N Contract 1—N ContractPerformanceRecord
                                     (Setup, MRR, Performance Fee, Projeto Avulso — status "pendente"
                                     até a proposta ser aprovada em /empresas/[id]/proposta)
Company 1—N PartnerReferral N—1 Partner
                                     (vertical Parceira: parceiros homologados e indicações por
                                     empresa; comissão/satisfação/SLA por indicação)
Company 1—N User                    (vínculo do cliente a uma empresa real para o login)
User.assignedVerticals               (JSON array — escopa um consultor a verticais específicas;
                                     vazio = vê a carteira inteira)
Company.contractedVerticals          (JSON array — quais módulos por vertical a empresa contratou;
                                     controla o que aparece em /empresas/[id]/modulo/*)
```

`Diagnostic.aiNarrative` guarda o JSON gerado pela IA (`{ executiveSummary, areaInsights[] }`),
persistido uma única vez na conclusão do diagnóstico — não é regenerado a cada visita ao relatório.

## Funcionalidades implementadas

- [x] Cadastro da empresa + objetivo do diagnóstico
- [x] Questionário em 12 áreas (~140 perguntas), escala de maturidade 0–5
- [x] Evidência, responsável, impacto, urgência e risco por pergunta
- [x] Motor de pontuação: nota por área, nota geral, status (Crítico → Otimizado)
- [x] **Motor de maturidade Nível 1–5**: Empresa informal → Empresa organizada → Empresa gerenciada → Empresa madura → Empresa escalável (badge no relatório, no dashboard e na lista de relatórios)
- [x] **9 verticais da Arca** (modelo BTO): as 12 áreas mapeadas nas verticais do plano (Estratégia,
      Financeiro, Comercial, Marketing, Operações, Pessoas, Tecnologia, Fiscal/Jurídico,
      Gestão da Rotina), com médias por vertical no relatório
- [x] **Comercialização modular**: cada vertical pode ser contratada isoladamente (Arca Checkup por
      vertical) — diagnóstico, Data Room, agentes e relatório próprios, sem depender das demais
- [x] **Catálogo Comercial / proposta em lote** (`/empresas/[id]/proposta`): monta uma proposta com
      várias verticais de uma vez, cada uma com seu tipo de contrato; aprovar ativa todos os
      contratos e libera os módulos correspondentes de uma só vez
- [x] **Estrutura de receita** (`Contract`): Setup Inicial, Mensalidade Fixa (MRR), Performance Fee
      (apuração periódica) e Projeto Avulso
- [x] **Vertical Parceira** (`/parceiros`): parceiros homologados (operacional/estratégica/comercial),
      indicações, 5 modelos de receita de parceria e os 6 KPIs do plano estratégico
- [x] **Segregação de consultor por vertical**: um consultor pode ser escopado a verticais
      específicas (`/usuarios`), restringindo quais empresas e módulos ele enxerga
- [x] **Organograma por Vertical** (`/organograma`): consultores agrupados por vertical atribuída ×
      senioridade (Sócio → Gerente → Coordenador → Analista → Assistente)
- [x] **Selo de Nível de Serviço por módulo**: Diagnóstico/Execução/Performance detectados a partir
      do estado real (diagnóstico concluído, plano aprovado, indicadores em acompanhamento);
      Especialista nunca é atribuído automaticamente — é sob avaliação da Arca
- [x] **Metas de KPI do plano estratégico** sugeridas por vertical no Cockpit de Performance —
      preenche indicador e meta com um clique quando o número do plano é um nível absoluto
- [x] **Metodologia Arca BTO v1.0** (`/metodologia`): os 5 princípios e o ciclo de 5 etapas, cada
      etapa linkando pra onde está implementada no produto
- [x] Relatório executivo: sumário, mapa de maturidade, diagnóstico analítico, matriz de priorização, plano de ação 30/90/365 dias
- [x] Texto consultivo gerado por IA (Gemini) no relatório, com fallback para o motor de regras
- [x] Exportação de PDF real do relatório
- [x] Aprovação do plano de ação → **Arca Planner**: projeto Kanban (A Fazer / Em Andamento / Concluído)
- [x] Data Room: upload e download de documentos por empresa, categorizado por área e por vertical
- [x] Painel de empresas com histórico comparativo de diagnósticos (evolução da maturidade)
- [x] **Arca Dashboard**: nota média, maturidade por área, ranking de empresas e execução da carteira
- [x] **Cockpit de Performance**: indicadores mensais por área, com metas do plano estratégico
      sugeridas por vertical e comparativo realizado x planejado
- [x] **Portal do Cliente** (`/portal`): pendências, histórico de decisões, comunicação com a Arca e comitê de gestão
- [x] **Relatório mensal automático**: cron `cron.json` → `/api/cron/mensal` gera/atualiza o scorecard do mês por empresa
- [x] **App responsivo**: header com mini navegação horizontal em 2 linhas, tabelas com scroll no mobile
- [x] Central de Agentes de IA (roadmap dos agentes do plano estratégico, com status real)
- [x] Tela de Integrações externas (ERP, CRM, bancos, WhatsApp etc.) — apenas UI, nada conectado
      (exceto Omie, que é real — ver `lib/omie.ts`)
- [x] Suíte de testes automatizados (unitário + integração) cobrindo o fluxo completo

## O que é mock e o que é real

| Item | Status |
|---|---|
| Diagnóstico, pontuação, relatório, PDF, Kanban, Data Room | **Real** — funcional de ponta a ponta, com teste de integração cobrindo o fluxo |
| Comercialização modular (Arca Checkup por vertical), proposta em lote, Contract/Partner | **Real** — verificado ponta a ponta em `test/integration.test.ts` |
| Segregação de consultor por vertical (`User.assignedVerticals`) | **Real** — mesma dupla camada de `assertCompanyAccess` (rota + Server Action) |
| Portal do cliente, decisões, comunicação, comitê de gestão | **Real** — roda sobre Server Actions com controle de acesso (cliente só vê a própria empresa) |
| Relatório mensal automático (`/api/cron/mensal`) | **Real**, depende de `CRON_SECRET` e do agendador da plataforma de deploy (ver `cron.json`) |
| Narrativa de IA no relatório | **Real**, condicionada a `GEMINI_API_KEY` configurada |
| Login e controle de acesso por papel (admin/consultor/cliente) | **Mockado, mas com regras reais** — ver seção abaixo |
| Tela de Integrações | **Mockup** — lista as integrações previstas, botão "Conectar" desabilitado |
| Central de Agentes de IA | **Roadmap honesto** — só marca "Ativo" o que de fato está ligado |

## Login mockado

Implementado a pedido — não é autenticação de produção, mas a lógica de controle de acesso (quem
pode ver o quê) é real, não decorativa.

- **Usuários**: persistidos no banco (modelo `User`, seedado pela migration `add_users` com Cauan e
  Cícero, ambos `admin` — os demais usuários do seed inicial foram removidos pela migration
  `remove_seed_users`), cobrindo 3 papéis — `admin`, `consultor` e `cliente` — mapeados pra cargos
  da visão organizacional do plano da Arca (CEO/Head BTO, Consultor Líder, Sponsor do Cliente etc.).
  A tela `/login` lista todos com um botão de "entrar como" pra facilitar teste, e `/usuarios`
  (admin) permite criar, mudar papel, **vincular um cliente a uma empresa real** (`User.companyId`,
  via select de empresas) e remover
  usuários. Cliente sem empresa vinculada não consegue logar.
- **Sessão**: cookie httpOnly com um JSON em base64 — **não é assinado nem criptografado**. Prova
  as regras de roteamento, não protege dado real contra um usuário que edite o próprio cookie.
- **Regras**: `cliente` só acessa a empresa vinculada a ele (empresa, diagnósticos, Data Room, atas,
  indicadores e o Portal do Cliente); `admin` e `consultor` veem tudo; só `admin` acessa `/usuarios`.
  Aplicadas em duas camadas — `proxy.ts` (roteamento, sem acesso ao banco) e `lib/access.ts` (dentro
  de cada página e Server Action, com o dado real do banco).

## Não implementado de propósito

- **Autenticação de produção** — sem hash de senha, sem verificação real de credencial, sem cadastro
  de usuário. Ver "Login mockado" acima.
- **Deploy em produção** — o app roda local com SQLite em arquivo. Para produção, troque o
  datasource do Prisma para Postgres (ex.: Vercel Postgres, Supabase, Neon) e hospede em uma
  plataforma como Vercel — requer conta e credenciais do usuário, por isso não foi executado aqui.
- **Integrações externas reais** (ERP, CRM, bancos, WhatsApp) — só a tela, sem OAuth/API real.

## Limitações conhecidas

- Upload de documentos usa o sistema de arquivos local (`uploads/`) — não é adequado para hospedagem
  serverless (ex. Vercel) sem trocar para um storage externo (S3, Vercel Blob etc.).
- SQLite em arquivo não escala para múltiplos usuários simultâneos em produção.
- Upload de arquivo não tem teste de UI ponta a ponta via browser automatizado (a seleção de
  arquivo depende do diálogo nativo do sistema operacional, que ferramentas de automação headless
  não conseguem acionar) — está cobrto pelo teste de integração, que chama a Server Action
  diretamente com um `File` real.
