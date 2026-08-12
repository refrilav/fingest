import { Link } from 'react-router-dom'
import { ArrowLeft, Package, Archive } from 'lucide-react'

const CARDS = [
  { to: '/vendas/pecas', label: 'Vendas de Peças', icon: Package, color: 'bg-teal-50 text-teal-600' },
  { to: '/estoque', label: 'Estoque', icon: Archive, color: 'bg-green-50 text-green-600' },
]

export default function VendasHub() {
  return (
    <div className="max-w-3xl">
      <Link to="/" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Voltar ao início
      </Link>
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Vendas</h2>
      <p className="text-gray-500 text-sm mb-6">Escolha o que você quer acessar.</p>

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
