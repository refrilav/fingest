-- Migração: suporte a parcelamento e recorrência em lancamentos
-- Rode isso no SQL Editor do Supabase (projeto já existente)

alter table lancamentos add column if not exists grupo_id uuid;
alter table lancamentos add column if not exists numero_parcela int;
alter table lancamentos add column if not exists total_parcelas int;

create index if not exists idx_lancamentos_grupo on lancamentos(grupo_id);
