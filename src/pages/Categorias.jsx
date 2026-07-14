import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Trash2, Pencil, X, Check } from 'lucide-react'

export default function Categorias() {
  const [categorias, setCategorias] = useState([])
  const [equipamentos, setEquipamentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)

  const [novoNome, setNovoNome] = useState('')
  const [novoTipo, setNovoTipo] = useState('despesa')
  const [novaNatureza, setNovaNatureza] = useState('operacional')
  const [novoEquipamento, setNovoEquipamento] = useState('')

  const [editandoId, setEditandoId] = useState(null)
  const [editNome, setEditNome] = useState('')
  const [editandoTabela, setEditandoTabela] = useState(null) // 'categorias' | 'equipamentos'

  async function carregar() {
    setLoading(true)
    const [cats, equips] = await Promise.all([
      supabase.from('categorias').select('*').order('tipo').order('nome').range(0, 9999),
      supabase.from('equipamentos').select('*').eq('ativo', true).order('nome').range(0, 9999),
    ])
    if (cats.error) setErro(cats.error.message)
    else setCategorias(cats.data)
    setEquipamentos(equips.data || [])
    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  async function adicionarCategoria(e) {
    e.preventDefault()
    if (!novoNome.trim()) return
    const { error } = await supabase
      .from('categorias')
      .insert({ nome: novoNome.trim(), tipo: novoTipo, natureza: novaNatureza })
    if (error) {
      setErro(error.message)
      return
    }
    setNovoNome('')
    setNovaNatureza('operacional')
    carregar()
  }

  async function alternarNatureza(id, naturezaAtual) {
    const nova = naturezaAtual === 'operacional' ? 'nao_operacional' : 'operacional'
    const { error } = await supabase.from('categorias').update({ natureza: nova }).eq('id', id)
    if (error) {
      setErro(error.message)
      return
    }
    carregar()
  }

  async function adicionarEquipamento(e) {
    e.preventDefault()
    if (!novoEquipamento.trim()) return
    const { error } = await supabase.from('equipamentos').insert({ nome: novoEquipamento.trim() })
    if (error) {
      setErro(error.message)
      return
    }
    setNovoEquipamento('')
    carregar()
  }

  async function excluir(tabela, id, mensagemConfirmacao) {
    if (!confirm(mensagemConfirmacao)) return
    // Equipamentos usamos "inativar" (soft delete), categorias excluímos de fato
    const { error } =
      tabela === 'equipamentos'
        ? await supabase.from('equipamentos').update({ ativo: false }).eq('id', id)
        : await supabase.from('categorias').delete().eq('id', id)
    if (error) {
      setErro(error.message)
      return
    }
    carregar()
  }

  function iniciarEdicao(tabela, item) {
    setEditandoTabela(tabela)
    setEditandoId(item.id)
    setEditNome(item.nome)
  }

  async function salvarEdicao(tabela, id) {
    const { error } = await supabase.from(tabela).update({ nome: editNome.trim() }).eq('id', id)
    if (error) {
      setErro(error.message)
      return
    }
    setEditandoId(null)
    setEditandoTabela(null)
    carregar()
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setEditandoTabela(null)
  }

  const receitas = categorias.filter((c) => c.tipo === 'receita')
  const despesas = categorias.filter((c) => c.tipo === 'despesa')

  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Plano de Contas</h2>
      <p className="text-gray-500 text-sm mb-6">
        Categorias usadas para classificar receitas e despesas nos lançamentos e no DRE.
      </p>

      {erro && <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-2">{erro}</div>}

      <form onSubmit={adicionarCategoria} className="flex gap-2 mb-2 items-center">
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
      <label className="flex items-center gap-1.5 text-xs text-gray-500 mb-6">
        <input
          type="checkbox"
          checked={novaNatureza === 'nao_operacional'}
          onChange={(e) => setNovaNatureza(e.target.checked ? 'nao_operacional' : 'operacional')}
        />
        Não operacional (ex: empréstimos, aportes — fica separado do resultado operacional no DRE)
      </label>

      {loading ? (
        <p className="text-gray-400 text-sm">Carregando...</p>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          <ListaColuna
            titulo="Receitas"
            tabela="categorias"
            lista={receitas}
            editandoId={editandoId}
            editandoTabela={editandoTabela}
            editNome={editNome}
            setEditNome={setEditNome}
            iniciarEdicao={iniciarEdicao}
            salvarEdicao={salvarEdicao}
            cancelarEdicao={cancelarEdicao}
            excluir={(id) => excluir('categorias', id, 'Excluir esta categoria? Lançamentos vinculados perdem a categoria.')}
            alternarNatureza={alternarNatureza}
          />
          <ListaColuna
            titulo="Despesas"
            tabela="categorias"
            lista={despesas}
            editandoId={editandoId}
            editandoTabela={editandoTabela}
            editNome={editNome}
            setEditNome={setEditNome}
            iniciarEdicao={iniciarEdicao}
            salvarEdicao={salvarEdicao}
            cancelarEdicao={cancelarEdicao}
            excluir={(id) => excluir('categorias', id, 'Excluir esta categoria? Lançamentos vinculados perdem a categoria.')}
            alternarNatureza={alternarNatureza}
          />
        </div>
      )}

      <div className="mt-10 pt-8 border-t border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Equipamentos</h2>
        <p className="text-gray-500 text-sm mb-6">
          Usado em Contas a Receber, para registrar em qual equipamento o serviço foi prestado.
        </p>

        <form onSubmit={adicionarEquipamento} className="flex gap-2 mb-6">
          <input
            type="text"
            placeholder="Nome do equipamento (ex: Ar-condicionado)"
            value={novoEquipamento}
            onChange={(e) => setNovoEquipamento(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
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
          <div className="max-w-sm">
            <ListaColuna
              titulo="Equipamentos cadastrados"
              tabela="equipamentos"
              lista={equipamentos}
              editandoId={editandoId}
              editandoTabela={editandoTabela}
              editNome={editNome}
              setEditNome={setEditNome}
              iniciarEdicao={iniciarEdicao}
              salvarEdicao={salvarEdicao}
              cancelarEdicao={cancelarEdicao}
              excluir={(id) => excluir('equipamentos', id, 'Remover este equipamento da lista ativa?')}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function ListaColuna({
  titulo,
  tabela,
  lista,
  editandoId,
  editandoTabela,
  editNome,
  setEditNome,
  iniciarEdicao,
  salvarEdicao,
  cancelarEdicao,
  excluir,
  alternarNatureza,
}) {
  return (
    <div>
      <h3 className="font-semibold text-gray-700 mb-2 text-sm uppercase tracking-wide">{titulo}</h3>
      <ul className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
        {lista.map((item) => {
          const emEdicao = editandoId === item.id && editandoTabela === tabela
          return (
            <li key={item.id} className="flex items-center justify-between px-3 py-2">
              {emEdicao ? (
                <>
                  <input
                    value={editNome}
                    onChange={(e) => setEditNome(e.target.value)}
                    className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm mr-2"
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <button onClick={() => salvarEdicao(tabela, item.id)} className="text-green-600 hover:bg-green-50 p-1 rounded">
                      <Check size={16} />
                    </button>
                    <button onClick={cancelarEdicao} className="text-gray-400 hover:bg-gray-100 p-1 rounded">
                      <X size={16} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-800">{item.nome}</span>
                    {tabela === 'categorias' && (
                      <button
                        onClick={() => alternarNatureza(item.id, item.natureza)}
                        title="Clique pra alternar entre operacional / não operacional"
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          item.natureza === 'nao_operacional'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {item.natureza === 'nao_operacional' ? 'não operacional' : 'operacional'}
                      </button>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => iniciarEdicao(tabela, item)}
                      className="text-gray-400 hover:text-primary-600 hover:bg-gray-100 p-1 rounded"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => excluir(item.id)}
                      className="text-gray-400 hover:text-red-600 hover:bg-gray-100 p-1 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </>
              )}
            </li>
          )
        })}
        {lista.length === 0 && <li className="px-3 py-3 text-sm text-gray-400">Nada cadastrado ainda.</li>}
      </ul>
    </div>
  )
}
