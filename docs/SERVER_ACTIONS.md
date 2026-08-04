# Catálogo de Server Actions

Isto é "a API" do ArcaOS — 64 funções `"use server"` espalhadas em 16 arquivos `app/actions*.ts`.
**Não são rotas HTTP** (isso está em [`API.md`](./API.md)): são funções assíncronas que o React
chama diretamente via `<form action={minhaAction}>` (ou `.bind(null, id)` quando precisam de um
parâmetro fixo, tipo o id da empresa). O Next.js serializa a chamada por baixo dos panos — não tem
URL, método HTTP nem body JSON pra inspecionar no Network tab do jeito que se inspeciona uma API
REST.

## Padrão que se repete em quase toda action

1. `const session = await getSession();` — lê o cookie de sessão (`lib/auth.ts`).
2. Checagem de papel: `if (!session || session.role === "cliente") notFound();` (ação só pra
   Arca) **ou** `assertCompanyAccess(session, companyId)` (cliente só na própria empresa) — às
   vezes as duas. Ver `lib/access.ts`.
3. Valida o `FormData` com um schema zod de `lib/validation.ts`.
4. Muta o banco via Prisma.
5. `redirect(...)` pra a página que mostra o resultado — **quase nenhuma action retorna dado pro
   componente**, o padrão é sempre "muta e redireciona", inclusive nos erros (`redirect(...?error=...)`).

Duas exceções: `reorderTasks` (drag-and-drop do Kanban) usa `revalidatePath` em vez de `redirect`
porque quem chama é um Client Component — um redirect ali interromperia a animação de soltar o
card. E várias actions read-heavy (`generateNarrativeAction`, `syncOmieFinancials`) fazem
`revalidatePath` **antes** do redirect pra evitar servir o Router Cache com dado velho.

---

## `actions.ts` — Diagnóstico principal

| Action | Papel | O que faz |
|---|---|---|
| `createDiagnostic(formData)` | não-cliente | Cria `Company` + primeiro `Diagnostic` (escopo completo), abre a Etapa 1 do questionário |
| `saveAreaAnswers(diagnosticId, areaKey, formData)` | dono da empresa | Salva as respostas de uma área (score/evidência/responsável/impacto/urgência/risco por pergunta), avança pra próxima área ou conclui o diagnóstico. Dispara `diagnostic.completed` ao concluir |
| `generateNarrativeAction(diagnosticId)` | dono da empresa | Gera a narrativa de IA (sumário, causa raiz, recomendação) e a comparação de evolução de maturidade com o diagnóstico anterior — sob demanda, nunca lança erro sem chave de IA |
| `updateNarrativeAction(diagnosticId, formData)` | dono da empresa | Revisão humana da narrativa gerada por IA antes de aprovar o plano |

## `actions-module.ts` — Diagnóstico por vertical (Arca Checkup modular)

| Action | Papel | O que faz |
|---|---|---|
| `startVerticalDiagnostic(companyId, verticalKey)` | não-cliente + escopo de vertical | Cria um `Diagnostic` com `scope = verticalKey` |
| `approveVerticalActionPlan(diagnosticId)` | dono da empresa + escopo de vertical | Cria o plano de ação da vertical **e** o Playbook de Execução como dois épicos separados |

## `actions-vertical.ts` — Agente de Diagnóstico Vertical

| Action | Papel | O que faz |
|---|---|---|
| `generateVerticalInsightAction(diagnosticId, areaKey)` | dono da empresa | Cruza respostas do questionário com o conteúdo real dos documentos do Data Room daquela área e gera uma análise aprofundada (só pras 5 áreas em `VERTICAL_AGENT_AREAS`) |

## `actions-project.ts` — Arca Planner (Kanban, sprints, épicos)

