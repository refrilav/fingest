import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Plus, Trash2, Upload, Search, X } from 'lucide-react'

const CAMPOS_VAZIOS = { nome: '', documento: '', telefone: '', email: '', observacoes: '' }
const LIMITE_PADRAO = 100

export default function Clientes() {
  const [lista, setLista] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [form, setForm] = useState(CAMPOS_VAZIOS)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [busca, setBusca] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [totalGeral, setTotalGeral] = useState(null)
  const timeoutRef = useRef(null)

  async function carregar(termoBusca = '') {
    setLoading(true)
    let query = supabase.from('clientes').select('*').eq('ativo', true).order('nome')

    if (termoBusca.trim().length >= 2) {
      // Busca por nome OU telefone, direto no servidor (não depende de carregar tudo)
      query = query.or(`nome.ilike.%${termoBusca.trim()}%,telefone.ilike.%${termoBusca.trim()}%`).range(0, 999)
    } else {
      query = query.range(0, LIMITE_PADRAO - 1)
    }

    const { data, error } = await query
    if (error) setErro(error.message)
    else setLista(data)
    setLoading(false)
    setBuscando(false)
  }

  async function carregarContagemTotal() {
    const { count } = await supabase.from('clientes').select('id', { count: 'exact', head: true }).eq('ativo', true)
    setTotalGeral(count)
  }

  useEffect(() => {
    carregar()
    carregarContagemTotal()
  }, [])

  function handleBusca(texto) {
    setBusca(texto)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setBuscando(true)
    timeoutRef.current = setTimeout(() => carregar(texto), 300)
  }

  async function salvar(e) {
    e.preventDefault()
    if (!form.nome.trim()) return
    const { error } = await supabase.from('clientes').insert({
      nome: form.nome.trim(),
      documento: form.documento || null,
      telefone: form.telefone || null,
      email: form.email || null,
      observacoes: form.observacoes || null,
    })
    if (error) {
      setErro(error.message)
      return
    }
    setForm(CAMPOS_VAZIOS)
    setMostrarForm(false)
    carregar(busca)
    carregarContagemTotal()
  }

  async function inativar(id) {
    if (!confirm('Remover este cliente da lista ativa?')) return
    const { error } = await supabase.from('clientes').update({ ativo: false }).eq('id', id)
    if (error) {
      setErro(error.message)
      return
    }
    carregar(busca)
    carregarContagemTotal()
  }

  return (
    <div className="max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1 gap-2">
        <h2 className="text-2xl font-bold text-gray-900">Clientes</h2>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Link
            to="/clientes/importar"
            className="flex items-center gap-1 rounded-lg bg-gray-100 text-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-200"
          >
            <Upload size={16} /> Importar planilha
          </Link>
          <button
            onClick={() => setMostrarForm((v) => !v)}
            className="flex items-center gap-1 rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700"
          >
            <Plus size={16} /> Novo cliente
          </button>
        </div>
      </div>
      <p className="text-gray-500 text-sm mb-4">
        Usados em contas a receber.
        {totalGeral !== null && ` ${totalGeral} cadastrado(s) no total.`}
      </p>

      {erro && <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-2">{erro}</div>}

      {mostrarForm && (
        <form onSubmit={salvar} className="bg-white border border-gray-200 rounded-lg p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            placeholder="Nome *"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            className="col-span-1 sm:col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            required
          />
          <input
            placeholder="CPF/CNPJ"
            value={form.documento}
            onChange={(e) => setForm({ ...form, documento: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Telefone"
            value={form.telefone}
            onChange={(e) => setForm({ ...form, telefone: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="E-mail"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="col-span-1 sm:col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <textarea
            placeholder="Observações"
            value={form.observacoes}
            onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            className="col-span-1 sm:col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            rows={2}
          />
          <div className="col-span-1 sm:col-span-2 flex justify-end gap-2">
            <button type="button" onClick={() => setMostrarForm(false)} className="px-4 py-2 text-sm text-gray-500">
              Cancelar
            </button>
            <button type="submit" className="rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700">
              Salvar
            </button>
          </div>
        </form>
      )}

      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={busca}
          onChange={(e) => handleBusca(e.target.value)}
          placeholder="Buscar por nome ou telefone..."
          className="w-full rounded-lg border border-gray-300 pl-8 pr-8 py-2 text-sm"
        />
        {busca && (
          <button
            onClick={() => {
              setBusca('')
              carregar('')
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {!busca && totalGeral > LIMITE_PADRAO && (
        <p className="text-xs text-gray-400 mb-3">
          Mostrando os primeiros {LIMITE_PADRAO} de {totalGeral}. Use a busca acima para encontrar outros.
        </p>
      )}

      {loading || buscando ? (
        <p className="text-gray-400 text-sm">{buscando ? 'Buscando...' : 'Carregando...'}</p>
      ) : (
        <ul className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {lista.map((f) => (
            <li key={f.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-800">{f.nome}</p>
                <p className="text-xs text-gray-500">
                  {[f.documento, f.telefone, f.email].filter(Boolean).join(' · ')}
                </p>
              </div>
              <button onClick={() => inativar(f.id)} className="text-gray-400 hover:text-red-600 p-1 rounded">
                <Trash2 size={16} />
              </button>
            </li>
          ))}
          {lista.length === 0 && (
            <li className="px-4 py-3 text-sm text-gray-400">
              {busca ? `Nenhum cliente encontrado para "${busca}".` : 'Nenhum cliente ainda.'}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
