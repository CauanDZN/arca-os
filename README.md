# ArcaOS — Diagnóstico 360, Plano de Ação e Execução para PMEs

MVP da plataforma **ArcaOS**, da Arca Consulting: diagnóstico empresarial digital em 12 áreas de
gestão, relatório executivo com análise consultiva gerada por IA, plano de ação priorizado e
execução acompanhada em Kanban — seguindo o ciclo **Diagnosticar → Priorizar → Executar → Medir**
do plano estratégico da Arca.

A jornada do cliente: **Cadastro → Questionário (12 áreas, ~140 perguntas) → Relatório Executivo →
Aprovação do Plano de Ação → Execução em Kanban**, com Data Room para documentos e um cockpit de
empresas com histórico comparativo entre diagnósticos.

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

```bash
npm install
npx prisma migrate dev   # cria/atualiza o banco SQLite local (dev.db)
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Como rodar os testes

```bash
npm test
```

Isso levanta **um banco SQLite temporário próprio** (fora do `dev.db` de desenvolvimento), aplica
todas as migrations reais nele, e roda:

- **Testes unitários** (`lib/*.test.ts`): motor de pontuação (`scoring.ts`), integridade dos dados
  do questionário (`areas.ts`), geração de narrativa por IA com fallback gracioso (`ai.ts`, com o
  Gemini mockado — não consome sua chave nem precisa de rede), e geração de PDF (`pdf.tsx`).
- **Teste de integração** (`test/integration.test.ts`): chama as Server Actions de verdade
  (`createDiagnostic`, `saveAreaAnswers`, `approveActionPlan`, `moveTask`, `uploadDocument`,
  `deleteDocument`) contra esse banco real, validando o fluxo completo ponta a ponta — cadastro →
  questionário com todos os campos extras → conclusão do diagnóstico → aprovação do plano →
  Kanban → upload/exclusão de documento no disco.

35 testes, 5 arquivos, todos passando. Ver `CLAUDE.md` para detalhes de como o banco de teste é
provisionado e armadilhas conhecidas caso algo quebre.

## Variáveis de ambiente

Crie um `.env.local` (já está no `.gitignore`, nunca é commitado):

```bash
GEMINI_API_KEY="sua-chave-aqui"
```

- **Sem a chave**: o app funciona normalmente. O motor de pontuação e o plano de ação (baseados em
  regras) continuam gerando o relatório completo; só o texto consultivo em linguagem natural
  (sumário executivo, causa raiz, recomendação) não aparece — fallback gracioso, sem erro. Isso é
  testado automaticamente (`lib/ai.test.ts` e o teste de conclusão do diagnóstico em
  `test/integration.test.ts`).
- **Como gerar uma chave gratuita**: [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
  (Google AI Studio tem camada gratuita, sem cartão de crédito).
- `DATABASE_URL` já vem definida em `.env` como `file:./dev.db` — não precisa alterar para uso local.

## Estrutura de pastas

```
proxy.ts                                  RBAC de rota (login obrigatório, escopo do papel "cliente")

app/
  page.tsx                                Landing page
  layout.tsx                              Layout raiz + NavBar global (busca a sessão)
  login/page.tsx                          Tela de login mockado
  usuarios/page.tsx                       Lista de usuários mockados (admin only)
  actions-auth.ts                         Server actions: login, logout
  components/NavBar.tsx                   Navegação (varia por papel) + usuário logado/logout

  diagnostico/novo/                       Etapa 1 — cadastro da empresa
  diagnostico/[id]/questionario/[areaKey]/  Etapa 2 — wizard de 12 passos, com evidência/
                                           responsável/impacto/urgência/risco por pergunta
  diagnostico/[id]/relatorio/              Etapa 3 — relatório executivo + narrativa de IA +
                                           aprovação do plano + export PDF/impressão
  diagnostico/[id]/projeto/                Kanban do plano de ação aprovado

  empresas/                               Lista de empresas cadastradas
  empresas/[id]/                          Cockpit: histórico de diagnósticos e evolução da
                                           maturidade entre eles
  empresas/[id]/documentos/                Data Room (upload/download por categoria/área)

  agentes/                                Central de Agentes de IA (status ativo vs planejado)
  integracoes/                            Tela de integrações externas (mockup, nada conectado)

  api/documentos/[id]/route.ts            Download de documento do Data Room
  api/diagnostico/[id]/pdf/route.ts       Geração do PDF do relatório

  actions.ts                              Server actions: criar diagnóstico, salvar respostas de área
  actions-documents.ts                    Server actions: upload/exclusão de documentos
  actions-project.ts                      Server actions: aprovar plano, mover tarefa no Kanban

lib/
  areas.ts (+ .test.ts)                   As 12 áreas e ~140 perguntas do diagnóstico
  scoring.ts (+ .test.ts)                 Motor de pontuação, maturidade, priorização, plano de ação
  ai.ts (+ .test.ts)                      Integração com Gemini para o texto consultivo
  pdf.tsx (+ .test.ts)                    Layout do PDF (@react-pdf/renderer)
  prisma.ts                               Cliente Prisma singleton
  session.ts (+ .test.ts)                 Tipo Session + encode/decode do cookie (puro, Edge-safe)
  auth.ts                                 getSession/setSessionCookie/clearSessionCookie (Node only)
  auth-users.ts                           Lista estática de usuários mockados
  access.ts                               assertCompanyAccess — trava o papel "cliente" na própria empresa

prisma/schema.prisma                      Modelos: Company, Diagnostic, Answer, Document, Task
test/integration.test.ts                  Teste de integração ponta a ponta
vitest.config.ts                          Provisiona o banco SQLite de teste com as migrations reais
```

## Modelo de dados

```
Company 1—N Diagnostic 1—N Answer   (uma resposta por pergunta, com evidência/responsável/
                          1—N Task    impacto/urgência/risco; Task é criada ao aprovar o plano)
Company 1—N Document                (Data Room, categorizado por área)
```

`Diagnostic.aiNarrative` guarda o JSON gerado pela IA (`{ executiveSummary, areaInsights[] }`),
persistido uma única vez na conclusão do diagnóstico — não é regenerado a cada visita ao relatório.

## Funcionalidades implementadas

- [x] Cadastro da empresa + objetivo do diagnóstico
- [x] Questionário em 12 áreas (~140 perguntas), escala de maturidade 0–5
- [x] Evidência, responsável, impacto, urgência e risco por pergunta
- [x] Motor de pontuação: nota por área, nota geral, status (Crítico → Otimizado)
- [x] Relatório executivo: sumário, mapa de maturidade, diagnóstico analítico, matriz de priorização, plano de ação 30/90/365 dias
- [x] Texto consultivo gerado por IA (Gemini) no relatório, com fallback para o motor de regras
- [x] Exportação de PDF real do relatório
- [x] Aprovação do plano de ação → projeto Kanban (A Fazer / Em Andamento / Concluído)
- [x] Data Room: upload e download de documentos por empresa, categorizado por área
- [x] Painel de empresas com histórico comparativo de diagnósticos (evolução da maturidade)
- [x] Central de Agentes de IA (roadmap dos agentes do plano estratégico, com status real)
- [x] Tela de Integrações externas (ERP, CRM, bancos, WhatsApp etc.) — apenas UI, nada conectado
- [x] Suíte de testes automatizados (unitário + integração) cobrindo o fluxo completo

## O que é mock e o que é real

| Item | Status |
|---|---|
| Diagnóstico, pontuação, relatório, PDF, Kanban, Data Room | **Real** — funcional de ponta a ponta, com teste de integração cobrindo o fluxo |
| Narrativa de IA no relatório | **Real**, condicionada a `GEMINI_API_KEY` configurada |
| Login e controle de acesso por papel (admin/consultor/cliente) | **Mockado, mas com regras reais** — ver seção abaixo |
| Tela de Integrações | **Mockup** — lista as integrações previstas, botão "Conectar" desabilitado |
| Central de Agentes de IA | **Roadmap honesto** — só marca "Ativo" o que de fato está ligado |

## Login mockado

Implementado a pedido — não é autenticação de produção, mas a lógica de controle de acesso (quem
pode ver o quê) é real, não decorativa.

- **Usuários**: lista estática em `lib/auth-users.ts` (5 usuários, não persistidos no banco),
  cobrindo 3 papéis — `admin`, `consultor` e `cliente` — mapeados pra cargos da visão organizacional
  do plano da Arca (CEO/Head BTO, Consultor Líder, Sponsor do Cliente etc.). A tela `/login` lista
  todos com um botão de "entrar como" pra facilitar teste.
- **Sessão**: cookie httpOnly com um JSON em base64 — **não é assinado nem criptografado**. Prova
  as regras de roteamento, não protege dado real contra um usuário que edite o próprio cookie.
- **Regras**: `cliente` só acessa a empresa vinculada a ele (empresa, diagnósticos, Data Room, atas,
  indicadores); `admin` e `consultor` veem tudo; só `admin` acessa `/usuarios`. Aplicadas em duas
  camadas — `proxy.ts` (roteamento, sem acesso ao banco) e `lib/access.ts` (dentro de cada
  página e Server Action, com o dado real do banco).

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
