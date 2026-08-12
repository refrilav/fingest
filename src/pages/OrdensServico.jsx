import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatDateBR, formatCurrencyBRL, todayISO } from '../lib/format'
import BuscaPessoa from '../components/BuscaPessoa'
import BuscaPeca from '../components/BuscaPeca'
import SelectCategoria from '../components/SelectCategoria'
import {
  Plus,
  Wrench,
  Play,
  CheckCircle2,
  X,
  Trash2,
  Pencil,
  ClipboardList,
  Package,
  Printer,
  Receipt,
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
  mostrar_problema_na_impressao: true,
  endereco: '',
  observacoes: '',
  data_abertura: todayISO(),
  cliente_final: '',
}

const CONCLUIR_VAZIO = {
  categoria_id: '',
  valor_mao_de_obra: '',
  garantia_dias: '',
  garantia_unidade: 'dias',
  garantia_referencia: 'do serviço',
  garantiaReferenciaCustom: '',
  modoValor: 'detalhado',
  valorFechado: '',
  faturamento: 'agora', // 'agora' | 'acumular'
}
const OPCOES_REFERENCIA_GARANTIA = ['do serviço', 'da instalação', 'da peça', 'do equipamento', 'Outro...']

// "1 anos" fica estranho — usa singular quando a quantidade é 1
function unidadeGarantia(qtd, unidade) {
  if (Number(qtd) === 1) {
    if (unidade === 'anos') return 'ano'
    if (unidade === 'meses') return 'mês'
    if (unidade === 'dias') return 'dia'
  }
  return unidade
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

  const [editandoStatusId, setEditandoStatusId] = useState(null)
  const [statusAtualForm, setStatusAtualForm] = useState({ opcao: STATUS_ATUAL_OPCOES[0], texto: '' })

  const [concluindoId, setConcluindoId] = useState(null)
  const [concluirForm, setConcluirForm] = useState(CONCLUIR_VAZIO)

  async function carregar() {
    setLoading(true)
    const [os, equips, cats, cent] = await Promise.all([
      supabase
        .from('ordens_servico')
        .select(
          '*, clientes(nome, telefone, endereco), equipamentos(nome), categorias(nome), centros_de_custo(nome), ordens_servico_pecas(id, peca_id, nome_peca, quantidade, valor_unitario)'
        )
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
      mostrar_problema_na_impressao: form.mostrar_problema_na_impressao,
      endereco: form.endereco || null,
      observacoes: form.observacoes || null,
      data_abertura: form.data_abertura,
      cliente_final: form.cliente_final || null,
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
      mostrar_problema_na_impressao: os.mostrar_problema_na_impressao ?? true,
      endereco: os.endereco || '',
      observacoes: os.observacoes || '',
      data_abertura: os.data_abertura,
      cliente_final: os.cliente_final || '',
    })
    setEditandoId(os.id)
    setMostrarForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

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

  // ---------- Peças ----------

  async function adicionarPeca(os, peca) {
    const { error: e1 } = await supabase.from('ordens_servico_pecas').insert({
      ordem_servico_id: os.id,
      peca_id: peca.id,
      nome_peca: peca.nome,
      quantidade: 1,
      valor_unitario: peca.valor_venda,
    })
    if (e1) {
      setErro(e1.message)
      return
    }
    const { error: e2 } = await supabase
      .from('pecas')
      .update({ quantidade_estoque: Number(peca.quantidade_estoque) - 1 })
      .eq('id', peca.id)
    if (e2) {
      setErro(e2.message)
      return
    }
    carregar()
  }

  async function atualizarItemPeca(item, novaQuantidade, novoValor) {
    const diferenca = novaQuantidade - Number(item.quantidade)
    const { error: e1 } = await supabase
      .from('ordens_servico_pecas')
      .update({ quantidade: novaQuantidade, valor_unitario: novoValor })
      .eq('id', item.id)
    if (e1) {
      setErro(e1.message)
      return
    }
    if (item.peca_id && diferenca !== 0) {
      const { data: pecaAtual } = await supabase.from('pecas').select('quantidade_estoque').eq('id', item.peca_id).single()
      if (pecaAtual) {
        await supabase
          .from('pecas')
          .update({ quantidade_estoque: Number(pecaAtual.quantidade_estoque) - diferenca })
          .eq('id', item.peca_id)
      }
    }
    carregar()
  }

  async function removerItemPeca(item) {
    if (!confirm(`Remover "${item.nome_peca}" desta OS? A quantidade volta pro estoque.`)) return
    const { error: e1 } = await supabase.from('ordens_servico_pecas').delete().eq('id', item.id)
    if (e1) {
      setErro(e1.message)
      return
    }
    if (item.peca_id) {
      const { data: pecaAtual } = await supabase.from('pecas').select('quantidade_estoque').eq('id', item.peca_id).single()
      if (pecaAtual) {
        await supabase
          .from('pecas')
          .update({ quantidade_estoque: Number(pecaAtual.quantidade_estoque) + Number(item.quantidade) })
          .eq('id', item.peca_id)
      }
    }
    carregar()
  }

  async function salvarMaoDeObra(os, valor) {
    const { error } = await supabase.from('ordens_servico').update({ valor_mao_de_obra: valor }).eq('id', os.id)
    if (error) {
      setErro(error.message)
      return
    }
    carregar()
  }

  async function salvarServicosRealizados(os, texto) {
    const { error } = await supabase.from('ordens_servico').update({ servicos_realizados: texto || null }).eq('id', os.id)
    if (error) {
      setErro(error.message)
      return
    }
    carregar()
  }

  // ---------- Conclusão ----------

  function abrirConclusao(os) {
    setConcluindoId(os.id)
    setConcluirForm({
      categoria_id: os.categoria_id || '',
      valor_mao_de_obra: os.valor_mao_de_obra != null ? String(os.valor_mao_de_obra) : '',
      garantia_dias: os.garantia_dias != null ? String(os.garantia_dias) : '',
      garantia_unidade: os.garantia_unidade || 'dias',
      garantia_referencia: os.garantia_referencia || 'do serviço',
      modoValor: 'detalhado',
      valorFechado: '',
      faturamento: 'agora',
    })
  }

  function totalPecasDaOS(os) {
    return (os.ordens_servico_pecas || []).reduce((acc, i) => acc + Number(i.quantidade) * Number(i.valor_unitario), 0)
  }

  async function confirmarConclusao(os) {
    const totalPecas = totalPecasDaOS(os)
    const fechado = concluirForm.modoValor === 'fechado'
    const maoDeObra = fechado ? null : Number(concluirForm.valor_mao_de_obra) || 0
    const valorFinal = fechado ? Number(concluirForm.valorFechado) || 0 : totalPecas + maoDeObra

    if (valorFinal <= 0) {
      setErro(
        fechado
          ? 'Informe o valor total.'
          : 'O valor total (peças + mão de obra) precisa ser maior que zero para concluir.'
      )
      return
    }

    const hoje = todayISO()
    const nomeCliente = os.clientes?.nome || 'Cliente não identificado'
    const descricaoLancamento = `OS #${os.numero} — ${nomeCliente}`.substring(0, 250)
    const detalheValores = fechado
      ? `Valor fechado (peças + mão de obra não discriminados)${totalPecas > 0 ? ` · Peças usadas somam ${formatCurrencyBRL(totalPecas)} pelo preço de tabela, só como referência de estoque` : ''}`
      : `Peças: ${formatCurrencyBRL(totalPecas)} · Mão de obra: ${formatCurrencyBRL(maoDeObra)}`

    let lancamentoId = null

    if (concluirForm.faturamento === 'agora') {
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
          observacoes: `Gerado automaticamente pela conclusão da OS #${os.numero}. ${detalheValores}`,
        })
        .select()
        .single()

      if (erroLancamento) {
        setErro(erroLancamento.message)
        return
      }
      lancamentoId = novoLancamento.id
    }

    const { error: erroOS } = await supabase
      .from('ordens_servico')
      .update({
        status: 'finalizada',
        data_conclusao: hoje,
        valor_final: valorFinal,
        valor_mao_de_obra: maoDeObra,
        garantia_dias: concluirForm.garantia_dias ? Number(concluirForm.garantia_dias) : null,
        garantia_unidade: concluirForm.garantia_unidade,
        garantia_referencia:
          concluirForm.garantia_referencia === 'Outro...'
            ? concluirForm.garantiaReferenciaCustom || 'do serviço'
            : concluirForm.garantia_referencia,
        categoria_id: concluirForm.categoria_id || null,
        lancamento_id: lancamentoId,
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
        Valor, peças e garantia são definidos só na conclusão — na abertura ainda não se sabe.
      </p>

      {erro && <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-2">{erro}</div>}

      {mostrarForm && (
        <form onSubmit={salvar} className="bg-white border border-gray-200 rounded-lg p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {editandoId && <p className="col-span-1 sm:col-span-2 text-sm font-medium text-primary-700 -mb-1">Editando OS</p>}

          <BuscaPessoa
            tabela="clientes"
            value={form.cliente_id}
            onChange={handleClienteSelecionado}
            placeholder="Buscar cliente por nome, telefone ou endereço..."
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

          <input
            placeholder="Cliente final (opcional — quando o cliente acima é um parceiro/intermediário)"
            value={form.cliente_final}
            onChange={(e) => setForm({ ...form, cliente_final: e.target.value })}
            className="col-span-1 sm:col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />

          <textarea
            placeholder="Descrição do problema / serviço solicitado *"
            value={form.descricao_problema}
            onChange={(e) => setForm({ ...form, descricao_problema: e.target.value })}
            className="col-span-1 sm:col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            rows={2}
            required
          />
          <label className="col-span-1 sm:col-span-2 flex items-center gap-1.5 text-xs text-gray-500 -mt-2">
            <input
              type="checkbox"
              checked={form.mostrar_problema_na_impressao}
              onChange={(e) => setForm({ ...form, mostrar_problema_na_impressao: e.target.checked })}
            />
            Mostrar essa descrição na impressão da OS
          </label>

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
          <SelectCategoria
            tipo="receita"
            categorias={categorias}
            value={form.categoria_id}
            onChange={(id) => setForm({ ...form, categoria_id: id })}
            onCriada={(nova) => {
              setCategorias((prev) => [...prev, nova].sort((a, b) => a.nome.localeCompare(b.nome)))
              setForm((f) => ({ ...f, categoria_id: nova.id }))
            }}
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
          {listaFiltrada.map((os) => {
            const totalPecas = totalPecasDaOS(os)
            return (
              <li key={os.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-gray-400">OS #{os.numero}</span>
                      <StatusBadge status={os.status} />
                    </div>
                    <p className="text-sm font-medium text-gray-800 mt-1">
                      {os.clientes?.nome || '(Sem cliente)'}
                      {os.clientes?.telefone ? ` · ${os.clientes.telefone}` : ''}
                      {os.equipamentos?.nome ? ` · ${os.equipamentos.nome}` : ''}
                    </p>
                    {os.cliente_final && (
                      <p className="text-xs text-blue-600">Cliente final: {os.cliente_final}</p>
                    )}
                    <p className="text-sm text-gray-600 mt-0.5 whitespace-pre-wrap">{os.descricao_problema}</p>
                    {os.status === 'finalizada' && os.servicos_realizados && (
                      <p className="text-xs text-gray-500 mt-1">
                        <span className="font-medium text-gray-600">Serviços realizados:</span> {os.servicos_realizados}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Aberta em {formatDateBR(os.data_abertura)}
                      {os.endereco ? ` · ${os.endereco}` : ''}
                      {os.garantia_dias ? ` · Garantia: ${os.garantia_dias} dias` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {os.valor_final != null && (
                      <p className="text-sm font-semibold text-gray-800">
                        {formatCurrencyBRL(os.valor_final)}
                        <span className="block text-[11px] font-normal text-gray-400">valor final</span>
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

                {(os.status === 'em_andamento' || os.status === 'finalizada') && (os.ordens_servico_pecas || []).length > 0 && (
                  <div className="mb-2 bg-gray-50 border border-gray-100 rounded-lg p-2">
                    <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                      <Package size={11} /> Peças usadas
                    </p>
                    <ul className="space-y-1">
                      {os.ordens_servico_pecas.map((item) => (
                        <li key={item.id} className="flex items-center gap-2 text-xs">
                          <span className="flex-1 text-gray-700">{item.nome_peca}</span>
                          {os.status === 'em_andamento' ? (
                            <>
                              <input
                                type="number"
                                step="0.01"
                                defaultValue={item.quantidade}
                                onBlur={(e) => {
                                  const novaQtd = Number(e.target.value) || 0
                                  if (novaQtd !== Number(item.quantidade)) atualizarItemPeca(item, novaQtd, Number(item.valor_unitario))
                                }}
                                className="w-14 rounded border border-gray-300 px-1 py-0.5 text-right"
                              />
                              <span className="text-gray-400">×</span>
                              <input
                                type="number"
                                step="0.01"
                                defaultValue={item.valor_unitario}
                                onBlur={(e) => {
                                  const novoValor = Number(e.target.value) || 0
                                  if (novoValor !== Number(item.valor_unitario)) atualizarItemPeca(item, Number(item.quantidade), novoValor)
                                }}
                                className="w-20 rounded border border-gray-300 px-1 py-0.5 text-right"
                              />
                              <span className="w-20 text-right text-gray-600">
                                {formatCurrencyBRL(Number(item.quantidade) * Number(item.valor_unitario))}
                              </span>
                              <button onClick={() => removerItemPeca(item)} className="text-gray-400 hover:text-red-600">
                                <X size={13} />
                              </button>
                            </>
                          ) : (
                            <span className="text-gray-500">
                              {item.quantidade} × {formatCurrencyBRL(item.valor_unitario)} ={' '}
                              <span className="font-medium text-gray-700">
                                {formatCurrencyBRL(Number(item.quantidade) * Number(item.valor_unitario))}
                              </span>
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-right font-medium text-gray-700 mt-1">Total peças: {formatCurrencyBRL(totalPecas)}</p>
                  </div>
                )}

                {os.status === 'em_andamento' && (
                  <div className="mb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-gray-400 mb-0.5">Valor da mão de obra</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="R$ 0,00"
                        defaultValue={os.valor_mao_de_obra ?? ''}
                        onBlur={(e) => {
                          const novo = e.target.value === '' ? null : Number(e.target.value)
                          if (novo !== (os.valor_mao_de_obra ?? null)) salvarMaoDeObra(os, novo)
                        }}
                        className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-400 mb-0.5">Serviços realizados</label>
                      <textarea
                        placeholder={'Ex: troca do compressor\nlimpeza dos filtros\n(um item por linha, se quiser)'}
                        defaultValue={os.servicos_realizados ?? ''}
                        rows={3}
                        onBlur={(e) => {
                          if (e.target.value !== (os.servicos_realizados || '')) salvarServicosRealizados(os, e.target.value)
                        }}
                        className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm resize-y"
                      />
                    </div>
                  </div>
                )}

                {os.status === 'em_andamento' && (
                  <div className="mb-3">
                    <BuscaPeca onSelecionar={(peca) => adicionarPeca(os, peca)} placeholder="Adicionar peça usada..." />
                  </div>
                )}

                {concluindoId === os.id && (
                  <div className="mb-3 bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex gap-2 bg-white rounded-lg p-1 mb-2 border border-gray-200">
                      <button
                        type="button"
                        onClick={() => setConcluirForm({ ...concluirForm, modoValor: 'detalhado' })}
                        className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                          concluirForm.modoValor === 'detalhado' ? 'bg-green-600 text-white' : 'text-gray-500'
                        }`}
                      >
                        Peças + mão de obra
                      </button>
                      <button
                        type="button"
                        onClick={() => setConcluirForm({ ...concluirForm, modoValor: 'fechado' })}
                        className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                          concluirForm.modoValor === 'fechado' ? 'bg-green-600 text-white' : 'text-gray-500'
                        }`}
                      >
                        Valor fechado
                      </button>
                    </div>

                    <div className="flex gap-2 bg-white rounded-lg p-1 mb-2 border border-gray-200">
                      <button
                        type="button"
                        onClick={() => setConcluirForm({ ...concluirForm, faturamento: 'agora' })}
                        className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                          concluirForm.faturamento === 'agora' ? 'bg-blue-600 text-white' : 'text-gray-500'
                        }`}
                      >
                        Cobrar agora
                      </button>
                      <button
                        type="button"
                        onClick={() => setConcluirForm({ ...concluirForm, faturamento: 'acumular' })}
                        className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                          concluirForm.faturamento === 'acumular' ? 'bg-blue-600 text-white' : 'text-gray-500'
                        }`}
                      >
                        Acumular p/ cobrar depois
                      </button>
                    </div>
                    {concluirForm.faturamento === 'acumular' && (
                      <p className="text-xs text-blue-700 mb-2">
                        A OS fica finalizada com o valor registrado, mas <strong>não</strong> cria conta a receber
                        agora. Depois, na tela do cliente, você junta várias OS's e gera uma cobrança consolidada.
                      </p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                      {concluirForm.modoValor === 'detalhado' ? (
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Valor da mão de obra"
                          value={concluirForm.valor_mao_de_obra}
                          onChange={(e) => setConcluirForm({ ...concluirForm, valor_mao_de_obra: e.target.value })}
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                        />
                      ) : (
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Valor total"
                          value={concluirForm.valorFechado}
                          onChange={(e) => setConcluirForm({ ...concluirForm, valorFechado: e.target.value })}
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                        />
                      )}
                      <SelectCategoria
                        tipo="receita"
                        categorias={categorias}
                        value={concluirForm.categoria_id}
                        onChange={(id) => setConcluirForm({ ...concluirForm, categoria_id: id })}
                        onCriada={(nova) => {
                          setCategorias((prev) => [...prev, nova].sort((a, b) => a.nome.localeCompare(b.nome)))
                          setConcluirForm((f) => ({ ...f, categoria_id: nova.id }))
                        }}
                      />
                      <div className="col-span-1 sm:col-span-2 flex gap-2">
                        <input
                          type="number"
                          placeholder="Garantia (opcional)"
                          value={concluirForm.garantia_dias}
                          onChange={(e) => setConcluirForm({ ...concluirForm, garantia_dias: e.target.value })}
                          className="w-24 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                        />
                        <select
                          value={concluirForm.garantia_unidade}
                          onChange={(e) => setConcluirForm({ ...concluirForm, garantia_unidade: e.target.value })}
                          className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                        >
                          <option value="dias">dias</option>
                          <option value="meses">meses</option>
                          <option value="anos">anos</option>
                        </select>
                        <select
                          value={concluirForm.garantia_referencia}
                          onChange={(e) => setConcluirForm({ ...concluirForm, garantia_referencia: e.target.value })}
                          className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                        >
                          {OPCOES_REFERENCIA_GARANTIA.map((op) => (
                            <option key={op} value={op}>{op}</option>
                          ))}
                        </select>
                      </div>
                      {concluirForm.garantia_referencia === 'Outro...' && (
                        <input
                          type="text"
                          placeholder='Ex: "do compressor"'
                          value={concluirForm.garantiaReferenciaCustom}
                          onChange={(e) => setConcluirForm({ ...concluirForm, garantiaReferenciaCustom: e.target.value })}
                          className="col-span-1 sm:col-span-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                        />
                      )}
                    </div>

                    {concluirForm.garantia_dias && (
                      <p className="text-xs text-green-700 mb-2">
                        No documento vai aparecer: "Garantia de {concluirForm.garantia_dias}{' '}
                        {unidadeGarantia(concluirForm.garantia_dias, concluirForm.garantia_unidade)}{' '}
                        {concluirForm.garantia_referencia === 'Outro...'
                          ? concluirForm.garantiaReferenciaCustom
                          : concluirForm.garantia_referencia}
                        , a partir da conclusão do serviço."
                      </p>
                    )}

                    {concluirForm.modoValor === 'detalhado' ? (
                      <p className="text-sm text-green-800 mb-2">
                        Peças: <strong>{formatCurrencyBRL(totalPecas)}</strong> + Mão de obra:{' '}
                        <strong>{formatCurrencyBRL(Number(concluirForm.valor_mao_de_obra) || 0)}</strong> = Total:{' '}
                        <strong>{formatCurrencyBRL(totalPecas + (Number(concluirForm.valor_mao_de_obra) || 0))}</strong>
                      </p>
                    ) : (
                      <p className="text-sm text-green-800 mb-2">
                        Valor total: <strong>{formatCurrencyBRL(Number(concluirForm.valorFechado) || 0)}</strong>
                        {totalPecas > 0 && (
                          <span className="text-green-600 text-xs block">
                            (as peças usadas ficam registradas no estoque normalmente, sem afetar esse valor)
                          </span>
                        )}
                      </p>
                    )}

                    <div className="flex justify-end gap-2">
                      <button onClick={() => setConcluindoId(null)} className="px-3 py-1.5 text-sm text-gray-500">
                        Cancelar
                      </button>
                      <button
                        onClick={() => confirmarConclusao(os)}
                        className="flex items-center gap-1 rounded-lg bg-green-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-green-700"
                      >
                        <CheckCircle2 size={14} />{' '}
                        {concluirForm.faturamento === 'acumular' ? 'Concluir e acumular' : 'Concluir e gerar conta a receber'}
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
                  <Link
                    to={`/ordens-servico/${os.id}/imprimir`}
                    className="flex items-center gap-1 rounded-lg bg-gray-100 text-gray-500 px-3 py-1.5 text-xs hover:bg-gray-200"
                  >
                    <Printer size={13} /> Imprimir OS
                  </Link>
                  {os.status === 'finalizada' && os.lancamento_id && (
                    <Link
                      to={`/recibo/${os.lancamento_id}`}
                      className="flex items-center gap-1 rounded-lg bg-gray-100 text-gray-500 px-3 py-1.5 text-xs hover:bg-gray-200"
                    >
                      <Receipt size={13} /> Recibo
                    </Link>
                  )}
                  <button
                    onClick={() => excluir(os.id)}
                    className="flex items-center gap-1 rounded-lg bg-gray-100 text-gray-500 px-3 py-1.5 text-xs hover:bg-red-50 hover:text-red-600 ml-auto"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </li>
            )
          })}
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
