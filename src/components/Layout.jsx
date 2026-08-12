import { Link, Outlet } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'

export default function Layout() {
  const { signOut } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 bg-white border-b border-gray-200 sticky top-0 z-20">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-lg font-bold text-gray-900">FinGest</span>
          <span className="text-xs text-gray-500 hidden sm:inline">· Refrilav · Gestão Financeira</span>
        </Link>
        <button
          onClick={signOut}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <LogOut size={16} />
          Sair
        </button>
      </header>

      <main className="p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  )
}
