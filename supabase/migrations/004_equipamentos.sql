-- Migração: cadastro de equipamentos + vínculo em lancamentos (contas a receber)
-- Rode isso no SQL Editor do Supabase (projeto já existente)

create table if not exists equipamentos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table equipamentos enable row level security;
create policy "authenticated_full_access" on equipamentos for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table lancamentos add column if not exists equipamento_id uuid references equipamentos(id) on delete set null;

-- Seed inicial baseado nos equipamentos mais comuns da Refrilav
insert into equipamentos (nome) values
  ('Ar-condicionado'),
  ('Lavadora'),
  ('Secadora'),
  ('Microondas'),
  ('Geladeira'),
  ('Freezer')
on conflict do nothing;
