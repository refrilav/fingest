import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatDateBR, formatCurrencyBRL, todayISO, isOverdue } from '../lib/format'
import { Plus, Trash2, CheckCircle2, X } from 'lucide-react'

const CAMPOS_VAZIOS = {
  descricao: '',
  valor: '',
  data_vencimento: todayISO(),
  data_competencia: todayISO(),
  categoria_id: '',
  centro_custo_id: '',
  fornecedor_id: '',
  cliente_id: '',
  observacoes: '',
  forma_pagamento: '',
  desconto: '',
}

// tipo: 'pagar' | 'receber'
export default function Lancamentos({ tipo }) {
  const [lista, setLista] = useState([])
  const [categorias, setCategorias] = useState([])
  const [centros, setCentros] = useState([])
  const [pessoas, setPessoas] = useState([]) // fornecedores ou clientes
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [form, setForm] = useState(CAMPOS_VAZIOS)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [filtroStatus, setFiltroStatus] = useState('todos')

  const tabelaPessoa = tipo === 'pagar' ? 'fornecedores' : 'clientes'
  const campoPessoa = tipo === 'pagar' ? 'fornecedor_id' : 'cliente_id'
  const tipoCategoria = tipo === 'pagar' ? 'despesa' : 'receita'
  const titulo = tipo === 'pagar' ? 'Contas a Pagar' : 'Contas a Receber'

  async function carregar() {
    setLoading(true)
    const [lanc, cats, cent, pes] = await Promise.all([
      supabase
        .from('lancamentos')
        .select('*, categorias(nome), centros_de_custo(nome), fornecedores(nome), clientes(nome)')
        .eq('tipo', tipo)
        .order('data_vencimento')
        .range(0, 9999),
      supabase.from('categorias').select('*').eq('tipo', tipoCategoria).eq('ativo', true).order('nome').range(0, 9999),
      supabase.from('centros_de_custo').select('*').eq('ativo', true).order('nome').range(0, 9999),
      supabase.from(tabelaPessoa).select('*').eq('ativo', true).order('nome').range(0, 9999),
    ])

    if (lanc.error) setErro(lanc.error.message)
    else setLista(lanc.data)
    setCategorias(cats.data || [])
    setCentros(cent.data || [])
    setPessoas(pes.data || [])
    setLoading(false)
  }

  useEffect(() => {
    carregar()
    setForm(CAMPOS_VAZIOS)
    setMostrarForm(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo])

  async function salvar(e) {
    e.preventDefault()
    if (!form.descricao.trim() || !form.valor || !form.data_vencimento) return

    const payload = {
      tipo,
      descricao: form.descricao.trim(),
      valor: Number(form.valor),
      data_vencimento: form.data_vencimento,
      data_competencia: form.data_competencia || form.data_vencimento,
      categoria_id: form.categoria_id || null,
      centro_custo_id: form.centro_custo_id || null,
      [campoPessoa]: form[campoPessoa] || null,
      observacoes: form.observacoes || null,
      forma_pagamento: form.forma_pagamento || null,
      desconto: Number(form.desconto) || 0,
    }

    const { error } = await supabase.from('lancamentos').insert(payload)
    if (error) {
      setErro(error.message)
      return
    }
    setForm(CAMPOS_VAZIOS)
    setMostrarForm(false)
    carregar()
  }

  async function marcarComoPago(item) {
    const desconto = Number(item.desconto) || 0
    const { error } = await supabase
      .from('lancamentos')
      .update({
        status: 'pago',
        valor_pago: Number(item.valor) - desconto,
        data_pagamento: todayISO(),
      })
      .eq('id', item.id)
    if (error) {
      setErro(error.message)
      return
    }
    carregar()
  }

  async function cancelar(item) {
    if (!confirm('Cancelar este lançamento?')) return
    const { error } = await supabase.from('lancamentos').update({ status: 'cancelado' }).eq('id', item.id)
    if (error) {
      setErro(error.message)
      return
    }
    carregar()
  }

  async function excluir(id) {
    if (!confirm('Excluir permanentemente este lançamento?')) return
    const { error } = await supabase.from('lancamentos').delete().eq('id', id)
    if (error) {
      setErro(error.message)
      return
    }
    carregar()
  }

  const listaFiltrada = lista.filter((item) => {
    if (filtroStatus === 'todos') return true
    if (filtroStatus === 'vencido') return item.status === 'aberto' && isOverdue(item.data_vencimento)
    return item.status === filtroStatus
  })

  const totalAberto = lista
    .filter((i) => i.status === 'aberto')
    .reduce((acc, i) => acc + Number(i.valor), 0)

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-2xl font-bold text-gray-900">{titulo}</h2>
        <button
          onClick={() => setMostrarForm((v) => !v)}
          className="flex items-center gap-1 rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700"
        >
          <Plus size={16} /> Novo lançamento
        </button>
      </div>
      <p className="text-gray-500 text-sm mb-4">
        Total em aberto: <span className="font-semibold text-gray-700">{formatCurrencyBRL(totalAberto)}</span>
      </p>

      {erro && <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-2">{erro}</div>}

      {mostrarForm && (
        <form onSubmit={salvar} className="bg-white border border-gray-200 rounded-lg p-4 mb-6 grid grid-cols-2 gap-3">
          <input
            placeholder="Descrição *"
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            className="col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            required
          />
          <input
            type="number"
            step="0.01"
            placeholder="Valor *"
            value={form.valor}
            onChange={(e) => setForm({ ...form, valor: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            required
          />
          <input
            type="date"
            value={form.data_vencimento}
            onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            required
          />
          <select
            value={form.categoria_id}
            onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Categoria...</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
          <select
            value={form.centro_custo_id}
            onChange={(e) => setForm({ ...form, centro_custo_id: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Centro de custo...</option>
            {centros.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
          <select
            value={form[campoPessoa]}
            onChange={(e) => setForm({ ...form, [campoPessoa]: e.target.value })}
            className="col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">{tipo === 'pagar' ? 'Fornecedor...' : 'Cliente...'}</option>
            {pessoas.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
          <input
            placeholder={tipo === 'pagar' ? 'Forma de pagamento (Pix, Boleto...)' : 'Forma de recebimento (Pix, Dinheiro...)'}
            value={form.forma_pagamento}
            onChange={(e) => setForm({ ...form, forma_pagamento: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Desconto (opcional)"
            value={form.desconto}
            onChange={(e) => setForm({ ...form, desconto: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <textarea
            placeholder="Observações"
            value={form.observacoes}
            onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            className="col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            rows={2}
          />
          <div className="col-span-2 flex justify-end gap-2">
            <button type="button" onClick={() => setMostrarForm(false)} className="px-4 py-2 text-sm text-gray-500">
              Cancelar
            </button>
            <button type="submit" className="rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700">
              Salvar
            </button>
          </div>
        </form>
      )}

      <div className="flex gap-2 mb-3">
        {['todos', 'aberto', 'vencido', 'pago', 'cancelado'].map((s) => (
          <button
            key={s}
            onClick={() => setFiltroStatus(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
              filtroStatus === s ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Carregando...</p>
      ) : (
        <ul className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {listaFiltrada.map((item) => {
            const vencido = item.status === 'aberto' && isOverdue(item.data_vencimento)
            const pessoaNome = tipo === 'pagar' ? item.fornecedores?.nome : item.clientes?.nome
            return (
              <li key={item.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{item.descricao}</p>
                  <p className="text-xs text-gray-500">
                    Venc: {formatDateBR(item.data_vencimento)}
                    {item.categorias?.nome ? ` · ${item.categorias.nome}` : ''}
                    {pessoaNome ? ` · ${pessoaNome}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">{formatCurrencyBRL(item.valor)}</span>
                  <StatusBadge status={item.status} vencido={vencido} />
                  {item.status === 'aberto' && (
                    <button
                      onClick={() => marcarComoPago(item)}
                      title={tipo === 'pagar' ? 'Marcar como pago' : 'Marcar como recebido'}
                      className="text-green-600 hover:bg-green-50 p-1 rounded"
                    >
                      <CheckCircle2 size={18} />
                    </button>
                  )}
                  {item.status === 'aberto' && (
                    <button onClick={() => cancelar(item)} className="text-gray-400 hover:text-orange-500 p-1 rounded">
                      <X size={16} />
                    </button>
                  )}
                  <button onClick={() => excluir(item.id)} className="text-gray-400 hover:text-red-600 p-1 rounded">
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            )
          })}
          {listaFiltrada.length === 0 && (
            <li className="px-4 py-3 text-sm text-gray-400">Nenhum lançamento encontrado.</li>
          )}
        </ul>
      )}
    </div>
  )
}

function StatusBadge({ status, vencido }) {
  if (status === 'aberto' && vencido) {
    return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">Vencido</span>
  }
  const map = {
    aberto: 'bg-yellow-100 text-yellow-700',
    pago: 'bg-green-100 text-green-700',
    cancelado: 'bg-gray-100 text-gray-500',
  }
  const label = { aberto: 'Em aberto', pago: 'Pago', cancelado: 'Cancelado' }
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status]}`}>{label[status]}</span>
}
