-- AddUserCompanyRelation
-- Troca o companyName free-text (mock) por um vínculo real com a tabela Company.
-- O administrador escolhe a empresa na tela /usuarios; o login usa o companyId direto.

ALTER TABLE "User" ADD COLUMN "companyId" TEXT;

-- Backfill best-effort: liga usuários clientes à empresa de mesmo nome, se já existir.
UPDATE "User"
SET "companyId" = (SELECT "id" FROM "Company" WHERE "Company"."name" = "User"."companyName" LIMIT 1)
WHERE "User"."companyName" IS NOT NULL;

CREATE INDEX "User_companyId_idx" ON "User"("companyId");

ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "User" DROP COLUMN "companyName";
