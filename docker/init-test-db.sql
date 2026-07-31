-- Roda uma única vez, quando o volume de dados do Postgres é criado pela
-- primeira vez (Postgres oficial executa tudo em /docker-entrypoint-initdb.d
-- nesse momento). Cria o banco de testes ao lado do banco de dev
-- (POSTGRES_DB do docker-compose.yml), pra vitest.config.ts nunca apontar
-- pro mesmo banco que você está usando no npm run dev.
CREATE DATABASE arcaos_test;
