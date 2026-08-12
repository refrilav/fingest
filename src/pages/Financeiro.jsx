import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowUpCircle,
  ArrowDownCircle,
  Landmark,
  ArrowLeftRight,
  SlidersHorizontal,
  Wallet,
  FileBarChart,
} from 'lucide-react'

const CARDS = [
  { to: '/contas-a-pagar', label: 'Contas a Pagar', icon: ArrowUpCircle, color: 'bg-red-50 text-red-600' },
  { to: '/contas-a-receber', label: 'Contas a Receber', icon: ArrowDownCircle, color: 'bg-green-50 text-green-600' },
  { to: '/conciliacao', label: 'Conciliação Bancária', icon: Landmark, color: 'bg-blue-50 text-blue-600' },
  { to: '/transferencias', label: 'Transferências', icon: ArrowLeftRight, color: 'bg-purple-50 text-purple-600' },
  { to: '/ajustes-saldo', label: 'Ajustes de Saldo', icon: SlidersHorizontal, color: 'bg-amber-50 text-amber-600' },
  { to: '/contas-bancarias', label: 'Contas Bancárias', icon: Wallet, color: 'bg-gray-100 text-gray-600' },
  { to: '/relatorios', label: 'Relatórios / DRE', icon: FileBarChart, color: 'bg-indigo-50 text-indigo-600' },
  { to: '/fluxo-caixa', label: 'Fluxo de Caixa', icon: Wallet, color: 'bg-teal-50 text-teal-600' },
]

export default function Financeiro() {
  return (
    <div className="max-w-3xl">
      <Link to="/" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Voltar ao início
      </Link>
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Financeiro</h2>
      <p className="text-gray-500 text-sm mb-6">Escolha a área que você quer acessar.</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {CARDS.map(({ to, label, icon: Icon, color }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-col items-center justify-center gap-3 bg-white border border-gray-200 rounded-xl p-6 text-center hover:border-primary-300 hover:shadow-sm transition-all"
          >
            <div className={`p-3 rounded-xl ${color}`}>
              <Icon size={26} />
            </div>
            <span className="text-sm font-medium text-gray-800">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
