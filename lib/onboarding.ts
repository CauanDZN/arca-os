export type OnboardingItemKey =
  | "cadastro"
  | "responsavel"
  | "data_room"
  | "diagnostico_iniciado"
  | "diagnostico_concluido";

export type OnboardingItem = {
  key: OnboardingItemKey;
  label: string;
  done: boolean;
};

export type OnboardingInput = {
  onboardingResponsible: string;
  documentCount: number;
  diagnosticCount: number;
  hasCompletedDiagnostic: boolean;
};

/**
 * Trilha 1 (Onboarding): checklist derivado de sinais que já existem no
 * banco — sem modelo novo além do responsável, sem IA. Uma empresa só chega
 * a esta tela depois de cadastrada, então "cadastro completo" é sempre true;
 * os outros itens refletem o que falta pra fechar a trilha.
 */
export function buildOnboardingChecklist(input: OnboardingInput): OnboardingItem[] {
  return [
    { key: "cadastro", label: "Cadastro da empresa completo", done: true },
    {
      key: "responsavel",
      label: "Responsável Arca definido",
      done: input.onboardingResponsible.trim() !== "",
    },
    {
      key: "data_room",
      label: "Data Room com ao menos 1 documento",
      done: input.documentCount > 0,
    },
    {
      key: "diagnostico_iniciado",
      label: "Diagnóstico iniciado",
      done: input.diagnosticCount > 0,
    },
    {
      key: "diagnostico_concluido",
      label: "Diagnóstico concluído",
      done: input.hasCompletedDiagnostic,
    },
  ];
}
