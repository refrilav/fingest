import { Link } from 'react-router-dom'
import { ClipboardList, FileText, Users, Wallet, Archive, Plus } from 'lucide-react'

const CARDS = [
  { to: '/ordens-servico', label: 'Ordens de Serviço', icon: ClipboardList, color: 'bg-primary-50 text-primary-600' },
  { to: '/orcamentos', label: 'Orçamentos', icon: FileText, color: 'bg-amber-50 text-amber-600' },
  { to: '/clientes', label: 'Clientes', icon: Users, color: 'bg-green-50 text-green-600' },
  { to: '/financeiro', label: 'Financeiro', icon: Wallet, color: 'bg-blue-50 text-blue-600' },
  { to: '/cadastros', label: 'Cadastros', icon: Archive, color: 'bg-gray-100 text-gray-600' },
]

export default function Home() {
  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-1">FinGest</h2>
      <p className="text-gray-500 text-sm mb-6">O que você precisa fazer agora?</p>

      <div className="flex flex-wrap gap-2 mb-8">
        <Link
          to="/ordens-servico"
          className="flex items-center gap-1 rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700"
        >
          <Plus size={16} /> Nova OS
        </Link>
        <Link
          to="/orcamentos"
          className="flex items-center gap-1 rounded-lg bg-gray-100 text-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-200"
        >
          <Plus size={16} /> Novo orçamento
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {CARDS.map(({ to, label, icon: Icon, color }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-col items-center justify-center gap-3 bg-white border border-gray-200 rounded-xl p-6 text-center hover:border-primary-300 hover:shadow-sm transition-all"
          >
            <div className={`p-3 rounded-xl ${color}`}>
              <Icon size={28} />
            </div>
            <span className="text-sm font-medium text-gray-800">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
