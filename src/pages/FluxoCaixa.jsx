import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import {
  formatCurrencyBRL,
  mesAtualISO,
  getRangeMes,
  gerarIntervaloMeses,
  formatMesLabel,
  addMonthsISO,
} from '../lib/format'
import { Wallet, Download } from 'lucide-react'

export default function FluxoCaixa() {
  const [mesInicio, setMesInicio] = useState(mesAtualISO())
  const [mesFim, setMesFim] = useState(mesAtualISO())
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [entradasOp, setEntradasOp] = useState({})
  const [saidasOp, setSaidasOp] = useState({})
  const [entradasFinanc, setEntradasFinanc] = useState({})
  const [saidasFinanc, setSaidasFinanc] = useState({})
  const [ajustes, setAjustes] = useState([])
  const [totalPorMes, setTotalPorMes] = useState({})

  const meses = gerarIntervaloMeses(mesInicio, mesFim)

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      setErro(null)

      const inicio = getRangeMes(mesInicio).inicio
      const fim = getRangeMes(mesFim).fim

      const [lancRes, ajustesRes] = await Promise.all([
        supabase
          .from('lancamentos')
          .select('tipo, valor_pago, data_pagamento, categoria_id, categorias(nome, natureza)')
          .eq('status', 'pago')
          .gte('data_pagamento', inicio)
          .lte('data_pagamento', fim)
          .range(0, 9999),
        supabase
          .from('ajustes_saldo')
          .select('valor, data, motivo')
          .gte('data', inicio)
          .lte('data', fim)
          .range(0, 9999),
      ])

      if (lancRes.error) {
        setErro(lancRes.error.message)
        setLoading(false)
        return
      }

      const novasEntradasOp = {}
      const novasSaidasOp = {}
      const novasEntradasFinanc = {}
      const novasSaidasFinanc = {}
      const novoTotalPorMes = {}
      meses.forEach((m) => (novoTotalPorMes[m] = { entradaOp: 0, saidaOp: 0, entradaFinanc: 0, saidaFinanc: 0, ajuste: 0 }))

      for (const l of lancRes.data) {
        const mes = (l.data_pagamento || '').substring(0, 7)
        if (!novoTotalPorMes[mes]) continue

        const catNome = l.categorias?.nome || '(Sem categoria)'
        const catId = l.categoria_id || `sem_categoria_${l.tipo}`
        const financiamento = l.categorias?.natureza === 'nao_operacional'
        const isEntrada = l.tipo === 'receber'
        const valor = Number(l.valor_pago)

        let alvo
        if (isEntrada && !financiamento) alvo = novasEntradasOp
        else if (isEntrada && financiamento) alvo = novasEntradasFinanc
        else if (!isEntrada && !financiamento) alvo = novasSaidasOp
        else alvo = novasSaidasFinanc

        if (!alvo[catId]) alvo[catId] = { nome: catNome, porMes: {}, total: 0 }
        alvo[catId].porMes[mes] = (alvo[catId].porMes[mes] || 0) + valor
        alvo[catId].total += valor

        const chave = isEntrada
          ? financiamento
            ? 'entradaFinanc'
            : 'entradaOp'
          : financiamento
          ? 'saidaFinanc'
          : 'saidaOp'
        novoTotalPorMes[mes][chave] += valor
      }

      for (const a of ajustesRes.data || []) {
        const mes = (a.data || '').substring(0, 7)
        if (!novoTotalPorMes[mes]) continue
        novoTotalPorMes[mes].ajuste += Number(a.valor)
      }

      setEntradasOp(novasEntradasOp)
      setSaidasOp(novasSaidasOp)
      setEntradasFinanc(novasEntradasFinanc)
      setSaidasFinanc(novasSaidasFinanc)
      setAjustes(ajustesRes.data || [])
      setTotalPorMes(novoTotalPorMes)
      setLoading(false)
    }
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesInicio, mesFim])

  function aplicarPreset(preset) {
    const hoje = mesAtualISO()
    if (preset === 'mes') {
      setMesInicio(hoje)
      setMesFim(hoje)
    } else if (preset === 'trimestre') {
      setMesInicio(addMonthsISO(`${hoje}-01`, -2).substring(0, 7))
      setMesFim(hoje)
    } else if (preset === 'ano') {
      setMesInicio(`${hoje.substring(0, 4)}-01`)
      setMesFim(hoje)
    }
  }

  const totalEntradaOp = Object.values(totalPorMes).reduce((acc, m) => acc + m.entradaOp, 0)
  const totalSaidaOp = Object.values(totalPorMes).reduce((acc, m) => acc + m.saidaOp, 0)
  const totalEntradaFinanc = Object.values(totalPorMes).reduce((acc, m) => acc + m.entradaFinanc, 0)
  const totalSaidaFinanc = Object.values(totalPorMes).reduce((acc, m) => acc + m.saidaFinanc, 0)
  const totalAjustes = Object.values(totalPorMes).reduce((acc, m) => acc + m.ajuste, 0)
  const caixaOperacional = totalEntradaOp - totalSaidaOp
  const caixaFinanciamento = totalEntradaFinanc - totalSaidaFinanc
  const variacaoCaixa = caixaOperacional + caixaFinanciamento + totalAjustes

  const temFinanciamento = Object.keys(entradasFinanc).length > 0 || Object.keys(saidasFinanc).length > 0
  const temAjustes = ajustes.length > 0

  function linhasOrdenadas(mapa) {
    return Object.values(mapa).sort((a, b) => b.total - a.total)
  }

  function exportarExcel() {
    const linhas = []
    linhas.push(['Categoria', ...meses.map(formatMesLabel), 'Total'])

    linhas.push(['ATIVIDADES OPERACIONAIS'])
    linhas.push(['Entradas'])
    linhasOrdenadas(entradasOp).forEach((r) => linhas.push([r.nome, ...meses.map((m) => r.porMes[m] || 0), r.total]))
    linhas.push(['Saídas'])
    linhasOrdenadas(saidasOp).forEach((d) => linhas.push([d.nome, ...meses.map((m) => -(d.porMes[m] || 0)), -d.total]))
    linhas.push(['Caixa Gerado nas Atividades Operacionais', ...meses.map((m) => (totalPorMes[m]?.entradaOp || 0) - (totalPorMes[m]?.saidaOp || 0)), caixaOperacional])
    linhas.push([])

    if (temFinanciamento) {
      linhas.push(['ATIVIDADES DE FINANCIAMENTO (empréstimos, aportes)'])
      linhasOrdenadas(entradasFinanc).forEach((r) => linhas.push([r.nome, ...meses.map((m) => r.porMes[m] || 0), r.total]))
      linhasOrdenadas(saidasFinanc).forEach((d) => linhas.push([d.nome, ...meses.map((m) => -(d.porMes[m] || 0)), -d.total]))
      linhas.push(['Caixa das Atividades de Financiamento', ...meses.map((m) => (totalPorMes[m]?.entradaFinanc || 0) - (totalPorMes[m]?.saidaFinanc || 0)), caixaFinanciamento])
      linhas.push([])
    }

    if (temAjustes) {
      linhas.push(['AJUSTES DE CAIXA'])
      ajustes.forEach((a) => linhas.push([a.motivo, a.data, Number(a.valor)]))
      linhas.push(['Total Ajustes', ...meses.map((m) => totalPorMes[m]?.ajuste || 0), totalAjustes])
      linhas.push([])
    }

    linhas.push(['VARIAÇÃO DE CAIXA DO PERÍODO', ...meses.map((m) => (totalPorMes[m]?.entradaOp || 0) - (totalPorMes[m]?.saidaOp || 0) + (totalPorMes[m]?.entradaFinanc || 0) - (totalPorMes[m]?.saidaFinanc || 0) + (totalPorMes[m]?.ajuste || 0)), variacaoCaixa])

    const ws = XLSX.utils.aoa_to_sheet(linhas)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Fluxo de Caixa')
    XLSX.writeFile(wb, `FluxoCaixa_${mesInicio}_a_${mesFim}.xlsx`)
  }

  return (
    <div className="max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1 gap-2">
        <h2 className="text-2xl font-bold text-gray-900">Fluxo de Caixa — Regime de Caixa</h2>
        <button
          onClick={exportarExcel}
          disabled={loading}
          className="flex items-center gap-1 rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
        >
          <Download size={16} /> Exportar Excel
        </button>
      </div>
      <p className="text-gray-500 text-sm mb-4">
        Baseado na data de pagamento (só considera o que realmente entrou/saiu do caixa). Transferências entre suas
        próprias contas não entram aqui, pois não alteram o caixa total.
      </p>

      <div className="flex items-center gap-3 mb-6 flex-wrap bg-white border border-gray-200 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">De:</label>
          <input type="month" value={mesInicio} onChange={(e) => setMesInicio(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1 text-sm" />
          <label className="text-xs text-gray-500">até:</label>
          <input type="month" value={mesFim} onChange={(e) => setMesFim(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1 text-sm" />
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <button onClick={() => aplicarPreset('mes')} className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full hover:bg-gray-200">Mês atual</button>
          <button onClick={() => aplicarPreset('trimestre')} className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full hover:bg-gray-200">Trimestre atual</button>
          <button onClick={() => aplicarPreset('ano')} className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full hover:bg-gray-200">Ano atual</button>
        </div>
      </div>

      {erro && <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-2">{erro}</div>}

      {loading ? (
        <p className="text-gray-400 text-sm">Carregando...</p>
      ) : meses.length === 0 ? (
        <p className="text-gray-400 text-sm">Selecione um período válido (de/até).</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                <th className="px-4 py-2 min-w-[200px]">Categoria</th>
                {meses.map((m) => (
                  <th key={m} className="px-3 py-2 text-right whitespace-nowrap">{formatMesLabel(m)}</th>
                ))}
                <th className="px-3 py-2 text-right whitespace-nowrap font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              <LinhaSecao texto="ATIVIDADES OPERACIONAIS" />
              <LinhaSubSecao texto="Entradas" />
              {linhasOrdenadas(entradasOp).map((r, i) => (
                <LinhaCategoria key={i} nome={r.nome} porMes={r.porMes} total={r.total} meses={meses} />
              ))}
              <LinhaSubSecao texto="Saídas" />
              {linhasOrdenadas(saidasOp).map((d, i) => (
                <LinhaCategoria key={i} nome={d.nome} porMes={d.porMes} total={d.total} meses={meses} negativo />
              ))}
              <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                <td className="px-4 py-3 text-gray-900">Caixa Gerado nas Atividades Operacionais</td>
                {meses.map((m) => {
                  const valor = (totalPorMes[m]?.entradaOp || 0) - (totalPorMes[m]?.saidaOp || 0)
                  return (
                    <td key={m} className={`px-3 py-3 text-right whitespace-nowrap ${valor < 0 ? 'text-red-600' : 'text-green-700'}`}>
                      {formatCurrencyBRL(valor)}
                    </td>
                  )
                })}
                <td className={`px-3 py-3 text-right whitespace-nowrap ${caixaOperacional < 0 ? 'text-red-600' : 'text-green-700'}`}>
                  {formatCurrencyBRL(caixaOperacional)}
                </td>
              </tr>

              {temFinanciamento && (
                <>
                  <tr><td colSpan={meses.length + 2} className="py-2"></td></tr>
                  <LinhaSecao texto="ATIVIDADES DE FINANCIAMENTO (empréstimos, aportes)" />
                  {linhasOrdenadas(entradasFinanc).map((r, i) => (
                    <LinhaCategoria key={i} nome={r.nome} porMes={r.porMes} total={r.total} meses={meses} />
                  ))}
                  {linhasOrdenadas(saidasFinanc).map((d, i) => (
                    <LinhaCategoria key={i} nome={d.nome} porMes={d.porMes} total={d.total} meses={meses} negativo />
                  ))}
                  <tr className="border-t border-gray-200 bg-gray-50 font-semibold">
                    <td className="px-4 py-2 text-gray-800">Caixa das Atividades de Financiamento</td>
                    {meses.map((m) => {
                      const valor = (totalPorMes[m]?.entradaFinanc || 0) - (totalPorMes[m]?.saidaFinanc || 0)
                      return (
                        <td key={m} className={`px-3 py-2 text-right whitespace-nowrap ${valor < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                          {formatCurrencyBRL(valor)}
                        </td>
                      )
                    })}
                    <td className={`px-3 py-2 text-right whitespace-nowrap ${caixaFinanciamento < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                      {formatCurrencyBRL(caixaFinanciamento)}
                    </td>
                  </tr>
                </>
              )}

              {temAjustes && (
                <>
                  <tr><td colSpan={meses.length + 2} className="py-2"></td></tr>
                  <LinhaSecao texto="AJUSTES DE CAIXA" />
                  <tr className="border-t border-gray-200 bg-gray-50 font-semibold">
                    <td className="px-4 py-2 text-gray-800">Total Ajustes</td>
                    {meses.map((m) => (
                      <td key={m} className="px-3 py-2 text-right whitespace-nowrap text-gray-800">
                        {formatCurrencyBRL(totalPorMes[m]?.ajuste || 0)}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right whitespace-nowrap text-gray-900">{formatCurrencyBRL(totalAjustes)}</td>
                  </tr>
                </>
              )}

              <tr className="border-t-2 border-gray-400 bg-primary-50 font-bold">
                <td className="px-4 py-3 text-gray-900">Variação de Caixa do Período</td>
                {meses.map((m) => {
                  const valor =
                    (totalPorMes[m]?.entradaOp || 0) -
                    (totalPorMes[m]?.saidaOp || 0) +
                    (totalPorMes[m]?.entradaFinanc || 0) -
                    (totalPorMes[m]?.saidaFinanc || 0) +
                    (totalPorMes[m]?.ajuste || 0)
                  return (
                    <td key={m} className={`px-3 py-3 text-right whitespace-nowrap ${valor < 0 ? 'text-red-600' : 'text-green-700'}`}>
                      {formatCurrencyBRL(valor)}
                    </td>
                  )
                })}
                <td className={`px-3 py-3 text-right whitespace-nowrap ${variacaoCaixa < 0 ? 'text-red-600' : 'text-green-700'}`}>
                  {formatCurrencyBRL(variacaoCaixa)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-start gap-2 text-xs text-gray-400">
        <Wallet size={14} className="shrink-0 mt-0.5" />
        <p>
          Diferente do DRE (que olha quando a receita/despesa foi gerada), o Fluxo de Caixa olha só o que realmente
          entrou ou saiu do bolso, na data em que o pagamento aconteceu de verdade.
        </p>
      </div>
    </div>
  )
}

function LinhaSecao({ texto }) {
  return (
    <tr>
      <td className="px-4 py-2 font-semibold text-gray-500 text-xs tracking-wide" colSpan={99}>
        {texto}
      </td>
    </tr>
  )
}

function LinhaSubSecao({ texto }) {
  return (
    <tr>
      <td className="px-4 py-1 font-medium text-gray-400 text-[11px] uppercase tracking-wide" colSpan={99}>
        {texto}
      </td>
    </tr>
  )
}

function LinhaCategoria({ nome, porMes, total, meses, negativo }) {
  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50">
      <td className="pl-6 pr-4 py-1.5 text-gray-700">{nome}</td>
      {meses.map((m) => (
        <td key={m} className="px-3 py-1.5 text-right whitespace-nowrap text-gray-600">
          {porMes[m] ? formatCurrencyBRL(porMes[m]) : '—'}
        </td>
      ))}
      <td className={`px-3 py-1.5 text-right whitespace-nowrap font-medium ${negativo ? 'text-red-600' : 'text-gray-800'}`}>
        {formatCurrencyBRL(total)}
      </td>
    </tr>
  )
}