| Action | Papel | O que faz |
|---|---|---|
| `approveActionPlan(diagnosticId)` | dono da empresa | Cria épicos (um por área) + tarefas a partir do plano de ação do relatório. Dispara `plan.approved` |
| `moveTask(diagnosticId, taskId, direction)` | dono da empresa | Move um card uma coluna pra frente/trás (botão, não drag). Dispara `task.status_changed` |
| `reorderTasks(diagnosticId, movedTaskId, toStatus, orderedIds)` | dono da empresa | Drag-and-drop do Kanban — **não redireciona** (chamado de Client Component). Dispara `task.status_changed` |
| `updateTaskDetails(diagnosticId, taskId, formData)` | dono da empresa | Responsável, prazo, sprint, épico, indicador de sucesso, dependências, evidência de conclusão |
| `createSprint` / `deleteSprint(diagnosticId, ...)` | dono da empresa | CRUD de sprints (nome, meta, datas) |
| `createEpic` / `deleteEpic(diagnosticId, ...)` | dono da empresa | CRUD de épicos manuais (além dos criados automaticamente na aprovação do plano) |
| `generateSprintReportAction(diagnosticId)` | dono da empresa | Agente de Relatório de Sprint — resume as movimentações do Kanban dos últimos 30 dias via IA |

## `actions-documents.ts` — Data Room

| Action | Papel | O que faz |
|---|---|---|
| `uploadDocument(companyId, formData)` | dono da empresa | Sobe o arquivo pro Vercel Blob, extrai texto (OCR se preciso), classifica o tipo do documento e sugere KPIs — tudo via IA, tudo opcional (falha graciosa) |
| `deleteDocument(companyId, documentId)` | dono da empresa | Apaga o blob e o registro |
| `extractFinancialTransactionsAction(companyId, documentId)` | dono da empresa | Agente de Extração Financeira — sob demanda, reanalisa o documento e substitui as transações extraídas anteriormente |
| `confirmDocumentTransaction` / `rejectDocumentTransaction(companyId, transactionId)` | dono da empresa | Revisão humana obrigatória de cada transação extraída antes dela "valer" |

## `actions-kpis.ts` — Cockpit de Performance

| Action | Papel | O que faz |
|---|---|---|
| `upsertKpiEntry(companyId, formData)` | dono da empresa | Cria/atualiza um `KpiEntry` (indicador + mês são a chave). Valida que o indicador pertence à área selecionada |
| `deleteKpiEntry(companyId, entryId)` | dono da empresa | Remove um indicador |
| `applyKpiSuggestion` / `rejectKpiSuggestion(companyId, suggestionId)` | dono da empresa | Confirma ou descarta uma sugestão de KPI extraída de documento (Data Room) antes dela virar `KpiEntry` de verdade |
| `generatePerformanceInsightAction(companyId)` | dono da empresa | Agente de Performance por Área — narrativa de tendência sobre o histórico de indicadores |

## `actions-meetings.ts` — Atas de Reunião

| Action | Papel | O que faz |
|---|---|---|
| `createMeetingNote(companyId, formData)` | dono da empresa | Cola anotações brutas → Gemini organiza em resumo/decisões/pendências |
| `deleteMeetingNote(companyId, noteId)` | dono da empresa | Remove uma ata |

## `actions-portal.ts` — Portal do Cliente

| Action | Papel | O que faz |
|---|---|---|
| `addDecision(companyId, formData)` | dono da empresa | Registra uma decisão no histórico (manual — além das extraídas de atas) |
| `sendMessage(companyId, formData)` | dono da empresa | Mensagem no canal de comunicação com a Arca |
| `generateMonthlyReport(companyId)` | dono da empresa | Gera/atualiza o scorecard do Comitê de Gestão do mês corrente — mesmo cálculo do cron `/api/cron/mensal` |

## `actions-empresas.ts` — Empresa (cadastro, verticais contratadas)

| Action | Papel | O que faz |
|---|---|---|
| `deleteCompany(companyId)` | **admin only** | Apaga a empresa inteira: diagnósticos, Data Room (+ blobs), atas, indicadores, webhooks — cascade |
| `updateOnboardingResponsible(companyId, formData)` | não-cliente | Define quem na Arca é responsável pela empresa (checklist de Onboarding) |
| `updateContractedVerticals(companyId, formData)` | não-cliente | Define quais verticais a empresa contratou — controla o que aparece em `/empresas/[id]/modulo/*` |

## `actions-contracts.ts` — Estrutura de receita

| Action | Papel | O que faz |
|---|---|---|
| `createContract(companyId, formData)` | não-cliente | Registra um contrato (Setup/MRR/Performance Fee/Projeto Avulso) |
| `updateContractStatus(companyId, contractId, formData)` | não-cliente | Muda status (ativo/encerrado/pendente) |
| `deleteContract(companyId, contractId)` | não-cliente | Remove um contrato |
| `createPerformanceRecord(companyId, contractId, formData)` | não-cliente | Apuração periódica de Performance Fee — `gainValue` é entrada manual, `feeValue` é calculado |
| `deletePerformanceRecord(companyId, contractId, recordId)` | não-cliente | Remove uma apuração |

