import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatDateBR, formatCurrencyBRL, todayISO } from '../lib/format'
import { FREQUENCIAS_HIGIENIZACAO } from '../lib/pmoc'
import { Plus, Trash2, Search, X, FileCheck2, FileX2, ArrowRightCircle } from 'lucide-react'

const STATUS_LABEL = {
  aberta: 'Aberta',
  aprovada: 'Aprovada',
  recusada: 'Recusada',
  convertida: 'Convertida em contrato',
}

const STATUS_COR = {
  aberta: 'bg-gray-100 text-gray-700',
  aprovada: 'bg-green-100 text-green-700',
  recusada: 'bg-red-100 text-red-700',
  convertida: 'bg-primary-100 text-primary-700',
}

const ITEM_VAZIO = {
  ativo_id: null,
  descricao_equipamento: '',
  local: '',
  capacidade_btu: '',
  frequencia_higienizacao: 'trimestral',
}

const PROPOSTA_VAZIA = {
  cliente_id: null,
  clienteNome: '',
  data: todayISO(),
  validade: '',
  valor: '',
  observacoes: '',
}

export default function PmocPropostas() {
  const [lista, setLista] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)

  const [form, setForm] = useState(PROPOSTA_VAZIA)
  const [itens, setItens] = useState([{ ...ITEM_VAZIO }])
  const [buscaCliente, setBuscaCliente] = useState('')
  const [resultadosCliente, setResultadosCliente] = useState([])
  const [salvando, setSalvando] = useState(false)

  async function carregar() {
    setLoading(true)
    const { data, error } = await supabase
      .from('pmoc_propostas')
      .select('*, clientes(nome), pmoc_proposta_itens(id)')
      .order('created_at', { ascending: false })
      .range(0, 9999)
    if (error) setErro(error.message)
    else setLista(data)
    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  useEffect(() => {
    if (buscaCliente.trim().length < 2) {
      setResultadosCliente([])
      return
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('clientes')
        .select('id, nome, telefone')
        .ilike('nome', `%${buscaCliente.trim()}%`)
        .eq('ativo', true)
        .order('nome')
        .limit(10)
      setResultadosCliente(data || [])
    }, 300)
    return () => clearTimeout(t)
  }, [buscaCliente])

  function selecionarCliente(c) {
    setForm({ ...form, cliente_id: c.id, clienteNome: c.nome })
    setBuscaCliente('')
    setResultadosCliente([])
  }

  function atualizarItem(i, campo, valor) {
    const novos = [...itens]
    novos[i] = { ...novos[i], [campo]: valor }
    setItens(novos)
  }

  function adicionarItem() {
    setItens([...itens, { ...ITEM_VAZIO }])
  }

  function removerItem(i) {
    setItens(itens.filter((_, idx) => idx !== i))
  }

  function fecharForm() {
    setMostrarForm(false)
    setForm(PROPOSTA_VAZIA)
    setItens([{ ...ITEM_VAZIO }])
    setBuscaCliente('')
    setResultadosCliente([])
  }

  async function salvar(e) {
    e.preventDefault()
    if (!form.cliente_id) {
      setErro('Selecione um cliente.')
      return
    }
    const itensValidos = itens.filter((i) => i.descricao_equipamento.trim() || i.local.trim())
    if (itensValidos.length === 0) {
      setErro('Adicione pelo menos um equipamento na proposta.')
      return
    }

    setSalvando(true)
    setErro(null)

    const { data: proposta, error: erroProposta } = await supabase
      .from('pmoc_propostas')
      .insert({
        cliente_id: form.cliente_id,
        data: form.data,
        validade: form.validade || null,
        valor: form.valor ? Number(form.valor) : null,
        observacoes: form.observacoes || null,
      })
      .select('*')
      .single()

    if (erroProposta) {
      setErro(erroProposta.message)
      setSalvando(false)
      return
    }

    const { error: erroItens } = await supabase.from('pmoc_proposta_itens').insert(
      itensValidos.map((i) => ({
        proposta_id: proposta.id,
        ativo_id: i.ativo_id || null,
        descricao_equipamento: i.descricao_equipamento || null,
        local: i.local || null,
        capacidade_btu: i.capacidade_btu ? Number(i.capacidade_btu) : null,
        frequencia_higienizacao: i.frequencia_higienizacao,
      }))
    )

    if (erroItens) {
      setErro(erroItens.message)
      setSalvando(false)
      return
    }

    setSalvando(false)
    fecharForm()
    carregar()
  }

  async function alterarStatus(proposta, novoStatus) {
    const { error } = await supabase.from('pmoc_propostas').update({ status: novoStatus }).eq('id', proposta.id)
    if (error) {
      setErro(error.message)
      return
    }
    carregar()
  }

  const totalBtu = itens.reduce((s, i) => s + (Number(i.capacidade_btu) || 0), 0)
  const exigeRt = totalBtu > 60000

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-2xl font-bold text-gray-900">PMOC — Propostas</h2>
        <div className="flex gap-2">
          <Link to="/pmoc" className="text-sm text-gray-500 hover:text-gray-700 self-center">
            ← Contratos PMOC
          </Link>
          <button
            onClick={() => setMostrarForm(true)}
            className="flex items-center gap-1 rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700"
          >
            <Plus size={16} /> Nova proposta
          </button>
        </div>
      </div>
      <p className="text-gray-500 text-sm mb-6">
        Módulo isolado de controle de conformidade PMOC. Não guarda dados de Responsável
        Técnico (RT) — isso é feito no carimbo do documento físico depois.
      </p>

      {erro && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-red-50 text-red-700 text-sm px-4 py-2">
          {erro}
          <button onClick={() => setErro(null)}><X size={14} /></button>
        </div>
      )}

      {mostrarForm && (
        <form onSubmit={salvar} className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-gray-800 mb-3">Nova proposta PMOC</h3>

          <div className="mb-3">
            {form.cliente_id ? (
              <div className="flex items-center justify-between bg-primary-50 rounded-lg px-3 py-2">
                <span className="text-sm font-medium text-primary-800">{form.clienteNome}</span>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, cliente_id: null, clienteNome: '' })}
                  className="text-primary-600 hover:text-primary-800"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    placeholder="Buscar cliente por nome..."
                    value={buscaCliente}
                    onChange={(e) => setBuscaCliente(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 pl-8 pr-3 py-2 text-sm"
                  />
                </div>
                {resultadosCliente.length > 0 && (
                  <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg mt-1 shadow-lg max-h-56 overflow-y-auto">
                    {resultadosCliente.map((c) => (
                      <li
                        key={c.id}
                        onClick={() => selecionarCliente(c)}
                        className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
                      >
                        {c.nome} {c.telefone && <span className="text-gray-400">· {c.telefone}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <label className="text-xs text-gray-500">Data da proposta</label>
              <input
                type="date"
                value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Validade</label>
              <input
                type="date"
                value={form.validade}
                onChange={(e) => setForm({ ...form, validade: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Equipamentos propostos</label>
              <button
                type="button"
                onClick={adicionarItem}
                className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1"
              >
                <Plus size={14} /> Adicionar equipamento
              </button>
            </div>

            <div className="space-y-2">
              {itens.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-lg p-2">
                  <input
                    placeholder="Equipamento (ex: Split 18000 BTU)"
                    value={item.descricao_equipamento}
                    onChange={(e) => atualizarItem(i, 'descricao_equipamento', e.target.value)}
                    className="col-span-4 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  <input
                    placeholder="Local (ex: Sala 2)"
                    value={item.local}
                    onChange={(e) => atualizarItem(i, 'local', e.target.value)}
                    className="col-span-3 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  <input
                    placeholder="BTU/h"
                    type="number"
                    value={item.capacidade_btu}
                    onChange={(e) => atualizarItem(i, 'capacidade_btu', e.target.value)}
                    className="col-span-2 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  <select
                    value={item.frequencia_higienizacao}
                    onChange={(e) => atualizarItem(i, 'frequencia_higienizacao', e.target.value)}
                    className="col-span-2 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    {FREQUENCIAS_HIGIENIZACAO.map((f) => (
                      <option key={f} value={f}>
                        Higien. {f}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removerItem(i)}
                    className="col-span-1 text-gray-400 hover:text-red-600 flex justify-center"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-500 mt-2">
              BTU/h total: <strong>{totalBtu.toLocaleString('pt-BR')}</strong>
              {' — '}
              {exigeRt ? (
                <span className="text-amber-600 font-medium">exige RT (acima de 60.000 BTU/h)</span>
              ) : (
                <span className="text-gray-400">não exige RT</span>
              )}
            </p>
          </div>

          <textarea
            placeholder="Observações"
            value={form.observacoes}
            onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mb-4"
            rows={2}
          />

          <div className="flex justify-end gap-2">
            <button type="button" onClick={fecharForm} className="px-4 py-2 text-sm text-gray-500">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700 disabled:opacity-60"
            >
              {salvando ? 'Salvando...' : 'Salvar proposta'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">Carregando...</p>
      ) : (
        <ul className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {lista.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-800">{p.clientes?.nome}</p>
                <p className="text-xs text-gray-500">
                  {formatDateBR(p.data)} · {p.pmoc_proposta_itens?.length || 0} equipamento(s)
                  {p.valor ? ` · ${formatCurrencyBRL(p.valor)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs rounded-full px-2 py-1 font-medium ${STATUS_COR[p.status]}`}>
                  {STATUS_LABEL[p.status]}
                </span>
                {p.status === 'aberta' && (
                  <>
                    <button
                      onClick={() => alterarStatus(p, 'aprovada')}
                      title="Aprovar"
                      className="text-green-500 hover:text-green-700 p-1"
                    >
                      <FileCheck2 size={16} />
                    </button>
                    <button
                      onClick={() => alterarStatus(p, 'recusada')}
                      title="Recusar"
                      className="text-red-400 hover:text-red-600 p-1"
                    >
                      <FileX2 size={16} />
                    </button>
                  </>
                )}
                {p.status === 'aprovada' && (
                  <Link
                    to={`/pmoc/propostas/${p.id}/converter`}
                    title="Converter em contrato"
                    className="text-primary-600 hover:text-primary-800 p-1 flex items-center gap-1 text-xs font-medium"
                  >
                    <ArrowRightCircle size={16} /> Converter em contrato
                  </Link>
                )}
              </div>
            </li>
          ))}
          {lista.length === 0 && <li className="px-4 py-3 text-sm text-gray-400">Nenhuma proposta ainda.</li>}
        </ul>
      )}
    </div>
  )
}
