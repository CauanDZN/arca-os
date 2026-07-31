export type BadgeTone = "critical" | "serious" | "warning" | "managed" | "good" | "neutral";

export function statusTone(status: string): BadgeTone {
  switch (status) {
    case "Crítico":
      return "critical";
    case "Frágil":
      return "serious";
    case "Em estruturação":
      return "warning";
    case "Gerenciado":
      return "managed";
    case "Otimizado":
      return "good";
    default:
      return "neutral";
  }
}

export function priorityTone(priority: string): BadgeTone {
  switch (priority) {
    case "Alta":
      return "critical";
    case "Média":
      return "warning";
    case "Baixa":
      return "neutral";
    default:
      return "neutral";
  }
}

export function classificationTone(classification: string): BadgeTone {
  switch (classification) {
    case "Estrutural":
      return "critical";
    case "Corretiva":
      return "serious";
    case "Quick Win":
      return "good";
    case "Estratégica":
      return "managed";
    case "Não prioritária":
      return "neutral";
    default:
      return "neutral";
  }
}

export function maturityTone(level: number): BadgeTone {
  if (level <= 1) return "critical";
  if (level === 2) return "serious";
  if (level === 3) return "warning";
  if (level === 4) return "managed";
  return "good";
}
