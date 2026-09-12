import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Plus, X, Trash2, QrCode, Pencil, Check } from 'lucide-react'

const ITEM_VAZIO = { codigo: '', local: '', modelo: '', numero_serie: '', equipamento_id: '', intervalo_meses: '3' }

export default function AtivosCliente() {
  const { clienteId } = useParams()
  const [cliente, setCliente] = useState(null)
  const [ativos, setAtivos] = useState([])
  const [equipamentos, setEquipamentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [novos, setNovos] = useState([{ ...ITEM_VAZIO }])
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [editForm, setEditForm] = useState(ITEM_VAZIO)
  const [editandoTodos, setEditandoTodos] = useState(false)
  const [edicoesEmMassa, setEdicoesEmMassa] = useState([])
  const [salvandoEmMassa, setSalvandoEmMassa] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [maiorCodigoDoCliente, setMaiorCodigoDoCliente] = useState(0)

  async function carregar() {
    setLoading(true)
    const [clienteRes, ativosRes, equipRes, codigoRes] = await Promise.all([
      supabase.from('clientes').select('nome').eq('id', clienteId).single(),
      supabase
        .from('ativos')
        .select('*, equipamentos(nome)')
        .eq('cliente_id', clienteId)
        .eq('ativo', true)
        .order('codigo')
        .range(0, 9999),
      supabase.from('equipamentos').select('*').eq('ativo', true).order('nome').range(0, 9999),
      // maior código já usado por ESSE cliente (ativo ou não, pra sempre sugerir um número livre)
      supabase.from('ativos').select('codigo').eq('cliente_id', clienteId).order('codigo', { ascending: false }).limit(1).maybeSingle(),
    ])
    setCliente(clienteRes.data)
    setAtivos(ativosRes.data || [])
    setEquipamentos(equipRes.data || [])
    setMaiorCodigoDoCliente(codigoRes.data?.codigo || 0)
    setLoading(false)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId])

  // Sugere o próximo número livre PARA ESSE CLIENTE, considerando também os que já estão sendo digitados agora
  function proximoCodigoSugerido(listaAtual) {
    const codigosEmUso = listaAtual.map((n) => Number(n.codigo) || 0)
    const maior = Math.max(maiorCodigoDoCliente, ...codigosEmUso)
    return String(maior + 1)
  }

  function abrirFormulario() {
    setNovos([{ ...ITEM_VAZIO, codigo: proximoCodigoSugerido([]) }])
    setMostrarForm(true)
  }

  function atualizarNovo(i, campo, valor) {
    const copia = [...novos]
    copia[i] = { ...copia[i], [campo]: valor }
    setNovos(copia)
  }

  function adicionarLinha() {
    setNovos([...novos, { ...ITEM_VAZIO, codigo: proximoCodigoSugerido(novos) }])
  }

  function removerLinha(i) {
    setNovos(novos.filter((_, idx) => idx !== i))
  }

  async function salvarNovos(e) {
    e.preventDefault()
    const validos = novos.filter((n) => n.local.trim() || n.modelo.trim())
    if (validos.length === 0) {
      setErro('Preencha pelo menos o local ou o modelo de um equipamento.')
      return
    }
    setSalvando(true)
    setErro(null)
    const linhas = validos.map((n) => ({
      cliente_id: clienteId,
      codigo: n.codigo ? Number(n.codigo) : undefined,
      local: n.local || null,
      modelo: n.modelo || null,
      numero_serie: n.numero_serie || null,
      equipamento_id: n.equipamento_id || null,
      intervalo_meses: Number(n.intervalo_meses) || 3,
    }))
    const { error } = await supabase.from('ativos').insert(linhas)
    setSalvando(false)
    if (error) {
      setErro(
        error.message.includes('ativos_codigo_cliente_unique_ativo') || error.message.includes('duplicate')
          ? `Esse cliente já tem um equipamento com essa referência. Escolha outro número.`
          : error.message
      )
      return
    }
    setNovos([{ ...ITEM_VAZIO }])
    setMostrarForm(false)
    carregar()
  }

  function iniciarEdicao(a) {
    setEditandoId(a.id)
    setEditForm({
      codigo: String(a.codigo ?? ''),
      local: a.local || '',
      modelo: a.modelo || '',
      numero_serie: a.numero_serie || '',
      equipamento_id: a.equipamento_id || '',
      intervalo_meses: String(a.intervalo_meses ?? '3'),
    })
  }

  async function salvarEdicao(id) {
    const { error } = await supabase
      .from('ativos')
      .update({
        codigo: editForm.codigo ? Number(editForm.codigo) : null,
        local: editForm.local || null,
        modelo: editForm.modelo || null,
        numero_serie: editForm.numero_serie || null,
        equipamento_id: editForm.equipamento_id || null,
        intervalo_meses: Number(editForm.intervalo_meses) || 3,
      })
      .eq('id', id)
    if (error) {
      setErro(
        error.message.includes('ativos_codigo_cliente_unique_ativo') || error.message.includes('duplicate')
          ? `Esse cliente já tem um equipamento com essa referência. Escolha outro número.`
          : error.message
      )
      return
    }
    setEditandoId(null)
    carregar()
  }

  async function inativar(id) {
    if (!confirm('Remover este equipamento da lista? O histórico de OS antigas não é apagado.')) return
    await supabase.from('ativos').update({ ativo: false }).eq('id', id)
    carregar()
  }

  function abrirEdicaoEmMassa() {
    setEdicoesEmMassa(
      ativos.map((a) => ({
        id: a.id,
        codigo: String(a.codigo ?? ''),
        local: a.local || '',
        modelo: a.modelo || '',
        numero_serie: a.numero_serie || '',
        equipamento_id: a.equipamento_id || '',
        intervalo_meses: String(a.intervalo_meses ?? '3'),
      }))
    )
    setEditandoId(null)
    setEditandoTodos(true)
  }

  function cancelarEdicaoEmMassa() {
    setEditandoTodos(false)
    setEdicoesEmMassa([])
    setErro(null)
  }

  function atualizarEdicaoEmMassa(index, campo, valor) {
    const copia = [...edicoesEmMassa]
    copia[index] = { ...copia[index], [campo]: valor }
    setEdicoesEmMassa(copia)
  }

  async function salvarEdicaoEmMassa() {
    setSalvandoEmMassa(true)
    setErro(null)

    // Fase 1: move todo mundo pra um número temporário negativo — evita erro de
    // duplicidade quando você troca referências entre equipamentos (ex: 1 vira 2 e 2 vira 1)
    for (let i = 0; i < edicoesEmMassa.length; i++) {
      const { error } = await supabase.from('ativos').update({ codigo: -(i + 1) }).eq('id', edicoesEmMassa[i].id)
      if (error) {
        setErro(error.message)
        setSalvandoEmMassa(false)
        return
      }
    }

    // Fase 2: aplica os valores definitivos de cada linha
    for (const item of edicoesEmMassa) {
      const { error } = await supabase
        .from('ativos')
        .update({
          codigo: Number(item.codigo),
          local: item.local || null,
          modelo: item.modelo || null,
          numero_serie: item.numero_serie || null,
          equipamento_id: item.equipamento_id || null,
          intervalo_meses: Number(item.intervalo_meses) || 3,
        })
        .eq('id', item.id)
      if (error) {
        setErro(
          error.message.includes('ativos_codigo_cliente_unique_ativo') || error.message.includes('duplicate')
            ? 'Duas linhas ficaram com a mesma referência. Corrija e clique em salvar de novo.'
            : error.message
        )
        setSalvandoEmMassa(false)
        return
      }
    }

    setSalvandoEmMassa(false)
    setEditandoTodos(false)
    setEdicoesEmMassa([])
    carregar()
  }

  return (
    <div className="max-w-3xl">
      <Link to={`/clientes/${clienteId}`} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Voltar para {cliente?.nome || 'o cliente'}
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1 gap-2">
        <h2 className="text-2xl font-bold text-gray-900">Equipamentos com QR Code</h2>
        <div className="flex gap-2">
          {ativos.length > 0 && !editandoTodos && (
            <Link
              to={`/clientes/${clienteId}/ativos/qrcodes`}
              className="flex items-center gap-1 rounded-lg bg-gray-100 text-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-200"
            >
              <QrCode size={16} /> Imprimir QR codes
            </Link>
          )}
          {ativos.length > 0 && !editandoTodos && (
            <button
              onClick={abrirEdicaoEmMassa}
              className="flex items-center gap-1 rounded-lg bg-gray-100 text-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-200"
            >
              <Pencil size={16} /> Editar equipamentos
            </button>
          )}
          {!editandoTodos && (
            <button
              onClick={() => (mostrarForm ? setMostrarForm(false) : abrirFormulario())}
              className="flex items-center gap-1 rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700"
            >
              <Plus size={16} /> Adicionar
            </button>
          )}
        </div>
      </div>
      <p className="text-gray-500 text-sm mb-4">
        Cada linha aqui é um equipamento físico específico (ex: "Split Sala 204"). Vincule as OS's a eles pra montar o
        histórico de higienização por QR code. A referência (REF-X) já vem sugerida e é numerada por cliente — pode
        alterar se quiser.
      </p>

      {erro && <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-2">{erro}</div>}

      {mostrarForm && (
        <form onSubmit={salvarNovos} className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-gray-700 mb-2">Novos equipamentos (adicione vários de uma vez)</p>
          <div className="space-y-2 mb-2">
            {novos.map((n, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-gray-50 rounded-lg p-2">
                <div className="sm:col-span-2 flex items-center gap-1">
                  <span className="text-xs text-gray-400">REF-</span>
                  <input
                    type="number"
                    value={n.codigo}
                    onChange={(e) => atualizarNovo(i, 'codigo', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <input
                  placeholder="Local (ex: Sala 204)"
                  value={n.local}
                  onChange={(e) => atualizarNovo(i, 'local', e.target.value)}
                  className="sm:col-span-3 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                />
                <select
                  value={n.equipamento_id}
                  onChange={(e) => atualizarNovo(i, 'equipamento_id', e.target.value)}
                  className="sm:col-span-2 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                >
                  <option value="">Tipo...</option>
                  {equipamentos.map((eq) => (
                    <option key={eq.id} value={eq.id}>{eq.nome}</option>
                  ))}
                </select>
                <input
                  placeholder="Modelo (opcional)"
                  value={n.modelo}
                  onChange={(e) => atualizarNovo(i, 'modelo', e.target.value)}
                  className="sm:col-span-2 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                />
                <input
                  type="number"
                  placeholder="Intervalo (meses)"
                  value={n.intervalo_meses}
                  onChange={(e) => atualizarNovo(i, 'intervalo_meses', e.target.value)}
                  className="sm:col-span-2 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => removerLinha(i)}
                  disabled={novos.length === 1}
                  className="sm:col-span-1 text-gray-400 hover:text-red-600 justify-self-end disabled:opacity-30"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={adicionarLinha}
            className="flex items-center gap-1 text-sm text-primary-700 hover:bg-primary-50 rounded-lg px-3 py-1.5 mb-3"
          >
            <Plus size={14} /> Adicionar linha
          </button>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setMostrarForm(false)} className="px-4 py-2 text-sm text-gray-500">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : 'Salvar equipamentos'}
            </button>
          </div>
        </form>
      )}

      {editandoTodos ? (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Editando todos os equipamentos</p>
          <div className="space-y-2 mb-3">
            {edicoesEmMassa.map((item, i) => (
              <div key={item.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-gray-50 rounded-lg p-2">
                <div className="sm:col-span-2 flex items-center gap-1">
                  <span className="text-xs text-gray-400">REF-</span>
                  <input
                    type="number"
                    value={item.codigo}
                    onChange={(e) => atualizarEdicaoEmMassa(i, 'codigo', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <input
                  value={item.local}
                  onChange={(e) => atualizarEdicaoEmMassa(i, 'local', e.target.value)}
                  placeholder="Local"
                  className="sm:col-span-3 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                />
                <select
                  value={item.equipamento_id}
                  onChange={(e) => atualizarEdicaoEmMassa(i, 'equipamento_id', e.target.value)}
                  className="sm:col-span-2 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                >
                  <option value="">Tipo...</option>
                  {equipamentos.map((eq) => (
                    <option key={eq.id} value={eq.id}>{eq.nome}</option>
                  ))}
                </select>
                <input
                  value={item.modelo}
                  onChange={(e) => atualizarEdicaoEmMassa(i, 'modelo', e.target.value)}
                  placeholder="Modelo"
                  className="sm:col-span-3 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                />
                <input
                  type="number"
                  value={item.intervalo_meses}
                  onChange={(e) => atualizarEdicaoEmMassa(i, 'intervalo_meses', e.target.value)}
                  placeholder="Meses"
                  className="sm:col-span-2 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={cancelarEdicaoEmMassa} className="px-4 py-2 text-sm text-gray-500">
              Cancelar
            </button>
            <button
              onClick={salvarEdicaoEmMassa}
              disabled={salvandoEmMassa}
              className="flex items-center gap-1 rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              <Check size={16} /> {salvandoEmMassa ? 'Salvando...' : 'Salvar todos'}
            </button>
          </div>
        </div>
      ) : loading ? (
        <p className="text-gray-400 text-sm">Carregando...</p>
      ) : ativos.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 flex flex-col items-center text-center text-gray-400">
          <QrCode size={28} className="mb-3" />
          <p className="text-sm">Nenhum equipamento cadastrado ainda.</p>
        </div>
      ) : (
        <ul className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {ativos.map((a) => (
            <li key={a.id} className="px-4 py-3">
              {editandoId === a.id ? (
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <div className="sm:col-span-2 flex items-center gap-1">
                    <span className="text-xs text-gray-400">REF-</span>
                    <input
                      type="number"
                      value={editForm.codigo}
                      onChange={(e) => setEditForm({ ...editForm, codigo: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <input
                    value={editForm.local}
                    onChange={(e) => setEditForm({ ...editForm, local: e.target.value })}
                    className="sm:col-span-3 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  <select
                    value={editForm.equipamento_id}
                    onChange={(e) => setEditForm({ ...editForm, equipamento_id: e.target.value })}
                    className="sm:col-span-2 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    <option value="">Tipo...</option>
                    {equipamentos.map((eq) => (
                      <option key={eq.id} value={eq.id}>{eq.nome}</option>
                    ))}
                  </select>
                  <input
                    value={editForm.modelo}
                    onChange={(e) => setEditForm({ ...editForm, modelo: e.target.value })}
                    placeholder="Modelo"
                    className="sm:col-span-2 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  <input
                    type="number"
                    value={editForm.intervalo_meses}
                    onChange={(e) => setEditForm({ ...editForm, intervalo_meses: e.target.value })}
                    className="sm:col-span-2 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  <button onClick={() => salvarEdicao(a.id)} className="sm:col-span-1 text-green-600 justify-self-end">
                    <Check size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-800">
                      <span className="text-xs font-mono text-gray-400">REF-{a.codigo}</span> {a.local || '(sem local)'}
                      {a.equipamentos?.nome ? ` · ${a.equipamentos.nome}` : ''}
                    </p>
                    <p className="text-xs text-gray-500">
                      {a.modelo ? `${a.modelo} · ` : ''}Higienização a cada {a.intervalo_meses} meses
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => iniciarEdicao(a)} className="text-gray-400 hover:text-primary-600 p-1.5 rounded">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => inativar(a.id)} className="text-gray-400 hover:text-red-600 p-1.5 rounded">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
