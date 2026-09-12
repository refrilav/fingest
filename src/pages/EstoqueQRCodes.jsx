import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BuscaPessoa from '../components/BuscaPessoa'
import { ArrowLeft, Plus, QrCode, Link2, Check, X } from 'lucide-react'

export default function EstoqueQRCodes() {
  const [estoque, setEstoque] = useState([])
  const [equipamentos, setEquipamentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)

  const [quantidade, setQuantidade] = useState('10')
  const [gerando, setGerando] = useState(false)

  const [vinculandoId, setVinculandoId] = useState(null)
  const [vinculoForm, setVinculoForm] = useState({ cliente_id: '', local: '', modelo: '', equipamento_id: '', intervalo_meses: '3' })
  const [salvandoVinculo, setSalvandoVinculo] = useState(false)

  async function carregar() {
    setLoading(true)
    const [estoqueRes, equipRes] = await Promise.all([
      supabase.from('ativos').select('*').is('cliente_id', null).eq('ativo', true).order('codigo').range(0, 9999),
      supabase.from('equipamentos').select('*').eq('ativo', true).order('nome').range(0, 9999),
    ])
    if (estoqueRes.error) setErro(estoqueRes.error.message)
    else setEstoque(estoqueRes.data)
    setEquipamentos(equipRes.data || [])
    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  async function gerarLote(e) {
    e.preventDefault()
    const qtd = Math.max(1, Number(quantidade) || 1)
    setGerando(true)
    setErro(null)

    // pega o maior código já usado em estoque (sem cliente), pra numerar a partir dele
    const { data: maiorRes } = await supabase
      .from('ativos')
      .select('codigo')
      .is('cliente_id', null)
      .order('codigo', { ascending: false })
      .limit(1)
      .maybeSingle()
    const base = maiorRes?.codigo || 0

    const linhas = Array.from({ length: qtd }, (_, i) => ({ codigo: base + i + 1 }))
    const { error } = await supabase.from('ativos').insert(linhas)
    setGerando(false)
    if (error) {
      setErro(error.message)
      return
    }
    carregar()
  }

  function abrirVinculo(item) {
    setVinculandoId(item.id)
    setVinculoForm({ cliente_id: '', local: '', modelo: '', equipamento_id: '', intervalo_meses: '3' })
  }

  async function confirmarVinculo(item) {
    if (!vinculoForm.cliente_id) {
      setErro('Selecione o cliente pra vincular esse equipamento.')
      return
    }
    setSalvandoVinculo(true)
    setErro(null)
    const { error } = await supabase
      .from('ativos')
      .update({
        cliente_id: vinculoForm.cliente_id,
        local: vinculoForm.local || null,
        modelo: vinculoForm.modelo || null,
        equipamento_id: vinculoForm.equipamento_id || null,
        intervalo_meses: Number(vinculoForm.intervalo_meses) || 3,
      })
      .eq('id', item.id)
    setSalvandoVinculo(false)
    if (error) {
      setErro(
        error.message.includes('ativos_codigo_cliente_unique_ativo') || error.message.includes('duplicate')
          ? 'Esse cliente já tem um equipamento com essa referência. Isso é raro — me avise se acontecer.'
          : error.message
      )
      return
    }
    setVinculandoId(null)
    carregar()
  }

  return (
    <div className="max-w-3xl">
      <Link to="/cadastros" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Voltar
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1 gap-2">
        <h2 className="text-2xl font-bold text-gray-900">Estoque de QR Codes</h2>
        {estoque.length > 0 && (
          <Link
            to="/estoque-qrcodes/imprimir"
            className="flex items-center gap-1 rounded-lg bg-gray-100 text-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-200"
          >
            <QrCode size={16} /> Imprimir QR codes do estoque
          </Link>
        )}
      </div>
      <p className="text-gray-500 text-sm mb-4">
        Gere e imprima QR codes com antecedência, cole nos equipamentos em campo, e vincule a um cliente depois —
        o adesivo não muda, só os dados por trás dele.
      </p>

      {erro && <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-2">{erro}</div>}

      <form onSubmit={gerarLote} className="bg-white border border-gray-200 rounded-lg p-4 mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Quantos códigos gerar</label>
          <input
            type="number"
            min="1"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={gerando}
          className="flex items-center gap-1 rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
        >
          <Plus size={16} /> {gerando ? 'Gerando...' : 'Gerar códigos novos'}
        </button>
      </form>

      {loading ? (
        <p className="text-gray-400 text-sm">Carregando...</p>
      ) : estoque.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 flex flex-col items-center text-center text-gray-400">
          <QrCode size={28} className="mb-3" />
          <p className="text-sm">Nenhum código em estoque ainda. Gere um lote acima.</p>
        </div>
      ) : (
        <ul className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {estoque.map((item) => (
            <li key={item.id} className="px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-mono text-gray-700">REF-{item.codigo}</span>
                {vinculandoId !== item.id && (
                  <button
                    onClick={() => abrirVinculo(item)}
                    className="flex items-center gap-1 text-xs bg-primary-50 text-primary-700 px-3 py-1.5 rounded-full hover:bg-primary-100"
                  >
                    <Link2 size={12} /> Vincular a um cliente
                  </button>
                )}
              </div>

              {vinculandoId === item.id && (
                <div className="mt-3 bg-gray-50 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <BuscaPessoa
                    tabela="clientes"
                    value={vinculoForm.cliente_id}
                    onChange={(id) => setVinculoForm({ ...vinculoForm, cliente_id: id })}
                    placeholder="Buscar cliente..."
                  />
                  <input
                    placeholder="Local (ex: Sala 204)"
                    value={vinculoForm.local}
                    onChange={(e) => setVinculoForm({ ...vinculoForm, local: e.target.value })}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <select
                    value={vinculoForm.equipamento_id}
                    onChange={(e) => setVinculoForm({ ...vinculoForm, equipamento_id: e.target.value })}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">Tipo de equipamento...</option>
                    {equipamentos.map((eq) => (
                      <option key={eq.id} value={eq.id}>{eq.nome}</option>
                    ))}
                  </select>
                  <input
                    placeholder="Modelo (opcional)"
                    value={vinculoForm.modelo}
                    onChange={(e) => setVinculoForm({ ...vinculoForm, modelo: e.target.value })}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Intervalo (meses)"
                    value={vinculoForm.intervalo_meses}
                    onChange={(e) => setVinculoForm({ ...vinculoForm, intervalo_meses: e.target.value })}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <div className="col-span-1 sm:col-span-2 flex justify-end gap-2">
                    <button onClick={() => setVinculandoId(null)} className="px-3 py-1.5 text-sm text-gray-500">
                      <X size={14} className="inline mr-1" /> Cancelar
                    </button>
                    <button
                      onClick={() => confirmarVinculo(item)}
                      disabled={salvandoVinculo}
                      className="flex items-center gap-1 rounded-lg bg-primary-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
                    >
                      <Check size={14} /> {salvandoVinculo ? 'Salvando...' : 'Confirmar vínculo'}
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
