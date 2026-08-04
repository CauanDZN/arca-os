import { z } from "zod";
import { AREAS } from "@/lib/areas";

// FormData.get() devolve null (não undefined) pra uma chave ausente — o que
// escapa do .default("") do zod, que só cobre undefined. Normaliza null/
// undefined pra "" antes da validação de string, tanto pro formulário real
// (que sempre manda o campo, mesmo vazio) quanto pra uma chamada direta da
// Server Action que omita o campo.
export const optionalTrimmedString = (max: number) =>
  z.preprocess((v) => (v === null || v === undefined ? "" : v), z.string().trim().max(max));

// Single source of truth for the fixed vocab used across the questionnaire form,
// the AI prompts and the priority matrix — keeping these as enums (not free text)
// is what lets the AI agents and the rule-based ones read the data reliably.
export const IMPACT_OPTIONS = ["Baixo", "Médio", "Alto"] as const;
export const URGENCY_OPTIONS = ["Baixa", "Média", "Alta"] as const;
export const RISK_OPTIONS = [
  "Operacional",
  "Financeiro",
  "Comercial",
  "Jurídico",
  "Fiscal",
  "Pessoas",
  "Tecnologia",
] as const;

export const answerFieldsSchema = z.object({
  score: z.coerce.number().int().min(0).max(5),
  evidence: z.string().trim().max(500).default(""),
  responsible: z.string().trim().max(120).default(""),
  impact: z.enum(IMPACT_OPTIONS).default("Médio"),
  urgency: z.enum(URGENCY_OPTIONS).default("Média"),
  risk: z.enum(RISK_OPTIONS).default("Operacional"),
});

export const taskDetailsSchema = z.object({
  responsible: z.string().trim().max(120).default(""),
  dueDate: z
    .string()
    .trim()
    .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "Data inválida")
    .default("")
    .transform((v) => (v === "" ? null : new Date(v))),
  sprintId: z
    .string()
    .trim()
    .default("")
    .transform((v) => (v === "" ? null : v)),
  epicId: z
    .string()
    .trim()
    .default("")
    .transform((v) => (v === "" ? null : v)),
  successIndicator: z.string().trim().max(300).default(""),
  dependencies: z.string().trim().max(300).default(""),
  completionEvidence: z.string().trim().max(300).default(""),
});

export const documentCategorySchema = z
  .enum(["geral", ...AREAS.map((a) => a.key)] as [string, ...string[]])
  .default("geral");

export const meetingNotesSchema = z.object({
  rawNotes: z.string().trim().min(1, "Cole ou digite as anotações da reunião.").max(8000),
});

export const decisionSchema = z.object({
  title: z.string().trim().min(1, "Descreva a decisão.").max(160),
  summary: z.string().trim().max(500).default(""),
  decidedAt: z
    .string()
    .trim()
    .refine((v) => !Number.isNaN(Date.parse(v)), "Data da decisão inválida")
    .transform((v) => new Date(v)),
  decidedBy: z.string().trim().max(120).default(""),
});

export const messageSchema = z.object({
  body: z.string().trim().min(1, "Escreva a mensagem.").max(2000),
});

export const onboardingResponsibleSchema = z.object({
  onboardingResponsible: z.string().trim().max(120).default(""),
});

export const omieCredentialsSchema = z.object({
  omieAppKey: z.string().trim().min(1, "Informe a App Key da Omie.").max(60),
  omieAppSecret: z.string().trim().min(1, "Informe o App Secret da Omie.").max(60),
});

// Vertical Parceira (plano estratégico, p. 16) — parcerias operacionais
// (execução técnica sob supervisão Arca), estratégicas (SaaS, fintechs,
// instituições financeiras) e comerciais (representantes, franquias).
export const PARTNER_TYPES = ["operacional", "estrategica", "comercial"] as const;
export const PARTNER_HOMOLOGATION_STATUSES = ["pendente", "homologado", "suspenso"] as const;
export const PARTNER_REFERRAL_STATUSES = ["indicado", "em_andamento", "concluido", "perdido"] as const;
// Os 5 modelos de receita de parceria do plano (p. 19) — ver comentário em
// Partner no schema.prisma pra por que só comissionamento vive na indicação.
export const PARTNER_REVENUE_MODELS = [
  "comissionamento",
  "coparticipacao",
  "fee_curadoria",
  "revenue_share",
  "white_label",
] as const;

export const partnerSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do parceiro.").max(160),
  type: z.enum(PARTNER_TYPES),
  category: z.string().trim().min(1, "Informe a categoria.").max(80),
  contactInfo: optionalTrimmedString(300),
  slaHours: z.coerce.number().int().min(0).max(720).optional(),
  revenueModel: z.enum(PARTNER_REVENUE_MODELS).default("comissionamento"),
  curationFeeValue: z.coerce.number().min(0).optional(),
  revenueSharePercent: z.coerce.number().min(0).max(100).optional(),
});

