import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { formatCurrencyBRL, formatDateBR, todayISO } from '../lib/format'
import { Wallet, Download } from 'lucide-react'

// Primeiro e último dia do mês atual, como ponto de partida padrão
function primeiroDiaMesAtual() {
  return todayISO().substring(0, 7) + '-01'
}
function ultimoDiaMesAtual() {
  const hoje = new Date()
  const ultimo = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth() + 1, 0))
  return ultimo.toISOString().substring(0, 10)
}

export default function FluxoCaixa() {
  const [dataInicio, setDataInicio] = useState(primeiroDiaMesAtual())
  const [dataFim, setDataFim] = useState(ultimoDiaMesAtual())
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [saldoInicial, setSaldoInicial] = useState(0)
  const [movimentos, setMovimentos] = useState([])

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      setErro(null)

      const [contasRes, lancAntesRes, ajustesAntesRes, lancPeriodoRes, ajustesPeriodoRes] = await Promise.all([
        supabase.from('contas_bancarias').select('saldo_inicial').eq('ativo', true),
        supabase.from('lancamentos').select('tipo, valor_pago').eq('status', 'pago').lt('data_pagamento', dataInicio).range(0, 9999),
        supabase.from('ajustes_saldo').select('valor').lt('data', dataInicio).range(0, 9999),
        supabase
          .from('lancamentos')
          .select('tipo, valor_pago, data_pagamento, descricao, categorias(nome)')
          .eq('status', 'pago')
          .gte('data_pagamento', dataInicio)
          .lte('data_pagamento', dataFim)
          .range(0, 9999),
        supabase
          .from('ajustes_saldo')
          .select('valor, data, motivo, observacoes')
          .gte('data', dataInicio)
          .lte('data', dataFim)
          .range(0, 9999),
      ])

      if (lancPeriodoRes.error) {
        setErro(lancPeriodoRes.error.message)
        setLoading(false)
        return
      }

      // Saldo inicial do período = saldo inicial das contas + tudo que aconteceu ANTES da data de início
      // (transferências não entram, pois no agregado de todas as contas elas se anulam)
      let base = (contasRes.data || []).reduce((acc, c) => acc + Number(c.saldo_inicial), 0)
      for (const l of lancAntesRes.data || []) {
        base += l.tipo === 'receber' ? Number(l.valor_pago) : -Number(l.valor_pago)
      }
      for (const a of ajustesAntesRes.data || []) {
        base += Number(a.valor)
      }
      setSaldoInicial(base)

      const todos = []
      for (const l of lancPeriodoRes.data) {
        todos.push({
          data: l.data_pagamento,
          descricao: l.descricao,
          categoria: l.categorias?.nome || '',
          entrada: l.tipo === 'receber' ? Number(l.valor_pago) : 0,
          saida: l.tipo === 'pagar' ? Number(l.valor_pago) : 0,
        })
      }
      for (const a of ajustesPeriodoRes.data || []) {
        const valor = Number(a.valor)
        todos.push({
          data: a.data,
          descricao: `${a.motivo}${a.observacoes ? ` — ${a.observacoes}` : ''}`,
          categoria: 'Ajuste de caixa',
          entrada: valor > 0 ? valor : 0,
          saida: valor < 0 ? -valor : 0,
        })
      }

      // ordem cronológica (mais antigo primeiro) — é assim que um fluxo de caixa real se lê
      todos.sort((a, b) => (a.data || '').localeCompare(b.data || ''))

      let acumulado = base
      const comSaldo = todos.map((m) => {
        acumulado += m.entrada - m.saida
        return { ...m, saldoApos: acumulado }
      })

      setMovimentos(comSaldo)
      setLoading(false)
    }
    carregar()
  }, [dataInicio, dataFim])

  const totalEntradas = movimentos.reduce((acc, m) => acc + m.entrada, 0)
  const totalSaidas = movimentos.reduce((acc, m) => acc + m.saida, 0)
  const saldoFinal = movimentos.length > 0 ? movimentos[movimentos.length - 1].saldoApos : saldoInicial

  function aplicarPreset(preset) {
    const hoje = new Date()
    if (preset === 'mes') {
      setDataInicio(primeiroDiaMesAtual())
      setDataFim(ultimoDiaMesAtual())
    } else if (preset === 'semana') {
      const diaSemana = hoje.getDay() // 0 = domingo
      const seg = new Date(hoje)
      seg.setDate(hoje.getDate() - ((diaSemana + 6) % 7))
      const dom = new Date(seg)
      dom.setDate(seg.getDate() + 6)
      setDataInicio(seg.toISOString().substring(0, 10))
      setDataFim(dom.toISOString().substring(0, 10))
    } else if (preset === 'hoje') {
      setDataInicio(todayISO())
      setDataFim(todayISO())
    }
  }

  function exportarExcel() {
    const linhas = [['Data', 'Descrição', 'Categoria', 'Entrada', 'Saída', 'Saldo Acumulado']]
    linhas.push(['', 'Saldo inicial do período', '', '', '', saldoInicial])
    movimentos.forEach((m) => {
      linhas.push([formatDateBR(m.data), m.descricao, m.categoria, m.entrada || '', m.saida || '', m.saldoApos])
    })
    linhas.push([])
    linhas.push(['', 'Total de Entradas', '', totalEntradas])
    linhas.push(['', 'Total de Saídas', '', '', totalSaidas])
    linhas.push(['', 'Saldo Final do Período', '', '', '', saldoFinal])

    const ws = XLSX.utils.aoa_to_sheet(linhas)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Fluxo de Caixa')
    XLSX.writeFile(wb, `FluxoCaixa_${dataInicio}_a_${dataFim}.xlsx`)
  }

  return (
    <div className="max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1 gap-2">
        <h2 className="text-2xl font-bold text-gray-900">Fluxo de Caixa</h2>
        <button
          onClick={exportarExcel}
          disabled={loading}
          className="flex items-center gap-1 rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
        >
          <Download size={16} /> Exportar Excel
        </button>
      </div>
      <p className="text-gray-500 text-sm mb-4">
        Movimento real de caixa, dia a dia — todas as contas somadas. Transferências entre suas próprias contas não
        aparecem aqui (não mudam o total em caixa).
      </p>

      <div className="flex items-center gap-3 mb-4 flex-wrap bg-white border border-gray-200 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">De:</label>
          <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1 text-sm" />
          <label className="text-xs text-gray-500">até:</label>
          <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1 text-sm" />
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <button onClick={() => aplicarPreset('hoje')} className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full hover:bg-gray-200">Hoje</button>
          <button onClick={() => aplicarPreset('semana')} className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full hover:bg-gray-200">Esta semana</button>
          <button onClick={() => aplicarPreset('mes')} className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full hover:bg-gray-200">Este mês</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-500">Entradas no período</p>
          <p className="text-lg font-bold text-green-600">{formatCurrencyBRL(totalEntradas)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-500">Saídas no período</p>
          <p className="text-lg font-bold text-red-600">{formatCurrencyBRL(totalSaidas)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-500">Saldo final do período</p>
          <p className="text-lg font-bold text-gray-900">{formatCurrencyBRL(saldoFinal)}</p>
        </div>
      </div>

      {erro && <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-2">{erro}</div>}

      {loading ? (
        <p className="text-gray-400 text-sm">Carregando...</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                <th className="px-4 py-2">Data</th>
                <th className="px-4 py-2">Descrição</th>
                <th className="px-4 py-2 text-right">Entrada</th>
                <th className="px-4 py-2 text-right">Saída</th>
                <th className="px-4 py-2 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-gray-50 font-medium">
                <td className="px-4 py-2 text-gray-500" colSpan={4}>Saldo inicial do período</td>
                <td className="px-4 py-2 text-right text-gray-800">{formatCurrencyBRL(saldoInicial)}</td>
              </tr>
              {movimentos.map((m, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2 whitespace-nowrap text-gray-600">{formatDateBR(m.data)}</td>
                  <td className="px-4 py-2 text-gray-800">
                    {m.descricao}
                    {m.categoria && <span className="text-gray-400"> · {m.categoria}</span>}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap text-green-600">
                    {m.entrada ? formatCurrencyBRL(m.entrada) : ''}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap text-red-600">
                    {m.saida ? formatCurrencyBRL(m.saida) : ''}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap font-semibold text-gray-800">
                    {formatCurrencyBRL(m.saldoApos)}
                  </td>
                </tr>
              ))}
              {movimentos.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-center text-gray-400 text-sm">
                    Nenhuma movimentação nesse período.
                  </td>
                </tr>
              )}
              <tr className="border-t-2 border-gray-300 bg-primary-50 font-bold">
                <td className="px-4 py-3 text-gray-900" colSpan={4}>Saldo Final do Período</td>
                <td className="px-4 py-3 text-right whitespace-nowrap text-gray-900">{formatCurrencyBRL(saldoFinal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-start gap-2 text-xs text-gray-400">
        <Wallet size={14} className="shrink-0 mt-0.5" />
        <p>
          Cada linha é um recebimento/pagamento que realmente aconteceu (baseado na data de pagamento), na ordem em
          que ocorreu. O saldo acumulado mostra o dinheiro em caixa após cada movimento.
        </p>
      </div>
    </div>
  )
}
