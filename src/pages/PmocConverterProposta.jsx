import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { todayISO, formatCurrencyBRL } from '../lib/format'
import { gerarCicloPmoc, FREQUENCIAS_HIGIENIZACAO } from '../lib/pmoc'
import { ArrowLeft } from 'lucide-react'

export default function PmocConverterProposta() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [proposta, setProposta] = useState(null)
  const [itens, setItens] = useState([])
  const [dataInicio, setDataInicio] = useState(todayISO())
  const [valor, setValor] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [convertendo, setConvertendo] = useState(false)

  useEffect(() => {
    async function carregar() {
      const { data: p, error: erroP } = await supabase
        .from('pmoc_propostas')
        .select('*, clientes(nome)')
        .eq('id', id)
        .single()
      if (erroP) {
        setErro(erroP.message)
        setLoading(false)
        return
      }
      const { data: i, error: erroI } = await supabase
        .from('pmoc_proposta_itens')
        .select('*')
        .eq('proposta_id', id)
      if (erroI) {
        setErro(erroI.message)
        setLoading(false)
        return
      }
      setProposta(p)
      setValor(p.valor || '')
      setItens(i.map((item) => ({ ...item })))
      setLoading(false)
    }
    carregar()
  }, [id])

  function atualizarItem(i, campo, valor) {
    const novos = [...itens]
    novos[i] = { ...novos[i], [campo]: valor }
    setItens(novos)
  }

  const totalBtu = itens.reduce((s, i) => s + (Number(i.capacidade_btu) || 0), 0)
  const exigeRt = totalBtu > 60000

  async function converter() {
    setConvertendo(true)
    setErro(null)

    const { data: contrato, error: erroContrato } = await supabase
      .from('pmoc_contratos')
      .insert({
        cliente_id: proposta.cliente_id,
        proposta_id: proposta.id,
        data_inicio: dataInicio,
        valor: valor ? Number(valor) : null,
        observacoes: observacoes || null,
      })
      .select('*')
      .single()

    if (erroContrato) {
      setErro(erroContrato.message)
      setConvertendo(false)
      return
    }

    const { data: equipamentosCriados, error: erroEquip } = await supabase
      .from('pmoc_equipamentos')
      .insert(
        itens.map((i) => ({
          contrato_id: contrato.id,
          ativo_id: i.ativo_id || null,
          descricao_equipamento: i.descricao_equipamento || null,
          local: i.local || null,
          capacidade_btu: i.capacidade_btu ? Number(i.capacidade_btu) : null,
          frequencia_higienizacao: i.frequencia_higienizacao,
          data_entrada: dataInicio,
        }))
      )
      .select('*')

    if (erroEquip) {
      setErro(erroEquip.message)
      setConvertendo(false)
      return
    }

    const { error: erroCiclo } = await gerarCicloPmoc(supabase, contrato, equipamentosCriados)
    if (erroCiclo) {
      setErro(erroCiclo.message)
      setConvertendo(false)
      return
    }

    await supabase
      .from('pmoc_propostas')
      .update({ status: 'convertida', contrato_id: contrato.id })
      .eq('id', proposta.id)

    setConvertendo(false)
    navigate(`/pmoc/contratos/${contrato.id}`)
  }

  if (loading) return <p className="text-gray-400 text-sm">Carregando...</p>
  if (erro && !proposta) return <p className="text-red-600 text-sm">{erro}</p>

  return (
    <div className="max-w-3xl">
      <Link to="/pmoc/propostas" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
        <ArrowLeft size={14} /> Voltar para propostas
      </Link>

      <h2 className="text-2xl font-bold text-gray-900 mb-1">Converter proposta em contrato</h2>
      <p className="text-gray-500 text-sm mb-6">
        Cliente: <strong>{proposta.clientes?.nome}</strong>. Confirme os dados abaixo — isso vai
        criar o contrato e gerar as 12 visitas mensais do primeiro ciclo.
      </p>

      {erro && <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-2">{erro}</div>}

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs text-gray-500">Data de início do contrato</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">Ancora o ciclo de 12 meses (mês 1 = este mês)</p>
          </div>
          <div>
            <label className="text-xs text-gray-500">Valor do contrato (R$)</label>
            <input
              type="number"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <label className="text-sm font-medium text-gray-700 mb-2 block">Equipamentos que entram no contrato</label>
        <div className="space-y-2 mb-3">
          {itens.map((item, i) => (
            <div key={item.id} className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-lg p-2">
              <input
                value={item.descricao_equipamento || ''}
                onChange={(e) => atualizarItem(i, 'descricao_equipamento', e.target.value)}
                className="col-span-4 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              />
              <input
                value={item.local || ''}
                onChange={(e) => atualizarItem(i, 'local', e.target.value)}
                placeholder="Local"
                className="col-span-3 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              />
              <input
                type="number"
                value={item.capacidade_btu || ''}
                onChange={(e) => atualizarItem(i, 'capacidade_btu', e.target.value)}
                placeholder="BTU/h"
                className="col-span-2 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              />
              <select
                value={item.frequencia_higienizacao}
                onChange={(e) => atualizarItem(i, 'frequencia_higienizacao', e.target.value)}
                className="col-span-3 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              >
                {FREQUENCIAS_HIGIENIZACAO.map((f) => (
                  <option key={f} value={f}>
                    Higien. {f}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-500">
          BTU/h total: <strong>{totalBtu.toLocaleString('pt-BR')}</strong>
          {' — '}
          {exigeRt ? (
            <span className="text-amber-600 font-medium">exige RT (acima de 60.000 BTU/h)</span>
          ) : (
            <span className="text-gray-400">não exige RT</span>
          )}
        </p>
      </div>

      <div className="flex justify-end">
        <button
          onClick={converter}
          disabled={convertendo}
          className="rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700 disabled:opacity-60"
        >
          {convertendo ? 'Convertendo...' : 'Confirmar e criar contrato'}
        </button>
      </div>
    </div>
  )
}
