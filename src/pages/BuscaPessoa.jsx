import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Search, X, Check } from 'lucide-react'

// tabela: "clientes" ou "fornecedores"
export default function BuscaPessoa({ tabela, value, onChange, placeholder }) {
  const [query, setQuery] = useState('')
  const [nomeSelecionado, setNomeSelecionado] = useState('')
  const [resultados, setResultados] = useState([])
  const [aberto, setAberto] = useState(false)
  const [criandoNovo, setCriandoNovo] = useState(false)
  const [novoTelefone, setNovoTelefone] = useState('')
  const [novoEndereco, setNovoEndereco] = useState('')
  const [salvandoNovo, setSalvandoNovo] = useState(false)
  const timeoutRef = useRef(null)
  const containerRef = useRef(null)

  const rotulo = tabela === 'fornecedores' ? 'fornecedor' : 'cliente'

  useEffect(() => {
    if (!value) {
      setNomeSelecionado('')
      return
    }
    supabase
      .from(tabela)
      .select('nome, telefone')
      .eq('id', value)
      .single()
      .then(({ data }) => {
        if (data) setNomeSelecionado(`${data.nome}${data.telefone ? ` · ${data.telefone}` : ''}`)
      })
  }, [value, tabela])

  useEffect(() => {
    function handleClickFora(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setAberto(false)
        setCriandoNovo(false)
      }
    }
    document.addEventListener('mousedown', handleClickFora)
    return () => document.removeEventListener('mousedown', handleClickFora)
  }, [])

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (!query.trim()) {
      setResultados([])
      return
    }
    timeoutRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from(tabela)
        .select('id, nome, telefone, endereco')
        .ilike('nome', `%${query.trim()}%`)
        .order('nome')
        .limit(20)
      setResultados(data || [])
    }, 250)
  }, [query, tabela])

  function selecionar(pessoa) {
    onChange(pessoa.id)
    setNomeSelecionado(`${pessoa.nome}${pessoa.telefone ? ` · ${pessoa.telefone}` : ''}`)
    setQuery('')
    setAberto(false)
    setCriandoNovo(false)
  }

  function limpar() {
    onChange('')
    setNomeSelecionado('')
    setQuery('')
  }

  function abrirCriacao() {
    setCriandoNovo(true)
    setNovoTelefone('')
    setNovoEndereco('')
  }

  async function salvarNovo() {
    if (!query.trim()) return
    setSalvandoNovo(true)
    const { data, error } = await supabase
      .from(tabela)
      .insert({ nome: query.trim(), telefone: novoTelefone || null, endereco: novoEndereco || null })
      .select()
      .single()
    setSalvandoNovo(false)
    if (error) {
      alert(`Não consegui cadastrar: ${error.message}`)
      return
    }
    selecionar(data)
    setCriandoNovo(false)
  }

  return (
    <div ref={containerRef} className="relative">
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
            onChange={(e) => {
              setQuery(e.target.value)
              setCriandoNovo(false)
            }}
            onFocus={() => setAberto(true)}
            placeholder={placeholder || `Buscar ${rotulo}...`}
            className="w-full rounded-lg border border-gray-300 pl-8 pr-3 py-2 text-sm"
          />
        </div>
      )}

      {aberto && !nomeSelecionado && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {!criandoNovo ? (
            <>
              {resultados.length === 0 && query.trim() && (
                <p className="px-3 py-2 text-sm text-gray-400">Nenhum resultado.</p>
              )}
              {resultados.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selecionar(p)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 text-gray-700 border-b border-gray-50 last:border-0"
                >
                  <p className="font-medium">{p.nome}</p>
                  {(p.telefone || p.endereco) && (
                    <p className="text-xs text-gray-400">{[p.telefone, p.endereco].filter(Boolean).join(' · ')}</p>
                  )}
                </button>
              ))}
              {query.trim() && (
                <button
                  type="button"
                  onClick={abrirCriacao}
                  className="w-full text-left px-3 py-2 text-sm text-primary-700 hover:bg-primary-50 border-t border-gray-100"
                >
                  + Cadastrar "{query.trim()}" como novo {rotulo}
                </button>
              )}
            </>
          ) : (
            <div className="p-2 border-t border-gray-100 bg-gray-50">
              <p className="text-xs text-gray-500 mb-1.5">Novo {rotulo}: <strong>{query}</strong></p>
              <div className="flex flex-col gap-1.5">
                <input
                  type="text"
                  value={novoTelefone}
                  onChange={(e) => setNovoTelefone(e.target.value)}
                  placeholder="Telefone (opcional)"
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                  autoFocus
                />
                <input
                  type="text"
                  value={novoEndereco}
                  onChange={(e) => setNovoEndereco(e.target.value)}
                  placeholder="Endereço (opcional)"
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                />
                <div className="flex items-center gap-1.5 justify-end">
                  <button
                    type="button"
                    onClick={() => setCriandoNovo(false)}
                    className="text-gray-400 hover:text-gray-600 p-1.5"
                  >
                    <X size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={salvarNovo}
                    disabled={salvandoNovo}
                    className="flex items-center gap-1 rounded-lg bg-primary-600 text-white px-2.5 py-1.5 text-xs font-medium hover:bg-primary-700 disabled:opacity-60"
                  >
                    <Check size={13} /> Salvar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
