import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Search, X, UserPlus, Check } from 'lucide-react'

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
  const [criandoNovo, setCriandoNovo] = useState(false)
  const [novoTelefone, setNovoTelefone] = useState('')
  const [novoEndereco, setNovoEndereco] = useState('')
  const [salvandoNovo, setSalvandoNovo] = useState(false)
  const timeoutRef = useRef(null)
  const containerRef = useRef(null)

  const rotulo = tabela === 'clientes' ? 'cliente' : 'fornecedor'

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

  function handleDigitar(texto) {
    setQuery(texto)
    setAberto(true)
    setCriandoNovo(false)

    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    if (texto.trim().length < 2) {
      setResultados([])
      return
    }

    setBuscando(true)
    timeoutRef.current = setTimeout(async () => {
      const termo = texto.trim()
      const { data } = await supabase
        .from(tabela)
        .select('id, nome, telefone, endereco')
        .eq('ativo', true)
        .or(`nome.ilike.%${termo}%,telefone.ilike.%${termo}%,endereco.ilike.%${termo}%`)
        .order('nome')
        .limit(20)
      setResultados(data || [])
      setBuscando(false)
    }, 300)
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
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
          {buscando ? (
            <p className="px-3 py-2 text-sm text-gray-400">Buscando...</p>
          ) : (
            <>
              {resultados.length === 0 && !criandoNovo && (
                <p className="px-3 py-2 text-sm text-gray-400">Nenhum resultado para "{query}".</p>
              )}
              {resultados.map((p) => (
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
              ))}

              {!criandoNovo ? (
                <button
                  type="button"
                  onClick={abrirCriacao}
                  className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm text-primary-700 hover:bg-primary-50 border-t border-gray-100"
                >
                  <UserPlus size={14} />
                  Cadastrar "{query}" como novo {rotulo}
                </button>
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
            </>
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
