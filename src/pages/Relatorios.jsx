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
  const [receitasOp, setReceitasOp] = useState({})
  const [despesasOp, setDespesasOp] = useState({})
  const [receitasNaoOp, setReceitasNaoOp] = useState({})
  const [despesasNaoOp, setDespesasNaoOp] = useState({})
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
        .select('tipo, valor, data_competencia, categoria_id, categorias(nome, natureza), equipamento_id, equipamentos(nome)')
        .neq('status', 'cancelado')
        .gte('data_competencia', inicio)
        .lte('data_competencia', fim)
        .range(0, 9999)

      if (error) {
        setErro(error.message)
        setLoading(false)
        return
      }

      const novasReceitasOp = {} // agrupado por EQUIPAMENTO, com categorias aninhadas dentro
      const novasDespesasOp = {}
      const novasReceitasNaoOp = {}
      const novasDespesasNaoOp = {}
      const novoTotalPorMes = {}
      meses.forEach((m) => (novoTotalPorMes[m] = { receitaOp: 0, despesaOp: 0, receitaNaoOp: 0, despesaNaoOp: 0 }))

      for (const l of data) {
        const mes = (l.data_competencia || '').substring(0, 7)
        if (!novoTotalPorMes[mes]) continue // fora do intervalo por algum motivo, ignora

        const catNome = l.categorias?.nome || '(Sem categoria)'
        const catId = l.categoria_id || `sem_categoria_${l.tipo}`
        const naoOperacional = l.categorias?.natureza === 'nao_operacional'
        const isReceita = l.tipo === 'receber'

        if (isReceita && !naoOperacional) {
          // Receitas operacionais: agrupa primeiro por equipamento, depois por categoria dentro dele
          const equipNome = l.equipamentos?.nome || '(Sem equipamento)'
          const equipId = l.equipamento_id || 'sem_equipamento'

          if (!novasReceitasOp[equipId]) {
            novasReceitasOp[equipId] = { nome: equipNome, porMes: {}, total: 0, categorias: {} }
          }
          const grupo = novasReceitasOp[equipId]
          grupo.porMes[mes] = (grupo.porMes[mes] || 0) + Number(l.valor)
          grupo.total += Number(l.valor)

          if (!grupo.categorias[catId]) grupo.categorias[catId] = { nome: catNome, porMes: {}, total: 0 }
          grupo.categorias[catId].porMes[mes] = (grupo.categorias[catId].porMes[mes] || 0) + Number(l.valor)
          grupo.categorias[catId].total += Number(l.valor)
        } else {
          let alvo
          if (isReceita && naoOperacional) alvo = novasReceitasNaoOp
          else if (!isReceita && !naoOperacional) alvo = novasDespesasOp
          else alvo = novasDespesasNaoOp

          if (!alvo[catId]) alvo[catId] = { nome: catNome, porMes: {}, total: 0 }
          alvo[catId].porMes[mes] = (alvo[catId].porMes[mes] || 0) + Number(l.valor)
          alvo[catId].total += Number(l.valor)
        }

        const chave = isReceita ? (naoOperacional ? 'receitaNaoOp' : 'receitaOp') : naoOperacional ? 'despesaNaoOp' : 'despesaOp'
        novoTotalPorMes[mes][chave] += Number(l.valor)
      }

      setReceitasOp(novasReceitasOp)
      setDespesasOp(novasDespesasOp)
      setReceitasNaoOp(novasReceitasNaoOp)
      setDespesasNaoOp(novasDespesasNaoOp)
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

  const totalReceitaOp = Object.values(totalPorMes).reduce((acc, m) => acc + m.receitaOp, 0)
  const totalDespesaOp = Object.values(totalPorMes).reduce((acc, m) => acc + m.despesaOp, 0)
  const totalReceitaNaoOp = Object.values(totalPorMes).reduce((acc, m) => acc + m.receitaNaoOp, 0)
  const totalDespesaNaoOp = Object.values(totalPorMes).reduce((acc, m) => acc + m.despesaNaoOp, 0)
  const resultadoOperacional = totalReceitaOp - totalDespesaOp
  const resultadoNaoOperacional = totalReceitaNaoOp - totalDespesaNaoOp
  const resultadoGeral = resultadoOperacional + resultadoNaoOperacional
  const baseReceita = totalReceitaOp // análise vertical usa só a receita operacional como base

  function linhasOrdenadas(mapa) {
    return Object.values(mapa).sort((a, b) => b.total - a.total)
  }

  function exportarExcel() {
    const linhas = []
    const header = ['Categoria', ...meses.map(formatMesLabel), 'Total', '% Receita']
    linhas.push(header)

    linhas.push(['RECEITAS OPERACIONAIS'])
    linhasOrdenadas(receitasOp).forEach((equip) => {
      linhas.push([equip.nome, ...meses.map((m) => equip.porMes[m] || 0), equip.total, baseReceita ? equip.total / baseReceita : 0])
      Object.values(equip.categorias)
        .sort((a, b) => b.total - a.total)
        .forEach((cat) => {
          linhas.push([`  ${cat.nome}`, ...meses.map((m) => cat.porMes[m] || 0), cat.total, baseReceita ? cat.total / baseReceita : 0])
        })
    })
    linhas.push(['Total Receitas Operacionais', ...meses.map((m) => totalPorMes[m]?.receitaOp || 0), totalReceitaOp, 1])
    linhas.push([])

    linhas.push(['DESPESAS OPERACIONAIS'])
    linhasOrdenadas(despesasOp).forEach((d) => {
      linhas.push([d.nome, ...meses.map((m) => d.porMes[m] || 0), d.total, baseReceita ? d.total / baseReceita : 0])
    })
    linhas.push(['Total Despesas Operacionais', ...meses.map((m) => totalPorMes[m]?.despesaOp || 0), totalDespesaOp, baseReceita ? totalDespesaOp / baseReceita : 0])
    linhas.push([])

    linhas.push(['RESULTADO OPERACIONAL', ...meses.map((m) => (totalPorMes[m]?.receitaOp || 0) - (totalPorMes[m]?.despesaOp || 0)), resultadoOperacional, baseReceita ? resultadoOperacional / baseReceita : 0])
    linhas.push([])

    const temNaoOperacional = Object.keys(receitasNaoOp).length > 0 || Object.keys(despesasNaoOp).length > 0
    if (temNaoOperacional) {
      linhas.push(['NÃO OPERACIONAL (empréstimos, aportes, etc.)'])
      linhasOrdenadas(receitasNaoOp).forEach((r) => {
        linhas.push([r.nome, ...meses.map((m) => r.porMes[m] || 0), r.total, baseReceita ? r.total / baseReceita : 0])
      })
      linhasOrdenadas(despesasNaoOp).forEach((d) => {
        linhas.push([d.nome, ...meses.map((m) => -(d.porMes[m] || 0)), -d.total, baseReceita ? -d.total / baseReceita : 0])
      })
      linhas.push(['Resultado Não Operacional', ...meses.map((m) => (totalPorMes[m]?.receitaNaoOp || 0) - (totalPorMes[m]?.despesaNaoOp || 0)), resultadoNaoOperacional, baseReceita ? resultadoNaoOperacional / baseReceita : 0])
      linhas.push([])
    }

    linhas.push([
      'RESULTADO DO PERÍODO',
      ...meses.map((m) => (totalPorMes[m]?.receitaOp || 0) - (totalPorMes[m]?.despesaOp || 0) + (totalPorMes[m]?.receitaNaoOp || 0) - (totalPorMes[m]?.despesaNaoOp || 0)),
      resultadoGeral,
      baseReceita ? resultadoGeral / baseReceita : 0,
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
              <LinhaSecao texto="RECEITAS OPERACIONAIS" />
              {linhasOrdenadas(receitasOp).map((equip, i) => (
                <GrupoEquipamento key={i} equip={equip} meses={meses} totalReceitaGeral={baseReceita} />
              ))}
              <LinhaSubtotal
                texto="Total Receitas Operacionais"
                porMes={Object.fromEntries(meses.map((m) => [m, totalPorMes[m]?.receitaOp || 0]))}
                total={totalReceitaOp}
                meses={meses}
                totalReceitaGeral={baseReceita}
              />

              <tr><td colSpan={meses.length + 3} className="py-2"></td></tr>

              <LinhaSecao texto="DESPESAS OPERACIONAIS" />
              {linhasOrdenadas(despesasOp).map((d, i) => (
                <LinhaCategoria key={i} nome={d.nome} porMes={d.porMes} total={d.total} meses={meses} totalReceitaGeral={baseReceita} negativo />
              ))}
              <LinhaSubtotal
                texto="Total Despesas Operacionais"
                porMes={Object.fromEntries(meses.map((m) => [m, totalPorMes[m]?.despesaOp || 0]))}
                total={totalDespesaOp}
                meses={meses}
                totalReceitaGeral={baseReceita}
                negativo
              />

              <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                <td className="px-4 py-3 text-gray-900">Resultado Operacional</td>
                {meses.map((m) => {
                  const valor = (totalPorMes[m]?.receitaOp || 0) - (totalPorMes[m]?.despesaOp || 0)
                  return (
                    <td key={m} className={`px-3 py-3 text-right whitespace-nowrap ${valor < 0 ? 'text-red-600' : 'text-green-700'}`}>
                      {formatCurrencyBRL(valor)}
                    </td>
                  )
                })}
                <td className={`px-3 py-3 text-right whitespace-nowrap ${resultadoOperacional < 0 ? 'text-red-600' : 'text-green-700'}`}>
                  {formatCurrencyBRL(resultadoOperacional)}
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap text-gray-500">
                  {baseReceita ? `${((resultadoOperacional / baseReceita) * 100).toFixed(1)}%` : '—'}
                </td>
              </tr>

              {(Object.keys(receitasNaoOp).length > 0 || Object.keys(despesasNaoOp).length > 0) && (
                <>
                  <tr><td colSpan={meses.length + 3} className="py-2"></td></tr>
                  <LinhaSecao texto="NÃO OPERACIONAL (empréstimos, aportes, etc.)" />
                  {linhasOrdenadas(receitasNaoOp).map((r, i) => (
                    <LinhaCategoria key={i} nome={r.nome} porMes={r.porMes} total={r.total} meses={meses} totalReceitaGeral={baseReceita} />
                  ))}
                  {linhasOrdenadas(despesasNaoOp).map((d, i) => (
                    <LinhaCategoria key={i} nome={d.nome} porMes={d.porMes} total={d.total} meses={meses} totalReceitaGeral={baseReceita} negativo />
                  ))}
                  <tr className="border-t border-gray-200 bg-gray-50 font-semibold">
                    <td className="px-4 py-2 text-gray-800">Resultado Não Operacional</td>
                    {meses.map((m) => {
                      const valor = (totalPorMes[m]?.receitaNaoOp || 0) - (totalPorMes[m]?.despesaNaoOp || 0)
                      return (
                        <td key={m} className={`px-3 py-2 text-right whitespace-nowrap ${valor < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                          {formatCurrencyBRL(valor)}
                        </td>
                      )
                    })}
                    <td className={`px-3 py-2 text-right whitespace-nowrap ${resultadoNaoOperacional < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                      {formatCurrencyBRL(resultadoNaoOperacional)}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap text-gray-500">
                      {baseReceita ? `${((resultadoNaoOperacional / baseReceita) * 100).toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                </>
              )}

              <tr className="border-t-2 border-gray-400 bg-primary-50 font-bold">
                <td className="px-4 py-3 text-gray-900">Resultado do Período</td>
                {meses.map((m) => {
                  const valor =
                    (totalPorMes[m]?.receitaOp || 0) -
                    (totalPorMes[m]?.despesaOp || 0) +
                    (totalPorMes[m]?.receitaNaoOp || 0) -
                    (totalPorMes[m]?.despesaNaoOp || 0)
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
                  {baseReceita ? `${((resultadoGeral / baseReceita) * 100).toFixed(1)}%` : '—'}
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

function GrupoEquipamento({ equip, meses, totalReceitaGeral }) {
  const categoriasOrdenadas = Object.values(equip.categorias).sort((a, b) => b.total - a.total)
  return (
    <>
      <tr className="bg-gray-50/70 border-t border-gray-100">
        <td className="px-4 py-1.5 font-semibold text-gray-700">{equip.nome}</td>
        {meses.map((m) => (
          <td key={m} className="px-3 py-1.5 text-right whitespace-nowrap font-semibold text-gray-700">
            {equip.porMes[m] ? formatCurrencyBRL(equip.porMes[m]) : '—'}
          </td>
        ))}
        <td className="px-3 py-1.5 text-right whitespace-nowrap font-semibold text-gray-900">
          {formatCurrencyBRL(equip.total)}
        </td>
        <td className="px-3 py-1.5 text-right whitespace-nowrap font-semibold text-gray-500">
          {totalReceitaGeral ? `${((equip.total / totalReceitaGeral) * 100).toFixed(1)}%` : '—'}
        </td>
      </tr>
      {categoriasOrdenadas.map((cat, i) => (
        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
          <td className="pl-8 pr-4 py-1.5 text-gray-500 text-[13px]">{cat.nome}</td>
          {meses.map((m) => (
            <td key={m} className="px-3 py-1.5 text-right whitespace-nowrap text-gray-500 text-[13px]">
              {cat.porMes[m] ? formatCurrencyBRL(cat.porMes[m]) : '—'}
            </td>
          ))}
          <td className="px-3 py-1.5 text-right whitespace-nowrap text-gray-600 text-[13px]">
            {formatCurrencyBRL(cat.total)}
          </td>
          <td className="px-3 py-1.5 text-right whitespace-nowrap text-gray-400 text-[13px]">
            {totalReceitaGeral ? `${((cat.total / totalReceitaGeral) * 100).toFixed(1)}%` : '—'}
          </td>
        </tr>
      ))}
    </>
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
