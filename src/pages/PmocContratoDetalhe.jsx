import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatDateBR, todayISO } from '../lib/format'
import {
  statusVisita,
  COR_STATUS_VISITA,
  LABEL_STATUS_VISITA,
  FREQUENCIAS_HIGIENIZACAO,
  adicionarEquipamentoContrato,
  removerEquipamentoContrato,
  alterarFrequenciaHigienizacao,
} from '../lib/pmoc'
import { ArrowLeft, Plus, X, AlertTriangle, Trash2, ChevronRight, FileText } from 'lucide-react'

const ITEM_VAZIO = { descricao_equipamento: '', local: '', capacidade_btu: '', frequencia_higienizacao: 'trimestral' }

export default function PmocContratoDetalhe() {
  const { id } = useParams()
  const [contrato, setContrato] = useState(null)
  const [resumo, setResumo] = useState(null)
  const [equipamentos, setEquipamentos] = useState([])
  const [visitas, setVisitas] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)

  const [mostrarNovoEquip, setMostrarNovoEquip] = useState(false)
  const [novoEquip, setNovoEquip] = useState(ITEM_VAZIO)

  const hoje = todayISO()

  async function carregar() {
    setLoading(true)
    const { data: c, error: erroC } = await supabase
      .from('pmoc_contratos')
      .select('*, clientes(nome)')
      .eq('id', id)
      .single()
    if (erroC) {
      setErro(erroC.message)
      setLoading(false)
      return
    }
    const { data: r } = await supabase.from('pmoc_contratos_resumo').select('*').eq('contrato_id', id).single()
    const { data: eq } = await supabase
      .from('pmoc_equipamentos')
      .select('*')
      .eq('contrato_id', id)
      .is('data_saida', null)
      .order('created_at')
    const { data: v } = await supabase
      .from('pmoc_visitas')
      .select('*')
      .eq('contrato_id', id)
      .order('numero_mes')

    setContrato(c)
    setResumo(r || null)
    setEquipamentos(eq || [])
    setVisitas(v || [])
    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [id])

  async function confirmarNovoEquip() {
    if (!novoEquip.descricao_equipamento.trim() && !novoEquip.local.trim()) return
    const { error } = await adicionarEquipamentoContrato(
      supabase,
      id,
      {
        descricao_equipamento: novoEquip.descricao_equipamento || null,
        local: novoEquip.local || null,
        capacidade_btu: novoEquip.capacidade_btu ? Number(novoEquip.capacidade_btu) : null,
        frequencia_higienizacao: novoEquip.frequencia_higienizacao,
      },
      hoje
    )
    if (error) {
      setErro(error.message)
      return
    }
    setNovoEquip(ITEM_VAZIO)
    setMostrarNovoEquip(false)
    carregar()
  }

  async function removerEquip(equip) {
    if (!confirm(`Remover "${equip.descricao_equipamento || equip.local || 'equipamento'}" do contrato a partir de hoje?`)) return
    const { error } = await removerEquipamentoContrato(supabase, equip.id, hoje)
    if (error) {
      setErro(error.message)
      return
    }
    carregar()
  }

  async function mudarFrequencia(equip, novaFrequencia) {
    const { error } = await alterarFrequenciaHigienizacao(supabase, equip.id, novaFrequencia, hoje)
    if (error) {
      setErro(error.message)
      return
    }
    carregar()
  }

  async function encerrarContrato() {
    if (!confirm('Encerrar este contrato PMOC? As visitas futuras continuam registradas, só o status muda.')) return
    const { error } = await supabase.from('pmoc_contratos').update({ status: 'encerrado' }).eq('id', id)
    if (error) {
      setErro(error.message)
      return
    }
    carregar()
  }

  if (loading) return <p className="text-gray-400 text-sm">Carregando...</p>
  if (erro && !contrato) return <p className="text-red-600 text-sm">{erro}</p>

  return (
    <div className="max-w-4xl">
      <Link to="/pmoc" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
        <ArrowLeft size={14} /> Voltar para contratos
      </Link>

      <div className="flex items-start justify-between mb-1">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{contrato.clientes?.nome}</h2>
          <p className="text-gray-500 text-sm">
            Contrato PMOC desde {formatDateBR(contrato.data_inicio)} · Status: {contrato.status}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to={`/pmoc/contratos/${id}/plano`}
            className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800"
          >
            <FileText size={14} /> Ver Plano PMOC
          </Link>
          <Link
            to={`/pmoc/contratos/${id}/relatorio`}
            className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800"
          >
            <FileText size={14} /> Ver relatório
          </Link>
          {contrato.status === 'ativo' && (
            <button onClick={encerrarContrato} className="text-xs text-red-500 hover:text-red-700">
              Encerrar contrato
            </button>
          )}
        </div>
      </div>

      {resumo?.exige_rt && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-3 mb-4">
          <AlertTriangle size={16} />
          Total de {Number(resumo.capacidade_total_btu).toLocaleString('pt-BR')} BTU/h — acima de 60.000 BTU/h,
          exige Responsável Técnico (RT ficará no carimbo do documento físico)
        </div>
      )}

      {erro && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-red-50 text-red-700 text-sm px-4 py-2">
          {erro}
          <button onClick={() => setErro(null)}><X size={14} /></button>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 mt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800">Equipamentos no contrato</h3>
          <button
            onClick={() => setMostrarNovoEquip((v) => !v)}
            className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1"
          >
            <Plus size={14} /> Adicionar equipamento
          </button>
        </div>

        {mostrarNovoEquip && (
          <div className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-lg p-2 mb-3">
            <input
              placeholder="Equipamento"
              value={novoEquip.descricao_equipamento}
              onChange={(e) => setNovoEquip({ ...novoEquip, descricao_equipamento: e.target.value })}
              className="col-span-4 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            />
            <input
              placeholder="Local"
              value={novoEquip.local}
              onChange={(e) => setNovoEquip({ ...novoEquip, local: e.target.value })}
              className="col-span-3 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            />
            <input
              placeholder="BTU/h"
              type="number"
              value={novoEquip.capacidade_btu}
              onChange={(e) => setNovoEquip({ ...novoEquip, capacidade_btu: e.target.value })}
              className="col-span-2 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            />
            <select
              value={novoEquip.frequencia_higienizacao}
              onChange={(e) => setNovoEquip({ ...novoEquip, frequencia_higienizacao: e.target.value })}
              className="col-span-2 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            >
              {FREQUENCIAS_HIGIENIZACAO.map((f) => (
                <option key={f} value={f}>Higien. {f}</option>
              ))}
            </select>
            <button onClick={confirmarNovoEquip} className="col-span-1 text-primary-600 hover:text-primary-800 flex justify-center">
              <Plus size={16} />
            </button>
          </div>
        )}

        <ul className="divide-y divide-gray-100">
          {equipamentos.map((eq) => (
            <li key={eq.id} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm text-gray-800">{eq.descricao_equipamento || '(sem descrição)'}</p>
                <p className="text-xs text-gray-500">
                  {eq.local && `${eq.local} · `}
                  {eq.capacidade_btu ? `${Number(eq.capacidade_btu).toLocaleString('pt-BR')} BTU/h · ` : ''}
                  desde {formatDateBR(eq.data_entrada)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={eq.frequencia_higienizacao}
                  onChange={(e) => mudarFrequencia(eq, e.target.value)}
                  className="text-xs rounded-lg border border-gray-300 px-2 py-1"
                >
                  {FREQUENCIAS_HIGIENIZACAO.map((f) => (
                    <option key={f} value={f}>Higien. {f}</option>
                  ))}
                </select>
                <button onClick={() => removerEquip(eq)} className="text-gray-400 hover:text-red-600 p-1">
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
          {equipamentos.length === 0 && <li className="py-2 text-sm text-gray-400">Nenhum equipamento ativo.</li>}
        </ul>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Ciclo de visitas (12 meses)</h3>
        <ul className="divide-y divide-gray-100">
          {visitas.map((v) => {
            const status = statusVisita(v, hoje)
            return (
              <li key={v.id}>
                <Link
                  to={`/pmoc/visitas/${v.id}`}
                  className="flex items-center justify-between py-2 hover:bg-gray-50 px-1 rounded-lg"
                >
                  <p className="text-sm text-gray-800">
                    Mês {v.numero_mes} — previsto {formatDateBR(v.data_prevista)}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs rounded-full px-2 py-1 border font-medium ${COR_STATUS_VISITA[status]}`}>
                      {LABEL_STATUS_VISITA[status]}
                    </span>
                    <ChevronRight size={14} className="text-gray-400" />
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
