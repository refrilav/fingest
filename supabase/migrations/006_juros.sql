-- Migração: campo de juros/acréscimos em lancamentos (complementa o desconto que já existe)
-- Rode isso no SQL Editor do Supabase (projeto já existente)

alter table lancamentos add column if not exists juros numeric(14,2) not null default 0;
