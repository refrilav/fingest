import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatDateBR, formatCurrencyBRL, todayISO } from '../lib/format'
import BuscaPessoa from '../components/BuscaPessoa'
import { Plus, Trash2, Pencil, Printer, FileText, X } from 'lucide-react'

const TEXTOS_PADRAO = {
  higienizacao:
    'A higienização é realizada no próprio local, com o uso de bolsa coletora, permitindo a lavagem completa de todos os componentes da unidade evaporadora sem gerar sujeira ou respingos no ambiente. Utilizamos produtos específicos para higienização de aparelhos de ar-condicionado, que eliminam fungos, bactérias e odores sem causar desgaste ou corrosão nos componentes internos do equipamento.',
  instalacao:
    'A instalação é executada seguindo rigorosamente os padrões de fábrica do fabricante, incluindo o respeito à metragem mínima de tubulação recomendada para o modelo. Isso preserva a garantia do fabricante e contribui para prolongar a vida útil do equipamento.',
  manutencao: '',
}

const AVISOS_PADRAO = {
  higienizacao:
    'Caso seja identificado algum problema técnico durante o serviço (vazamento, peça danificada, etc.), o cliente será comunicado antes da execução de qualquer serviço adicional.',
  instalacao: '',
  manutencao:
    'O valor deste orçamento é baseado no diagnóstico técnico realizado. Caso, durante a execução do serviço, sejam identificados problemas adicionais não previstos, o cliente será comunicado antes da realização de qualquer serviço ou custo extra.',
}

const GARANTIAS_PADRAO = {
  higienizacao: '',
  instalacao: 'Garantia de 1 ano sobre a instalação, a partir da data de conclusão do serviço.',
  manutencao: '',
}

const MOSTRAR_GARANTIA_PADRAO = {
  higienizacao: false,
  instalacao: true,
  manutencao: false,
}

const TIPO_LABEL = {
  higienizacao: 'Higienização',
  instalacao: 'Instalação',
  manutencao: 'Manutenção Corretiva',
}

// Rótulos do campo "item" mudam conforme o tipo de orçamento
const ITEM_LABELS = {
  higienizacao: { titulo: 'Itens (por local/ambiente)', campo: 'Local', placeholder: 'Ex: 2º andar, Sala do diretor' },
  instalacao: {
    titulo: 'Mão de obra e materiais',
    campo: 'Item',
    placeholder: 'Ex: Mão de obra - instalação, Tubulação de cobre 3/8"...',
  },
  manutencao: { titulo: 'Itens', campo: 'Item', placeholder: 'Ex: Mão de obra, Peça substituída...' },
}

const CAMPOS_VAZIOS = {
  tipo: 'higienizacao',
  cliente_id: '',
  data_emissao: todayISO(),
  validade_dias: '15',
  texto_explicativo: TEXTOS_PADRAO.higienizacao,
  aviso_padrao: AVISOS_PADRAO.higienizacao,
  observacoes_complementares: '',
  forma_pagamento: 'Pix, cartão de débito/crédito ou dinheiro',
  mostrar_forma_pagamento: false,
  garantia_texto: GARANTIAS_PADRAO.higienizacao,
  mostrar_garantia: MOSTRAR_GARANTIA_PADRAO.higienizacao,
}

const ITEM_VAZIO = { local: '', descricao: '', quantidade: '1', valor_unitario: '' }

