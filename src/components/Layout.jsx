import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  ArrowDownCircle,
  ArrowUpCircle,
  Landmark,
  FileBarChart,
  Tags,
  Users,
  Truck,
  Wallet,
  LogOut,
} from 'lucide-react'
import { useAuth } from '../lib/AuthContext'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/contas-a-pagar', label: 'Contas a Pagar', icon: ArrowUpCircle },
  { to: '/contas-a-receber', label: 'Contas a Receber', icon: ArrowDownCircle },
  { to: '/conciliacao', label: 'Conciliação Bancária', icon: Landmark },
  { to: '/relatorios', label: 'Relatórios / DRE', icon: FileBarChart },
  { to: '/categorias', label: 'Categorias', icon: Tags },
  { to: '/fornecedores', label: 'Fornecedores', icon: Truck },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/contas-bancarias', label: 'Contas Bancárias', icon: Wallet },
]

export default function Layout() {
  const { signOut } = useAuth()

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-64 shrink-0 border-r border-gray-200 bg-white flex flex-col">
        <div className="px-5 py-5 border-b border-gray-200">
          <h1 className="text-lg font-bold text-gray-900">FinGest</h1>
          <p className="text-xs text-gray-500">Refrilav · Gestão Financeira</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-gray-200">
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 w-full"
          >
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
