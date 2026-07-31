-- Remove do seed os usuários que não devem existir por padrão. O seed original
-- (migration add_users) já foi aplicado na produção, então editar aquele arquivo
-- não mudaria bancos existentes — esta migration é o jeito seguro de alinhar todos
-- os ambientes: em banco novo (teste/ambiente novo) apaga logo depois do seed; em
-- banco que já foi limpo manualmente, o DELETE não encontra nada (idempotente).
DELETE FROM "User"
WHERE "email" IN (
  'camila@arcaconsulting.com',
  'marcos@arcaconsulting.com',
  'beatriz@arcaconsulting.com',
  'roberto@oticavisaoclara.com.br'
);
