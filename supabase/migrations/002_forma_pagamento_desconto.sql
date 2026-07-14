-- Migração: adicionar forma_pagamento e desconto em lancamentos
-- Rode isso no SQL Editor do Supabase (projeto já existente)

alter table lancamentos add column if not exists forma_pagamento text;
alter table lancamentos add column if not exists desconto numeric(14,2) not null default 0;
