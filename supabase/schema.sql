-- =========================================================
-- FinGest — Schema inicial (Fase 1 + Fase 2)
-- Sistema de gestão financeira, mono-empresa (Refrilav)
-- =========================================================

-- Extensão para UUID
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- Plano de contas (categorias de receita/despesa, hierárquico)
-- ---------------------------------------------------------
create table categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null check (tipo in ('receita', 'despesa')),
  categoria_pai_id uuid references categorias(id) on delete set null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- Centros de custo (ex: Oficina, Administrativo, Comercial)
-- ---------------------------------------------------------
create table centros_de_custo (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- Fornecedores
-- ---------------------------------------------------------
create table fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  documento text, -- CPF ou CNPJ
  telefone text,
  email text,
  observacoes text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------
create table clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  documento text, -- CPF ou CNPJ
  telefone text,
  email text,
  observacoes text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- Contas bancárias
-- ---------------------------------------------------------
create table contas_bancarias (
  id uuid primary key default gen_random_uuid(),
  nome text not null, -- ex: "Sicredi CC", "Caixinha"
  banco text,
  agencia text,
  numero_conta text,
  saldo_inicial numeric(14,2) not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- Lançamentos (contas a pagar / receber)
-- ---------------------------------------------------------
create table lancamentos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('pagar', 'receber')),
  descricao text not null,
  valor numeric(14,2) not null,
  valor_pago numeric(14,2) not null default 0,
  status text not null default 'aberto' check (status in ('aberto', 'pago', 'vencido', 'cancelado')),

  -- Datas como string 'YYYY-MM-DD' (sem hora) — convenção do projeto
  data_vencimento date not null,
  data_pagamento date,
  data_competencia date, -- data de referência contábil/gerencial (para DRE)

  categoria_id uuid references categorias(id) on delete set null,
  centro_custo_id uuid references centros_de_custo(id) on delete set null,
  fornecedor_id uuid references fornecedores(id) on delete set null,
  cliente_id uuid references clientes(id) on delete set null,
  conta_bancaria_id uuid references contas_bancarias(id) on delete set null,

  recorrente boolean not null default false,
  observacoes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- regra: lançamento de "pagar" deve ter fornecedor OU nenhum; "receber" deve ter cliente OU nenhum
  constraint chk_tipo_pessoa check (
    (tipo = 'pagar' and cliente_id is null) or
    (tipo = 'receber' and fornecedor_id is null)
  )
);

create index idx_lancamentos_status on lancamentos(status);
create index idx_lancamentos_vencimento on lancamentos(data_vencimento);
create index idx_lancamentos_tipo on lancamentos(tipo);

-- ---------------------------------------------------------
-- Transações bancárias importadas (extrato OFX)
-- ---------------------------------------------------------
create table transacoes_bancarias (
  id uuid primary key default gen_random_uuid(),
  conta_bancaria_id uuid not null references contas_bancarias(id) on delete cascade,
  fitid text not null, -- identificador único do OFX, usado para dedupe
  data date not null,
  valor numeric(14,2) not null, -- positivo = crédito, negativo = débito
  descricao text,
  conciliado boolean not null default false,
  lancamento_id uuid references lancamentos(id) on delete set null,
  created_at timestamptz not null default now(),

  unique (conta_bancaria_id, fitid)
);

create index idx_transacoes_conciliado on transacoes_bancarias(conciliado);

-- ---------------------------------------------------------
-- Orçamentos (previsto por categoria/mês)
-- ---------------------------------------------------------
create table orcamentos (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references categorias(id) on delete cascade,
  ano int not null,
  mes int not null check (mes between 1 and 12),
  valor_previsto numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),

  unique (categoria_id, ano, mes)
);

-- =========================================================
-- RLS — mono-empresa, mono-usuário autenticado (você + eventuais
-- usuários da família/equipe). Ajuste as policies se quiser
-- granularidade por usuário no futuro.
-- =========================================================

alter table categorias enable row level security;
alter table centros_de_custo enable row level security;
alter table fornecedores enable row level security;
alter table clientes enable row level security;
alter table contas_bancarias enable row level security;
alter table lancamentos enable row level security;
alter table transacoes_bancarias enable row level security;
alter table orcamentos enable row level security;

-- Policy padrão: qualquer usuário autenticado pode ler/escrever tudo.
-- (Sistema mono-empresa, não precisa de isolamento por linha)
create policy "authenticated_full_access" on categorias for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access" on centros_de_custo for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access" on fornecedores for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access" on clientes for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access" on contas_bancarias for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access" on lancamentos for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access" on transacoes_bancarias for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access" on orcamentos for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- =========================================================
-- Seed inicial de categorias (opcional, ajuste como preferir)
-- =========================================================
insert into categorias (nome, tipo) values
  ('Serviços prestados', 'receita'),
  ('Vendas de peças', 'receita'),
  ('Outras receitas', 'receita'),
  ('Peças e materiais', 'despesa'),
  ('Combustível', 'despesa'),
  ('Salários e encargos', 'despesa'),
  ('Aluguel', 'despesa'),
  ('Marketing', 'despesa'),
  ('Impostos', 'despesa'),
  ('Outras despesas', 'despesa');

insert into centros_de_custo (nome) values
  ('Oficina/Campo'),
  ('Administrativo'),
  ('Comercial');
