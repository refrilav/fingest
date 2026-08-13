import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Search, X } from 'lucide-react'

// tabela de busca é sempre "ativos", filtrado por cliente_id (obrigatório)
// value: id selecionado (ou '')
// onChange: (id) => void
export default function BuscaAtivo({ clienteId, value, onChange, placeholder }) {
  const [query, setQuery] = useState('')
  const [nomeSelecionado, setNomeSelecionado] = useState('')
  const [resultados, setResultados] = useState([])
  const [aberto, setAberto] = useState(false)
  const timeoutRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!value) {
      setNomeSelecionado('')
      return
    }
    supabase
      .from('ativos')
      .select('local, modelo, codigo')
      .eq('id', value)
      .single()
      .then(({ data }) => {
        if (data) setNomeSelecionado(`REF-${data.codigo} · ${data.local || data.modelo || 'sem local'}`)
      })
  }, [value])

  useEffect(() => {
    function handleClickFora(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setAberto(false)
    }
    document.addEventListener('mousedown', handleClickFora)
    return () => document.removeEventListener('mousedown', handleClickFora)
  }, [])

  useEffect(() => {
    if (!clienteId) {
      setResultados([])
      return
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(async () => {
      let q = supabase.from('ativos').select('id, local, modelo, codigo').eq('cliente_id', clienteId).eq('ativo', true).order('codigo')
      if (query.trim()) q = q.ilike('local', `%${query.trim()}%`)
      const { data } = await q.limit(30)
      setResultados(data || [])
    }, 250)
  }, [query, clienteId, aberto])

  function selecionar(ativo) {
    onChange(ativo.id)
    setNomeSelecionado(`REF-${ativo.codigo} · ${ativo.local || ativo.modelo || 'sem local'}`)
    setQuery('')
    setAberto(false)
  }

  function limpar() {
    onChange('')
    setNomeSelecionado('')
    setQuery('')
  }

  if (!clienteId) {
    return (
      <div className="col-span-1 sm:col-span-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-400">
        Selecione o cliente primeiro pra escolher o equipamento específico (opcional).
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative col-span-1 sm:col-span-2">
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
            placeholder={placeholder || 'Equipamento específico (opcional)...'}
            className="w-full rounded-lg border border-gray-300 pl-8 pr-3 py-2 text-sm"
          />
        </div>
      )}

      {aberto && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {resultados.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-400">
              Nenhum equipamento cadastrado pra esse cliente ainda.
            </p>
          ) : (
            resultados.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => selecionar(a)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 text-gray-700"
              >
                <span className="text-xs font-mono text-gray-400">REF-{a.codigo}</span> {a.local || a.modelo || '(sem local)'}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
