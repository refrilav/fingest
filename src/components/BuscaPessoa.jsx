import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Search, X, Check } from 'lucide-react'

const NOVO_VAZIO = {
  nome: '',
  documento: '',
  telefone: '',
  email: '',
  endereco: '',
  bairro: '',
  cidade: '',
  observacoes: '',
}

// tabela: "clientes" ou "fornecedores"
export default function BuscaPessoa({ tabela, value, onChange, placeholder }) {
  const [query, setQuery] = useState('')
  const [nomeSelecionado, setNomeSelecionado] = useState('')
  const [resultados, setResultados] = useState([])
  const [aberto, setAberto] = useState(false)
  const [painelAberto, setPainelAberto] = useState(false)
  const [novo, setNovo] = useState(NOVO_VAZIO)
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
  }

  function limpar() {
    onChange('')
    setNomeSelecionado('')
    setQuery('')
  }

  function abrirPainelCriacao() {
    setNovo({ ...NOVO_VAZIO, nome: query.trim() })
    setPainelAberto(true)
    setAberto(false)
  }

  function fecharPainel() {
    setPainelAberto(false)
    setNovo(NOVO_VAZIO)
  }

  async function salvarNovo() {
    if (!novo.nome.trim()) return
    setSalvandoNovo(true)
    const { data, error } = await supabase
      .from(tabela)
      .insert({
        nome: novo.nome.trim(),
        documento: novo.documento || null,
        telefone: novo.telefone || null,
        email: novo.email || null,
        endereco: novo.endereco || null,
        bairro: novo.bairro || null,
        cidade: novo.cidade || null,
        observacoes: novo.observacoes || null,
      })
      .select()
      .single()
    setSalvandoNovo(false)
    if (error) {
      alert(`Não consegui cadastrar: ${error.message}`)
      return
    }
    selecionar(data)
    fecharPainel()
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
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setAberto(true)}
            placeholder={placeholder || `Buscar ${rotulo}...`}
            className="w-full rounded-lg border border-gray-300 pl-8 pr-3 py-2 text-sm"
          />
        </div>
      )}

      {aberto && !nomeSelecionado && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
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
              onClick={abrirPainelCriacao}
              className="w-full text-left px-3 py-2 text-sm text-primary-700 hover:bg-primary-50 border-t border-gray-100"
            >
              + Cadastrar "{query.trim()}" como novo {rotulo}
            </button>
          )}
        </div>
      )}

      {painelAberto && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={fecharPainel} />
          <div className="relative bg-white w-full max-w-md h-full overflow-y-auto shadow-xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
              <h3 className="font-bold text-gray-900">Novo {rotulo}</h3>
              <button type="button" onClick={fecharPainel} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-3 flex-1">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nome *</label>
                <input
                  value={novo.nome}
                  onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">CPF/CNPJ</label>
                  <input
                    value={novo.documento}
                    onChange={(e) => setNovo({ ...novo, documento: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Telefone</label>
                  <input
                    value={novo.telefone}
                    onChange={(e) => setNovo({ ...novo, telefone: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">E-mail</label>
                <input
                  type="email"
                  value={novo.email}
                  onChange={(e) => setNovo({ ...novo, email: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Endereço</label>
                <input
                  value={novo.endereco}
                  onChange={(e) => setNovo({ ...novo, endereco: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Bairro</label>
                  <input
                    value={novo.bairro}
                    onChange={(e) => setNovo({ ...novo, bairro: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Cidade</label>
                  <input
                    value={novo.cidade}
                    onChange={(e) => setNovo({ ...novo, cidade: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Observações</label>
                <textarea
                  value={novo.observacoes}
                  onChange={(e) => setNovo({ ...novo, observacoes: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-100 shrink-0">
              <button type="button" onClick={fecharPainel} className="px-4 py-2 text-sm text-gray-500">
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarNovo}
                disabled={salvandoNovo || !novo.nome.trim()}
                className="flex items-center gap-1 rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                <Check size={16} /> {salvandoNovo ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
