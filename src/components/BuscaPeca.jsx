import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatCurrencyBRL } from '../lib/format'
import { Search } from 'lucide-react'

// onSelecionar: (peca) => void — peça inclui id, nome, valor_venda, quantidade_estoque
export default function BuscaPeca({ onSelecionar, placeholder }) {
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState([])
  const [aberto, setAberto] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const timeoutRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    function handleClickFora(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setAberto(false)
      }
    }
    document.addEventListener('mousedown', handleClickFora)
    return () => document.removeEventListener('mousedown', handleClickFora)
  }, [])

  function handleDigitar(texto) {
    setQuery(texto)
    setAberto(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    if (texto.trim().length < 2) {
      setResultados([])
      return
    }

    setBuscando(true)
    timeoutRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('pecas')
        .select('id, nome, valor_venda, quantidade_estoque, unidade')
        .eq('ativo', true)
        .ilike('nome', `%${texto.trim()}%`)
        .order('nome')
        .limit(20)
      setResultados(data || [])
      setBuscando(false)
    }, 300)
  }

  function selecionar(peca) {
    onSelecionar(peca)
    setQuery('')
    setAberto(false)
    setResultados([])
  }

  return (
    <div ref={containerRef} className="relative">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        type="text"
        value={query}
        onChange={(e) => handleDigitar(e.target.value)}
        onFocus={() => setAberto(true)}
        placeholder={placeholder || 'Buscar peça por nome...'}
        className="w-full rounded-lg border border-gray-300 pl-8 pr-3 py-2 text-sm"
      />

      {aberto && query.trim().length >= 2 && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {buscando ? (
            <p className="px-3 py-2 text-sm text-gray-400">Buscando...</p>
          ) : resultados.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-400">Nenhuma peça encontrada para "{query}".</p>
          ) : (
            resultados.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => selecionar(p)}
                disabled={Number(p.quantidade_estoque) <= 0}
                className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between"
              >
                <span>
                  {p.nome}
                  <span className="block text-xs text-gray-400">
                    {p.quantidade_estoque} {p.unidade} em estoque
                    {Number(p.quantidade_estoque) <= 0 ? ' (sem estoque)' : ''}
                  </span>
                </span>
                <span className="text-xs text-gray-500 shrink-0 ml-2">{formatCurrencyBRL(p.valor_venda)}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
