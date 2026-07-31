-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'consultor',
    "title" TEXT NOT NULL DEFAULT '',
    "companyName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- Seed dos usuários mockados (antes viviam em lib/auth-users.ts, que foi
-- removido). O login agora lê do banco — sem esse seed, ninguém consegue
-- entrar depois do deploy. Senhas em texto puro de propósito: login mockado,
-- não um cofre de credenciais real.
INSERT INTO "User" ("id", "name", "email", "password", "role", "title", "companyName", "createdAt", "updatedAt") VALUES
('u1', 'Cauan Victor', 'cauan@arcaconsulting.com', 'arca123', 'admin', 'CEO / Head BTO', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('u2', 'Camila Torres', 'camila@arcaconsulting.com', 'arca123', 'admin', 'Head de Produto', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('u6', 'Cícero Pereira', 'cicero@arcaconsulting.com', 'arca123', 'admin', 'CEO / Head BTO', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('u3', 'Marcos Prado', 'marcos@arcaconsulting.com', 'arca123', 'consultor', 'Consultor Líder / Agente PMO Ágil', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('u4', 'Beatriz Lima', 'beatriz@arcaconsulting.com', 'arca123', 'consultor', 'Analista de Dados / Curadora de IA', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('u5', 'Roberto Off', 'roberto@oticavisaoclara.com.br', 'cliente123', 'cliente', 'Sponsor do Cliente — Ótica Visão Clara', 'Ótica Visão Clara', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
