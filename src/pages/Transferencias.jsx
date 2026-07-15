import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { calcularSaldosContas } from '../lib/saldo'
import { formatDateBR, formatCurrencyBRL, todayISO } from '../lib/format'
import { ArrowLeftRight, Trash2 } from 'lucide-react'

const CAMPOS_VAZIOS = { conta_origem_id: '', conta_destino_id: '', valor: '', data: todayISO(), observacoes: '' }

export default function Transferencias() {
  const [contas, setContas] = useState([])
  const [saldos, setSaldos] = useState({})
  const [lista, setLista] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [form, setForm] = useState(CAMPOS_VAZIOS)

  async function carregar() {
    setLoading(true)
    const [{ contas: contasData, saldos: saldosData }, transf] = await Promise.all([
      calcularSaldosContas(),
      supabase
        .from('transferencias')
        .select('*, origem:contas_bancarias!transferencias_conta_origem_id_fkey(nome), destino:contas_bancarias!transferencias_conta_destino_id_fkey(nome)')
        .order('data', { ascending: false })
        .range(0, 9999),
    ])
    setContas(contasData)
    setSaldos(saldosData)
    if (transf.error) setErro(transf.error.message)
    else setLista(transf.data || [])
    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  async function salvar(e) {
    e.preventDefault()
    if (!form.conta_origem_id || !form.conta_destino_id || !form.valor) return
    if (form.conta_origem_id === form.conta_destino_id) {
      setErro('A conta de origem e destino não podem ser a mesma.')
      return
    }
    setErro(null)

    const { error } = await supabase.from('transferencias').insert({
      conta_origem_id: form.conta_origem_id,
      conta_destino_id: form.conta_destino_id,
      valor: Number(form.valor),
      data: form.data,
      observacoes: form.observacoes || null,
    })
    if (error) {
      setErro(error.message)
      return
    }
    setForm(CAMPOS_VAZIOS)
    carregar()
  }

  async function excluir(id) {
    if (!confirm('Excluir esta transferência? Os saldos das contas serão recalculados.')) return
    const { error } = await supabase.from('transferencias').delete().eq('id', id)
    if (error) {
      setErro(error.message)
      return
    }
    carregar()
  }

  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Transferências entre Contas</h2>
      <p className="text-gray-500 text-sm mb-6">
        Movimentação entre suas próprias contas/caixa. Não entra como receita nem despesa no DRE.
      </p>

      {erro && <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-2">{erro}</div>}

      <form onSubmit={salvar} className="bg-white border border-gray-200 rounded-lg p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <select
          value={form.conta_origem_id}
          onChange={(e) => setForm({ ...form, conta_origem_id: e.target.value })}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          required
        >
          <option value="">De (origem)...</option>
          {contas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome} ({formatCurrencyBRL(saldos[c.id] ?? c.saldo_inicial)})
            </option>
          ))}
        </select>
        <select
          value={form.conta_destino_id}
          onChange={(e) => setForm({ ...form, conta_destino_id: e.target.value })}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          required
        >
          <option value="">Para (destino)...</option>
          {contas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome} ({formatCurrencyBRL(saldos[c.id] ?? c.saldo_inicial)})
            </option>
          ))}
        </select>
        <input
          type="number"
          step="0.01"
          placeholder="Valor *"
          value={form.valor}
          onChange={(e) => setForm({ ...form, valor: e.target.value })}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          required
        />
        <input
          type="date"
          value={form.data}
          onChange={(e) => setForm({ ...form, data: e.target.value })}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          required
        />
        <input
          placeholder="Observações (opcional)"
          value={form.observacoes}
          onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
          className="col-span-1 sm:col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <div className="col-span-1 sm:col-span-2 flex justify-end">
          <button
            type="submit"
            className="flex items-center gap-1 rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700"
          >
            <ArrowLeftRight size={16} /> Transferir
          </button>
        </div>
      </form>

      {loading ? (
        <p className="text-gray-400 text-sm">Carregando...</p>
      ) : (
        <ul className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {lista.map((t) => (
            <li key={t.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {t.origem?.nome} <ArrowLeftRight size={12} className="inline mx-1 text-gray-400" /> {t.destino?.nome}
                </p>
                <p className="text-xs text-gray-500">
                  {formatDateBR(t.data)}
                  {t.observacoes ? ` · ${t.observacoes}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">{formatCurrencyBRL(t.valor)}</span>
                <button onClick={() => excluir(t.id)} className="text-gray-400 hover:text-red-600 p-1 rounded">
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
          {lista.length === 0 && <li className="px-4 py-3 text-sm text-gray-400">Nenhuma transferência ainda.</li>}
        </ul>
      )}
    </div>
  )
}
