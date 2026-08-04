@AGENTS.md

# ArcaOS — Contexto do Projeto

MVP da plataforma ArcaOS (Arca Consulting): diagnóstico empresarial 360 para PMEs, relatório
executivo com narrativa gerada por IA, plano de ação e execução em Kanban. `README.md` tem a
visão geral, stack, checklist de features e como rodar — não repita esse conteúdo aqui, leia lá.

## Decisões de arquitetura e por quê

- **SQLite local via `@prisma/adapter-better-sqlite3`, não `sqlite3` puro.** Prisma 7 exige um
  *driver adapter* explícito — `new PrismaClient()` sem adapter é erro de compilação. `lib/prisma.ts`.
- **Import do client gerado é `@/app/generated/prisma/client`, não `@/app/generated/prisma`.**
  O gerador `prisma-client` não cria `index.ts` barrel — exports vivem em `client.ts`.
- **Modelo Gemini é `gemini-flash-latest`** (alias, não versão fixa). Chaves novas do Google AI
  Studio não têm acesso a `gemini-2.0-flash`/`gemini-2.5-flash` ("no longer available to new
  users"). Se `lib/ai.ts` passar a 404, rode `ai.models.list()` antes de trocar o nome.
- **PDF via `@react-pdf/renderer`, não Puppeteer** — decisão deliberada para não depender de
  Chromium headless. `lib/pdf.tsx` é uma reimplementação simplificada do relatório HTML; os dois
  layouts **não** compartilham JSX — uma mudança visual no relatório não se propaga pro PDF.
- **Upload em `uploads/` no disco local**, não bucket externo. Não funciona em hospedagem
  serverless sem trocar para S3/Vercel Blob.
- **9 verticais da Arca (`lib/verticals.ts`)** — as 12 áreas do questionário são mapeadas nas 9
  verticais do pitch: Estratégia e Governança (`estrategia`); Financeiro e Controladoria
  (`financeiro`); Comercial, Growth e Sucesso do Cliente (`comercial`, `atendimento`); Marketing e
  Comunicação (`marketing`) — vertical própria, separada de Comercial pra poder ser vendida isolada
  (o plano estratégico da Arca trata as duas como ofertas distintas); Operações e Suprimentos
  (`operacoes`, `compras`); Pessoas e Cultura (`pessoas`); Tecnologia e Dados (`tecnologia`); Fiscal,
  Jurídico e Compliance (`fiscal`, `juridico`); Gestão da Rotina e Indicadores (`indicadores`). O
  teste unitário garante que toda área cai em exatamente uma vertical. Se uma área
  for renomeada/removida, atualize `verticals.ts` junto — o build não pega.
- **Motor de maturidade Nível 1–5 (`lib/scoring.ts`)** — `maturityLevelForScore(avg)` usa limiares
  < 1 → Nível 1, < 2 → Nível 2, < 3 → Nível 3, < 4 → Nível 4, resto → Nível 5 (ou seja, nota 3.0 já
  é Nível 4). O nível é exposto no `Report` como `maturityLevel`/`maturityLabel` e estilizado via
  `maturityTone` em `lib/badge-tones.ts`.
- **Relatório mensal do Comitê de Gestão (`lib/monthly-report.ts`)** — `buildMonthlyReport` é uma
  função pura (mesma filosofia do `buildReport`): recebe o snapshot e devolve `null` se a empresa
  não tiver respostas. Persistência é upsert por `companyId + period` no model `MonthlyReport`. O
  período vem de `currentPeriod()` em `America/Sao_Paulo` usando `Intl.DateTimeFormat` +
  `formatToParts` (não `format()` direto — em pt-BR ele retorna `MM-AAAA`, ex. `07-2026`).
- **Cron do relatório mensal (`app/api/cron/mensal/route.ts` + `cron.json`)** — rota GET protegida
  por `Authorization: Bearer $CRON_SECRET`; itera as empresas com respostas e faz upsert do
  scorecard do mês. Agenda: dia 1 de cada mês, 9h UTC (`0 9 1 * *`). Sem `CRON_SECRET` a rota
  retorna 401. Rodar `generateMonthlyReport` manualmente no portal tem o mesmo efeito por empresa.
- **Portal do cliente (`app/portal/`, `app/actions-portal.ts`)** — `Decision`, `Message` e
  `MonthlyReport` são models novos ligados à `Company`. Toda action recebe `companyId` e chama
  `assertCompanyAccess` antes de mutar; decisões também podem vir das atas
  (`MeetingMinutes.decisions`, string com quebras de linha).
- **Narrativa de IA é gerada sob demanda**, não na conclusão. Concluir o último bloco do
  questionário (`saveAreaAnswers`) só marca o diagnóstico como `concluido` e dispara o webhook de
  saída — salvar nunca bloqueia em Gemini. A análise consultiva (`Diagnostic.aiNarrative`, JSON
  string) e a evolução de maturidade (`Diagnostic.evolutionNarrative`) são geradas por
  `generateNarrativeAction`, acionado pelo botão "Gerar análise consultiva com IA" no relatório
  (que redireciona pra `#sumario`). Nunca lança erro — sem chave ou com falha de rede,
  `generateAiNarrative`/`generateMaturityEvolution` retornam `null` silenciosamente.
- **Playbook de Execução por vertical (`lib/playbooks.ts`)** — passo a passo padrão de implantação,
  igual pra qualquer cliente da mesma vertical, independente de nota de diagnóstico (conteúdo
  extraído do "Nível 2" de cada vertical no plano estratégico). `approveVerticalActionPlan`
  (`app/actions-module.ts`) cria um segundo épico no Kanban a partir dele, separado do "Plano de
  Ação" que vem das respostas fracas do diagnóstico — dois épicos por aprovação, não um. Diagnóstico
  aprovado antes do playbook existir **não** ganha o épico retroativamente; o relatório do módulo
  checa se o épico existe de verdade antes de dizer "já criado" (`playbookAlreadyCreated`).
- **Agente de Sinergia entre Verticais (`lib/synergy.ts`)** — regra fixa (mesma filosofia de
  `lib/governance.ts`), não IA: cruza pares de perguntas fracas de **verticais diferentes** que
  descrevem o mesmo problema por dois ângulos (ex.: Financeiro q10 + Comercial q10 = precificação
  sem base de custo). Só dispara com os dois lados respondidos e fracos (nota ≤ 2). Roda na página
  da empresa (`app/empresas/[id]/page.tsx`), juntando a resposta mais recente de qualquer
  diagnóstico da empresa — completo ou de vertical isolada — não só do diagnóstico mais recente.
- **Integrações de ERP são genéricas (`ErpConnection`, não colunas na `Company`)** — um provedor por
  empresa (`@@unique([companyId, provider])`); hoje só `provider: "omie"` está implementado
  (`lib/omie.ts` + `app/actions-omie.ts`), mas TOTVS/Voalle (citados no diagrama do plano
  estratégico) entram como uma nova `provider` sem migration de schema. Antes disso era
  `Company.omieAppKey`/`omieAppSecret` — migrado via `20260803200403_generalize_erp_connections`
  (cria a tabela, faz backfill das credenciais existentes, só depois derruba as colunas antigas — sem
  isso qualquer empresa já conectada perderia a credencial).
- **Estrutura de receita (`Contract` + `ContractPerformanceRecord`, `app/actions-contracts.ts`)** —
  os 4 tipos de contrato do plano estratégico (Setup Inicial, MRR, Performance Fee, Projeto Avulso).
  `value` é obrigatório pra todos exceto `performance_fee`, que usa `feePercent` no lugar — dois
  `.refine()` cruzados em `contractSchema` (`lib/validation.ts`) cobrem essa dependência. A apuração
  de Performance Fee é **deliberadamente manual**: `gainValue` (o ganho em R$ do cliente no período)
  não vem de `KpiEntry` porque a direção de "melhora" varia por indicador (Inadimplência caindo é
  bom, Receita caindo é ruim) — adivinhar errado calcularia comissão errada. Só a multiplicação
  `gainValue × feePercent` é automatizada (`lib/contracts.ts`, testado). Mesma lógica pra comissão de
  parceiro: `PartnerReferral.commissionPercent`/`commissionValue` são entrada manual, não calculados.
  `lib/contracts.ts` também tem `totalActiveMrr()`, mostrado como badge no card de Contratos da
  empresa.

## Suíte de testes — como funciona e armadilhas

**Dois modos de rodar:**

```bash
npx vitest run --config vitest.unit.config.ts lib/   # unitários puros — SEM banco (15 arquivos, 127 testes)
npm test                                             # suíte completa (unitário + integração) — precisa de banco
```

Os testes `lib/*.test.ts` são todos funções puras (scoring, areas, verticals, monthly-report,
dashboard, session, ai com Gemini mockado, pdf) e rodam **sem banco** pelo `vitest.unit.config.ts`.
O `npm test` usa o `vitest.config.ts`, que exige um Postgres de teste: **`npm test` falha sem
`TEST_DATABASE_URL` em `.env.test.local`** (gitignored, `test/setup-db.ts` dropa e recria o schema
`public`). Na dúvida, rode a primeira linha — é a que valida as regras de negócio puras.

**Provisionamento do banco** (`vitest.config.ts` + `test/setup-db.ts`, roda uma vez ao iniciar o
Vitest, fora dos test workers):
1. Lê `TEST_DATABASE_URL` de `.env.test.local` (dotenv). **Sem ela, falha na hora** — não existe
   fallback para SQLite.
2. `DROP SCHEMA public CASCADE; CREATE SCHEMA public` no Postgres de teste (por isso ela **não pode
   ser o banco de dev/produção**).
3. Lê `prisma/migrations/*/migration.sql` em ordem alfabética (= cronológica, prefixo timestamp) e
   executa cada uma via `pg` direto — **não** roda `prisma migrate deploy`.
4. Injeta `DATABASE_URL` (o valor de `TEST_DATABASE_URL`) via `test.env` — isso é lido por
   `lib/prisma.ts` quando os testes importam `@/lib/prisma` (estaticamente, no topo do arquivo —
   funciona porque `test.env` é aplicado pelo worker *antes* do módulo do teste ser carregado).
5. **Se adicionar uma migration nova, nada precisa mudar** — o loop já pega qualquer pasta nova em
   `prisma/migrations/`.
6. **`fileParallelism: false` é obrigatório** — todos os arquivos de teste compartilham o mesmo
   banco; rodar em paralelo causa corrida entre arquivos. Testes dentro de um mesmo arquivo já usam
   nomes de empresa únicos por teste para não colidir mesmo em série.

**Mockando `@google/genai`** (`lib/ai.test.ts`): `GoogleGenAI` é chamado com `new`, então o mock
**precisa** ser uma `function` (ou classe) que retorna o objeto fake — uma arrow function em
`vi.fn().mockImplementation(() => ({...}))` explode com `TypeError: ... is not a constructor`.
Use `vi.fn().mockImplementation(function () { return {...} })`. A variável `mockGenerateContent`
referenciada dentro do factory de `vi.mock(...)` precisa vir de `vi.hoisted(() => vi.fn())` —
`vi.mock` é hoisted para o topo do arquivo pelo transform do Vitest, então uma `const` normal
declarada abaixo dele ainda não existiria no momento em que o factory roda.

**Mockando `next/navigation`** (`test/integration.test.ts`): `redirect()` de verdade lança um erro
com um "digest" especial para o Next.js interceptar; o mock (`redirect: (url) => { throw new
Error(\`REDIRECT:${url}\`) }`) precisa **lançar**, não só registrar a chamada — várias Server
Actions dependem de `redirect()` interromper a execução (ex.: `uploadDocument` chama `redirect()`
dentro de um `if` de validação sem `return` depois).

**Upload nos testes escreve no `uploads/` real do projeto** (não num diretório temp), porque
`actions-documents.ts` resolve o caminho via `process.cwd()`. O teste de Data Room limpa o
diretório da empresa de teste no final (`fs.rm(..., { recursive: true, force: true })`) — se
adicionar um teste novo que faz upload, replique essa limpeza ou vai sujar o repo.

**`GEMINI_API_KEY` nunca está setada nos testes** — Vitest não carrega `.env.local` (isso é
comportamento do Next.js dev/build, não do Vitest). Isso é *usado a favor*: o teste de conclusão
do diagnóstico em `test/integration.test.ts` valida o fallback gracioso sem precisar mockar nada.

**Mockando `@/lib/auth`** (`test/integration.test.ts`): como toda Server Action agora chama
`getSession()` internamente (ver seção de login abaixo), o arquivo mocka `@/lib/auth` inteiro com
`vi.hoisted(() => vi.fn())` pra `getSession`/`setSessionCookie`/`clearSessionCookie`, e um
`beforeEach` reseta `getSession` pra resolver uma sessão `admin` por padrão — assim os ~85 testes
que já existiam antes do RBAC continuam passando sem saber que auth existe. Testes que querem
validar o bloqueio de `cliente` chamam `mockGetSession.mockResolvedValue({ role: "cliente", ... })`
antes da chamada que deve falhar.

**Mockando `next/cache`** (`test/integration.test.ts`): `revalidatePath()` de verdade exige um
request-scoped store do Next.js (`Invariant: static generation store missing`) que só existe
dentro de uma requisição real — chamar a Server Action direto como função (como o teste faz) não
tem esse contexto. O mock (`revalidatePath: () => {}`) é um no-op; usado por `reorderTasks`
(drag-and-drop do Kanban), que não pode chamar `redirect()` como as outras actions porque é
invocada de um Client Component sem submit de formulário — um redirect ali mataria a animação de
arrastar a cada solto.

## Comandos úteis

```bash
npx vitest run --config vitest.unit.config.ts lib/   # unitários puros, sem banco
npx vitest run --config vitest.unit.config.ts lib/scoring.test.ts   # um arquivo só
npm test                                # suíte completa (exige TEST_DATABASE_URL em .env.test.local)
npx prisma migrate dev --name <nome>    # criar/aplicar migration após editar schema.prisma
npx prisma generate                     # regenerar o client (roda automático após migrate)
npx prisma studio                       # inspecionar dev.db visualmente
npx tsc --noEmit                        # type-check sem build
npx eslint .                            # lint
```

## Login mockado — como funciona e seus limites

Implementado a pedido explícito do usuário ("mesmo que mockado"), depois de ter ficado de fora do
MVP inicial de propósito. Três peças:

- **`lib/session.ts`** — tipo `Session` e `encodeSession`/`decodeSession`, funções puras sem
  dependência de `next/headers` (uso de `btoa`/`atob` manual em vez de `Buffer`, porque este arquivo
  também é importado por `proxy.ts` — a partir do Next 16 o Proxy roda em Node por padrão, mas ainda
  pode rodar em Edge se configurado, e o código do Proxy não deve depender de módulos/globais
  compartilhados; `btoa`/`atob` funcionam nos dois ambientes, `Buffer` não é garantido).
  **O cookie não é assinado nem criptografado** — é só JSON em base64. Isso é intencional pro
  escopo "mockado", mas significa que o payload pode ser forjado editando o cookie no devtools; uma
  implementação real usaria sessão assinada (`next-auth`, `iron-session`).
- **`lib/auth.ts`** — só roda em Node (usa `next/headers`): `getSession`/`setSessionCookie`/
  `clearSessionCookie`.
- **Modelo `User` no banco** — os usuários vivem em Postgres (migration `add_users`, que semeia os
  usuários que antes eram `MOCK_USERS` em `lib/auth-users.ts` — arquivo removido). **Por padrão só
  existem Cauan e Cícero (ambos `admin`)**; a migration `remove_seed_users` apaga Camila, Marcos,
  Beatriz e Roberto de qualquer banco — ela é idempotente, então vale para banco novo e para bancos
  já existentes (o seed da `add_users` não foi editado porque já está aplicado; editar migration
  aplicada gera risco de checksum no Prisma). O login consulta `prisma.user`; a página `/usuarios`
  (só admin) cria, troca o cargo/empresa e exclui usuários via `app/actions-users.ts`. Clientes são
  vinculados a uma empresa **real** por `User.companyId` (FK, migration `add_user_company_relation`)
  — a tela usa um `<select>` de empresas e o login usa o `companyId` direto; sem vínculo o login
  cai em `/login?error=empresa`. `createUser`/`updateUserRole`/`deleteUser` têm guards: validação
  via `userSchema`, e-mail único, cliente exige empresa (`empresa-obrigatoria`/`empresa-invalida`),
  não se auto-excluir e não excluir o último admin. Senha em texto puro de propósito — não é um
  cofre de credenciais real.

**Regras de acesso**: `proxy.ts` bloqueia rotas sem sessão e redireciona `cliente` pra longe de
`/empresas`, `/relatorios`, `/diagnostico/novo` e de qualquer `/empresas/[id]` que não seja o dele —
tudo isso sem tocar no banco (Edge runtime não roda o driver do Prisma). O que o middleware **não**
consegue verificar é se um `/diagnostico/[id]` pertence à empresa do cliente logado, porque isso
exige uma query — por isso `lib/access.ts` (`assertCompanyAccess`) é chamado de novo, com o
`companyId` já resolvido, em toda página de diagnóstico E em toda Server Action que muta dado (dupla
camada: se a página deixar passar, a action ainda barra). Se adicionar uma Server Action nova que
recebe `companyId` ou `diagnosticId`, replique esse padrão — não existe verificação automática.

Se `GEMINI_API_KEY`/testes forem afetados: o mock de `next/navigation` em `test/integration.test.ts`
agora também precisa exportar `notFound` (não só `redirect`), porque `assertCompanyAccess` chama
`notFound()` quando bloqueia acesso — se você adicionar um teste novo que usa `next/navigation` sem
importar desse mock, vai quebrar com "notFound is not a function".

**Dashboard (`/dashboard`)**: agregação em `lib/dashboard.ts` (`buildDashboardData` — query com
`prisma.company.findMany` incluindo diagnostics/answers/tasks — e `aggregateDashboard`, função pura
com teste unitário em `lib/dashboard.test.ts`). A página escopa por sessão: `cliente` só vê a
própria empresa; admin/consultor veem a carteira. A landing `/` fica visível também pra logados
(não há redirect de `/` no `proxy.ts`). Gráficos são barras CSS puras (`app/components/BarChart.tsx`),
sem lib de charts.

## Áreas sensíveis — não fazer sem confirmar com o usuário

- **Deploy em produção**: nunca executar deploy real (Vercel etc.) sem o usuário presente e
  confirmando — toca conta/credenciais de hospedagem dele.
- **Upload de arquivos via browser automation**: automação headless não abre o diálogo nativo do
  SO para selecionar arquivo. Para validar upload, use o teste de integração (já cobre isso) ou
  peça para o usuário testar manualmente — não force `input[type=file].value` via JS (o browser
  rejeita: `InvalidStateError`).

## Convenções do projeto

- Português do Brasil em toda a UI e conteúdo de negócio (labels, textos, mensagens). Nomes de
  variáveis/funções/comentários de código em inglês.
- Tailwind utilitário direto no JSX — sem CSS modules, sem styled-components.
- Server Actions (`"use server"`) para toda mutação — sem API routes REST para CRUD, exceto onde é
  preciso retornar um binário (`/api/documentos/[id]`, `/api/diagnostico/[id]/pdf`) ou onde o
  Next.js precisa chamar de fora (`/api/cron/mensal`). **Arquivos `"use server"` só exportam
  funções async** — não exportar constantes (ex.: `ROLE_LABEL`) de lá, o LSP acusa "only async
  functions are allowed".
- Ao adicionar uma Server Action nova que muda dados, escreva o teste de integração correspondente
  em `test/integration.test.ts` reaproveitando os helpers `createTestCompany`, `areaAnswersForm`,
  `completeAllAreas` e `expectRedirect` já existentes no arquivo. Toda action que recebe
  `companyId`/`diagnosticId` chama `assertCompanyAccess` (padrão de `app/actions-portal.ts`).
