import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { formatDateBR, formatCurrencyBRL, mesAtualISO, getRangeMes } from '../lib/format'
import { ArrowLeft, Download, ArrowUpCircle, ArrowDownCircle, ArrowLeftRight, SlidersHorizontal } from 'lucide-react'

export default function ExtratoConta() {
  const { id } = useParams()
  const [conta, setConta] = useState(null)
  const [movimentos, setMovimentos] = useState([])
  const [periodo, setPeriodo] = useState('todos') // 'YYYY-MM' ou 'todos'
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      setErro(null)

      const [contaRes, lancRes, transfOrigemRes, transfDestinoRes, ajustesRes] = await Promise.all([
        supabase.from('contas_bancarias').select('*').eq('id', id).single(),
        supabase
          .from('lancamentos')
          .select('descricao, tipo, valor_pago, data_pagamento')
          .eq('conta_bancaria_id', id)
          .eq('status', 'pago')
          .range(0, 9999),
        supabase
          .from('transferencias')
          .select('valor, data, observacoes, destino:contas_bancarias!transferencias_conta_destino_id_fkey(nome)')
          .eq('conta_origem_id', id)
          .range(0, 9999),
        supabase
          .from('transferencias')
          .select('valor, data, observacoes, origem:contas_bancarias!transferencias_conta_origem_id_fkey(nome)')
          .eq('conta_destino_id', id)
          .range(0, 9999),
        supabase.from('ajustes_saldo').select('valor, data, motivo, observacoes').eq('conta_bancaria_id', id).range(0, 9999),
      ])

      if (contaRes.error) {
        setErro(contaRes.error.message)
        setLoading(false)
        return
      }
      setConta(contaRes.data)

      const todos = []

      for (const l of lancRes.data || []) {
        todos.push({
          data: l.data_pagamento,
          descricao: l.descricao,
          tipoIcone: l.tipo === 'receber' ? 'entrada' : 'saida',
          categoria: l.tipo === 'receber' ? 'Recebimento' : 'Pagamento',
          valor: l.tipo === 'receber' ? Number(l.valor_pago) : -Number(l.valor_pago),
        })
      }

      for (const t of transfOrigemRes.data || []) {
        todos.push({
          data: t.data,
          descricao: `Transferência enviada → ${t.destino?.nome || '?'}${t.observacoes ? ` (${t.observacoes})` : ''}`,
          tipoIcone: 'transferencia',
          categoria: 'Transferência',
          valor: -Number(t.valor),
        })
      }

      for (const t of transfDestinoRes.data || []) {
        todos.push({
          data: t.data,
          descricao: `Transferência recebida de ${t.origem?.nome || '?'}${t.observacoes ? ` (${t.observacoes})` : ''}`,
          tipoIcone: 'transferencia',
          categoria: 'Transferência',
          valor: Number(t.valor),
        })
      }

      for (const a of ajustesRes.data || []) {
        todos.push({
          data: a.data,
          descricao: `${a.motivo}${a.observacoes ? ` — ${a.observacoes}` : ''}`,
          tipoIcone: 'ajuste',
          categoria: 'Ajuste de saldo',
          valor: Number(a.valor),
        })
      }

      todos.sort((a, b) => (a.data || '').localeCompare(b.data || ''))

      // saldo acumulado a partir do saldo inicial, em ordem cronológica
      let acumulado = Number(contaRes.data.saldo_inicial)
      const comSaldo = todos.map((m) => {
        acumulado += m.valor
        return { ...m, saldoApos: acumulado }
      })

      setMovimentos(comSaldo.reverse()) // mostra mais recente primeiro
      setLoading(false)
    }
    carregar()
  }, [id])

  const movimentosFiltrados = movimentos.filter((m) => {
    if (periodo === 'todos') return true
    const { inicio, fim } = getRangeMes(periodo)
    const data = (m.data || '').substring(0, 10)
    return data >= inicio && data <= fim
  })

  const saldoAtual = movimentos.length > 0 ? movimentos[0].saldoApos : Number(conta?.saldo_inicial || 0)

  function exportarExcel() {
    const linhas = [['Data', 'Descrição', 'Categoria', 'Valor', 'Saldo Após']]
    // exporta em ordem cronológica (mais antigo primeiro), mais natural pra planilha
    ;[...movimentosFiltrados].reverse().forEach((m) => {
      linhas.push([formatDateBR(m.data), m.descricao, m.categoria, m.valor, m.saldoApos])
    })
    const ws = XLSX.utils.aoa_to_sheet(linhas)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Extrato')
    XLSX.writeFile(wb, `Extrato_${conta?.nome || 'conta'}.xlsx`)
  }

  if (loading) return <p className="text-gray-400 text-sm">Carregando...</p>
  if (erro) return <div className="rounded-lg bg-red-50 text-red-700 text-sm px-4 py-2 max-w-lg">{erro}</div>

  return (
    <div className="max-w-4xl">
      <Link to="/contas-bancarias" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Voltar para Contas Bancárias
      </Link>

      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{conta?.nome}</h2>
          <p className="text-gray-500 text-sm">
            Saldo atual: <span className="font-semibold text-gray-800">{formatCurrencyBRL(saldoAtual)}</span>
          </p>
        </div>
        <button
          onClick={exportarExcel}
          className="flex items-center gap-1 rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700"
        >
          <Download size={16} /> Exportar Excel
        </button>
      </div>

      <div className="flex items-center gap-2 my-4">
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

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
              <th className="px-4 py-2">Data</th>
              <th className="px-4 py-2">Descrição</th>
              <th className="px-4 py-2">Tipo</th>
              <th className="px-4 py-2 text-right">Valor</th>
              <th className="px-4 py-2 text-right">Saldo após</th>
            </tr>
          </thead>
          <tbody>
            {movimentosFiltrados.map((m, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-2 whitespace-nowrap text-gray-600">{formatDateBR(m.data)}</td>
                <td className="px-4 py-2 text-gray-800">{m.descricao}</td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <IconeTipo tipo={m.tipoIcone} categoria={m.categoria} />
                </td>
                <td className={`px-4 py-2 text-right whitespace-nowrap font-medium ${m.valor < 0 ? 'text-red-600' : 'text-green-700'}`}>
                  {m.valor > 0 ? '+' : ''}
                  {formatCurrencyBRL(m.valor)}
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap font-semibold text-gray-800">
                  {formatCurrencyBRL(m.saldoApos)}
                </td>
              </tr>
            ))}
            {movimentosFiltrados.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-center text-gray-400 text-sm">
                  Nenhuma movimentação nesse período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function IconeTipo({ tipo, categoria }) {
  const map = {
    entrada: { icon: ArrowDownCircle, color: 'text-green-600' },
    saida: { icon: ArrowUpCircle, color: 'text-red-600' },
    transferencia: { icon: ArrowLeftRight, color: 'text-primary-600' },
    ajuste: { icon: SlidersHorizontal, color: 'text-amber-600' },
  }
  const { icon: Icon, color } = map[tipo] || map.ajuste
  return (
    <span className={`flex items-center gap-1 text-xs ${color}`}>
      <Icon size={14} /> {categoria}
    </span>
  )
}
