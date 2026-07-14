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
import { FileBarChart, Download } from 'lucide-react'

export default function Relatorios() {
  const [mesInicio, setMesInicio] = useState(mesAtualISO())
  const [mesFim, setMesFim] = useState(mesAtualISO())
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [receitas, setReceitas] = useState({})
  const [despesas, setDespesas] = useState({})
  const [totalPorMes, setTotalPorMes] = useState({})

  const meses = gerarIntervaloMeses(mesInicio, mesFim)

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      setErro(null)

      const inicio = getRangeMes(mesInicio).inicio
      const fim = getRangeMes(mesFim).fim

      const { data, error } = await supabase
        .from('lancamentos')
        .select('tipo, valor, data_competencia, categoria_id, categorias(nome)')
        .neq('status', 'cancelado')
        .gte('data_competencia', inicio)
        .lte('data_competencia', fim)
        .range(0, 9999)

      if (error) {
        setErro(error.message)
        setLoading(false)
        return
      }

      const novasReceitas = {}
      const novasDespesas = {}
      const novoTotalPorMes = {}
      meses.forEach((m) => (novoTotalPorMes[m] = { receita: 0, despesa: 0 }))

      for (const l of data) {
        const mes = (l.data_competencia || '').substring(0, 7)
        if (!novoTotalPorMes[mes]) continue // fora do intervalo por algum motivo, ignora

        const catNome = l.categorias?.nome || '(Sem categoria)'
        const catId = l.categoria_id || `sem_categoria_${l.tipo}`
        const alvo = l.tipo === 'receber' ? novasReceitas : novasDespesas

        if (!alvo[catId]) alvo[catId] = { nome: catNome, porMes: {}, total: 0 }
        alvo[catId].porMes[mes] = (alvo[catId].porMes[mes] || 0) + Number(l.valor)
        alvo[catId].total += Number(l.valor)

        novoTotalPorMes[mes][l.tipo === 'receber' ? 'receita' : 'despesa'] += Number(l.valor)
      }

      setReceitas(novasReceitas)
      setDespesas(novasDespesas)
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

  const totalReceitaGeral = Object.values(totalPorMes).reduce((acc, m) => acc + m.receita, 0)
  const totalDespesaGeral = Object.values(totalPorMes).reduce((acc, m) => acc + m.despesa, 0)
  const resultadoGeral = totalReceitaGeral - totalDespesaGeral

  function linhasOrdenadas(mapa) {
    return Object.values(mapa).sort((a, b) => b.total - a.total)
  }

  function exportarExcel() {
    const linhas = []
    const header = ['Categoria', ...meses.map(formatMesLabel), 'Total', '% Receita']
    linhas.push(header)

    linhas.push(['RECEITAS'])
    linhasOrdenadas(receitas).forEach((r) => {
      linhas.push([
        r.nome,
        ...meses.map((m) => r.porMes[m] || 0),
        r.total,
        totalReceitaGeral ? r.total / totalReceitaGeral : 0,
      ])
    })
    linhas.push(['Total Receitas', ...meses.map((m) => totalPorMes[m]?.receita || 0), totalReceitaGeral, 1])
    linhas.push([])

    linhas.push(['DESPESAS'])
    linhasOrdenadas(despesas).forEach((d) => {
      linhas.push([
        d.nome,
        ...meses.map((m) => d.porMes[m] || 0),
        d.total,
        totalReceitaGeral ? d.total / totalReceitaGeral : 0,
      ])
    })
    linhas.push(['Total Despesas', ...meses.map((m) => totalPorMes[m]?.despesa || 0), totalDespesaGeral, totalReceitaGeral ? totalDespesaGeral / totalReceitaGeral : 0])
    linhas.push([])

    linhas.push([
      'RESULTADO DO PERÍODO',
      ...meses.map((m) => (totalPorMes[m]?.receita || 0) - (totalPorMes[m]?.despesa || 0)),
      resultadoGeral,
      totalReceitaGeral ? resultadoGeral / totalReceitaGeral : 0,
    ])

    const ws = XLSX.utils.aoa_to_sheet(linhas)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'DRE')
    XLSX.writeFile(wb, `DRE_${mesInicio}_a_${mesFim}.xlsx`)
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h2 className="text-2xl font-bold text-gray-900">DRE — Regime de Competência</h2>
        <button
          onClick={exportarExcel}
          disabled={loading}
          className="flex items-center gap-1 rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
        >
          <Download size={16} /> Exportar Excel
        </button>
      </div>
      <p className="text-gray-500 text-sm mb-4">
        Baseado na data de competência dos lançamentos (não considera se já foi pago ou não).
      </p>

      <div className="flex items-center gap-3 mb-6 flex-wrap bg-white border border-gray-200 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">De:</label>
          <input
            type="month"
            value={mesInicio}
            onChange={(e) => setMesInicio(e.target.value)}
            className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
          />
          <label className="text-xs text-gray-500">até:</label>
          <input
            type="month"
            value={mesFim}
            onChange={(e) => setMesFim(e.target.value)}
            className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
          />
        </div>
        <div className="flex gap-2 ml-auto">
          <button onClick={() => aplicarPreset('mes')} className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full hover:bg-gray-200">
            Mês atual
          </button>
          <button onClick={() => aplicarPreset('trimestre')} className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full hover:bg-gray-200">
            Trimestre atual
          </button>
          <button onClick={() => aplicarPreset('ano')} className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full hover:bg-gray-200">
            Ano atual
          </button>
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
                <th className="px-4 py-2 min-w-[180px]">Categoria</th>
                {meses.map((m) => (
                  <th key={m} className="px-3 py-2 text-right whitespace-nowrap">{formatMesLabel(m)}</th>
                ))}
                <th className="px-3 py-2 text-right whitespace-nowrap font-semibold">Total</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">% Receita</th>
              </tr>
            </thead>
            <tbody>
              <LinhaSecao texto="RECEITAS" />
              {linhasOrdenadas(receitas).map((r, i) => (
                <LinhaCategoria key={i} nome={r.nome} porMes={r.porMes} total={r.total} meses={meses} totalReceitaGeral={totalReceitaGeral} />
              ))}
              <LinhaSubtotal
                texto="Total Receitas"
                porMes={Object.fromEntries(meses.map((m) => [m, totalPorMes[m]?.receita || 0]))}
                total={totalReceitaGeral}
                meses={meses}
                totalReceitaGeral={totalReceitaGeral}
              />

              <tr><td colSpan={meses.length + 3} className="py-2"></td></tr>

              <LinhaSecao texto="DESPESAS" />
              {linhasOrdenadas(despesas).map((d, i) => (
                <LinhaCategoria key={i} nome={d.nome} porMes={d.porMes} total={d.total} meses={meses} totalReceitaGeral={totalReceitaGeral} negativo />
              ))}
              <LinhaSubtotal
                texto="Total Despesas"
                porMes={Object.fromEntries(meses.map((m) => [m, totalPorMes[m]?.despesa || 0]))}
                total={totalDespesaGeral}
                meses={meses}
                totalReceitaGeral={totalReceitaGeral}
                negativo
              />

              <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                <td className="px-4 py-3 text-gray-900">Resultado do Período</td>
                {meses.map((m) => {
                  const valor = (totalPorMes[m]?.receita || 0) - (totalPorMes[m]?.despesa || 0)
                  return (
                    <td key={m} className={`px-3 py-3 text-right whitespace-nowrap ${valor < 0 ? 'text-red-600' : 'text-green-700'}`}>
                      {formatCurrencyBRL(valor)}
                    </td>
                  )
                })}
                <td className={`px-3 py-3 text-right whitespace-nowrap ${resultadoGeral < 0 ? 'text-red-600' : 'text-green-700'}`}>
                  {formatCurrencyBRL(resultadoGeral)}
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap text-gray-500">
                  {totalReceitaGeral ? `${((resultadoGeral / totalReceitaGeral) * 100).toFixed(1)}%` : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-start gap-2 text-xs text-gray-400">
        <FileBarChart size={14} className="shrink-0 mt-0.5" />
        <p>
          "% Receita" mostra a análise vertical: cada linha como percentual da Receita Total do período — útil pra
          ver o peso de cada despesa/categoria em relação ao faturamento.
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

function LinhaCategoria({ nome, porMes, total, meses, totalReceitaGeral, negativo }) {
  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50">
      <td className="px-4 py-1.5 text-gray-700">{nome}</td>
      {meses.map((m) => (
        <td key={m} className="px-3 py-1.5 text-right whitespace-nowrap text-gray-600">
          {porMes[m] ? formatCurrencyBRL(porMes[m]) : '—'}
        </td>
      ))}
      <td className={`px-3 py-1.5 text-right whitespace-nowrap font-medium ${negativo ? 'text-red-600' : 'text-gray-800'}`}>
        {formatCurrencyBRL(total)}
      </td>
      <td className="px-3 py-1.5 text-right whitespace-nowrap text-gray-400">
        {totalReceitaGeral ? `${((total / totalReceitaGeral) * 100).toFixed(1)}%` : '—'}
      </td>
    </tr>
  )
}

function LinhaSubtotal({ texto, porMes, total, meses, totalReceitaGeral, negativo }) {
  return (
    <tr className="bg-gray-50 font-semibold border-t border-gray-200">
      <td className="px-4 py-2 text-gray-800">{texto}</td>
      {meses.map((m) => (
        <td key={m} className="px-3 py-2 text-right whitespace-nowrap text-gray-800">
          {formatCurrencyBRL(porMes[m] || 0)}
        </td>
      ))}
      <td className={`px-3 py-2 text-right whitespace-nowrap ${negativo ? 'text-red-700' : 'text-gray-900'}`}>
        {formatCurrencyBRL(total)}
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap text-gray-500">
        {totalReceitaGeral ? `${((total / totalReceitaGeral) * 100).toFixed(1)}%` : '—'}
      </td>
    </tr>
  )
}
