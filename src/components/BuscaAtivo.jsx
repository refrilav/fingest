import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Search, X, Check } from 'lucide-react'

// tabela de busca é sempre "ativos", filtrado por cliente_id (obrigatório)
// onSelecionar: (ativo) => void — chamado quando escolhe (ou cadastra) um equipamento
export default function BuscaAtivo({ clienteId, onSelecionar, placeholder }) {
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState([])
  const [aberto, setAberto] = useState(false)
  const [tiposEquipamento, setTiposEquipamento] = useState([])
  const [criandoNovo, setCriandoNovo] = useState(false)
  const [novoLocal, setNovoLocal] = useState('')
  const [novoEquipamentoId, setNovoEquipamentoId] = useState('')
  const [novoModelo, setNovoModelo] = useState('')
  const [novoIntervalo, setNovoIntervalo] = useState('3')
  const [novoBtu, setNovoBtu] = useState('')
  const [salvandoNovo, setSalvandoNovo] = useState(false)

  const [vinculandoEstoque, setVinculandoEstoque] = useState(false)
  const [refBusca, setRefBusca] = useState('')
  const [buscandoRef, setBuscandoRef] = useState(false)
  const [erroRef, setErroRef] = useState(null)
  const [ativoEstoqueEncontrado, setAtivoEstoqueEncontrado] = useState(null)
  const [vinculandoSalvando, setVinculandoSalvando] = useState(false)
  const timeoutRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    supabase
      .from('equipamentos')
      .select('*')
      .eq('ativo', true)
      .order('nome')
      .then(({ data }) => setTiposEquipamento(data || []))
  }, [])

  useEffect(() => {
    function handleClickFora(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setAberto(false)
        setCriandoNovo(false)
        setVinculandoEstoque(false)
      }
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
      let q = supabase
        .from('ativos')
        .select('id, local, modelo, codigo, capacidade_btu')
        .eq('cliente_id', clienteId)
        .eq('ativo', true)
        .order('codigo')
      if (query.trim()) q = q.ilike('local', `%${query.trim()}%`)
      const { data } = await q.limit(30)
      setResultados(data || [])
    }, 250)
  }, [query, clienteId, aberto])

  function selecionar(ativo) {
    onSelecionar(ativo)
    setQuery('')
    setAberto(false)
    setCriandoNovo(false)
  }

  function abrirCriacao() {
    setNovoLocal(query.trim())
    setNovoEquipamentoId('')
    setNovoModelo('')
    setNovoIntervalo('3')
    setNovoBtu('')
    setCriandoNovo(true)
    setVinculandoEstoque(false)
  }

  async function salvarNovoAtivo() {
    if (!novoLocal.trim()) return
    setSalvandoNovo(true)

    // próximo número de referência livre pra esse cliente
    const { data: maxRes } = await supabase
      .from('ativos')
      .select('codigo')
      .eq('cliente_id', clienteId)
      .order('codigo', { ascending: false })
      .limit(1)
      .maybeSingle()
    const proximoCodigo = (maxRes?.codigo || 0) + 1

    const { data, error } = await supabase
      .from('ativos')
      .insert({
        cliente_id: clienteId,
        codigo: proximoCodigo,
        local: novoLocal.trim(),
        equipamento_id: novoEquipamentoId || null,
        modelo: novoModelo || null,
        intervalo_meses: Number(novoIntervalo) || 3,
        capacidade_btu: novoBtu || null,
      })
      .select()
      .single()

    setSalvandoNovo(false)
    if (error) {
      alert(`Não consegui cadastrar o equipamento: ${error.message}`)
      return
    }
    selecionar(data)
  }

  function abrirVincularEstoque() {
    setRefBusca('')
    setErroRef(null)
    setAtivoEstoqueEncontrado(null)
    setVinculandoEstoque(true)
    setCriandoNovo(false)
  }

  async function buscarRefEstoque() {
    const numero = Number(refBusca)
    if (!numero) {
      setErroRef('Digite o número da referência (ex: 12).')
      return
    }
    setBuscandoRef(true)
    setErroRef(null)
    setAtivoEstoqueEncontrado(null)

    // A referência é única POR CLIENTE, não pro sistema todo — então primeiro tenta achar
    // um QR code com esse número que já foi usado e desativado, mas ainda desse mesmo cliente
    const { data: doCliente, error: erroCliente } = await supabase
      .from('ativos')
      .select('id, codigo, cliente_id, ativo')
      .eq('codigo', numero)
      .eq('cliente_id', clienteId)
      .limit(1)
      .maybeSingle()

    if (erroCliente) {
      setBuscandoRef(false)
      setErroRef(erroCliente.message)
      return
    }

    if (doCliente) {
      setBuscandoRef(false)
      if (doCliente.ativo) {
        setErroRef(`REF-${numero} já está ativo pra esse cliente — busque ele na lista normal, mais acima.`)
        return
      }
      setAtivoEstoqueEncontrado(doCliente)
      setNovoLocal('')
      setNovoEquipamentoId('')
      setNovoModelo('')
      setNovoIntervalo('3')
      setNovoBtu('')
      return
    }

    // senão, procura um QR code do estoque puro (impresso com antecedência, sem cliente ainda)
    const { data: doEstoque, error: erroEstoque } = await supabase
      .from('ativos')
      .select('id, codigo, cliente_id, ativo')
      .eq('codigo', numero)
      .is('cliente_id', null)
      .limit(1)
      .maybeSingle()

    setBuscandoRef(false)
    if (erroEstoque) {
      setErroRef(erroEstoque.message)
      return
    }
    if (!doEstoque) {
      setErroRef(
        `Não encontrei REF-${numero} no estoque nem desativado pra esse cliente. Se ela pertence a outro cliente e ainda está ativa, desvincule ela lá primeiro.`
      )
      return
    }
    setAtivoEstoqueEncontrado(doEstoque)
    setNovoLocal('')
    setNovoEquipamentoId('')
    setNovoModelo('')
    setNovoIntervalo('3')
    setNovoBtu('')
  }

  async function confirmarVinculoEstoque() {
    if (!novoLocal.trim()) {
      setErroRef('Preencha o local do equipamento.')
      return
    }
    setVinculandoSalvando(true)
    const { data, error } = await supabase
      .from('ativos')
      .update({
        cliente_id: clienteId,
        ativo: true, // reativa, caso fosse um QR code desativado sendo reaproveitado
        local: novoLocal.trim(),
        equipamento_id: novoEquipamentoId || null,
        modelo: novoModelo || null,
        intervalo_meses: Number(novoIntervalo) || 3,
        capacidade_btu: novoBtu || null,
      })
      .eq('id', ativoEstoqueEncontrado.id)
      .select()
      .single()
    setVinculandoSalvando(false)
    if (error) {
      setErroRef(error.message)
      return
    }
    setVinculandoEstoque(false)
    selecionar(data)
  }

  if (!clienteId) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-400">
        Selecione o cliente primeiro pra poder adicionar equipamentos específicos.
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setCriandoNovo(false)
        }}
        onFocus={() => setAberto(true)}
        placeholder={placeholder || 'Buscar equipamento com QR code, ou cadastrar um novo...'}
        className="w-full rounded-lg border border-gray-300 pl-8 pr-3 py-2 text-sm"
      />

      {aberto && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
          {!criandoNovo && !vinculandoEstoque ? (
            <>
              {resultados.length === 0 ? (
                <p className="px-3 py-2 text-sm text-gray-400">
                  {query.trim() ? 'Nenhum equipamento encontrado.' : 'Nenhum equipamento cadastrado pra esse cliente ainda.'}
                </p>
              ) : (
                resultados.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => selecionar(a)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 text-gray-700 border-b border-gray-50 last:border-0"
                  >
                    <span className="text-xs font-mono text-gray-400">REF-{a.codigo}</span> {a.local || a.modelo || '(sem local)'}
                  </button>
                ))
              )}
              <button
                type="button"
                onClick={abrirCriacao}
                className="w-full text-left px-3 py-2 text-sm text-primary-700 hover:bg-primary-50 border-t border-gray-100"
              >
                + Cadastrar novo equipamento (gera QR code)
              </button>
              <button
                type="button"
                onClick={abrirVincularEstoque}
                className="w-full text-left px-3 py-2 text-sm text-primary-700 hover:bg-primary-50 border-t border-gray-100"
              >
                Já tem um QR code impresso? Vincular pela referência
              </button>
            </>
          ) : criandoNovo ? (
            <div className="p-2 border-t border-gray-100 bg-gray-50">
              <p className="text-xs text-gray-500 mb-1.5">Novo equipamento pra esse cliente</p>
              <div className="flex flex-col gap-1.5">
                <input
                  type="text"
                  value={novoLocal}
                  onChange={(e) => setNovoLocal(e.target.value)}
                  placeholder="Local (ex: Sala 204) *"
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                  autoFocus
                />
                <select
                  value={novoEquipamentoId}
                  onChange={(e) => setNovoEquipamentoId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                >
                  <option value="">Tipo de equipamento...</option>
                  {tiposEquipamento.map((eq) => (
                    <option key={eq.id} value={eq.id}>{eq.nome}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={novoModelo}
                  onChange={(e) => setNovoModelo(e.target.value)}
                  placeholder="Modelo (opcional)"
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                />
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    value={novoIntervalo}
                    onChange={(e) => setNovoIntervalo(e.target.value)}
                    placeholder="Higienizar a cada (meses)"
                    className="w-1/2 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  <input
                    type="text"
                    value={novoBtu}
                    onChange={(e) => setNovoBtu(e.target.value)}
                    placeholder="BTU (opcional)"
                    className="w-1/2 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </div>
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
                    onClick={salvarNovoAtivo}
                    disabled={salvandoNovo || !novoLocal.trim()}
                    className="flex items-center gap-1 rounded-lg bg-primary-600 text-white px-2.5 py-1.5 text-xs font-medium hover:bg-primary-700 disabled:opacity-60"
                  >
                    <Check size={13} /> Salvar e adicionar
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-2 border-t border-gray-100 bg-gray-50">
              {erroRef && <p className="text-xs text-red-600 mb-1.5">{erroRef}</p>}
              {!ativoEstoqueEncontrado ? (
                <>
                  <p className="text-xs text-gray-500 mb-1.5">Número da referência impressa no adesivo</p>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={refBusca}
                      onChange={(e) => setRefBusca(e.target.value)}
                      placeholder="Ex: 12"
                      className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={buscarRefEstoque}
                      disabled={buscandoRef}
                      className="rounded-lg bg-primary-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-primary-700 disabled:opacity-60"
                    >
                      {buscandoRef ? 'Buscando...' : 'Buscar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setVinculandoEstoque(false)}
                      className="text-gray-400 hover:text-gray-600 p-1.5"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-green-700 mb-1.5">
                    Encontrado: REF-{ativoEstoqueEncontrado.codigo}. Preencha os dados desse equipamento:
                  </p>
                  <div className="flex flex-col gap-1.5">
                    <input
                      type="text"
                      value={novoLocal}
                      onChange={(e) => setNovoLocal(e.target.value)}
                      placeholder="Local (ex: Sala 204) *"
                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                      autoFocus
                    />
                    <select
                      value={novoEquipamentoId}
                      onChange={(e) => setNovoEquipamentoId(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">Tipo de equipamento...</option>
                      {tiposEquipamento.map((eq) => (
                        <option key={eq.id} value={eq.id}>{eq.nome}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={novoModelo}
                      onChange={(e) => setNovoModelo(e.target.value)}
                      placeholder="Modelo (opcional)"
                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                    />
                    <div className="flex gap-1.5">
                      <input
                        type="number"
                        value={novoIntervalo}
                        onChange={(e) => setNovoIntervalo(e.target.value)}
                        placeholder="Higienizar a cada (meses)"
                        className="w-1/2 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                      />
                      <input
                        type="text"
                        value={novoBtu}
                        onChange={(e) => setNovoBtu(e.target.value)}
                        placeholder="BTU (opcional)"
                        className="w-1/2 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 justify-end">
                      <button
                        type="button"
                        onClick={() => setVinculandoEstoque(false)}
                        className="text-gray-400 hover:text-gray-600 p-1.5"
                      >
                        <X size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={confirmarVinculoEstoque}
                        disabled={vinculandoSalvando || !novoLocal.trim()}
                        className="flex items-center gap-1 rounded-lg bg-primary-600 text-white px-2.5 py-1.5 text-xs font-medium hover:bg-primary-700 disabled:opacity-60"
                      >
                        <Check size={13} /> Vincular e adicionar
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
