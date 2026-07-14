# FinGest — Gestão Financeira Refrilav

Sistema de gestão financeira inspirado no Nibo (sem emissão de NFS-e), construído sob medida
para a Refrilav. Mono-empresa.

## Stack
- React 18 + Vite
- Tailwind CSS v4
- Supabase (Postgres + Auth + RLS)
- React Router
- lucide-react (ícones), recharts (gráficos, fase de relatórios), xlsx (exportação Excel)

## Status do projeto (fases)

- ✅ **Fase 1** — Fundação: categorias (plano de contas), centros de custo, fornecedores, clientes
- ✅ **Fase 2** — Núcleo financeiro: lançamentos (contas a pagar/receber), dashboard
- ⏳ **Fase 3** — Bancário: contas bancárias (feito) + conciliação com importação OFX (pendente)
- ⏳ **Fase 4** — Relatórios: DRE, orçado x realizado, exportação Excel (pendente)
- ⏳ **Fase 5** — Cobrança: régua de vencimento, status de cobrança (pendente)

## Setup

### 1. Criar o projeto no Supabase
1. Acesse https://supabase.com e crie um novo projeto.
2. Vá em **SQL Editor** e rode o conteúdo de `supabase/schema.sql`.
3. Vá em **Authentication > Providers** e habilite o método de login que preferir (e-mail/senha é o
   mais simples para uso próprio). Crie seu usuário em **Authentication > Users**.
4. Vá em **Project Settings > API** e copie a **Project URL** e a **anon public key**.

### 2. Configurar variáveis de ambiente
```bash
cp .env.example .env.local
```
Edite `.env.local` e cole a URL e a chave do passo anterior.

### 3. Rodar localmente
```bash
npm install
npm run dev
```

### 4. Deploy (Vercel)
1. Suba este projeto para um repositório novo no GitHub.
2. Importe o repositório na Vercel.
3. Configure as variáveis de ambiente `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no painel da
   Vercel (Project Settings > Environment Variables).
4. Deploy.

## Convenções do projeto (importante para manter consistência)

- **Datas**: sempre como string `YYYY-MM-DD` (ou `YYYY-MM-DDTHH:mm` quando houver hora). Nunca usar
  `new Date(str)` para exibir — sempre fatiar a própria string (ver `src/lib/format.js`).
- **Listas grandes do Supabase**: sempre usar `.range(0, 9999)` para evitar o limite padrão de 1000
  linhas.
- **Autenticação**: ainda não há tela de login neste MVP — o `supabase.js` já está pronto para
  chamadas autenticadas via RLS, falta adicionar a tela. Aviso que farei isso antes do primeiro uso
  real, junto com a Fase 3.

## Estrutura de pastas
```
src/
  components/   → Layout, componentes reutilizáveis
  lib/           → cliente Supabase, formatação de datas/moeda
  pages/         → uma página por rota
supabase/
  schema.sql    → schema completo do banco (tabelas + RLS + seed)
```
