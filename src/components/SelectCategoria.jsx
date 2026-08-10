import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Check, X } from 'lucide-react'

// tipo: 'receita' | 'despesa' — usado ao criar a nova categoria
// categorias: lista já carregada pela página (para popular o select)
// onCriada: (novaCategoria) => void — chamado após criar, pra página atualizar a lista e selecionar
export default function SelectCategoria({ tipo, categorias, value, onChange, onCriada, className = '' }) {
  const [criando, setCriando] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    if (!novoNome.trim()) return
    setSalvando(true)
    const { data, error } = await supabase
      .from('categorias')
      .insert({ nome: novoNome.trim(), tipo })
      .select()
      .single()
    setSalvando(false)
    if (error) {
      alert(`Não consegui criar a categoria: ${error.message}`)
      return
    }
    setCriando(false)
    setNovoNome('')
    onCriada(data)
  }

  if (criando) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <input
          autoFocus
          type="text"
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          placeholder={`Nome da nova categoria (${tipo})`}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              salvar()
            }
          }}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="text-green-600 hover:bg-green-50 p-2 rounded-lg border border-gray-300 disabled:opacity-50"
        >
          <Check size={16} />
        </button>
        <button type="button" onClick={() => setCriando(false)} className="text-gray-400 hover:bg-gray-100 p-2 rounded-lg border border-gray-300">
          <X size={16} />
        </button>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="">{tipo === 'receita' ? 'Serviço/categoria...' : 'Categoria...'}</option>
        {categorias.map((c) => (
          <option key={c.id} value={c.id}>{c.nome}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setCriando(true)}
        title="Nova categoria"
        className="text-primary-600 hover:bg-primary-50 p-2 rounded-lg border border-gray-300 shrink-0"
      >
        <Plus size={16} />
      </button>
    </div>
  )
}
