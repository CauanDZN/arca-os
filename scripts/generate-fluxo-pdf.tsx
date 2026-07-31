import path from "path";
import { Document, Page, Text, View, StyleSheet, renderToFile } from "@react-pdf/renderer";

// Gera um PDF apresentando o fluxo ponta a ponta da ArcaOS, para enviar ao
// Cícero junto com o link do site.
//
// Uso: npx tsx scripts/generate-fluxo-pdf.tsx
// Saída: arcaos-fluxo-da-aplicacao.pdf na raiz do projeto.

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#1e293b" },
  eyebrow: { fontSize: 9, color: "#1d4ed8", fontWeight: 700, marginBottom: 4, textTransform: "uppercase" },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#64748b", marginBottom: 18 },
  sectionTitle: { fontSize: 12, fontWeight: 700, color: "#1e293b", marginTop: 14, marginBottom: 6 },
  step: { flexDirection: "row", marginBottom: 8 },
  stepNumber: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#1d4ed8",
    color: "#ffffff",
    fontSize: 10,
    fontWeight: 700,
    textAlign: "center",
    lineHeight: 18,
    marginRight: 8,
    marginTop: 1,
  },
  stepBody: { flex: 1 },
  stepTitle: { fontSize: 10, fontWeight: 700, marginBottom: 2 },
  stepDesc: { fontSize: 9, color: "#475569", lineHeight: 1.5 },
  bullet: { flexDirection: "row", marginBottom: 4 },
  bulletMark: { width: 10, fontSize: 9, color: "#1d4ed8" },
  bulletText: { flex: 1, fontSize: 9, color: "#475569", lineHeight: 1.5 },
  footer: { marginTop: 18, fontSize: 8, color: "#94a3b8" },
  card: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 6,
    padding: 10,
    marginTop: 6,
  },
});

const CYCLE = ["Diagnosticar", "Priorizar", "Executar", "Medir"];

const STEPS = [
  {
    title: "Cadastro da empresa",
    desc: "Dados da empresa, segmento e o objetivo do diagnóstico. O vínculo do cliente a uma empresa real é o que abre o Portal do Cliente.",
  },
  {
    title: "Diagnóstico 360",
    desc: "Questionário em 12 áreas de gestão, agrupadas nas 8 verticais da Arca, com cerca de 140 perguntas e escala de maturidade de 0 a 5. Cada pergunta pede evidência, responsável, impacto, urgência e risco.",
  },
  {
    title: "Relatório Executivo",
    desc: "Nota geral e por área, Nível de Maturidade de 1 a 5 (de Empresa informal a Empresa escalável), médias das 8 verticais, diagnóstico analítico com narrativa gerada por IA, priorização e plano de ação em 30/90/365 dias. Exportável em PDF.",
  },
  {
    title: "Aprovação do Plano de Ação",
    desc: "O plano aprovado vira um projeto Kanban (A Fazer, Em Andamento, Concluído), com tarefas que têm responsável, prazo e prioridade.",
  },
  {
    title: "Execução e Medição",
    desc: "Acompanhamento das tarefas, Data Room com documentos, indicadores (KPIs) e reuniões com atas. O histórico entre diagnósticos mostra a evolução da maturidade.",
  },
  {
    title: "Gestão Contínua",
    desc: "Relatório Mensal automático do Comitê de Gestão (gerado no dia 1 de cada mês) e Portal do Cliente com pendências, histórico de decisões e comunicação com a Arca.",
  },
];

const ROLES = [
  { role: "Admin", desc: "Gestão de usuários e visão completa da carteira de empresas." },
  { role: "Consultor", desc: "Acesso à carteira, empresas, diagnósticos e relatórios." },
  { role: "Cliente", desc: "Acesso apenas à própria empresa, ao seu relatório e ao Portal do Cliente." },
];

const AUTOMATIONS = [
  "Relatório Mensal gerado automaticamente no dia 1 de cada mês (cron), alimentando o Comitê de Gestão.",
  "Narrativa consultiva do relatório gerada por IA (Gemini), com fallback automático quando não há chave configurada.",
  "Classificação automática de documentos do Data Room por área e extração de sugestões de indicadores.",
];

function FluxoDocument() {
  return (
    <Document title="ArcaOS - Fluxo da Aplicação">
      <Page size="A4" style={styles.page}>
        <Text style={styles.eyebrow}>Arca Consulting</Text>
        <Text style={styles.title}>ArcaOS — Fluxo da Aplicação</Text>
        <Text style={styles.subtitle}>
          Plataforma digital de diagnóstico e gestão contínua para PMEs · https://arcaos.vercel.app
        </Text>

        <Text style={styles.sectionTitle}>O ciclo</Text>
        <View style={styles.card}>
          <Text style={{ fontSize: 10, fontWeight: 700, textAlign: "center" }}>
            {CYCLE.join("  ·  ")}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Passo a passo</Text>
        {STEPS.map((step, i) => (
          <View key={step.title} style={styles.step} wrap={false}>
            <Text style={styles.stepNumber}>{i + 1}</Text>
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepDesc}>{step.desc}</Text>
            </View>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Papéis e acesso</Text>
        {ROLES.map((item) => (
          <View key={item.role} style={styles.bullet}>
            <Text style={styles.bulletMark}>•</Text>
            <Text style={styles.bulletText}>
              <Text style={{ fontWeight: 700 }}>{item.role}</Text>
              {" — "}
              {item.desc}
            </Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Automações</Text>
        {AUTOMATIONS.map((item) => (
          <View key={item} style={styles.bullet}>
            <Text style={styles.bulletMark}>•</Text>
            <Text style={styles.bulletText}>{item}</Text>
          </View>
        ))}

        <Text style={styles.footer}>
          Documento de apresentação do MVP da ArcaOS — gerado automaticamente pelo projeto.
        </Text>
      </Page>
    </Document>
  );
}

async function main() {
  const out = path.join(process.cwd(), "arcaos-fluxo-da-aplicacao.pdf");
  await renderToFile(<FluxoDocument />, out);
  console.log(`PDF gerado em ${out}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
