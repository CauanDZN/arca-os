// Taxonomia: as 8 verticais de atuação da Arca. As 12 áreas
// do questionário (lib/areas.ts) são mapeadas nessas 8 verticais — assim o
// relatório e o dashboard falam a mesma língua da proposta comercial.

export type Vertical = {
  key: string;
  name: string;
  description: string;
  areaKeys: string[];
};

export const VERTICALS: Vertical[] = [
  {
    key: "estrategia",
    name: "Estratégia e Governança",
    description: "Rumo, metas, organograma e governança.",
    areaKeys: ["estrategia"],
  },
  {
    key: "financeiro",
    name: "Financeiro e Controladoria",
    description: "Caixa, rentabilidade, custos e previsibilidade.",
    areaKeys: ["financeiro"],
  },
  {
    key: "comercial",
    name: "Comercial, Growth e Sucesso do Cliente",
    description: "Geração de receita, funil de vendas e retenção de clientes.",
    areaKeys: ["comercial", "atendimento"],
  },
  {
    key: "marketing",
    name: "Marketing e Comunicação",
    description: "Posicionamento de marca, geração de demanda e presença digital.",
    areaKeys: ["marketing"],
  },
  {
    key: "operacoes",
    name: "Operações e Suprimentos",
    description: "Entrega, produtividade, compras e estoque.",
    areaKeys: ["operacoes", "compras"],
  },
  {
    key: "pessoas",
    name: "Pessoas e Cultura",
    description: "Estrutura humana, liderança e clima.",
    areaKeys: ["pessoas"],
  },
  {
    key: "tecnologia",
    name: "Tecnologia e Dados",
    description: "Sistemas, automação e confiabilidade dos dados.",
    areaKeys: ["tecnologia"],
  },
  {
    key: "fiscal_juridico",
    name: "Fiscal, Jurídico e Compliance",
    description: "Tributos, contratos, riscos e proteção.",
    areaKeys: ["fiscal", "juridico"],
  },
  {
    key: "gestao_rotina",
    name: "Gestão da Rotina e Indicadores",
    description: "Disciplina de execução, indicadores e reuniões.",
    areaKeys: ["indicadores"],
  },
];

export function verticalForArea(areaKey: string): Vertical | undefined {
  return VERTICALS.find((v) => v.areaKeys.includes(areaKey));
}

export function getVerticalByKey(key: string): Vertical | undefined {
  return VERTICALS.find((v) => v.key === key);
}

export type VerticalAverage = {
  key: string;
  name: string;
  description: string;
  average: number;
  areas: { areaKey: string; average: number }[];
};

// Agrupa as notas por área (do relatório) nas 8 verticais. A nota de uma
// vertical é a média das notas das áreas que a compõem.
export function verticalAverages(areaScores: { areaKey: string; average: number }[]): VerticalAverage[] {
  return VERTICALS.map((vertical) => {
    const areas = vertical.areaKeys
      .map((areaKey) => {
        const match = areaScores.find((a) => a.areaKey === areaKey);
        return { areaKey, average: match?.average ?? 0 };
      })
      .filter((a) => a.average > 0);

    const sum = areas.reduce((acc, a) => acc + a.average, 0);
    const average = areas.length > 0 ? Math.round((sum / areas.length) * 10) / 10 : 0;

    return {
      key: vertical.key,
      name: vertical.name,
      description: vertical.description,
      average,
      areas,
    };
  });
}
