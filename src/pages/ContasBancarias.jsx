import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { calcularSaldosContas } from '../lib/saldo'
import { Plus, Trash2, Wallet, ArrowLeftRight } from 'lucide-react'
import { formatCurrencyBRL } from '../lib/format'

const CAMPOS_VAZIOS = { nome: '', banco: '', agencia: '', numero_conta: '', saldo_inicial: '0' }

export default function ContasBancarias() {
  const [lista, setLista] = useState([])
  const [saldos, setSaldos] = useState({})
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [form, setForm] = useState(CAMPOS_VAZIOS)
  const [mostrarForm, setMostrarForm] = useState(false)

  async function carregar() {
    setLoading(true)
    const [{ data, error }, { saldos: novosSaldos }] = await Promise.all([
      supabase.from('contas_bancarias').select('*').eq('ativo', true).order('nome').range(0, 9999),
      calcularSaldosContas(),
    ])
    if (error) setErro(error.message)
    else setLista(data)
    setSaldos(novosSaldos)
    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  async function salvar(e) {
    e.preventDefault()
    if (!form.nome.trim()) return
    const { error } = await supabase.from('contas_bancarias').insert({
      nome: form.nome.trim(),
      banco: form.banco || null,
      agencia: form.agencia || null,
      numero_conta: form.numero_conta || null,
      saldo_inicial: Number(form.saldo_inicial) || 0,
    })
    if (error) {
      setErro(error.message)
      return
    }
    setForm(CAMPOS_VAZIOS)
    setMostrarForm(false)
    carregar()
  }

  async function inativar(id) {
    if (!confirm('Remover esta conta bancária da lista ativa?')) return
    const { error } = await supabase.from('contas_bancarias').update({ ativo: false }).eq('id', id)
    if (error) {
      setErro(error.message)
      return
    }
    carregar()
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-2xl font-bold text-gray-900">Contas Bancárias</h2>
        <div className="flex gap-2">
          <Link
            to="/transferencias"
            className="flex items-center gap-1 rounded-lg bg-gray-100 text-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-200"
          >
            <ArrowLeftRight size={16} /> Transferências
          </Link>
          <button
            onClick={() => setMostrarForm((v) => !v)}
            className="flex items-center gap-1 rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700"
          >
            <Plus size={16} /> Nova conta
          </button>
        </div>
      </div>
      <p className="text-gray-500 text-sm mb-6">
        Saldo atual = saldo inicial + lançamentos pagos nessa conta + transferências.
      </p>

      {erro && <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-2">{erro}</div>}

      {mostrarForm && (
        <form onSubmit={salvar} className="bg-white border border-gray-200 rounded-lg p-4 mb-6 grid grid-cols-2 gap-3">
          <input
            placeholder="Nome (ex: Sicredi CC) *"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            className="col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            required
          />
          <input
            placeholder="Banco"
            value={form.banco}
            onChange={(e) => setForm({ ...form, banco: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Agência"
            value={form.agencia}
            onChange={(e) => setForm({ ...form, agencia: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Número da conta"
            value={form.numero_conta}
            onChange={(e) => setForm({ ...form, numero_conta: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Saldo inicial"
            value={form.saldo_inicial}
            onChange={(e) => setForm({ ...form, saldo_inicial: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <div className="col-span-2 flex justify-end gap-2">
            <button type="button" onClick={() => setMostrarForm(false)} className="px-4 py-2 text-sm text-gray-500">
              Cancelar
            </button>
            <button type="submit" className="rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700">
              Salvar
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">Carregando...</p>
      ) : (
        <ul className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {lista.map((c) => (
            <li key={c.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <Wallet size={18} className="text-primary-600" />
                <div>
                  <p className="text-sm font-medium text-gray-800">{c.nome}</p>
                  <p className="text-xs text-gray-500">
                    {[c.banco, c.agencia, c.numero_conta].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="block text-sm font-semibold text-gray-800">
                    {formatCurrencyBRL(saldos[c.id] ?? c.saldo_inicial)}
                  </span>
                  <span className="block text-[11px] text-gray-400">saldo atual</span>
                </div>
                <button onClick={() => inativar(c.id)} className="text-gray-400 hover:text-red-600 p-1 rounded">
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
          {lista.length === 0 && <li className="px-4 py-3 text-sm text-gray-400">Nenhuma conta ainda.</li>}
        </ul>
      )}
    </div>
  )
}