export default function Orcamentos() {
  const [lista, setLista] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [form, setForm] = useState(CAMPOS_VAZIOS)
  const [itens, setItens] = useState([{ ...ITEM_VAZIO }])
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [filtroTipo, setFiltroTipo] = useState('todos')

  async function carregar() {
    setLoading(true)
    const { data, error } = await supabase
      .from('propostas')
      .select('*, clientes(nome, telefone), proposta_itens(id, local, descricao, quantidade, valor_unitario)')
      .order('numero', { ascending: false })
      .range(0, 9999)
    if (error) setErro(error.message)
    else setLista(data)
    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  function cancelarFormulario() {
    setForm(CAMPOS_VAZIOS)
    setItens([{ ...ITEM_VAZIO }])
    setEditandoId(null)
    setMostrarForm(false)
  }

  function novaProposta() {
    setForm(CAMPOS_VAZIOS)
    setItens([{ ...ITEM_VAZIO }])
    setEditandoId(null)
    setMostrarForm(true)
  }

  function handleTipoChange(tipo) {
    // só troca os textos padrão automaticamente se o texto atual ainda for o padrão anterior
    // (evita apagar uma edição manual sem querer)
    const eraTextoPadrao = Object.values(TEXTOS_PADRAO).includes(form.texto_explicativo)
    const eraAvisoPadrao = Object.values(AVISOS_PADRAO).includes(form.aviso_padrao)
    const eraGarantiaPadrao = Object.values(GARANTIAS_PADRAO).includes(form.garantia_texto)
    setForm({
      ...form,
      tipo,
      texto_explicativo: eraTextoPadrao ? TEXTOS_PADRAO[tipo] : form.texto_explicativo,
      aviso_padrao: eraAvisoPadrao ? AVISOS_PADRAO[tipo] : form.aviso_padrao,
      garantia_texto: eraGarantiaPadrao ? GARANTIAS_PADRAO[tipo] : form.garantia_texto,
      mostrar_garantia: eraGarantiaPadrao ? MOSTRAR_GARANTIA_PADRAO[tipo] : form.mostrar_garantia,
    })
  }

  function atualizarItem(index, campo, valor) {
    const novos = [...itens]
    novos[index] = { ...novos[index], [campo]: valor }
    setItens(novos)
  }

  function adicionarItem() {
    setItens([...itens, { ...ITEM_VAZIO }])
  }

  function removerItem(index) {
    setItens(itens.filter((_, i) => i !== index))
  }

  const totalGeral = itens.reduce((acc, i) => acc + (Number(i.quantidade) || 0) * (Number(i.valor_unitario) || 0), 0)

  async function salvar(e) {
    e.preventDefault()
    if (!form.cliente_id) {
      setErro('Selecione um cliente.')
      return
    }
    const itensValidos = itens.filter((i) => i.local.trim() && Number(i.valor_unitario) > 0)
    if (itensValidos.length === 0) {
      setErro('Adicione pelo menos um item com local e valor.')
      return
    }

    const payloadProposta = {
      tipo: form.tipo,
      cliente_id: form.cliente_id,
      data_emissao: form.data_emissao,
      validade_dias: form.validade_dias ? Number(form.validade_dias) : null,
      texto_explicativo: form.texto_explicativo || null,
      aviso_padrao: form.aviso_padrao || null,
      observacoes_complementares: form.observacoes_complementares || null,
      forma_pagamento: form.forma_pagamento || null,
      mostrar_forma_pagamento: form.mostrar_forma_pagamento,
      garantia_texto: form.garantia_texto || null,
      mostrar_garantia: form.mostrar_garantia,
    }

    let propostaId = editandoId

    if (editandoId) {
      const { error } = await supabase.from('propostas').update(payloadProposta).eq('id', editandoId)
      if (error) {
        setErro(error.message)
        return
      }
      // reescreve os itens do zero (mais simples que fazer diff)
      await supabase.from('proposta_itens').delete().eq('proposta_id', editandoId)
    } else {
      const { data, error } = await supabase.from('propostas').insert(payloadProposta).select().single()
      if (error) {
        setErro(error.message)
        return
      }
      propostaId = data.id
    }

    const linhasItens = itensValidos.map((i, idx) => ({
      proposta_id: propostaId,
      local: i.local.trim(),
      descricao: i.descricao || null,
      quantidade: Number(i.quantidade) || 1,
      valor_unitario: Number(i.valor_unitario) || 0,
      ordem: idx,
    }))

    const { error: erroItens } = await supabase.from('proposta_itens').insert(linhasItens)
    if (erroItens) {
      setErro(erroItens.message)
      return
    }

    cancelarFormulario()
    carregar()
  }

  function iniciarEdicao(proposta) {
    setForm({
      tipo: proposta.tipo,
      cliente_id: proposta.cliente_id || '',
      data_emissao: proposta.data_emissao,
      validade_dias: proposta.validade_dias != null ? String(proposta.validade_dias) : '',
      texto_explicativo: proposta.texto_explicativo || '',
      aviso_padrao: proposta.aviso_padrao || '',
      observacoes_complementares: proposta.observacoes_complementares || '',
      forma_pagamento: proposta.forma_pagamento || '',
      mostrar_forma_pagamento: proposta.mostrar_forma_pagamento || false,
      garantia_texto: proposta.garantia_texto || '',
      mostrar_garantia: proposta.mostrar_garantia || false,
    })
    setItens(
      (proposta.proposta_itens || [])
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
        .map((i) => ({
          local: i.local,
          descricao: i.descricao || '',
          quantidade: String(i.quantidade),
          valor_unitario: String(i.valor_unitario),
        }))
    )
    setEditandoId(proposta.id)
    setMostrarForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function excluir(id) {
    if (!confirm('Excluir este orçamento permanentemente?')) return
    const { error } = await supabase.from('propostas').delete().eq('id', id)
    if (error) {
      setErro(error.message)
      return
    }
    carregar()
  }

  async function mudarStatus(proposta, status) {
    const { error } = await supabase.from('propostas').update({ status }).eq('id', proposta.id)
    if (error) {
      setErro(error.message)
      return
    }
    carregar()
  }

  function totalDaProposta(proposta) {
    return (proposta.proposta_itens || []).reduce((acc, i) => acc + Number(i.quantidade) * Number(i.valor_unitario), 0)
  }

  const listaFiltrada = lista.filter((p) => filtroTipo === 'todos' || p.tipo === filtroTipo)

  return (
    <div className="max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1 gap-2">
        <h2 className="text-2xl font-bold text-gray-900">Orçamentos</h2>
        <button
          onClick={() => (mostrarForm ? cancelarFormulario() : novaProposta())}
          className="flex items-center gap-1 rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700"
        >
          <Plus size={16} /> Novo orçamento
        </button>
      </div>
      <p className="text-gray-500 text-sm mb-4">Monte o orçamento por local/ambiente e quantidade de equipamentos.</p>

      {erro && <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-2">{erro}</div>}

      {mostrarForm && (
        <form onSubmit={salvar} className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          {editandoId && <p className="text-sm font-medium text-primary-700 mb-2">Editando orçamento</p>}

          <div className="flex gap-2 bg-gray-50 rounded-lg p-1 mb-3">
            {Object.entries(TIPO_LABEL).map(([valor, label]) => (
              <button
                key={valor}
                type="button"
                onClick={() => handleTipoChange(valor)}
                className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                  form.tipo === valor ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <BuscaPessoa
              tabela="clientes"
              value={form.cliente_id}
              onChange={(id) => setForm({ ...form, cliente_id: id })}
              placeholder="Buscar cliente por nome, telefone ou endereço..."
            />
            <input
              type="date"
              value={form.data_emissao}
              onChange={(e) => setForm({ ...form, data_emissao: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs text-gray-500 mb-1">Validade (dias)</label>
            <input
              type="number"
              value={form.validade_dias}
              onChange={(e) => setForm({ ...form, validade_dias: e.target.value })}
              placeholder="Ex: 15"
              className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <p className="text-sm font-medium text-gray-700 mb-2">{ITEM_LABELS[form.tipo].titulo}</p>
          <div className="space-y-2 mb-2">
            {itens.map((item, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-gray-50 rounded-lg p-2">
                <input
                  placeholder={ITEM_LABELS[form.tipo].placeholder}
                  value={item.local}
                  onChange={(e) => atualizarItem(i, 'local', e.target.value)}
                  className="sm:col-span-5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                />
                <input
                  placeholder="Detalhe (opcional)"
                  value={item.descricao}
                  onChange={(e) => atualizarItem(i, 'descricao', e.target.value)}
                  className="sm:col-span-3 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                />
                <input
                  type="number"
                  placeholder="Qtd."
                  value={item.quantidade}
                  onChange={(e) => atualizarItem(i, 'quantidade', e.target.value)}
                  className="sm:col-span-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-right"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Valor unit."
                  value={item.valor_unitario}
                  onChange={(e) => atualizarItem(i, 'valor_unitario', e.target.value)}
                  className="sm:col-span-2 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-right"
                />
                <button
                  type="button"
                  onClick={() => removerItem(i)}
                  className="sm:col-span-1 text-gray-400 hover:text-red-600 justify-self-end sm:justify-self-center"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={adicionarItem}
            className="flex items-center gap-1 text-sm text-primary-700 hover:bg-primary-50 rounded-lg px-3 py-1.5 mb-3"
          >
            <Plus size={14} /> Adicionar {ITEM_LABELS[form.tipo].campo.toLowerCase()}
          </button>

          <p className="text-sm text-gray-700 mb-3">
            Total do orçamento: <strong>{formatCurrencyBRL(totalGeral)}</strong>
          </p>

          <label className="block text-xs text-gray-500 mb-1">Texto explicativo (aparece no orçamento impresso)</label>
          <textarea
            value={form.texto_explicativo}
            onChange={(e) => setForm({ ...form, texto_explicativo: e.target.value })}
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mb-3"
          />

          <label className="block text-xs text-gray-500 mb-1">
            Aviso sobre condições encontradas (editável, aparece se preenchido)
          </label>
          <textarea
            value={form.aviso_padrao}
            onChange={(e) => setForm({ ...form, aviso_padrao: e.target.value })}
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mb-3"
          />

          <div className="mb-3">
            <label className="flex items-center gap-1.5 text-xs text-gray-600 mb-1">
              <input
                type="checkbox"
                checked={form.mostrar_forma_pagamento}
                onChange={(e) => setForm({ ...form, mostrar_forma_pagamento: e.target.checked })}
              />
              Mostrar forma de pagamento neste orçamento
            </label>
            {form.mostrar_forma_pagamento && (
              <input
                type="text"
                value={form.forma_pagamento}
                onChange={(e) => setForm({ ...form, forma_pagamento: e.target.value })}
                placeholder="Ex: Pix, cartão de débito/crédito ou dinheiro"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            )}
          </div>

          <div className="mb-3">
            <label className="flex items-center gap-1.5 text-xs text-gray-600 mb-1">
              <input
                type="checkbox"
                checked={form.mostrar_garantia}
                onChange={(e) => setForm({ ...form, mostrar_garantia: e.target.checked })}
              />
              Mostrar garantia neste orçamento
            </label>
            {form.mostrar_garantia && (
              <input
                type="text"
                value={form.garantia_texto}
                onChange={(e) => setForm({ ...form, garantia_texto: e.target.value })}
                placeholder="Ex: Garantia de 1 ano sobre a instalação..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            )}
          </div>

          <label className="block text-xs text-gray-500 mb-1">Observações complementares (opcional — só aparece se preenchido)</label>
          <textarea
            value={form.observacoes_complementares}
            onChange={(e) => setForm({ ...form, observacoes_complementares: e.target.value })}
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mb-3"
          />

          <div className="flex justify-end gap-2">
            <button type="button" onClick={cancelarFormulario} className="px-4 py-2 text-sm text-gray-500">
              Cancelar
            </button>
            <button type="submit" className="rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700">
              {editandoId ? 'Salvar alterações' : 'Criar orçamento'}
            </button>
          </div>
        </form>
      )}

      <div className="flex gap-2 mb-4 flex-wrap">
        {[{ v: 'todos', l: 'Todos' }, ...Object.entries(TIPO_LABEL).map(([v, l]) => ({ v, l }))].map((f) => (
          <button
            key={f.v}
            onClick={() => setFiltroTipo(f.v)}
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              filtroTipo === f.v ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {f.l}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Carregando...</p>
      ) : listaFiltrada.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 flex flex-col items-center text-center text-gray-400">
          <FileText size={28} className="mb-3" />
          <p className="text-sm">Nenhum orçamento ainda.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {listaFiltrada.map((p) => (
            <li key={p.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-gray-400">#{p.numero}</span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary-50 text-primary-700">
                      {TIPO_LABEL[p.tipo]}
                    </span>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="text-sm font-medium text-gray-800 mt-1">
                    {p.clientes?.nome || '(Sem cliente)'}
                    {p.clientes?.telefone ? ` · ${p.clientes.telefone}` : ''}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Emitido em {formatDateBR(p.data_emissao)}
                    {p.validade_dias ? ` · Válido por ${p.validade_dias} dias` : ''}
                  </p>
                </div>
                <p className="text-sm font-semibold text-gray-800">{formatCurrencyBRL(totalDaProposta(p))}</p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={p.status}
                  onChange={(e) => mudarStatus(p, e.target.value)}
                  className="rounded-lg border border-gray-300 px-2 py-1 text-xs"
                >
                  <option value="rascunho">Rascunho</option>
                  <option value="enviado">Enviado</option>
                  <option value="aprovado">Aprovado</option>
                  <option value="recusado">Recusado</option>
                </select>
                <Link
                  to={`/orcamentos/${p.id}/imprimir`}
                  className="flex items-center gap-1 rounded-lg bg-gray-100 text-gray-500 px-3 py-1.5 text-xs hover:bg-gray-200"
                >
                  <Printer size={13} /> Imprimir
                </Link>
                <button
                  onClick={() => iniciarEdicao(p)}
                  className="flex items-center gap-1 rounded-lg bg-gray-100 text-gray-500 px-3 py-1.5 text-xs hover:bg-gray-200"
                >
                  <Pencil size={13} /> Editar
                </button>
                <button
                  onClick={() => excluir(p.id)}
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
    rascunho: 'bg-gray-100 text-gray-600',
    enviado: 'bg-amber-100 text-amber-700',
    aprovado: 'bg-green-100 text-green-700',
    recusado: 'bg-red-50 text-red-500',
  }
  const label = { rascunho: 'Rascunho', enviado: 'Enviado', aprovado: 'Aprovado', recusado: 'Recusado' }
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status]}`}>{label[status]}</span>
}
