import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Search, X } from 'lucide-react'

// tabela: 'clientes' | 'fornecedores'
// value: id selecionado (ou '')
// onChange: (id) => void
export default function BuscaPessoa({ tabela, value, onChange, placeholder }) {
  const [query, setQuery] = useState('')
  const [nomeSelecionado, setNomeSelecionado] = useState('')
  const [resultados, setResultados] = useState([])
  const [aberto, setAberto] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const timeoutRef = useRef(null)
  const containerRef = useRef(null)

  // Se já vier um "value" (edição, ou setado por fora), busca o nome pra exibir
  useEffect(() => {
    if (!value) {
      setNomeSelecionado('')
      return
    }
    supabase
      .from(tabela)
      .select('nome')
      .eq('id', value)
      .single()
      .then(({ data }) => {
        if (data) setNomeSelecionado(data.nome)
      })
  }, [value, tabela])

  // Fecha o dropdown se clicar fora
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
        .from(tabela)
        .select('id, nome')
        .eq('ativo', true)
        .ilike('nome', `%${texto.trim()}%`)
        .order('nome')
        .limit(20)
      setResultados(data || [])
      setBuscando(false)
    }, 300) // debounce: espera parar de digitar antes de consultar o banco
  }

  function selecionar(pessoa) {
    onChange(pessoa.id)
    setNomeSelecionado(pessoa.nome)
    setQuery('')
    setAberto(false)
  }

  function limpar() {
    onChange('')
    setNomeSelecionado('')
    setQuery('')
  }

  return (
    <div ref={containerRef} className="relative col-span-2">
      {nomeSelecionado && !aberto ? (
        <div className="flex items-center justify-between rounded-lg border border-gray-300 px-3 py-2 text-sm bg-gray-50">
          <span className="text-gray-800">{nomeSelecionado}</span>
          <button type="button" onClick={limpar} className="text-gray-400 hover:text-red-600">
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleDigitar(e.target.value)}
            onFocus={() => setAberto(true)}
            placeholder={placeholder}
            className="w-full rounded-lg border border-gray-300 pl-8 pr-3 py-2 text-sm"
          />
        </div>
      )}

      {aberto && query.trim().length >= 2 && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {buscando ? (
            <p className="px-3 py-2 text-sm text-gray-400">Buscando...</p>
          ) : resultados.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-400">Nenhum resultado para "{query}".</p>
          ) : (
            resultados.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => selecionar(p)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 text-gray-700"
              >
                {p.nome}
              </button>
            ))
          )}
        </div>
      )}
      {aberto && query.trim().length > 0 && query.trim().length < 2 && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs text-gray-400">
          Digite ao menos 2 letras...
        </div>
      )}
    </div>
  )
}
