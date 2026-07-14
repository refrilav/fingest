import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Trash2, Pencil, X, Check } from 'lucide-react'

export default function Categorias() {
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [novoNome, setNovoNome] = useState('')
  const [novoTipo, setNovoTipo] = useState('despesa')
  const [editandoId, setEditandoId] = useState(null)
  const [editNome, setEditNome] = useState('')

  async function carregar() {
    setLoading(true)
    const { data, error } = await supabase
      .from('categorias')
      .select('*')
      .order('tipo')
      .order('nome')
      .range(0, 9999)

    if (error) setErro(error.message)
    else setCategorias(data)
    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  async function adicionar(e) {
    e.preventDefault()
    if (!novoNome.trim()) return
    const { error } = await supabase
      .from('categorias')
      .insert({ nome: novoNome.trim(), tipo: novoTipo })
    if (error) {
      setErro(error.message)
      return
    }
    setNovoNome('')
    carregar()
  }

  async function excluir(id) {
    if (!confirm('Excluir esta categoria? Lançamentos vinculados perdem a categoria.')) return
    const { error } = await supabase.from('categorias').delete().eq('id', id)
    if (error) {
      setErro(error.message)
      return
    }
    carregar()
  }

  function iniciarEdicao(cat) {
    setEditandoId(cat.id)
    setEditNome(cat.nome)
  }

  async function salvarEdicao(id) {
    const { error } = await supabase
      .from('categorias')
      .update({ nome: editNome.trim() })
      .eq('id', id)
    if (error) {
      setErro(error.message)
      return
    }
    setEditandoId(null)
    carregar()
  }

  const receitas = categorias.filter((c) => c.tipo === 'receita')
  const despesas = categorias.filter((c) => c.tipo === 'despesa')

  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Plano de Contas</h2>
      <p className="text-gray-500 text-sm mb-6">
        Categorias usadas para classificar receitas e despesas nos lançamentos e no DRE.
      </p>

      {erro && (
        <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-2">{erro}</div>
      )}

      <form onSubmit={adicionar} className="flex gap-2 mb-6">
        <input
          type="text"
          placeholder="Nome da categoria"
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <select
          value={novoTipo}
          onChange={(e) => setNovoTipo(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="despesa">Despesa</option>
          <option value="receita">Receita</option>
        </select>
        <button
          type="submit"
          className="flex items-center gap-1 rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700"
        >
          <Plus size={16} /> Adicionar
        </button>
      </form>

      {loading ? (
        <p className="text-gray-400 text-sm">Carregando...</p>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          <CategoriaColuna
            titulo="Receitas"
            lista={receitas}
            editandoId={editandoId}
            editNome={editNome}
            setEditNome={setEditNome}
            iniciarEdicao={iniciarEdicao}
            salvarEdicao={salvarEdicao}
            cancelarEdicao={() => setEditandoId(null)}
            excluir={excluir}
          />
          <CategoriaColuna
            titulo="Despesas"
            lista={despesas}
            editandoId={editandoId}
            editNome={editNome}
            setEditNome={setEditNome}
            iniciarEdicao={iniciarEdicao}
            salvarEdicao={salvarEdicao}
            cancelarEdicao={() => setEditandoId(null)}
            excluir={excluir}
          />
        </div>
      )}
    </div>
  )
}

function CategoriaColuna({
  titulo,
  lista,
  editandoId,
  editNome,
  setEditNome,
  iniciarEdicao,
  salvarEdicao,
  cancelarEdicao,
  excluir,
}) {
  return (
    <div>
      <h3 className="font-semibold text-gray-700 mb-2 text-sm uppercase tracking-wide">
        {titulo}
      </h3>
      <ul className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
        {lista.map((cat) => (
          <li key={cat.id} className="flex items-center justify-between px-3 py-2">
            {editandoId === cat.id ? (
              <>
                <input
                  value={editNome}
                  onChange={(e) => setEditNome(e.target.value)}
                  className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm mr-2"
                  autoFocus
                />
                <div className="flex gap-1">
                  <button onClick={() => salvarEdicao(cat.id)} className="text-green-600 hover:bg-green-50 p-1 rounded">
                    <Check size={16} />
                  </button>
                  <button onClick={cancelarEdicao} className="text-gray-400 hover:bg-gray-100 p-1 rounded">
                    <X size={16} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <span className="text-sm text-gray-800">{cat.nome}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => iniciarEdicao(cat)}
                    className="text-gray-400 hover:text-primary-600 hover:bg-gray-100 p-1 rounded"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => excluir(cat.id)}
                    className="text-gray-400 hover:text-red-600 hover:bg-gray-100 p-1 rounded"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
        {lista.length === 0 && (
          <li className="px-3 py-3 text-sm text-gray-400">Nenhuma categoria ainda.</li>
        )}
      </ul>
    </div>
  )
}
