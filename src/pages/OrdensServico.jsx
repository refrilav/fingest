import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatDateBR, formatCurrencyBRL, todayISO } from '../lib/format'
import BuscaPessoa from '../components/BuscaPessoa'
import BuscaPeca from '../components/BuscaPeca'
import BuscaAtivo from '../components/BuscaAtivo'
import SelectCategoria from '../components/SelectCategoria'
import {
  Plus,
  Wrench,
  CheckCircle2,
  X,
  Trash2,
  Pencil,
  ClipboardList,
  Package,
  Printer,
  Receipt,
  ChevronDown,
  ChevronUp,
  FileBarChart,
} from 'lucide-react'

// "2026-01-15T14:30" -> "15/01 14:30"
function formatDataHora(str) {
  if (!str) return ''
  const [data, hora] = str.split('T')
  if (!data) return str
  const [, mes, dia] = data.split('-')
  return `${dia}/${mes}${hora ? ` ${hora.substring(0, 5)}` : ''}`
}

const TIPOS_SERVICO = [
  { valor: 'higienizacao', label: 'Higienização' },
  { valor: 'instalacao', label: 'Instalação' },
  { valor: 'manutencao_corretiva', label: 'Manutenção corretiva' },
  { valor: 'outro', label: 'Outro' },
]

