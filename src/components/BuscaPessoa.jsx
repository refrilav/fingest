import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Search, X } from 'lucide-react'

// tabela: 'clientes' | 'fornecedores'
// value: id selecionado (ou '')
// onChange: (id) => void
export default function BuscaPessoa({ tabela, value, onChange, placeholder }) {
  const [query, setQuery] = useState('')
  const [nomeSelecionado, setNomeSelecionado] = useState('')
  const [telefoneSelecionado, setTelefoneSelecionado] = useState('')
  const [resultados, setResultados] = useState([])
  const [aberto, setAberto] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const timeoutRef = useRef(null)
  const containerRef = useRef(null)

  // Se já vier um "value" (edição, ou setado por fora), busca o nome/telefone pra exibir
  useEffect(() => {
    if (!value) {
      setNomeSelecionado('')
      setTelefoneSelecionado('')
      return
    }
    supabase
      .from(tabela)
      .select('nome, telefone')
      .eq('id', value)
      .single()
      .then(({ data }) => {
        if (data) {
          setNomeSelecionado(data.nome)
          setTelefoneSelecionado(data.telefone || '')
        }
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
      const termo = texto.trim()
      // Busca por nome, telefone OU endereço, todos no servidor
      const { data } = await supabase
        .from(tabela)
        .select('id, nome, telefone, endereco')
        .eq('ativo', true)
        .or(`nome.ilike.%${termo}%,telefone.ilike.%${termo}%,endereco.ilike.%${termo}%`)
        .order('nome')
        .limit(20)
      setResultados(data || [])
      setBuscando(false)
    }, 300) // debounce: espera parar de digitar antes de consultar o banco
  }

  function selecionar(pessoa) {
    onChange(pessoa.id)
    setNomeSelecionado(pessoa.nome)
    setTelefoneSelecionado(pessoa.telefone || '')
    setQuery('')
    setAberto(false)
  }

  function limpar() {
    onChange('')
    setNomeSelecionado('')
    setTelefoneSelecionado('')
    setQuery('')
  }

  return (
    <div ref={containerRef} className="relative col-span-1 sm:col-span-2">
      {nomeSelecionado && !aberto ? (
        <div className="flex items-center justify-between rounded-lg border border-gray-300 px-3 py-2 text-sm bg-gray-50">
          <span className="text-gray-800">
            {nomeSelecionado}
            {telefoneSelecionado && <span className="text-gray-400"> · {telefoneSelecionado}</span>}
          </span>
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
            placeholder={placeholder || 'Buscar por nome, telefone ou endereço...'}
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
                <span className="block">{p.nome}</span>
                {(p.telefone || p.endereco) && (
                  <span className="block text-xs text-gray-400">
                    {[p.telefone, p.endereco].filter(Boolean).join(' · ')}
                  </span>
                )}
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
