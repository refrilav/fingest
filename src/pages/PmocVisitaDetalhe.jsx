import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatDateBR, todayISO } from '../lib/format'
import { LABEL_GRUPO, statusVisita, COR_STATUS_VISITA, LABEL_STATUS_VISITA } from '../lib/pmoc'
import { ArrowLeft, Check, X, CheckCheck } from 'lucide-react'

export default function PmocVisitaDetalhe() {
  const { id } = useParams()
  const [visita, setVisita] = useState(null)
  const [contrato, setContrato] = useState(null)
  const [itens, setItens] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [marcandoTudo, setMarcandoTudo] = useState(false)

  const hoje = todayISO()

  async function carregar() {
    setLoading(true)
    const { data: v, error: erroV } = await supabase.from('pmoc_visitas').select('*').eq('id', id).single()
    if (erroV) {
      setErro(erroV.message)
      setLoading(false)
      return
    }
    const { data: c } = await supabase
      .from('pmoc_contratos')
      .select('*, clientes(nome)')
      .eq('id', v.contrato_id)
      .single()
    const { data: i } = await supabase
      .from('pmoc_visita_itens')
      .select('*, pmoc_equipamentos(descricao_equipamento, local)')
      .eq('visita_id', id)

    setVisita(v)
    setContrato(c)
    setItens(i || [])
    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [id])

  function toggleItemChecklist(itemIndex, checklistIndex) {
    const novos = [...itens]
    const checklist = [...novos[itemIndex].checklist]
    checklist[checklistIndex] = { ...checklist[checklistIndex], concluido: !checklist[checklistIndex].concluido }
    novos[itemIndex] = { ...novos[itemIndex], checklist }
    setItens(novos)
  }

  async function salvarItem(item) {
    const todosConcluidos = item.checklist.every((c) => c.concluido)
    const { error } = await supabase
      .from('pmoc_visita_itens')
      .update({
        checklist: item.checklist,
        concluido: todosConcluidos,
        data_execucao: todosConcluidos ? hoje : null,
      })
      .eq('id', item.id)
    if (error) setErro(error.message)
    else carregar()
  }

  // Marca todos os itens do checklist de UM equipamento e já salva
  async function marcarTudoEquipamento(itemIndex) {
    const item = itens[itemIndex]
    const checklist = item.checklist.map((c) => ({ ...c, concluido: true }))
    await salvarItem({ ...item, checklist })
  }

  // Marca TODOS os equipamentos da visita de uma vez (útil em contratos com muitos equipamentos)
  async function marcarTudoVisita() {
    if (!confirm('Marcar todos os itens de todos os equipamentos desta visita como concluídos?')) return
    setMarcandoTudo(true)
    const atualizacoes = itens.map((item) => ({
      id: item.id,
      checklist: item.checklist.map((c) => ({ ...c, concluido: true })),
      concluido: true,
      data_execucao: hoje,
    }))
    for (const upd of atualizacoes) {
      const { error } = await supabase
        .from('pmoc_visita_itens')
        .update({ checklist: upd.checklist, concluido: upd.concluido, data_execucao: upd.data_execucao })
        .eq('id', upd.id)
      if (error) {
        setErro(error.message)
        setMarcandoTudo(false)
        return
      }
    }
    setMarcandoTudo(false)
    carregar()
  }

  async function marcarVisitaRealizada() {
    setSalvando(true)
    const { error } = await supabase.from('pmoc_visitas').update({ data_realizada: hoje }).eq('id', id)
    setSalvando(false)
    if (error) {
      setErro(error.message)
      return
    }
    carregar()
  }

  async function reabrirVisita() {
    const { error } = await supabase.from('pmoc_visitas').update({ data_realizada: null }).eq('id', id)
    if (error) setErro(error.message)
    else carregar()
  }

  if (loading) return <p className="text-gray-400 text-sm">Carregando...</p>
  if (erro && !visita) return <p className="text-red-600 text-sm">{erro}</p>

  const status = statusVisita(visita, hoje)
  const todosItensConcluidos = itens.length > 0 && itens.every((i) => i.concluido)

  return (
    <div className="max-w-3xl">
      <Link to={`/pmoc/contratos/${visita.contrato_id}`} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
        <ArrowLeft size={14} /> Voltar para o contrato
      </Link>

      <div className="flex items-start justify-between mb-1">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {contrato?.clientes?.nome} — Mês {visita.numero_mes}
          </h2>
          <p className="text-gray-500 text-sm">Previsto para {formatDateBR(visita.data_prevista)}</p>
        </div>
        <span className={`text-xs rounded-full px-3 py-1 border font-medium ${COR_STATUS_VISITA[status]}`}>
          {LABEL_STATUS_VISITA[status]}
        </span>
      </div>

      {itens.length > 1 && !visita.data_realizada && (
        <div className="flex justify-end mt-2">
          <button
            onClick={marcarTudoVisita}
            disabled={marcandoTudo}
            className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 disabled:opacity-60"
          >
            <CheckCheck size={14} />
            {marcandoTudo ? 'Marcando...' : 'Marcar tudo (todos os equipamentos)'}
          </button>
        </div>
      )}

      {erro && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-red-50 text-red-700 text-sm px-4 py-2 mt-3">
          {erro}
          <button onClick={() => setErro(null)}><X size={14} /></button>
        </div>
      )}

      <div className="space-y-4 mt-4">
        {itens.map((item, itemIndex) => (
          <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-800">
                {item.pmoc_equipamentos?.descricao_equipamento || '(equipamento)'}
                {item.pmoc_equipamentos?.local && (
                  <span className="text-gray-400 font-normal"> · {item.pmoc_equipamentos.local}</span>
                )}
              </p>
              <div className="flex gap-1">
                {item.grupos.map((g) => (
                  <span key={g} className="text-xs bg-primary-50 text-primary-700 rounded-full px-2 py-0.5">
                    {LABEL_GRUPO[g]}
                  </span>
                ))}
              </div>
            </div>

            <ul className="space-y-1.5 mb-3">
              {item.checklist.map((c, checklistIndex) => (
                <li key={checklistIndex} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={c.concluido}
                    onChange={() => toggleItemChecklist(itemIndex, checklistIndex)}
                    className="mt-0.5"
                  />
                  <span className={c.concluido ? 'text-gray-400 line-through' : 'text-gray-700'}>{c.item}</span>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between">
              {item.concluido ? (
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <Check size={12} /> Concluído em {formatDateBR(item.data_execucao)}
                </span>
              ) : (
                <span className="text-xs text-gray-400">
                  {item.checklist.filter((c) => c.concluido).length}/{item.checklist.length} itens marcados
                </span>
              )}
              <div className="flex gap-2">
                {!item.concluido && (
                  <button
                    onClick={() => marcarTudoEquipamento(itemIndex)}
                    className="flex items-center gap-1 text-xs rounded-lg bg-primary-50 text-primary-700 px-3 py-1.5 hover:bg-primary-100"
                  >
                    <CheckCheck size={14} /> Marcar tudo
                  </button>
                )}
                <button
                  onClick={() => salvarItem(item)}
                  className="text-xs rounded-lg bg-gray-100 text-gray-700 px-3 py-1.5 hover:bg-gray-200"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        ))}
        {itens.length === 0 && (
          <p className="text-sm text-gray-400">Nenhum equipamento previsto para este mês.</p>
        )}
      </div>

      <div className="flex justify-end mt-4">
        {visita.data_realizada ? (
          <button onClick={reabrirVisita} className="text-sm text-gray-500 hover:text-gray-700">
            Reabrir visita
          </button>
        ) : (
          <button
            onClick={marcarVisitaRealizada}
            disabled={salvando}
            title={!todosItensConcluidos ? 'Ainda há itens de checklist não marcados' : ''}
            className="rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700 disabled:opacity-60"
          >
            {salvando ? 'Salvando...' : 'Marcar visita como realizada'}
          </button>
        )}
      </div>
    </div>
  )
}
