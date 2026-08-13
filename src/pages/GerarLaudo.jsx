import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { todayISO } from '../lib/format'
import { ArrowLeft, Check, Plus, X } from 'lucide-react'

const CHECKLIST_PADRAO = [
  'Verificar e eliminar sujeira, danos e corrosão no gabinete, na moldura da serpentina e na bandeja',
  'Limpar as serpentinas e bandejas',
  'Verificar a operação de drenagem de água da bandeja',
  'Lavar as bandejas com remoção de biofilme (lodo)',
  'Limpar o gabinete do condicionador e ventiladores',
  'Verificar e limpar os filtros de ar',
  'Verificar e eliminar danos e corrosão',
  'Verificar e eliminar frestas dos filtros',
  'Pulverizar bactericida',
]

export default function GerarLaudo() {
  const { osId } = useParams()
  const navigate = useNavigate()
  const [os, setOs] = useState(null)
  const [laudoExistente, setLaudoExistente] = useState(null)
  const [dataEmissao, setDataEmissao] = useState(todayISO())
  const [equipamentoDescricao, setEquipamentoDescricao] = useState('')
  const [capacidadeBtu, setCapacidadeBtu] = useState('')
  const [checklist, setChecklist] = useState(CHECKLIST_PADRAO.map((descricao) => ({ descricao, status: 'OK', observacoes: '' })))
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      const { data: osData, error: erroOS } = await supabase
        .from('ordens_servico')
        .select('*, clientes(nome), ativos(local, modelo, capacidade_btu), equipamentos(nome)')
        .eq('id', osId)
        .single()
      if (erroOS) {
        setErro(erroOS.message)
        setLoading(false)
        return
      }
      setOs(osData)

      const { data: laudoData } = await supabase
        .from('laudos')
        .select('*')
        .eq('ordem_servico_id', osId)
        .maybeSingle()

      if (laudoData) {
        setLaudoExistente(laudoData)
        setDataEmissao(laudoData.data_emissao)
        setEquipamentoDescricao(laudoData.equipamento_descricao || '')
        setCapacidadeBtu(laudoData.capacidade_btu || '')
        setChecklist(laudoData.checklist?.length ? laudoData.checklist : CHECKLIST_PADRAO.map((d) => ({ descricao: d, status: 'OK', observacoes: '' })))
      } else {
        setDataEmissao(osData.data_conclusao || todayISO())
        setEquipamentoDescricao(osData.ativos?.modelo || osData.equipamentos?.nome || '')
        setCapacidadeBtu(osData.ativos?.capacidade_btu || '')
      }
      setLoading(false)
    }
    carregar()
  }, [osId])

  function atualizarItem(i, campo, valor) {
    const novos = [...checklist]
    novos[i] = { ...novos[i], [campo]: valor }
    setChecklist(novos)
  }

  function adicionarItem() {
    setChecklist([...checklist, { descricao: '', status: 'OK', observacoes: '' }])
  }

  function removerItem(i) {
    setChecklist(checklist.filter((_, idx) => idx !== i))
  }

  async function salvar() {
    setSalvando(true)
    setErro(null)
    const payload = {
      ordem_servico_id: osId,
      ativo_id: os.ativo_id || null,
      cliente_id: os.cliente_id || null,
      data_emissao: dataEmissao,
      equipamento_descricao: equipamentoDescricao || null,
      capacidade_btu: capacidadeBtu || null,
      checklist,
    }

    let laudoId = laudoExistente?.id
    if (laudoExistente) {
      const { error } = await supabase.from('laudos').update(payload).eq('id', laudoExistente.id)
      if (error) {
        setErro(error.message)
        setSalvando(false)
        return
      }
    } else {
      const { data, error } = await supabase.from('laudos').insert(payload).select().single()
      if (error) {
        setErro(error.message)
        setSalvando(false)
        return
      }
      laudoId = data.id
    }
    setSalvando(false)
    navigate(`/laudo/${laudoId}/imprimir`)
  }

  if (loading) return <p className="text-gray-400 text-sm p-6">Carregando...</p>
  if (erro && !os) return <div className="p-6 text-red-600 text-sm">{erro}</div>
  if (!os) return null

  return (
    <div className="max-w-2xl">
      <Link to="/ordens-servico" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Voltar
      </Link>

      <h2 className="text-2xl font-bold text-gray-900 mb-1">
        {laudoExistente ? 'Editar Laudo' : 'Gerar Laudo'} — OS #{os.numero}
      </h2>
      <p className="text-gray-500 text-sm mb-4">
        {os.clientes?.nome} {os.ativos?.local ? `· ${os.ativos.local}` : ''}
      </p>

      {erro && <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-2">{erro}</div>}

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data de emissão</label>
            <input
              type="date"
              value={dataEmissao}
              onChange={(e) => setDataEmissao(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Equipamento</label>
            <input
              value={equipamentoDescricao}
              onChange={(e) => setEquipamentoDescricao(e.target.value)}
              placeholder="Ex: Split EOS"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Capacidade (BTU)</label>
            <input
              value={capacidadeBtu}
              onChange={(e) => setCapacidadeBtu(e.target.value)}
              placeholder="Ex: 18000"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <p className="text-sm font-medium text-gray-700 mb-2">Check-list de higienização</p>
        <div className="space-y-2">
          {checklist.map((item, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-gray-50 rounded-lg p-2">
              <input
                value={item.descricao}
                onChange={(e) => atualizarItem(i, 'descricao', e.target.value)}
                className="sm:col-span-6 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              />
              <select
                value={item.status}
                onChange={(e) => atualizarItem(i, 'status', e.target.value)}
                className="sm:col-span-2 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="OK">OK</option>
                <option value="Não">Não</option>
                <option value="N/A">N/A</option>
              </select>
              <input
                value={item.observacoes}
                onChange={(e) => atualizarItem(i, 'observacoes', e.target.value)}
                placeholder="Observações"
                className="sm:col-span-3 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              />
              <button onClick={() => removerItem(i)} className="sm:col-span-1 text-gray-400 hover:text-red-600 justify-self-end">
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={adicionarItem}
          className="flex items-center gap-1 text-sm text-primary-700 hover:bg-primary-50 rounded-lg px-3 py-1.5 mt-2"
        >
          <Plus size={14} /> Adicionar item
        </button>
      </div>

      <div className="flex justify-end">
        <button
          onClick={salvar}
          disabled={salvando}
          className="flex items-center gap-1 rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
        >
          <Check size={16} /> {salvando ? 'Salvando...' : 'Salvar e imprimir'}
        </button>
      </div>
    </div>
  )
}
