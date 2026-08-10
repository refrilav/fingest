import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatDateBR, formatCurrencyBRL, todayISO } from '../lib/format'
import BuscaPessoa from '../components/BuscaPessoa'
import {
  Plus,
  Wrench,
  Play,
  CheckCircle2,
  X,
  Trash2,
  Pencil,
  ClipboardList,
} from 'lucide-react'

const STATUS_ATUAL_OPCOES = [
  'Recolhida para oficina',
  'Peça encomendada',
  'Aguardando aprovação do orçamento',
  'Pronta para entrega',
  'Em atendimento no local',
  'Outro...',
]

const CAMPOS_VAZIOS = {
  cliente_id: '',
  equipamento_id: '',
  categoria_id: '',
  centro_custo_id: '',
  descricao_problema: '',
  valor_orcamento: '',
  endereco: '',
  observacoes: '',
  garantia_dias: '',
  data_abertura: todayISO(),
}

export default function OrdensServico() {
  const [lista, setLista] = useState([])
  const [equipamentos, setEquipamentos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [centros, setCentros] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [form, setForm] = useState(CAMPOS_VAZIOS)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [filtroStatus, setFiltroStatus] = useState('abertas')

  // estado para edição de status_atual por OS
  const [editandoStatusId, setEditandoStatusId] = useState(null)
  const [statusAtualForm, setStatusAtualForm] = useState({ opcao: STATUS_ATUAL_OPCOES[0], texto: '' })

  // estado para o modal de conclusão
  const [concluindoId, setConcluindoId] = useState(null)
  const [concluirForm, setConcluirForm] = useState({ valor_final: '', categoria_id: '' })

  async function carregar() {
    setLoading(true)
    const [os, equips, cats, cent] = await Promise.all([
      supabase
        .from('ordens_servico')
        .select('*, clientes(nome, telefone, endereco), equipamentos(nome), categorias(nome), centros_de_custo(nome)')
        .order('numero', { ascending: false })
        .range(0, 9999),
      supabase.from('equipamentos').select('*').eq('ativo', true).order('nome').range(0, 9999),
      supabase.from('categorias').select('*').eq('tipo', 'receita').eq('ativo', true).order('nome').range(0, 9999),
      supabase.from('centros_de_custo').select('*').eq('ativo', true).order('nome').range(0, 9999),
    ])
    if (os.error) setErro(os.error.message)
    else setLista(os.data)
    setEquipamentos(equips.data || [])
    setCategorias(cats.data || [])
    setCentros(cent.data || [])
    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  function cancelarFormulario() {
    setForm(CAMPOS_VAZIOS)
    setEditandoId(null)
    setMostrarForm(false)
  }

  async function salvar(e) {
    e.preventDefault()
    if (!form.descricao_problema.trim()) return

    const payload = {
      cliente_id: form.cliente_id || null,
      equipamento_id: form.equipamento_id || null,
      categoria_id: form.categoria_id || null,
      centro_custo_id: form.centro_custo_id || null,
      descricao_problema: form.descricao_problema.trim(),
      valor_orcamento: form.valor_orcamento ? Number(form.valor_orcamento) : null,
      endereco: form.endereco || null,
      observacoes: form.observacoes || null,
      garantia_dias: form.garantia_dias ? Number(form.garantia_dias) : null,
      data_abertura: form.data_abertura,
    }

    const { error } = editandoId
      ? await supabase.from('ordens_servico').update(payload).eq('id', editandoId)
      : await supabase.from('ordens_servico').insert(payload)

    if (error) {
      setErro(error.message)
      return
    }
    cancelarFormulario()
    carregar()
  }

  function iniciarEdicao(os) {
    setForm({
      cliente_id: os.cliente_id || '',
      equipamento_id: os.equipamento_id || '',
      categoria_id: os.categoria_id || '',
      centro_custo_id: os.centro_custo_id || '',
      descricao_problema: os.descricao_problema || '',
      valor_orcamento: os.valor_orcamento != null ? String(os.valor_orcamento) : '',
      endereco: os.endereco || '',
      observacoes: os.observacoes || '',
      garantia_dias: os.garantia_dias != null ? String(os.garantia_dias) : '',
      data_abertura: os.data_abertura,
    })
    setEditandoId(os.id)
    setMostrarForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Ao escolher um cliente no formulário, pré-preenche o endereço (se vazio) com o do cadastro
  async function handleClienteSelecionado(clienteId) {
    setForm((f) => ({ ...f, cliente_id: clienteId }))
    if (!clienteId) return
    const { data } = await supabase.from('clientes').select('endereco').eq('id', clienteId).single()
    if (data?.endereco) {
      setForm((f) => (f.endereco ? f : { ...f, endereco: data.endereco }))
    }
  }

  async function iniciarOS(os) {
    const { error } = await supabase
      .from('ordens_servico')
      .update({ status: 'em_andamento', data_inicio: todayISO() })
      .eq('id', os.id)
    if (error) {
      setErro(error.message)
      return
    }
    carregar()
  }

  function abrirEdicaoStatus(os) {
    setEditandoStatusId(os.id)
    const jaEhOpcaoPadrao = STATUS_ATUAL_OPCOES.slice(0, -1).includes(os.status_atual)
    setStatusAtualForm({
      opcao: jaEhOpcaoPadrao ? os.status_atual : os.status_atual ? 'Outro...' : STATUS_ATUAL_OPCOES[0],
      texto: jaEhOpcaoPadrao ? '' : os.status_atual || '',
    })
  }

  async function salvarStatusAtual(osId) {
    const valor = statusAtualForm.opcao === 'Outro...' ? statusAtualForm.texto.trim() : statusAtualForm.opcao
    const { error } = await supabase.from('ordens_servico').update({ status_atual: valor || null }).eq('id', osId)
    if (error) {
      setErro(error.message)
      return
    }
    setEditandoStatusId(null)
    carregar()
  }

  function abrirConclusao(os) {
    setConcluindoId(os.id)
    setConcluirForm({
      valor_final: os.valor_orcamento != null ? String(os.valor_orcamento) : '',
      categoria_id: os.categoria_id || '',
    })
  }

  async function confirmarConclusao(os) {
    const valorFinal = Number(concluirForm.valor_final)
    if (!valorFinal || valorFinal <= 0) {
      setErro('Informe o valor final do serviço para concluir a OS.')
      return
    }

    const hoje = todayISO()
    const descricaoLancamento = `OS #${os.numero} — ${os.descricao_problema}`.substring(0, 250)

    const { data: novoLancamento, error: erroLancamento } = await supabase
      .from('lancamentos')
      .insert({
        tipo: 'receber',
        descricao: descricaoLancamento,
        valor: valorFinal,
        data_vencimento: hoje,
        data_competencia: hoje,
        categoria_id: concluirForm.categoria_id || null,
        centro_custo_id: os.centro_custo_id || null,
        cliente_id: os.cliente_id || null,
        equipamento_id: os.equipamento_id || null,
        observacoes: `Gerado automaticamente pela conclusão da OS #${os.numero}.`,
      })
      .select()
      .single()

    if (erroLancamento) {
      setErro(erroLancamento.message)
      return
    }

    const { error: erroOS } = await supabase
      .from('ordens_servico')
      .update({
        status: 'finalizada',
        data_conclusao: hoje,
        valor_final: valorFinal,
        categoria_id: concluirForm.categoria_id || null,
        lancamento_id: novoLancamento.id,
      })
      .eq('id', os.id)

    if (erroOS) {
      setErro(erroOS.message)
      return
    }

    setConcluindoId(null)
    carregar()
  }

  async function cancelarOS(id) {
    if (!confirm('Cancelar esta OS? Ela sai da lista de abertas, mas fica no histórico.')) return
    const { error } = await supabase.from('ordens_servico').update({ status: 'cancelada' }).eq('id', id)
    if (error) {
      setErro(error.message)
      return
    }
    carregar()
  }

  async function excluir(id) {
    if (!confirm('Excluir esta OS permanentemente? Isso não afeta o contas a receber já gerado, se houver.')) return
    const { error } = await supabase.from('ordens_servico').delete().eq('id', id)
    if (error) {
      setErro(error.message)
      return
    }
    carregar()
  }

  const listaFiltrada = lista.filter((os) => {
    if (filtroStatus === 'todas') return true
    if (filtroStatus === 'abertas') return os.status === 'nao_iniciada' || os.status === 'em_andamento'
    return os.status === filtroStatus
  })

  return (
    <div className="max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1 gap-2">
        <h2 className="text-2xl font-bold text-gray-900">Ordens de Serviço</h2>
        <button
          onClick={() => {
            if (mostrarForm) cancelarFormulario()
            else {
              setForm(CAMPOS_VAZIOS)
              setMostrarForm(true)
            }
          }}
          className="flex items-center gap-1 rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700"
        >
          <Plus size={16} /> Nova OS
        </button>
      </div>
      <p className="text-gray-500 text-sm mb-4">
        Ao concluir, gera automaticamente um lançamento em Contas a Receber.
      </p>

      {erro && <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-2">{erro}</div>}

      {mostrarForm && (
        <form onSubmit={salvar} className="bg-white border border-gray-200 rounded-lg p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {editandoId && <p className="col-span-1 sm:col-span-2 text-sm font-medium text-primary-700 -mb-1">Editando OS</p>}

          <BuscaPessoa
            tabela="clientes"
            value={form.cliente_id}
            onChange={handleClienteSelecionado}
            placeholder="Buscar cliente por nome..."
          />
          <select
            value={form.equipamento_id}
            onChange={(e) => setForm({ ...form, equipamento_id: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Equipamento...</option>
            {equipamentos.map((eq) => (
              <option key={eq.id} value={eq.id}>{eq.nome}</option>
            ))}
          </select>

          <textarea
            placeholder="Descrição do problema / serviço solicitado *"
            value={form.descricao_problema}
            onChange={(e) => setForm({ ...form, descricao_problema: e.target.value })}
            className="col-span-1 sm:col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            rows={2}
            required
          />

          <input
            placeholder="Endereço do atendimento"
            value={form.endereco}
            onChange={(e) => setForm({ ...form, endereco: e.target.value })}
            className="col-span-1 sm:col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />

          <input
            type="date"
            value={form.data_abertura}
            onChange={(e) => setForm({ ...form, data_abertura: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Valor orçado (opcional)"
            value={form.valor_orcamento}
            onChange={(e) => setForm({ ...form, valor_orcamento: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />

          <select
            value={form.categoria_id}
            onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Serviço/categoria (opcional)...</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
          <select
            value={form.centro_custo_id}
            onChange={(e) => setForm({ ...form, centro_custo_id: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Centro de custo (opcional)...</option>
            {centros.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>

          <input
            type="number"
            placeholder="Garantia (dias, opcional)"
            value={form.garantia_dias}
            onChange={(e) => setForm({ ...form, garantia_dias: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />

          <textarea
            placeholder="Observações"
            value={form.observacoes}
            onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            className="col-span-1 sm:col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            rows={2}
          />

          <div className="col-span-1 sm:col-span-2 flex justify-end gap-2">
            <button type="button" onClick={cancelarFormulario} className="px-4 py-2 text-sm text-gray-500">
              Cancelar
            </button>
            <button type="submit" className="rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700">
              {editandoId ? 'Salvar alterações' : 'Criar OS'}
            </button>
          </div>
        </form>
      )}

      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { valor: 'abertas', label: 'Abertas' },
          { valor: 'nao_iniciada', label: 'Não iniciadas' },
          { valor: 'em_andamento', label: 'Em andamento' },
          { valor: 'finalizada', label: 'Finalizadas' },
          { valor: 'cancelada', label: 'Canceladas' },
          { valor: 'todas', label: 'Todas' },
        ].map((f) => (
          <button
            key={f.valor}
            onClick={() => setFiltroStatus(f.valor)}
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              filtroStatus === f.valor ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Carregando...</p>
      ) : listaFiltrada.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 flex flex-col items-center text-center text-gray-400">
          <ClipboardList size={28} className="mb-3" />
          <p className="text-sm">Nenhuma OS encontrada nesse filtro.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {listaFiltrada.map((os) => (
            <li key={os.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-gray-400">OS #{os.numero}</span>
                    <StatusBadge status={os.status} />
                  </div>
                  <p className="text-sm font-medium text-gray-800 mt-1">
                    {os.clientes?.nome || '(Sem cliente)'}
                    {os.equipamentos?.nome ? ` · ${os.equipamentos.nome}` : ''}
                  </p>
                  <p className="text-sm text-gray-600 mt-0.5">{os.descricao_problema}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Aberta em {formatDateBR(os.data_abertura)}
                    {os.endereco ? ` · ${os.endereco}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {(os.valor_final ?? os.valor_orcamento) != null && (
                    <p className="text-sm font-semibold text-gray-800">
                      {formatCurrencyBRL(os.valor_final ?? os.valor_orcamento)}
                      <span className="block text-[11px] font-normal text-gray-400">
                        {os.valor_final != null ? 'valor final' : 'orçado'}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              {os.status === 'em_andamento' && (
                <div className="mb-2">
                  {editandoStatusId === os.id ? (
                    <div className="flex flex-wrap items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2">
                      <select
                        value={statusAtualForm.opcao}
                        onChange={(e) => setStatusAtualForm({ ...statusAtualForm, opcao: e.target.value })}
                        className="rounded-lg border border-gray-300 px-2 py-1 text-xs"
                      >
                        {STATUS_ATUAL_OPCOES.map((op) => (
                          <option key={op} value={op}>{op}</option>
                        ))}
                      </select>
                      {statusAtualForm.opcao === 'Outro...' && (
                        <input
                          value={statusAtualForm.texto}
                          onChange={(e) => setStatusAtualForm({ ...statusAtualForm, texto: e.target.value })}
                          placeholder="Descreva o status..."
                          className="rounded-lg border border-gray-300 px-2 py-1 text-xs flex-1 min-w-[140px]"
                        />
                      )}
                      <button
                        onClick={() => salvarStatusAtual(os.id)}
                        className="rounded-lg bg-amber-600 text-white px-3 py-1 text-xs font-medium hover:bg-amber-700"
                      >
                        Salvar
                      </button>
                      <button onClick={() => setEditandoStatusId(null)} className="text-xs text-gray-500 px-2">
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => abrirEdicaoStatus(os)}
                      className="flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full hover:bg-amber-100"
                    >
                      <Wrench size={12} />
                      {os.status_atual || 'Definir status atual...'}
                    </button>
                  )}
                </div>
              )}

              {concluindoId === os.id && (
                <div className="mb-3 bg-green-50 border border-green-200 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Valor final do serviço *"
                    value={concluirForm.valor_final}
                    onChange={(e) => setConcluirForm({ ...concluirForm, valor_final: e.target.value })}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                  />
                  <select
                    value={concluirForm.categoria_id}
                    onChange={(e) => setConcluirForm({ ...concluirForm, categoria_id: e.target.value })}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                  >
                    <option value="">Serviço/categoria...</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                  <div className="col-span-1 sm:col-span-2 flex justify-end gap-2">
                    <button onClick={() => setConcluindoId(null)} className="px-3 py-1.5 text-sm text-gray-500">
                      Cancelar
                    </button>
                    <button
                      onClick={() => confirmarConclusao(os)}
                      className="flex items-center gap-1 rounded-lg bg-green-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-green-700"
                    >
                      <CheckCircle2 size={14} /> Concluir e gerar conta a receber
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                {os.status === 'nao_iniciada' && (
                  <button
                    onClick={() => iniciarOS(os)}
                    className="flex items-center gap-1 rounded-lg bg-primary-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-primary-700"
                  >
                    <Play size={13} /> Iniciar
                  </button>
                )}
                {os.status === 'em_andamento' && concluindoId !== os.id && (
                  <button
                    onClick={() => abrirConclusao(os)}
                    className="flex items-center gap-1 rounded-lg bg-green-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-green-700"
                  >
                    <CheckCircle2 size={13} /> Concluir
                  </button>
                )}
                {(os.status === 'nao_iniciada' || os.status === 'em_andamento') && (
                  <button
                    onClick={() => cancelarOS(os.id)}
                    className="flex items-center gap-1 rounded-lg bg-gray-100 text-gray-500 px-3 py-1.5 text-xs hover:bg-gray-200"
                  >
                    <X size={13} /> Cancelar OS
                  </button>
                )}
                <button
                  onClick={() => iniciarEdicao(os)}
                  className="flex items-center gap-1 rounded-lg bg-gray-100 text-gray-500 px-3 py-1.5 text-xs hover:bg-gray-200"
                >
                  <Pencil size={13} /> Editar
                </button>
                <button
                  onClick={() => excluir(os.id)}
                  className="flex items-center gap-1 rounded-lg bg-gray-100 text-gray-500 px-3 py-1.5 text-xs hover:bg-red-50 hover:text-red-600 ml-auto"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  const map = {
    nao_iniciada: 'bg-gray-100 text-gray-600',
    em_andamento: 'bg-amber-100 text-amber-700',
    finalizada: 'bg-green-100 text-green-700',
    cancelada: 'bg-red-50 text-red-500',
  }
  const label = {
    nao_iniciada: 'Não iniciada',
    em_andamento: 'Em andamento',
    finalizada: 'Finalizada',
    cancelada: 'Cancelada',
  }
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status]}`}>{label[status]}</span>
}
