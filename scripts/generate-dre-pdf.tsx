import path from "path";
import { Document, Page, Text, View, StyleSheet, renderToFile } from "@react-pdf/renderer";

// Gera um PDF de teste (DRE — Demonstrativo do Resultado do Exercício) com
// valores mensais, para subir no Data Room e ver como o Classificador de
// Documentos e o Agente de Extração de Indicadores se comportam.
//
// Uso: npx tsx scripts/generate-dre-pdf.tsx
// Saída: teste-dataroom-dre.pdf na raiz do projeto.

const MONTHS = ["Jan/26", "Fev/26", "Mar/26", "Abr/26", "Mai/26", "Jun/26"] as const;

const MONTHLY = {
  receitaBruta: [185_000, 210_000, 198_500, 240_000, 262_000, 301_500],
  deducoes: [18_500, 21_000, 19_850, 24_000, 26_200, 30_150],
  custos: [95_000, 108_000, 101_000, 122_000, 134_000, 154_000],
  pessoal: [32_000, 32_000, 33_500, 33_500, 34_800, 34_800],
  vendas: [9_000, 10_200, 9_800, 11_500, 12_400, 13_900],
  administrativas: [14_500, 14_500, 15_200, 15_200, 16_100, 16_100],
  despesasFinanceiras: [2_300, 2_100, 2_450, 1_980, 2_700, 2_150],
} as const;

const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);

type Line = { label: string; values: readonly number[] };

function rows(): (Line & { totals: number })[] {
  const lines: Line[] = [
    { label: "Receita Bruta de Vendas", values: MONTHLY.receitaBruta },
    { label: "(-) Deduções de Vendas (impostos)", values: MONTHLY.deducoes },
    {
      label: "(=) Receita Líquida",
      values: MONTHLY.receitaBruta.map((v, i) => v - MONTHLY.deducoes[i]),
    },
    { label: "(-) Custo dos Produtos Vendidos", values: MONTHLY.custos },
    {
      label: "(=) Lucro Bruto",
      values: MONTHLY.receitaBruta.map((v, i) => v - MONTHLY.deducoes[i] - MONTHLY.custos[i]),
    },
    { label: "(-) Despesas com Pessoal", values: MONTHLY.pessoal },
    { label: "(-) Despesas de Vendas", values: MONTHLY.vendas },
    { label: "(-) Despesas Administrativas", values: MONTHLY.administrativas },
    {
      label: "(=) EBITDA (resultado operacional)",
      values: MONTHLY.receitaBruta.map(
        (v, i) => v - MONTHLY.deducoes[i] - MONTHLY.custos[i] - MONTHLY.pessoal[i] - MONTHLY.vendas[i] - MONTHLY.administrativas[i]
      ),
    },
    { label: "(-) Despesas Financeiras", values: MONTHLY.despesasFinanceiras },
    {
      label: "(=) Lucro Líquido",
      values: MONTHLY.receitaBruta.map(
        (v, i) => v - MONTHLY.deducoes[i] - MONTHLY.custos[i] - MONTHLY.pessoal[i] - MONTHLY.vendas[i] - MONTHLY.administrativas[i] - MONTHLY.despesasFinanceiras[i]
      ),
    },
  ];
  return lines.map((line) => ({ ...line, totals: sum(line.values) }));
}

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#1e293b" },
  eyebrow: { fontSize: 9, color: "#1d4ed8", fontWeight: 700, marginBottom: 4, textTransform: "uppercase" },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 2 },
  subtitle: { fontSize: 10, color: "#64748b", marginBottom: 12 },
  table: { display: "flex", flexDirection: "column", borderWidth: 1, borderColor: "#e2e8f0" },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  labelCell: { flex: 2.2, padding: 6, fontSize: 9 },
  valueCell: { flex: 1, padding: 6, fontSize: 9, textAlign: "right" },
  headerCell: { flex: 1, padding: 6, fontSize: 8, fontWeight: 700, backgroundColor: "#f1f5f9", textAlign: "right" },
  labelHeaderCell: { flex: 2.2, padding: 6, fontSize: 8, fontWeight: 700, backgroundColor: "#f1f5f9" },
  footer: { marginTop: 14, fontSize: 8, color: "#94a3b8" },
});

function DreDocument() {
  const data = rows();
  return (
    <Document title="DRE - Demonstrativo do Resultado do Exercício">
      <Page size="A4" style={styles.page}>
        <Text style={styles.eyebrow}>Documento financeiro de teste</Text>
        <Text style={styles.title}>Demonstração do Resultado do Exercício (DRE)</Text>
        <Text style={styles.subtitle}>
          CNPJ 00.000.000/0001-00 · Período: Janeiro a Junho de 2026 · Valores em R$
        </Text>

        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.labelHeaderCell}>Conta</Text>
            {MONTHS.map((m) => (
              <Text key={m} style={styles.headerCell}>
                {m}
              </Text>
            ))}
            <Text style={[styles.headerCell, { backgroundColor: "#e2e8f0" }]}>Total</Text>
          </View>
          {data.map((line) => (
            <View key={line.label} style={styles.tableRow}>
              <Text style={styles.labelCell}>{line.label}</Text>
              {line.values.map((v, j) => (
                <Text key={j} style={styles.valueCell}>
                  {formatBRL(v)}
                </Text>
              ))}
              <Text style={[styles.valueCell, { fontWeight: 700 }]}>{formatBRL(line.totals)}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.footer}>
          Notas: documento gerado para testes do Classificador de Documentos e do Agente de Extração
          de Indicadores da ArcaOS. Valores fictícios.
        </Text>
      </Page>
    </Document>
  );
}

async function main() {
  const out = path.join(process.cwd(), "teste-dataroom-dre.pdf");
  await renderToFile(<DreDocument />, out);
  console.log(`PDF gerado em ${out}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
