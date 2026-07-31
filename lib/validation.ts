import { z } from "zod";
import { AREAS } from "@/lib/areas";

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
