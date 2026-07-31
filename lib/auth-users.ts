import type { Role } from "@/lib/session";

export type MockUser = {
  id: string;
  name: string;
  email: string;
  password: string; // plaintext on purpose — mocked login, not a real credential store
  role: Role;
  title: string; // cargo na visão organizacional da Arca (seção 16 do pitch do Cícero)
  companyName?: string; // só para role "cliente" — resolvido para um companyId real no login
};

/**
 * Colapsa a estrutura organizacional completa do pitch (CEO/Head BTO, Head de
 * Produto, Head de Operações, Consultores Líderes, Especialistas Verticais,
 * PMO Ágil, Analistas de Dados, Curadores de IA, Customer Success de um lado;
 * Sponsor do Cliente e Donos de Área do outro) em 3 níveis de permissão —
 * admin / consultor / cliente — mas mantém o cargo original em `title` pra
 * cada usuário mockado refletir a visão real.
 */
export const MOCK_USERS: MockUser[] = [
  {
    id: "u1",
    name: "Cauan Victor",
    email: "cauan@arcaconsulting.com",
    password: "arca123",
    role: "admin",
    title: "CEO / Head BTO",
  },
  {
    id: "u2",
    name: "Camila Torres",
    email: "camila@arcaconsulting.com",
    password: "arca123",
    role: "admin",
    title: "Head de Produto",
  },
  {
    id: "u3",
    name: "Marcos Prado",
    email: "marcos@arcaconsulting.com",
    password: "arca123",
    role: "consultor",
    title: "Consultor Líder / Agente PMO Ágil",
  },
  {
    id: "u4",
    name: "Beatriz Lima",
    email: "beatriz@arcaconsulting.com",
    password: "arca123",
    role: "consultor",
    title: "Analista de Dados / Curadora de IA",
  },
  {
    id: "u5",
    name: "Roberto Off",
    email: "roberto@oticavisaoclara.com.br",
    password: "cliente123",
    role: "cliente",
    title: "Sponsor do Cliente — Ótica Visão Clara",
    companyName: "Ótica Visão Clara",
  },
];
