import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { calcularSaldosContas } from '../lib/saldo'
import { formatDateBR, formatCurrencyBRL, todayISO } from '../lib/format'
import { SlidersHorizontal, Trash2 } from 'lucide-react'

const MOTIVOS = ['Acerto de caixa', 'Saldo anterior/abertura', 'Diferença de contagem', 'Outro']

const CAMPOS_VAZIOS = {
  conta_bancaria_id: '',
  direcao: 'aumentar', // 'aumentar' | 'diminuir'
  valor: '',
  data: todayISO(),
  motivo: MOTIVOS[0],
  observacoes: '',
}

export default function AjustesSaldo() {
  const [contas, setContas] = useState([])
  const [saldos, setSaldos] = useState({})
  const [lista, setLista] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [form, setForm] = useState(CAMPOS_VAZIOS)

  async function carregar() {
    setLoading(true)
    const [{ contas: contasData, saldos: saldosData }, ajustes] = await Promise.all([
      calcularSaldosContas(),
      supabase
        .from('ajustes_saldo')
        .select('*, contas_bancarias(nome)')
        .order('data', { ascending: false })
        .range(0, 9999),
    ])
    setContas(contasData)
    setSaldos(saldosData)
    if (ajustes.error) setErro(ajustes.error.message)
    else setLista(ajustes.data || [])
    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  async function salvar(e) {
    e.preventDefault()
    if (!form.conta_bancaria_id || !form.valor) return

    const valorAbs = Math.abs(Number(form.valor))
    const valorComSinal = form.direcao === 'aumentar' ? valorAbs : -valorAbs

    const { error } = await supabase.from('ajustes_saldo').insert({
      conta_bancaria_id: form.conta_bancaria_id,
      valor: valorComSinal,
      data: form.data,
      motivo: form.motivo,
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
    if (!confirm('Excluir este ajuste? O saldo da conta será recalculado.')) return
    const { error } = await supabase.from('ajustes_saldo').delete().eq('id', id)
    if (error) {
      setErro(error.message)
      return
    }
    carregar()
  }

  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Ajustes de Saldo</h2>
      <p className="text-gray-500 text-sm mb-6">
        Corrige o saldo de uma conta (acerto de caixa, saldo de abertura, diferença de contagem) sem criar um
        lançamento de receita/despesa falso. Não entra no DRE.
      </p>

      {erro && <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-2">{erro}</div>}

      <form onSubmit={salvar} className="bg-white border border-gray-200 rounded-lg p-4 mb-6 grid grid-cols-2 gap-3">
        <select
          value={form.conta_bancaria_id}
          onChange={(e) => setForm({ ...form, conta_bancaria_id: e.target.value })}
          className="col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          required
        >
          <option value="">Conta/caixa...</option>
          {contas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome} (saldo atual: {formatCurrencyBRL(saldos[c.id] ?? c.saldo_inicial)})
            </option>
          ))}
        </select>

        <div className="col-span-2 flex gap-2 bg-gray-50 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setForm({ ...form, direcao: 'aumentar' })}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium ${
              form.direcao === 'aumentar' ? 'bg-white shadow-sm text-green-700' : 'text-gray-500'
            }`}
          >
            Aumentar saldo
          </button>
          <button
            type="button"
            onClick={() => setForm({ ...form, direcao: 'diminuir' })}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium ${
              form.direcao === 'diminuir' ? 'bg-white shadow-sm text-red-700' : 'text-gray-500'
            }`}
          >
            Diminuir saldo
          </button>
        </div>

        <input
          type="number"
          step="0.01"
          min="0"
          placeholder="Valor do ajuste *"
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
        <select
          value={form.motivo}
          onChange={(e) => setForm({ ...form, motivo: e.target.value })}
          className="col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          {MOTIVOS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <input
          placeholder="Observações (opcional)"
          value={form.observacoes}
          onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
          className="col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <div className="col-span-2 flex justify-end">
          <button
            type="submit"
            className="flex items-center gap-1 rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700"
          >
            <SlidersHorizontal size={16} /> Aplicar ajuste
          </button>
        </div>
      </form>

      {loading ? (
        <p className="text-gray-400 text-sm">Carregando...</p>
      ) : (
        <ul className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {lista.map((a) => (
            <li key={a.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {a.contas_bancarias?.nome} · {a.motivo}
                </p>
                <p className="text-xs text-gray-500">
                  {formatDateBR(a.data)}
                  {a.observacoes ? ` · ${a.observacoes}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-medium ${Number(a.valor) < 0 ? 'text-red-600' : 'text-green-700'}`}>
                  {Number(a.valor) > 0 ? '+' : ''}
                  {formatCurrencyBRL(a.valor)}
                </span>
                <button onClick={() => excluir(a.id)} className="text-gray-400 hover:text-red-600 p-1 rounded">
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
          {lista.length === 0 && <li className="px-4 py-3 text-sm text-gray-400">Nenhum ajuste ainda.</li>}
        </ul>
      )}
    </div>
  )
}
