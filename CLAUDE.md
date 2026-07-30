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
- **Narrativa de IA é gerada uma vez**, na conclusão do diagnóstico (`saveAreaAnswers`, branch da
  última área), e persistida em `Diagnostic.aiNarrative` (JSON string). Nunca lança erro — sem
  chave ou com falha de rede, `generateAiNarrative` retorna `null` silenciosamente.

## Suíte de testes — como funciona e armadilhas

`npm test` (`vitest run`). 5 arquivos, 35 testes, todos devem passar antes de considerar qualquer
mudança pronta.

**Provisionamento do banco** (`vitest.config.ts`, roda uma vez ao iniciar o Vitest, fora dos test
workers):
1. Cria um diretório temp (`os.tmpdir()`), um arquivo `test.db` novo.
2. Lê `prisma/migrations/*/migration.sql` em ordem alfabética (= cronológica, prefixo timestamp) e
   executa cada um via `better-sqlite3` direto — **não** roda `prisma migrate deploy` (mais rápido,
   sem spawnar processo).
3. Injeta `DATABASE_URL=file:<temp>` via `test.env` — isso é lido por `lib/prisma.ts` quando os
   testes importam `@/lib/prisma` (estaticamente, no topo do arquivo — funciona porque `test.env`
   é aplicado pelo worker *antes* do módulo do teste ser carregado).
4. **Se adicionar uma migration nova, nada precisa mudar** — o loop já pega qualquer pasta nova em
   `prisma/migrations/`.
5. **`fileParallelism: false` é obrigatório** — todos os arquivos de teste compartilham o mesmo
   arquivo `.db`; rodar em paralelo causa corrida entre arquivos. Testes dentro de um mesmo arquivo
   já usam nomes de empresa únicos por teste para não colidir mesmo em série.

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

## Comandos úteis

```bash
npm test                                # suíte completa (unitário + integração)
npx vitest run lib/scoring.test.ts      # um arquivo só
npx prisma migrate dev --name <nome>    # criar/aplicar migration após editar schema.prisma
npx prisma generate                     # regenerar o client (roda automático após migrate)
npx prisma studio                       # inspecionar dev.db visualmente
npx tsc --noEmit                        # type-check sem build
npx eslint .                            # lint
```

## Áreas sensíveis — não fazer sem confirmar com o usuário

- **Login/autenticação real**: não implementado de propósito (ver README). Se pedirem, trate como
  feature própria — não hackeie algo simplificado "pra já funcionar".
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
  preciso retornar um binário (`/api/documentos/[id]`, `/api/diagnostico/[id]/pdf`).
- Ao adicionar uma Server Action nova que muda dados, escreva o teste de integração correspondente
  em `test/integration.test.ts` reaproveitando os helpers `createTestCompany`, `areaAnswersForm`,
  `completeAllAreas` e `expectRedirect` já existentes no arquivo.
