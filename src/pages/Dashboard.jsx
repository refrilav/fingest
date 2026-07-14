import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatCurrencyBRL, formatDateBR, todayISO, isOverdue, getRangeMes, mesAtualISO } from '../lib/format'
import { ArrowUpCircle, ArrowDownCircle, AlertTriangle, Wallet } from 'lucide-react'

export default function Dashboard() {
  const [resumo, setResumo] = useState(null)
  const [proximosPagar, setProximosPagar] = useState([])
  const [proximosReceber, setProximosReceber] = useState([])
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState(mesAtualISO()) // 'YYYY-MM' ou 'todos'

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      const hoje = todayISO()

      let queryPagar = supabase.from('lancamentos').select('valor, data_vencimento').eq('tipo', 'pagar').eq('status', 'aberto')
      let queryReceber = supabase.from('lancamentos').select('valor, data_vencimento').eq('tipo', 'receber').eq('status', 'aberto')
      let queryProxPagar = supabase.from('lancamentos').select('*, fornecedores(nome)').eq('tipo', 'pagar').eq('status', 'aberto').order('data_vencimento')
      let queryProxReceber = supabase.from('lancamentos').select('*, clientes(nome)').eq('tipo', 'receber').eq('status', 'aberto').order('data_vencimento')

      if (periodo !== 'todos') {
        const { inicio, fim } = getRangeMes(periodo)
        queryPagar = queryPagar.gte('data_vencimento', inicio).lte('data_vencimento', fim)
        queryReceber = queryReceber.gte('data_vencimento', inicio).lte('data_vencimento', fim)
        queryProxPagar = queryProxPagar.gte('data_vencimento', inicio).lte('data_vencimento', fim)
        queryProxReceber = queryProxReceber.gte('data_vencimento', inicio).lte('data_vencimento', fim)
      }

      const [contas, aPagarAberto, aReceberAberto, prox5Pagar, prox5Receber] = await Promise.all([
        supabase.from('contas_bancarias').select('saldo_inicial').eq('ativo', true),
        queryPagar.range(0, 9999),
        queryReceber.range(0, 9999),
        queryProxPagar.limit(5),
        queryProxReceber.limit(5),
      ])

      const saldoContas = (contas.data || []).reduce((acc, c) => acc + Number(c.saldo_inicial), 0)
      const totalPagar = (aPagarAberto.data || []).reduce((acc, l) => acc + Number(l.valor), 0)
      const totalReceber = (aReceberAberto.data || []).reduce((acc, l) => acc + Number(l.valor), 0)
      const vencidosPagar = (aPagarAberto.data || []).filter((l) => isOverdue(l.data_vencimento, hoje)).length
      const vencidosReceber = (aReceberAberto.data || []).filter((l) => isOverdue(l.data_vencimento, hoje)).length

      setResumo({ saldoContas, totalPagar, totalReceber, vencidosPagar, vencidosReceber })
      setProximosPagar(prox5Pagar.data || [])
      setProximosReceber(prox5Receber.data || [])
      setLoading(false)
    }
    carregar()
  }, [periodo])

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={periodo === 'todos' ? '' : periodo}
            onChange={(e) => setPeriodo(e.target.value || mesAtualISO())}
            disabled={periodo === 'todos'}
            className="rounded-lg border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-100 disabled:text-gray-400"
          />
          <label className="flex items-center gap-1 text-xs text-gray-500">
            <input
              type="checkbox"
              checked={periodo === 'todos'}
              onChange={(e) => setPeriodo(e.target.checked ? 'todos' : mesAtualISO())}
            />
            Todos os períodos
          </label>
        </div>
      </div>

      {loading || !resumo ? (
        <p className="text-gray-400 text-sm">Carregando dashboard...</p>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4 mb-8">
            <Card
              icon={Wallet}
              label="Saldo em contas"
              value={formatCurrencyBRL(resumo.saldoContas)}
              color="text-primary-600 bg-primary-50"
            />
            <Card
              icon={ArrowUpCircle}
              label={periodo === 'todos' ? 'A pagar (aberto)' : 'A pagar no mês (aberto)'}
              value={formatCurrencyBRL(resumo.totalPagar)}
              color="text-red-600 bg-red-50"
              sub={resumo.vencidosPagar > 0 ? `${resumo.vencidosPagar} vencido(s)` : null}
            />
            <Card
              icon={ArrowDownCircle}
              label={periodo === 'todos' ? 'A receber (aberto)' : 'A receber no mês (aberto)'}
              value={formatCurrencyBRL(resumo.totalReceber)}
              color="text-green-600 bg-green-50"
              sub={resumo.vencidosReceber > 0 ? `${resumo.vencidosReceber} vencido(s)` : null}
            />
            <Card
              icon={AlertTriangle}
              label="Saldo projetado"
              value={formatCurrencyBRL(resumo.saldoContas + resumo.totalReceber - resumo.totalPagar)}
              color="text-gray-700 bg-gray-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <ListaResumo titulo="Próximos a pagar" itens={proximosPagar} pessoaKey="fornecedores" />
            <ListaResumo titulo="Próximos a receber" itens={proximosReceber} pessoaKey="clientes" />
          </div>
        </>
      )}
    </div>
  )
}

function Card({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className={`inline-flex p-2 rounded-lg ${color} mb-3`}>
        <Icon size={18} />
      </div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-red-500 mt-1">{sub}</p>}
    </div>
  )
}

function ListaResumo({ titulo, itens, pessoaKey }) {
  return (
    <div>
      <h3 className="font-semibold text-gray-700 mb-2 text-sm">{titulo}</h3>
      <ul className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
        {itens.map((item) => (
          <li key={item.id} className="flex items-center justify-between px-3 py-2">
            <div>
              <p className="text-sm text-gray-800">{item.descricao}</p>
              <p className="text-xs text-gray-500">
                {formatDateBR(item.data_vencimento)}
                {item[pessoaKey]?.nome ? ` · ${item[pessoaKey].nome}` : ''}
              </p>
            </div>
            <span className="text-sm font-medium text-gray-700">{formatCurrencyBRL(item.valor)}</span>
          </li>
        ))}
        {itens.length === 0 && <li className="px-3 py-3 text-sm text-gray-400">Nada por aqui.</li>}
      </ul>
    </div>
  )
}
