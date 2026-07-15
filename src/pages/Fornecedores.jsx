import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Plus, Trash2, Upload } from 'lucide-react'

const CAMPOS_VAZIOS = { nome: '', documento: '', telefone: '', email: '', observacoes: '' }

export default function Fornecedores() {
  const [lista, setLista] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [form, setForm] = useState(CAMPOS_VAZIOS)
  const [mostrarForm, setMostrarForm] = useState(false)

  async function carregar() {
    setLoading(true)
    const { data, error } = await supabase
      .from('fornecedores')
      .select('*')
      .eq('ativo', true)
      .order('nome')
      .range(0, 9999)
    if (error) setErro(error.message)
    else setLista(data)
    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  async function salvar(e) {
    e.preventDefault()
    if (!form.nome.trim()) return
    const { error } = await supabase.from('fornecedores').insert({
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
    carregar()
  }

  async function inativar(id) {
    if (!confirm('Remover este fornecedor da lista ativa?')) return
    const { error } = await supabase.from('fornecedores').update({ ativo: false }).eq('id', id)
    if (error) {
      setErro(error.message)
      return
    }
    carregar()
  }

  return (
    <div className="max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1 gap-2">
        <h2 className="text-2xl font-bold text-gray-900">Fornecedores</h2>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Link
            to="/fornecedores/importar"
            className="flex items-center gap-1 rounded-lg bg-gray-100 text-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-200"
          >
            <Upload size={16} /> Importar planilha
          </Link>
          <button
            onClick={() => setMostrarForm((v) => !v)}
            className="flex items-center gap-1 rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700"
          >
            <Plus size={16} /> Novo fornecedor
          </button>
        </div>
      </div>
      <p className="text-gray-500 text-sm mb-6">Usados em contas a pagar.</p>

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

      {loading ? (
        <p className="text-gray-400 text-sm">Carregando...</p>
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
          {lista.length === 0 && <li className="px-4 py-3 text-sm text-gray-400">Nenhum fornecedor ainda.</li>}
        </ul>
      )}
    </div>
  )
}
