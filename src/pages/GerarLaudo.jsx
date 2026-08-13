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
  const [equipamentosLaudo, setEquipamentosLaudo] = useState([]) // [{ativo_id, descricao, capacidade_btu}]
  const [checklist, setChecklist] = useState(CHECKLIST_PADRAO.map((descricao) => ({ descricao, status: 'OK', observacoes: '' })))
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      const [osRes, laudoRes] = await Promise.all([
        supabase
          .from('ordens_servico')
          .select('*, clientes(nome), equipamentos(nome), ordens_servico_ativos(ativo_id, ativos(local, modelo, capacidade_btu))')
          .eq('id', osId)
          .single(),
        supabase.from('laudos').select('*, laudo_ativos(*)').eq('ordem_servico_id', osId).maybeSingle(),
      ])
      if (osRes.error) {
        setErro(osRes.error.message)
        setLoading(false)
        return
      }
      setOs(osRes.data)

      if (laudoRes.data) {
        setLaudoExistente(laudoRes.data)
        setDataEmissao(laudoRes.data.data_emissao)
        setChecklist(laudoRes.data.checklist?.length ? laudoRes.data.checklist : CHECKLIST_PADRAO.map((d) => ({ descricao: d, status: 'OK', observacoes: '' })))
        setEquipamentosLaudo(
          (laudoRes.data.laudo_ativos || []).map((la) => ({
            ativo_id: la.ativo_id,
            descricao: la.descricao_equipamento || '',
            capacidade_btu: la.capacidade_btu || '',
          }))
        )
      } else {
        setDataEmissao(osRes.data.data_conclusao || todayISO())
        const vinculados = osRes.data.ordens_servico_ativos || []
        if (vinculados.length > 0) {
          setEquipamentosLaudo(
            vinculados.map((v) => ({
              ativo_id: v.ativo_id,
              descricao: v.ativos?.modelo || osRes.data.equipamentos?.nome || '',
              capacidade_btu: v.ativos?.capacidade_btu || '',
            }))
          )
        } else {
          setEquipamentosLaudo([{ ativo_id: null, descricao: osRes.data.equipamentos?.nome || '', capacidade_btu: '' }])
        }
      }
      setLoading(false)
    }
    carregar()
  }, [osId])

  function atualizarEquip(i, campo, valor) {
    const novos = [...equipamentosLaudo]
    novos[i] = { ...novos[i], [campo]: valor }
    setEquipamentosLaudo(novos)
  }

  function adicionarEquip() {
    setEquipamentosLaudo([...equipamentosLaudo, { ativo_id: null, descricao: '', capacidade_btu: '' }])
  }

  function removerEquip(i) {
    setEquipamentosLaudo(equipamentosLaudo.filter((_, idx) => idx !== i))
  }

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
      cliente_id: os.cliente_id || null,
      data_emissao: dataEmissao,
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
      await supabase.from('laudo_ativos').delete().eq('laudo_id', laudoExistente.id)
    } else {
      const { data, error } = await supabase.from('laudos').insert(payload).select().single()
      if (error) {
        setErro(error.message)
        setSalvando(false)
        return
      }
      laudoId = data.id
    }

    const equipamentosValidos = equipamentosLaudo.filter((e) => e.descricao.trim())
    if (equipamentosValidos.length > 0) {
      const { error: erroEquip } = await supabase.from('laudo_ativos').insert(
        equipamentosValidos.map((e) => ({
          laudo_id: laudoId,
          ativo_id: e.ativo_id || null,
          descricao_equipamento: e.descricao || null,
          capacidade_btu: e.capacidade_btu || null,
        }))
      )
      if (erroEquip) {
        setErro(erroEquip.message)
        setSalvando(false)
        return
      }
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
      <p className="text-gray-500 text-sm mb-4">{os.clientes?.nome}</p>

      {erro && <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-2">{erro}</div>}

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <label className="block text-xs text-gray-500 mb-1">Data de emissão</label>
        <input
          type="date"
          value={dataEmissao}
          onChange={(e) => setDataEmissao(e.target.value)}
          className="w-full sm:w-48 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <p className="text-sm font-medium text-gray-700 mb-2">Relação de equipamentos</p>
        <div className="space-y-2">
          {equipamentosLaudo.map((eq, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-gray-50 rounded-lg p-2">
              <input
                placeholder="Equipamento (ex: Split EOS)"
                value={eq.descricao}
                onChange={(e) => atualizarEquip(i, 'descricao', e.target.value)}
                className="sm:col-span-7 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              />
              <input
                placeholder="Capacidade BTU"
                value={eq.capacidade_btu}
                onChange={(e) => atualizarEquip(i, 'capacidade_btu', e.target.value)}
                className="sm:col-span-4 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              />
              <button onClick={() => removerEquip(i)} className="sm:col-span-1 text-gray-400 hover:text-red-600 justify-self-end">
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={adicionarEquip}
          className="flex items-center gap-1 text-sm text-primary-700 hover:bg-primary-50 rounded-lg px-3 py-1.5 mt-2"
        >
          <Plus size={14} /> Adicionar equipamento
        </button>
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
