-- Migração: adicionar endereço/bairro/cidade em clientes e fornecedores
-- Rode isso no SQL Editor do Supabase (projeto já existente)

alter table clientes add column if not exists endereco text;
alter table clientes add column if not exists bairro text;
alter table clientes add column if not exists cidade text;

alter table fornecedores add column if not exists endereco text;
alter table fornecedores add column if not exists bairro text;
alter table fornecedores add column if not exists cidade text;
