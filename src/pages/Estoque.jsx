import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatCurrencyBRL } from '../lib/format'
import { Plus, Trash2, Pencil, Check, X, PackagePlus, AlertTriangle } from 'lucide-react'

const CAMPOS_VAZIOS = {
  nome: '',
  descricao: '',
  valor_custo: '',
  valor_venda: '',
  quantidade_estoque: '0',
  unidade: 'un',
}

export default function Estoque() {
  const [lista, setLista] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [form, setForm] = useState(CAMPOS_VAZIOS)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [entradaId, setEntradaId] = useState(null)
  const [entradaQtd, setEntradaQtd] = useState('')

  async function carregar() {
    setLoading(true)
    const { data, error } = await supabase.from('pecas').select('*').eq('ativo', true).order('nome').range(0, 9999)
    if (error) setErro(error.message)
    else setLista(data)
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
    if (!form.nome.trim()) return

    const payload = {
      nome: form.nome.trim(),
      descricao: form.descricao || null,
      valor_custo: Number(form.valor_custo) || 0,
      valor_venda: Number(form.valor_venda) || 0,
      unidade: form.unidade || 'un',
    }
    if (!editandoId) payload.quantidade_estoque = Number(form.quantidade_estoque) || 0

    const { error } = editandoId
      ? await supabase.from('pecas').update(payload).eq('id', editandoId)
      : await supabase.from('pecas').insert(payload)

    if (error) {
      setErro(error.message)
      return
    }
    cancelarFormulario()
    carregar()
  }

  function iniciarEdicao(peca) {
    setForm({
      nome: peca.nome,
      descricao: peca.descricao || '',
      valor_custo: String(peca.valor_custo ?? '0'),
      valor_venda: String(peca.valor_venda ?? '0'),
      quantidade_estoque: String(peca.quantidade_estoque ?? '0'),
      unidade: peca.unidade || 'un',
    })
    setEditandoId(peca.id)
    setMostrarForm(true)
  }

  async function inativar(id) {
    if (!confirm('Remover esta peça do estoque ativo?')) return
    const { error } = await supabase.from('pecas').update({ ativo: false }).eq('id', id)
    if (error) {
      setErro(error.message)
      return
    }
    carregar()
  }

  function abrirEntrada(peca) {
    setEntradaId(peca.id)
    setEntradaQtd('')
  }

  async function confirmarEntrada(peca) {
    const qtd = Number(entradaQtd)
    if (!qtd || qtd <= 0) return
    const { error } = await supabase
      .from('pecas')
      .update({ quantidade_estoque: Number(peca.quantidade_estoque) + qtd })
      .eq('id', peca.id)
    if (error) {
      setErro(error.message)
      return
    }
    setEntradaId(null)
    carregar()
  }

  return (
    <div className="max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1 gap-2">
        <h2 className="text-2xl font-bold text-gray-900">Estoque de Peças</h2>
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
          <Plus size={16} /> Nova peça
        </button>
      </div>
      <p className="text-gray-500 text-sm mb-6">Usadas em Ordens de Serviço. O estoque desconta automaticamente ao usar numa OS.</p>

      {erro && <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-2">{erro}</div>}

      {mostrarForm && (
        <form onSubmit={salvar} className="bg-white border border-gray-200 rounded-lg p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {editandoId && <p className="col-span-1 sm:col-span-2 text-sm font-medium text-primary-700 -mb-1">Editando peça</p>}
          <input
            placeholder="Nome da peça *"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            className="col-span-1 sm:col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            required
          />
          <input
            placeholder="Descrição (opcional)"
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            className="col-span-1 sm:col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Valor de custo"
            value={form.valor_custo}
            onChange={(e) => setForm({ ...form, valor_custo: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Valor de venda *"
            value={form.valor_venda}
            onChange={(e) => setForm({ ...form, valor_venda: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            required
          />
          {!editandoId && (
            <input
              type="number"
              step="0.01"
              placeholder="Quantidade inicial em estoque"
              value={form.quantidade_estoque}
              onChange={(e) => setForm({ ...form, quantidade_estoque: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          )}
          <select
            value={form.unidade}
            onChange={(e) => setForm({ ...form, unidade: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="un">Unidade (un)</option>
            <option value="pç">Peça (pç)</option>
            <option value="par">Par</option>
            <option value="m">Metro (m)</option>
            <option value="kg">Quilo (kg)</option>
            <option value="litro">Litro</option>
          </select>
          <div className="col-span-1 sm:col-span-2 flex justify-end gap-2">
            <button type="button" onClick={cancelarFormulario} className="px-4 py-2 text-sm text-gray-500">
              Cancelar
            </button>
            <button type="submit" className="rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700">
              {editandoId ? 'Salvar alterações' : 'Cadastrar'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">Carregando...</p>
      ) : (
        <ul className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {lista.map((p) => (
            <li key={p.id} className="px-4 py-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-gray-800 flex items-center gap-2">
                    {p.nome}
                    {Number(p.quantidade_estoque) <= 0 && (
                      <span className="flex items-center gap-1 text-[11px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">
                        <AlertTriangle size={10} /> sem estoque
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    Custo: {formatCurrencyBRL(p.valor_custo)} · Venda: {formatCurrencyBRL(p.valor_venda)} · Em estoque:{' '}
                    <span className="font-medium">{p.quantidade_estoque} {p.unidade}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => abrirEntrada(p)}
                    title="Registrar entrada de estoque"
                    className="flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full hover:bg-green-100"
                  >
                    <PackagePlus size={12} /> Entrada
                  </button>
                  <button onClick={() => iniciarEdicao(p)} className="text-gray-400 hover:text-primary-600 p-1 rounded">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => inativar(p.id)} className="text-gray-400 hover:text-red-600 p-1 rounded">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {entradaId === p.id && (
                <div className="mt-2 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-2">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Quantidade a adicionar"
                    value={entradaQtd}
                    onChange={(e) => setEntradaQtd(e.target.value)}
                    className="flex-1 rounded-lg border border-gray-300 px-2 py-1 text-sm"
                    autoFocus
                  />
                  <button onClick={() => confirmarEntrada(p)} className="text-green-600 hover:bg-green-100 p-1 rounded">
                    <Check size={16} />
                  </button>
                  <button onClick={() => setEntradaId(null)} className="text-gray-400 hover:bg-gray-100 p-1 rounded">
                    <X size={16} />
                  </button>
                </div>
              )}
            </li>
          ))}
          {lista.length === 0 && <li className="px-4 py-3 text-sm text-gray-400">Nenhuma peça cadastrada ainda.</li>}
        </ul>
      )}
    </div>
  )
}