## `actions-proposal.ts` — Catálogo Comercial (proposta em lote)

| Action | Papel | O que faz |
|---|---|---|
| `createProposal(companyId, formData)` | não-cliente + escopo de vertical | Cria vários `Contract` de uma vez, status `pendente` — um por vertical marcada no form |
| `activatePendingContracts(companyId)` | não-cliente | Aprova a proposta inteira: todos os `pendente` viram `ativo` **e** as verticais deles entram em `contractedVerticals` |
| `discardPendingContracts(companyId)` | não-cliente | Descarta a proposta inteira (apaga os `pendente`) |

## `actions-partners.ts` — Vertical Parceira

| Action | Papel | O que faz |
|---|---|---|
| `createPartner(formData)` | não-cliente | Cadastra parceiro (tipo, categoria, SLA, modelo de receita) |
| `updatePartnerHomologation(partnerId, formData)` | não-cliente | pendente → homologado → suspenso |
| `updatePartnerNps(partnerId, formData)` | não-cliente | Atualiza o NPS Arca Partner (leitura manual mais recente) |
| `deletePartner(partnerId)` | **admin only** | Remove o parceiro |
| `createPartnerReferral(companyId, formData)` | não-cliente | Indica um parceiro homologado pra uma empresa |
| `updatePartnerReferralStatus(companyId, referralId, formData)` | não-cliente | indicado → em_andamento → concluído/perdido |
| `updatePartnerReferralFeedback(companyId, referralId, formData)` | não-cliente | Comissão apurada + satisfação do cliente com essa indicação |
| `markReferralResponded(companyId, referralId)` | não-cliente | Marca quando o parceiro respondeu — mede o SLA realizado |
| `deletePartnerReferral(companyId, referralId)` | não-cliente | Remove a indicação |

## `actions-omie.ts` — Integração ERP (Omie)

Ver [`OMIE.md`](./OMIE.md) pro detalhe da API externa consumida.

| Action | Papel | O que faz |
|---|---|---|
| `saveOmieCredentials(companyId, formData)` | não-cliente | Valida a credencial contra a API real antes de salvar |
| `disconnectOmie(companyId)` | não-cliente | Remove a `ErpConnection` |
| `syncOmieFinancials(companyId)` | não-cliente | Busca contas a pagar/receber e grava como `KpiEntry` (Inadimplência, Endividamento) |

## `actions-webhooks.ts` — Webhooks de saída

| Action | Papel | O que faz |
|---|---|---|
| `generateWebhookToken(companyId)` | dono da empresa | Gera o token que protege `POST /api/webhooks/[companyId]` |
| `revokeWebhookToken(companyId)` | dono da empresa | Desativa o webhook de entrada |
| `deleteWebhookEvent(companyId, eventId)` | dono da empresa | Apaga um evento recebido do histórico |
| `setOutboundWebhookUrl(companyId, formData)` | dono da empresa | Define a URL do sistema do cliente que recebe os eventos de saída |
| `sendTestOutboundEvent(companyId)` | dono da empresa | Dispara um `webhook.test` manualmente |

## `actions-users.ts` — Usuários (admin)

| Action | Papel | O que faz |
|---|---|---|
| `createUser(formData)` | **admin only** | Cria usuário — cliente exige empresa vinculada; consultor pode ganhar `assignedVerticals` e `seniority` |
| `updateUserRole(userId, formData)` | **admin only** | Muda papel, empresa, verticais atribuídas e senioridade |
| `deleteUser(userId)` | **admin only** | Remove — bloqueia auto-exclusão e exclusão do último admin |

## `actions-auth.ts` — Login

| Action | Papel | O que faz |
|---|---|---|
| `login(formData)` | pública | Confere email/senha (texto puro — login mockado) contra a tabela `User`, grava a sessão no cookie |
| `logout()` | qualquer sessão | Limpa o cookie |

---

## Como achar rápido quem chama uma action

Toda action é importada e usada num Server Component `page.tsx` (form `action={...}`) ou passada
via `.bind(null, id)` pra um Client Component. Não há injeção de dependência nem service layer —
`grep -rn "nomeDaAction" app/` sempre acha o form que a dispara.