export const partnerNpsSchema = z.object({
  npsScore: z.coerce.number().int().min(-100).max(100),
});

export const partnerReferralSchema = z.object({
  partnerId: z.string().trim().min(1, "Selecione um parceiro."),
  notes: optionalTrimmedString(300),
});

export const partnerReferralFeedbackSchema = z.object({
  commissionPercent: z.coerce.number().min(0).max(100).optional(),
  commissionValue: z.coerce.number().min(0).optional(),
  clientSatisfaction: z.coerce.number().int().min(0).max(100).optional(),
});

// Estrutura de receita Arca BTO (plano estratégico, p. 24). value é
// obrigatório pra todos os tipos exceto performance_fee, que usa feePercent
// no lugar — os dois .refine cobrem essa dependência cruzada que um enum
// simples não expressa.
export const CONTRACT_TYPES = ["setup", "mrr", "performance_fee", "projeto_avulso"] as const;
export const CONTRACT_STATUSES = ["ativo", "encerrado", "pendente"] as const;

export const contractSchema = z
  .object({
    type: z.enum(CONTRACT_TYPES),
    verticalKey: optionalTrimmedString(40).transform((v) => (v === "" ? null : v)),
    value: z.coerce.number().min(0).optional(),
    feePercent: z.coerce.number().min(0).max(100).optional(),
    status: z.enum(CONTRACT_STATUSES).default("ativo"),
    startDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Data de início inválida"),
    endDate: z
      .string()
      .trim()
      .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "Data de fim inválida")
      .default(""),
    notes: optionalTrimmedString(300),
  })
  .transform((v) => ({
    ...v,
    startDate: new Date(v.startDate),
    endDate: v.endDate === "" ? null : new Date(v.endDate),
  }))
  .refine((v) => v.type !== "performance_fee" || (v.feePercent != null && v.feePercent > 0), {
    message: "Informe o percentual do performance fee.",
    path: ["feePercent"],
  })
  .refine((v) => v.type === "performance_fee" || (v.value != null && v.value > 0), {
    message: "Informe o valor do contrato.",
    path: ["value"],
  });

export const contractPerformanceRecordSchema = z.object({
  period: z.string().trim().min(1, "Informe o período.").max(20),
  gainValue: z.coerce.number().min(0.01, "Informe o ganho apurado."),
  notes: optionalTrimmedString(300),
});

// Revisão humana da narrativa de IA antes da aprovação do plano — o sumário é
// um campo só, os insights por área chegam como arrays paralelos (areaKey[],
// causaRaiz[], recomendacao[]) porque o form tem um bloco repetido por área.
export const narrativeEditSchema = z.object({
  executiveSummary: z.string().trim().min(1, "Escreva o sumário executivo.").max(2000),
});

export const narrativeAreaInsightSchema = z.object({
  areaKey: z.string().trim().min(1),
  causaRaiz: z.string().trim().max(600).default(""),
  recomendacao: z.string().trim().max(600).default(""),
});

export const sprintSchema = z
  .object({
    name: z.string().trim().min(1, "Dê um nome ao sprint.").max(120),
    goal: z.string().trim().max(300).default(""),
    startDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Data de início inválida"),
    endDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Data de fim inválida"),
  })
  .transform((v) => ({ ...v, startDate: new Date(v.startDate), endDate: new Date(v.endDate) }))
  .refine((v) => v.endDate >= v.startDate, {
    message: "A data de fim deve ser depois da data de início.",
    path: ["endDate"],
  });

export const epicSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome ao épico.").max(120),
  description: z.string().trim().max(300).default(""),
});

const AREA_KEYS = AREAS.map((a) => a.key) as [string, ...string[]];

export const outboundWebhookUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https?:\/\//.test(v), "A URL deve começar com http:// ou https://")
  .refine((v) => {
    if (v === "") return true;
    try {
      new URL(v);
      return true;
    } catch {
      return false;
    }
  }, "URL inválida")
  .transform((v) => (v === "" ? null : v));

export const kpiEntrySchema = z.object({
  areaKey: z.enum(AREA_KEYS),
  indicatorName: z.string().trim().min(1).max(120),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use o formato AAAA-MM."),
  value: z.coerce.number(),
  target: z.coerce.number().optional(),
});

export const USER_ROLES = ["admin", "consultor", "cliente"] as const;

export const userSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome.").max(120),
  email: z.string().trim().email("E-mail inválido").max(160),
  password: z.string().min(6, "A senha deve ter ao menos 6 caracteres.").max(120),
  role: z.enum(USER_ROLES),
  title: optionalTrimmedString(120),
  companyId: optionalTrimmedString(120).transform((v) => (v === "" ? null : v)),
});
