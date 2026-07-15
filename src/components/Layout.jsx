import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
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
  ArrowLeftRight,
  Menu,
  X,
} from 'lucide-react'
import { useAuth } from '../lib/AuthContext'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/contas-a-pagar', label: 'Contas a Pagar', icon: ArrowUpCircle },
  { to: '/contas-a-receber', label: 'Contas a Receber', icon: ArrowDownCircle },
  { to: '/conciliacao', label: 'Conciliação Bancária', icon: Landmark },
  { to: '/transferencias', label: 'Transferências', icon: ArrowLeftRight },
  { to: '/relatorios', label: 'Relatórios / DRE', icon: FileBarChart },
  { to: '/categorias', label: 'Categorias', icon: Tags },
  { to: '/fornecedores', label: 'Fornecedores', icon: Truck },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/contas-bancarias', label: 'Contas Bancárias', icon: Wallet },
]

export default function Layout() {
  const { signOut } = useAuth()
  const [menuAberto, setMenuAberto] = useState(false)
  const location = useLocation()
  const paginaAtual = navItems.find((n) => (n.end ? location.pathname === n.to : location.pathname.startsWith(n.to)))

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Overlay escuro atrás do menu, só no mobile quando aberto */}
      {menuAberto && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          onClick={() => setMenuAberto(false)}
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 shrink-0 border-r border-gray-200 bg-white flex flex-col transition-transform duration-200 ${
          menuAberto ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="px-5 py-5 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">FinGest</h1>
            <p className="text-xs text-gray-500">Refrilav · Gestão Financeira</p>
          </div>
          <button onClick={() => setMenuAberto(false)} className="lg:hidden text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setMenuAberto(false)}
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

      <div className="flex-1 flex flex-col min-w-0">
        {/* Barra superior, só aparece no mobile */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-20">
          <button onClick={() => setMenuAberto(true)} className="text-gray-500 hover:text-gray-700">
            <Menu size={22} />
          </button>
          <span className="text-sm font-semibold text-gray-800">{paginaAtual?.label || 'FinGest'}</span>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