const CAMPOS_VAZIOS = {
  cliente_id: '',
  equipamento_id: '',
  categoria_id: '',
  centro_custo_id: '',
  tipo_servico: '',
  descricao_problema: '',
  mostrar_problema_na_impressao: true,
  endereco: '',
  observacoes: '',
  data_abertura: todayISO(),
  cliente_final: '',
  data_conclusao_edicao: '',
  iniciarAgora: true,
  dataAgendamento: '',
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
  dataConclusao: todayISO(),
  tecnico: '',
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
  const [searchParams] = useSearchParams()
  const [lista, setLista] = useState([])
  const [equipamentos, setEquipamentos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [centros, setCentros] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [form, setForm] = useState(CAMPOS_VAZIOS)
  const [ativosSelecionados, setAtivosSelecionados] = useState([]) // [{id, local, codigo}]
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [mostrarHistorico, setMostrarHistorico] = useState(false)

  const [mostrarListaAtivos, setMostrarListaAtivos] = useState(false)
  const [ativosDoCliente, setAtivosDoCliente] = useState([])

  const [concluindoId, setConcluindoId] = useState(null)
  const [concluirForm, setConcluirForm] = useState(CONCLUIR_VAZIO)
  const [expandidoId, setExpandidoId] = useState(null)
  const maoDeObraRefs = useRef({})
  const servicosRefs = useRef({})
  const [salvoRecente, setSalvoRecente] = useState({}) // { [`${osId}-maoDeObra`]: true }

  function mostrarSalvo(chave) {
    setSalvoRecente((prev) => ({ ...prev, [chave]: true }))
    setTimeout(() => setSalvoRecente((prev) => ({ ...prev, [chave]: false })), 1800)
  }

  function alternarExpandido(osId) {
    if (expandidoId === osId) {
      setExpandidoId(null)
    } else {
      setExpandidoId(osId)
      setConcluindoId(null)
    }
  }

  function abrirDaOficina(osId) {
    setExpandidoId(osId)
    setTimeout(() => {
      document.getElementById(`os-${osId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
  }

  async function carregar() {
    setLoading(true)
    const [os, equips, cats, cent] = await Promise.all([
      supabase
        .from('ordens_servico')
        .select(
          '*, clientes(nome, telefone, endereco), equipamentos(nome), categorias(nome), centros_de_custo(nome), ordens_servico_pecas(id, peca_id, nome_peca, quantidade, valor_unitario), ordens_servico_ativos(ativo_id, ativos(local, codigo))'
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

  useEffect(() => {
    const idParaAbrir = searchParams.get('abrir')
    const osAlvo = lista.find((os) => os.id === idParaAbrir)
    if (osAlvo) {
      if (osAlvo.status === 'finalizada' || osAlvo.status === 'cancelada') {
        setMostrarHistorico(true)
      }
      setExpandidoId(osAlvo.id)
      setTimeout(() => {
        document.getElementById(`os-${osAlvo.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista])

  function cancelarFormulario() {
    setForm(CAMPOS_VAZIOS)
    setAtivosSelecionados([])
    setMostrarListaAtivos(false)
    setAtivosDoCliente([])
    setEditandoId(null)
    setMostrarForm(false)
  }

  async function salvar(e) {
    e.preventDefault()

    const payload = {
      cliente_id: form.cliente_id || null,
      equipamento_id: form.equipamento_id || null,
      categoria_id: form.categoria_id || null,
      centro_custo_id: form.centro_custo_id || null,
      tipo_servico: form.tipo_servico || null,
      descricao_problema: form.descricao_problema.trim(),
      mostrar_problema_na_impressao: form.mostrar_problema_na_impressao,
      endereco: form.endereco || null,
      observacoes: form.observacoes || null,
      data_abertura: form.data_abertura,
      cliente_final: form.cliente_final || null,
    }

    // Se a OS já está finalizada, permite corrigir a data de conclusão também
    const itemOriginal = editandoId ? lista.find((o) => o.id === editandoId) : null
    if (itemOriginal?.status === 'finalizada' && form.data_conclusao_edicao) {
      payload.data_conclusao = form.data_conclusao_edicao
    }

    // Só na criação: a OS já nasce pronta pra trabalhar (sem etapa "não iniciada"),
    // a menos que ela seja deixada agendada pra depois.
    if (!editandoId) {
      payload.status = 'em_andamento'
      if (form.iniciarAgora) {
        payload.status_atual = null
        payload.data_agendamento = null
      } else {
        payload.status_atual = 'Agendado'
        payload.data_agendamento = form.dataAgendamento || null
      }
    }

    let osId = editandoId
    if (editandoId) {
      const { error } = await supabase.from('ordens_servico').update(payload).eq('id', editandoId)
      if (error) {
        setErro(error.message)
        return
      }
    } else {
      const { data, error } = await supabase.from('ordens_servico').insert(payload).select().single()
      if (error) {
        setErro(error.message)
        return
      }
      osId = data.id
    }

    // Sincroniza os equipamentos vinculados: apaga os antigos e grava os selecionados agora
    const { error: erroDelete } = await supabase.from('ordens_servico_ativos').delete().eq('ordem_servico_id', osId)
    if (erroDelete) {
      setErro(erroDelete.message)
      return
    }
    if (ativosSelecionados.length > 0) {
      const { error: erroInsert } = await supabase
        .from('ordens_servico_ativos')
        .insert(ativosSelecionados.map((a) => ({ ordem_servico_id: osId, ativo_id: a.id })))
      if (erroInsert) {
        setErro(erroInsert.message)
        return
      }
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
      tipo_servico: os.tipo_servico || '',
      descricao_problema: os.descricao_problema || '',
      mostrar_problema_na_impressao: os.mostrar_problema_na_impressao ?? true,
      endereco: os.endereco || '',
      observacoes: os.observacoes || '',
      data_abertura: os.data_abertura,
      cliente_final: os.cliente_final || '',
      data_conclusao_edicao: os.data_conclusao || '',
    })
    setAtivosSelecionados(
      (os.ordens_servico_ativos || []).map((v) => ({ id: v.ativo_id, local: v.ativos?.local, codigo: v.ativos?.codigo }))
    )
    setMostrarListaAtivos(false)
    setAtivosDoCliente([])
    setEditandoId(os.id)
    setMostrarForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function adicionarAtivo(ativo) {
    setAtivosSelecionados((prev) => (prev.some((a) => a.id === ativo.id) ? prev : [...prev, ativo]))
  }

  function removerAtivo(ativoId) {
    setAtivosSelecionados((prev) => prev.filter((a) => a.id !== ativoId))
  }

  async function carregarAtivosDoCliente(clienteId) {
    if (!clienteId) {
      setAtivosDoCliente([])
      return
    }
    const { data, error } = await supabase
      .from('ativos')
      .select('id, codigo, local')
      .eq('cliente_id', clienteId)
      .eq('ativo', true)
      .order('codigo')
      .range(0, 9999)
    if (error) {
      setErro(error.message)
      return
    }
    setAtivosDoCliente(data || [])
  }

  function alternarListaAtivos() {
    if (!mostrarListaAtivos) carregarAtivosDoCliente(form.cliente_id)
    setMostrarListaAtivos(!mostrarListaAtivos)
  }

  function alternarAtivoNaLista(ativo) {
    setAtivosSelecionados((prev) =>
      prev.some((a) => a.id === ativo.id) ? prev.filter((a) => a.id !== ativo.id) : [...prev, ativo]
    )
  }

  async function handleClienteSelecionado(clienteId) {
    setForm((f) => ({ ...f, cliente_id: clienteId }))
    setMostrarListaAtivos(false)
    setAtivosDoCliente([])
    if (!clienteId) return
    const { data } = await supabase.from('clientes').select('endereco').eq('id', clienteId).single()
    if (data?.endereco) {
      setForm((f) => (f.endereco ? f : { ...f, endereco: data.endereco }))
    }
  }

  
  async function alternarNaOficina(os) {
    const { error } = await supabase.from('ordens_servico').update({ na_oficina: !os.na_oficina }).eq('id', os.id)
    if (error) {
      setErro(error.message)
      return
    }
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
      dataConclusao: os.data_conclusao || todayISO(),
      tecnico: os.tecnico || '',
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
    if (!concluirForm.dataConclusao) {
      setErro('Informe a data de conclusão do serviço.')
      return
    }

    const dataConclusao = concluirForm.dataConclusao
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
          data_vencimento: dataConclusao,
          data_competencia: dataConclusao,
          categoria_id: concluirForm.categoria_id || null,
          centro_custo_id: os.centro_custo_id || null,
          cliente_id: os.cliente_id || null,
          equipamento_id: os.equipamento_id || null,
          observacoes: `Gerado automaticamente pela conclusão da OS #${os.numero} (concluída em ${dataConclusao}). ${detalheValores}`,
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
        data_conclusao: dataConclusao,
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
        tecnico: concluirForm.tecnico || null,
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

  const listaAberta = lista.filter((os) => os.status === 'nao_iniciada' || os.status === 'em_andamento')
  const listaHistorico = lista.filter((os) => os.status === 'finalizada' || os.status === 'cancelada')
  const listaNaOficina = listaAberta.filter((os) => os.na_oficina)

  // Só separa as "Agendado" (automático, vindo da agenda) do resto — o resto fica junto,
  // sem mais sub-status manuais pra escolher.
  function agruparAbertos(itens) {
    const agendados = [...itens.filter((os) => os.status_atual === 'Agendado')].sort((a, b) =>
      (a.data_agendamento || '').localeCompare(b.data_agendamento || '')
    )
    const outros = itens.filter((os) => os.status_atual !== 'Agendado')
    const grupos = []
    if (agendados.length > 0) grupos.push({ titulo: 'Agendado', itens: agendados })
    if (outros.length > 0) grupos.push({ titulo: null, itens: outros })
    return grupos
  }

  const grupos = mostrarHistorico
    ? [{ titulo: null, itens: listaHistorico }]
    : agruparAbertos(listaAberta)

  const itemEditando = editandoId ? lista.find((o) => o.id === editandoId) : null
  const editandoOSFinalizada = itemEditando?.status === 'finalizada'

  return (
    <div className="max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1 gap-2">
        <h2 className="text-2xl font-bold text-gray-900">Ordens de Serviço</h2>
        <div className="flex gap-2">
          <Link
            to="/ordens-servico/relatorio"
            className="flex items-center gap-1 rounded-lg bg-gray-100 text-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-200"
          >
            <FileBarChart size={16} /> Relatório
          </Link>
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

          <select
            value={form.tipo_servico}
            onChange={(e) => setForm({ ...form, tipo_servico: e.target.value })}
            className="col-span-1 sm:col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Tipo de serviço (opcional — aparece no histórico do QR code)...</option>
            {TIPOS_SERVICO.map((t) => (
              <option key={t.valor} value={t.valor}>{t.label}</option>
            ))}
          </select>

          <input
            placeholder="Cliente final (opcional — quando o cliente acima é um parceiro/intermediário)"
            value={form.cliente_final}
            onChange={(e) => setForm({ ...form, cliente_final: e.target.value })}
            className="col-span-1 sm:col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />

          <div className="col-span-1 sm:col-span-2">
            <BuscaAtivo
              clienteId={form.cliente_id}
              onSelecionar={adicionarAtivo}
              placeholder="Adicionar equipamento específico (opcional — pra controle por QR code)..."
            />
            {form.cliente_id && (
              <button
                type="button"
                onClick={alternarListaAtivos}
                className="text-xs text-primary-700 hover:underline mt-1.5"
              >
                {mostrarListaAtivos ? 'Esconder lista' : 'Ou marcar vários da lista'}
              </button>
            )}

            {mostrarListaAtivos && (
              <div className="mt-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                {ativosDoCliente.length === 0 ? (
                  <p className="text-xs text-gray-400 col-span-1 sm:col-span-2">
                    Nenhum equipamento cadastrado pra esse cliente ainda.
                  </p>
                ) : (
                  ativosDoCliente.map((a) => (
                    <label key={a.id} className="flex items-center gap-1.5 text-xs text-gray-700">
                      <input
                        type="checkbox"
                        checked={ativosSelecionados.some((sel) => sel.id === a.id)}
                        onChange={() => alternarAtivoNaLista(a)}
                      />
                      REF-{a.codigo} · {a.local || '(sem local)'}
                    </label>
                  ))
                )}
              </div>
            )}

            {ativosSelecionados.length > 0 && (
              <ul className="flex flex-wrap gap-1.5 mt-2">
                {ativosSelecionados.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-1.5 text-xs bg-primary-50 text-primary-700 px-2 py-1 rounded-full"
                  >
                    REF-{a.codigo} · {a.local || '(sem local)'}
                    <button type="button" onClick={() => removerAtivo(a.id)} className="text-primary-500 hover:text-primary-800">
                      <X size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {editandoOSFinalizada && (
            <div className="col-span-1 sm:col-span-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <label className="block text-xs text-amber-800 mb-1">Data de conclusão do serviço</label>
              <input
                type="date"
                value={form.data_conclusao_edicao}
                onChange={(e) => setForm({ ...form, data_conclusao_edicao: e.target.value })}
                className="w-full sm:w-48 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>
          )}

          {!editandoId && (
            <div className="col-span-1 sm:col-span-2">
              <div className="flex gap-2 bg-gray-50 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, iniciarAgora: true })}
                  className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                    form.iniciarAgora ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500'
                  }`}
                >
                  Começar agora
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, iniciarAgora: false })}
                  className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                    !form.iniciarAgora ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500'
                  }`}
                >
                  Deixar agendado pra depois
                </button>
              </div>
              {!form.iniciarAgora && (
                <input
                  type="datetime-local"
                  value={form.dataAgendamento}
                  onChange={(e) => setForm({ ...form, dataAgendamento: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mt-2"
                />
              )}
            </div>
          )}

          <textarea
            placeholder="Descrição do problema / serviço solicitado (opcional)"
            value={form.descricao_problema}
            onChange={(e) => setForm({ ...form, descricao_problema: e.target.value })}
            className="col-span-1 sm:col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            rows={2}
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

      {!mostrarHistorico && listaNaOficina.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-blue-900 mb-2">
            <Wrench size={14} /> Na oficina ({listaNaOficina.length})
          </p>
          <ul className="space-y-1.5">
            {listaNaOficina.map((os) => (
              <li key={os.id} className="flex items-center justify-between gap-2 bg-white rounded-lg px-3 py-2">
                <button
                  onClick={() => abrirDaOficina(os.id)}
                  className="flex-1 text-left text-sm text-blue-900 min-w-0 truncate"
                >
                  <span className="font-mono text-xs text-blue-400">OS #{os.numero}</span>{' '}
                  {os.clientes?.nome || '(Sem cliente)'}
                </button>
                <button
                  onClick={() => alternarNaOficina(os)}
                  className="shrink-0 text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full hover:bg-blue-200"
                >
                  Entregar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          {mostrarHistorico ? `${listaHistorico.length} OS finalizada(s)/cancelada(s)` : `${listaAberta.length} OS em aberto`}
        </p>
        <button
          onClick={() => setMostrarHistorico(!mostrarHistorico)}
          className="text-sm text-primary-700 hover:underline"
        >
          {mostrarHistorico ? '← Voltar pro que está aberto' : 'Ver histórico (finalizadas/canceladas)'}
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Carregando...</p>
      ) : (mostrarHistorico ? listaHistorico : listaAberta).length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 flex flex-col items-center text-center text-gray-400">
          <ClipboardList size={28} className="mb-3" />
          <p className="text-sm">{mostrarHistorico ? 'Nenhuma OS no histórico ainda.' : 'Nenhuma OS em aberto no momento.'}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grupos.map((grupo, gi) => (
            <div key={grupo.titulo || `grupo-${gi}`}>
              {grupo.titulo && grupos.length > 1 && (
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {grupo.titulo} <span className="font-normal normal-case text-gray-400">({grupo.itens.length})</span>
                </p>
              )}
              <ul className="space-y-3">
                {grupo.itens.map((os) => {
                  const totalPecas = totalPecasDaOS(os)
                  const emAberto = os.status === 'nao_iniciada' || os.status === 'em_andamento'
                  return (
              <li id={`os-${os.id}`} key={os.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => alternarExpandido(os.id)}
                  className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-gray-400">OS #{os.numero}</span>
                        <StatusBadge status={os.status} />
                        {os.tipo_servico && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {TIPOS_SERVICO.find((t) => t.valor === os.tipo_servico)?.label || os.tipo_servico}
                          </span>
                        )}
                        {emAberto && os.status_atual === 'Agendado' && (
                          <span className="flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                            <Wrench size={11} /> Agendado
                            {os.data_agendamento ? ` · ${formatDataHora(os.data_agendamento)}` : ''}
                          </span>
                        )}
                        {emAberto && os.na_oficina && (
                          <span className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                            <Wrench size={11} /> Na oficina
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-800 mt-1">
                        {os.clientes?.nome || '(Sem cliente)'}
                        {os.clientes?.telefone ? ` · ${os.clientes.telefone}` : ''}
                        {os.equipamentos?.nome ? ` · ${os.equipamentos.nome}` : ''}
                      </p>
                      {os.cliente_final && (
                        <p className="text-xs text-blue-600">Cliente final: {os.cliente_final}</p>
                      )}
                      {(os.ordens_servico_ativos || []).length > 0 && (
                        <p className="text-xs text-teal-600">
                          Equipamentos: {os.ordens_servico_ativos.map((v) => `REF-${v.ativos?.codigo}`).join(', ')}
                        </p>
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
                    <div className="flex items-start gap-2 shrink-0">
                      {os.valor_final != null && (
                        <p className="text-sm font-semibold text-gray-800 text-right">
                          {formatCurrencyBRL(os.valor_final)}
                          <span className="block text-[11px] font-normal text-gray-400">valor final</span>
                        </p>
                      )}
                      {expandidoId === os.id ? (
                        <ChevronUp size={18} className="text-gray-400 mt-0.5" />
                      ) : (
                        <ChevronDown size={18} className="text-gray-400 mt-0.5" />
                      )}
                    </div>
                  </div>
                </button>

                {expandidoId === os.id && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                {emAberto && (
                  <div className="mb-3">
                    <button
                      onClick={() => alternarNaOficina(os)}
                      className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg w-full sm:w-auto ${
                        os.na_oficina
                          ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <Wrench size={14} />
                      {os.na_oficina ? 'Devolver / Entregar ao cliente' : 'Recolher para oficina'}
                    </button>
                  </div>
                )}

                {(emAberto || os.status === 'finalizada') && (os.ordens_servico_pecas || []).length > 0 && (
                  <div className="mb-3 bg-gray-50 border border-gray-100 rounded-lg p-2">
                    <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                      <Package size={11} /> Peças usadas
                    </p>
                    <ul className="space-y-2">
                      {os.ordens_servico_pecas.map((item) => (
                        <li key={item.id} className="bg-white rounded-lg border border-gray-200 p-2">
                          {emAberto ? (
                            <>
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span className="flex-1 text-sm text-gray-700">{item.nome_peca}</span>
                                <button
                                  onClick={() => removerItemPeca(item)}
                                  className="text-gray-400 hover:text-red-600 p-1.5 -my-1.5 -mr-1.5"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <input
                                  type="number"
                                  step="0.01"
                                  defaultValue={item.quantidade}
                                  onBlur={(e) => {
                                    const novaQtd = Number(e.target.value) || 0
                                    if (novaQtd !== Number(item.quantidade)) atualizarItemPeca(item, novaQtd, Number(item.valor_unitario))
                                  }}
                                  className="w-16 rounded-lg border border-gray-300 px-2 py-2 text-sm text-right"
                                />
                                <span className="text-gray-400 text-sm">×</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  defaultValue={item.valor_unitario}
                                  onBlur={(e) => {
                                    const novoValor = Number(e.target.value) || 0
                                    if (novoValor !== Number(item.valor_unitario)) atualizarItemPeca(item, Number(item.quantidade), novoValor)
                                  }}
                                  className="w-24 rounded-lg border border-gray-300 px-2 py-2 text-sm text-right"
                                />
                                <span className="ml-auto text-sm font-medium text-gray-700">
                                  {formatCurrencyBRL(Number(item.quantidade) * Number(item.valor_unitario))}
                                </span>
                              </div>
                            </>
                          ) : (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-700">{item.nome_peca}</span>
                              <span className="text-gray-500">
                                {item.quantidade} × {formatCurrencyBRL(item.valor_unitario)} ={' '}
                                <span className="font-medium text-gray-700">
                                  {formatCurrencyBRL(Number(item.quantidade) * Number(item.valor_unitario))}
                                </span>
                              </span>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-right font-medium text-gray-700 mt-2">Total peças: {formatCurrencyBRL(totalPecas)}</p>
                  </div>
                )}

                {emAberto && (
                  <div className="mb-3 space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Valor da mão de obra</label>
                      <input
                        ref={(el) => (maoDeObraRefs.current[os.id] = el)}
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        placeholder="R$ 0,00"
                        defaultValue={os.valor_mao_de_obra ?? ''}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                      />
                      <div className="flex items-center gap-2 mt-1.5">
                        <button
                          onClick={() => {
                            const el = maoDeObraRefs.current[os.id]
                            const novo = el.value === '' ? null : Number(el.value)
                            salvarMaoDeObra(os, novo)
                            mostrarSalvo(`${os.id}-mao`)
                          }}
                          className="rounded-lg bg-gray-100 text-gray-700 px-4 py-1.5 text-xs font-medium hover:bg-gray-200"
                        >
                          Salvar
                        </button>
                        {salvoRecente[`${os.id}-mao`] && <span className="text-xs text-green-600">✓ Salvo</span>}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Serviços realizados</label>
                      <textarea
                        ref={(el) => (servicosRefs.current[os.id] = el)}
                        placeholder={'Ex: troca do compressor\nlimpeza dos filtros\n(um item por linha, se quiser)'}
                        defaultValue={os.servicos_realizados ?? ''}
                        rows={3}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm resize-y"
                      />
                      <div className="flex items-center gap-2 mt-1.5">
                        <button
                          onClick={() => {
                            const el = servicosRefs.current[os.id]
                            salvarServicosRealizados(os, el.value)
                            mostrarSalvo(`${os.id}-serv`)
                          }}
                          className="rounded-lg bg-gray-100 text-gray-700 px-4 py-1.5 text-xs font-medium hover:bg-gray-200"
                        >
                          Salvar
                        </button>
                        {salvoRecente[`${os.id}-serv`] && <span className="text-xs text-green-600">✓ Salvo</span>}
                      </div>
                    </div>
                  </div>
                )}

                {emAberto && (
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

                    <div className="mb-2 flex flex-wrap gap-2">
                      <div>
                        <label className="block text-[11px] text-green-800 mb-0.5">Data em que o serviço foi concluído</label>
                        <input
                          type="date"
                          value={concluirForm.dataConclusao}
                          onChange={(e) => setConcluirForm({ ...concluirForm, dataConclusao: e.target.value })}
                          className="w-full sm:w-48 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-green-800 mb-0.5">Técnico responsável (opcional)</label>
                        <input
                          type="text"
                          value={concluirForm.tecnico}
                          onChange={(e) => setConcluirForm({ ...concluirForm, tecnico: e.target.value })}
                          placeholder="Ex: Diego"
                          className="w-full sm:w-48 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                        />
                      </div>
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
                  {emAberto && concluindoId !== os.id && (
                    <button
                      onClick={() => abrirConclusao(os)}
                      className="flex items-center gap-1 rounded-lg bg-green-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-green-700"
                    >
                      <CheckCircle2 size={13} /> Concluir
                    </button>
                  )}
                  {emAberto && (
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
                  {os.status === 'finalizada' && (
                    <Link
                      to={`/ordens-servico/${os.id}/laudo`}
                      className="flex items-center gap-1 rounded-lg bg-gray-100 text-gray-500 px-3 py-1.5 text-xs hover:bg-gray-200"
                    >
                      <FileBarChart size={13} /> Laudo
                    </Link>
                  )}
                  <button
                    onClick={() => excluir(os.id)}
                    className="flex items-center gap-1 rounded-lg bg-gray-100 text-gray-500 px-3 py-1.5 text-xs hover:bg-red-50 hover:text-red-600 ml-auto"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                  </div>
                )}
              </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
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
