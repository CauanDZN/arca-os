-- Marketing e Comunicação vira vertical própria (lib/verticals.ts), separada
-- de Comercial — o plano estratégico da Arca vende as duas como ofertas
-- distintas. Nenhuma coluna muda: Company.contractedVerticals continua um
-- JSON-encoded array de texto. Esta migration só faz backfill: toda empresa
-- que já tinha "comercial" contratado (o que antes dava acesso a Comercial +
-- Marketing + Atendimento juntos) ganha "marketing" também, pra não perder
-- acesso a um módulo que já usava.
UPDATE "Company"
SET "contractedVerticals" = (
  SELECT to_jsonb(array_agg(DISTINCT elem))::text
  FROM (
    SELECT jsonb_array_elements_text("contractedVerticals"::jsonb) AS elem
    UNION ALL
    SELECT 'marketing'
  ) t
)
WHERE "contractedVerticals"::jsonb @> '["comercial"]'::jsonb
  AND NOT ("contractedVerticals"::jsonb @> '["marketing"]'::jsonb);
