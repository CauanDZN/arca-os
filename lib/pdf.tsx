import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Report } from "@/lib/scoring";
import type { AiNarrative } from "@/lib/ai";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#1e293b" },
  eyebrow: { fontSize: 9, color: "#1d4ed8", fontWeight: 700, marginBottom: 4, textTransform: "uppercase" },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: 700, marginTop: 18, marginBottom: 8 },
  paragraph: { fontSize: 10, lineHeight: 1.5, marginBottom: 6 },
  table: { display: "flex", flexDirection: "column", borderWidth: 1, borderColor: "#e2e8f0" },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  tableHeaderCell: { flex: 1, padding: 6, fontSize: 9, fontWeight: 700, backgroundColor: "#f1f5f9" },
  tableCell: { flex: 1, padding: 6, fontSize: 9 },
  badge: { fontSize: 8, fontWeight: 700, paddingHorizontal: 4, paddingVertical: 2 },
  actionItem: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 4, padding: 8, marginBottom: 6 },
  actionArea: { fontSize: 8, color: "#64748b" },
  actionTitle: { fontSize: 10, fontWeight: 700, marginTop: 2 },
});

function ReportDocument({
  companyName,
  segment,
  objectives,
  report,
  aiNarrative,
}: {
  companyName: string;
  segment: string;
  objectives: string[];
  report: Report;
  aiNarrative: AiNarrative | null;
}) {
  const insightByArea = new Map((aiNarrative?.areaInsights ?? []).map((i) => [i.areaKey, i]));

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.eyebrow}>Relatório Executivo · Arca Scan 360</Text>
        <Text style={styles.title}>{companyName}</Text>
        <Text style={styles.paragraph}>
          Segmento: {segment || "—"} · Objetivo: {objectives.join(", ") || "—"}
        </Text>
        <Text style={styles.paragraph}>
          Nota geral de maturidade: {report.overallAverage.toFixed(1)}/5 ({report.overallStatus})
        </Text>

        {aiNarrative && (
          <>
            <Text style={styles.sectionTitle}>Sumário Executivo</Text>
            <Text style={styles.paragraph}>{aiNarrative.executiveSummary}</Text>
          </>
        )}

        <Text style={styles.sectionTitle}>Mapa de Maturidade por Área</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableHeaderCell}>Área</Text>
            <Text style={[styles.tableHeaderCell, { flex: 0.4 }]}>Nota</Text>
            <Text style={styles.tableHeaderCell}>Status</Text>
          </View>
          {report.areaScores.map((a) => (
            <View style={styles.tableRow} key={a.area.key}>
              <Text style={styles.tableCell}>{a.area.name}</Text>
              <Text style={[styles.tableCell, { flex: 0.4 }]}>{a.average.toFixed(1)}</Text>
              <Text style={styles.tableCell}>{a.status}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Diagnóstico Analítico</Text>
        {report.areaScores
          .filter((a) => a.weakestQuestions.length > 0)
          .map((a) => {
            const insight = insightByArea.get(a.area.key);
            return (
              <View key={a.area.key} style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: 700 }}>{a.area.name}</Text>
                {a.weakestQuestions.map((q) => (
                  <Text key={q.text} style={styles.paragraph}>
                    • {q.text} (nota {q.score})
                  </Text>
                ))}
                {insight && (
                  <>
                    <Text style={styles.paragraph}>Causa raiz: {insight.causaRaiz}</Text>
                    <Text style={styles.paragraph}>Recomendação da Arca: {insight.recomendacao}</Text>
                  </>
                )}
              </View>
            );
          })}
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Matriz de Priorização</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableHeaderCell}>Área</Text>
            <Text style={[styles.tableHeaderCell, { flex: 0.4 }]}>Nota</Text>
            <Text style={styles.tableHeaderCell}>Classificação</Text>
          </View>
          {report.priorityMatrix.map((p) => (
            <View style={styles.tableRow} key={p.areaKey}>
              <Text style={styles.tableCell}>{p.areaName}</Text>
              <Text style={[styles.tableCell, { flex: 0.4 }]}>{p.average.toFixed(1)}</Text>
              <Text style={styles.tableCell}>{p.classification}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Plano de Ação Recomendado</Text>
        {[
          { title: "Primeiros 30 dias", items: report.actionPlan.days30 },
          { title: "31 a 90 dias", items: report.actionPlan.days90 },
          { title: "3 a 12 meses", items: report.actionPlan.months12 },
        ].map(
          (block) =>
            block.items.length > 0 && (
              <View key={block.title} style={{ marginBottom: 10 }}>
                <Text style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>{block.title}</Text>
                {block.items.map((item, i) => (
                  <View key={i} style={styles.actionItem}>
                    <Text style={styles.actionArea}>
                      {item.areaName} · Prioridade {item.priority}
                    </Text>
                    <Text style={styles.actionTitle}>{item.action}</Text>
                  </View>
                ))}
              </View>
            )
        )}
      </Page>
    </Document>
  );
}

export async function renderReportPdf(props: {
  companyName: string;
  segment: string;
  objectives: string[];
  report: Report;
  aiNarrative: AiNarrative | null;
}): Promise<Buffer> {
  const { renderToBuffer } = await import("@react-pdf/renderer");
  return renderToBuffer(<ReportDocument {...props} />);
}
