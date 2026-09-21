import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ClipboardList, FileText, Users, Wallet, Package, Archive, Plus, Check, X, ListChecks, ArrowLeft, Calendar } from 'lucide-react'

function ListaTarefas() {
  const [tarefas, setTarefas] = useState([])
  const [novoTexto, setNovoTexto] = useState('')
  const [loading, setLoading] = useState(true)

  async function carregar() {
    const { data } = await supabase.from('tarefas').select('*').order('feita').order('created_at')
    setTarefas(data || [])
    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  async function adicionar(e) {
    e.preventDefault()
    if (!novoTexto.trim()) return
    const { error } = await supabase.from('tarefas').insert({ texto: novoTexto.trim() })
    if (!error) {
      setNovoTexto('')
      carregar()
    }
  }

  async function alternar(tarefa) {
    await supabase.from('tarefas').update({ feita: !tarefa.feita }).eq('id', tarefa.id)
    carregar()
  }

  async function excluir(id) {
    await supabase.from('tarefas').delete().eq('id', id)
    carregar()
  }

  if (loading) return null

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-8">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
        <ListChecks size={16} className="text-primary-600" /> Pendências pra conferir
      </h3>

      {tarefas.length > 0 && (
        <ul className="space-y-1 mb-3">
          {tarefas.map((t) => (
            <li key={t.id} className="flex items-center gap-2 group">
              <button
                onClick={() => alternar(t)}
                className={`shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                  t.feita ? 'bg-primary-600 border-primary-600' : 'border-gray-300 hover:border-primary-400'
                }`}
              >
                {t.feita && <Check size={13} className="text-white" />}
              </button>
              <span className={`flex-1 text-sm ${t.feita ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{t.texto}</span>
              <button
                onClick={() => excluir(t.id)}
                className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={adicionar} className="flex gap-2">
        <input
          value={novoTexto}
          onChange={(e) => setNovoTexto(e.target.value)}
          placeholder="Adicionar pendência..."
          className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
        />
        <button type="submit" className="rounded-lg bg-gray-100 text-gray-600 px-3 py-1.5 text-sm hover:bg-gray-200">
          <Plus size={16} />
        </button>
      </form>
    </div>
  )
}

const CARDS = [
  {
    to: '/ordens-servico',
    label: 'Ordens de Serviço',
    desc: 'Abrir e acompanhar atendimentos',
    icon: ClipboardList,
    accent: 'text-blue-700 bg-blue-50 group-hover:bg-blue-100',
  },
  {
    to: '/orcamentos',
    label: 'Orçamentos',
    desc: 'Higienização, instalação, manutenção',
    icon: FileText,
    accent: 'text-purple-700 bg-purple-50 group-hover:bg-purple-100',
  },
  {
    to: '/clientes',
    label: 'Clientes',
    desc: 'Cadastro e histórico',
    icon: Users,
    accent: 'text-amber-700 bg-amber-50 group-hover:bg-amber-100',
  },
  {
    to: '/financeiro',
    label: 'Financeiro',
    desc: 'Contas a pagar/receber, bancos',
    icon: Wallet,
    accent: 'text-green-700 bg-green-50 group-hover:bg-green-100',
  },
  {
    to: '/vendas',
    label: 'Vendas',
    desc: 'Venda de peças e estoque',
    icon: Package,
    accent: 'text-teal-700 bg-teal-50 group-hover:bg-teal-100',
  },
  {
    to: '/cadastros',
    label: 'Cadastros',
    desc: 'Fornecedores, categorias, QR codes',
    icon: Archive,
    accent: 'text-gray-700 bg-gray-100 group-hover:bg-gray-200',
  },
]

export default function Home() {
  return (
    <div className="max-w-3xl">
      <Link to="/" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Voltar pra agenda
      </Link>

      <h2 className="text-2xl font-bold text-gray-900 mb-6">O que você precisa fazer agora?</h2>

      <ListaTarefas />

      <div className="flex flex-wrap gap-2 mb-10">
        <Link
          to="/"
          className="flex items-center gap-1 text-sm font-medium text-primary-700 bg-primary-50 px-4 py-2 rounded-lg hover:bg-primary-100"
        >
          <Calendar size={15} /> Ver agenda
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {CARDS.map(({ to, label, desc, icon: Icon, accent }) => (
          <Link
            key={to}
            to={to}
            className="group flex flex-col gap-3 bg-white border border-gray-200 rounded-xl p-4 hover:border-primary-300 hover:shadow-sm transition-all"
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accent}`}>
              <Icon size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
