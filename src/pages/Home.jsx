import { Link } from 'react-router-dom'
import { ClipboardList, FileText, Users, Wallet, Package, Archive, Plus } from 'lucide-react'

const CARDS = [
  {
    to: '/ordens-servico',
    label: 'Ordens de Serviço',
    desc: 'Atendimentos em andamento e finalizados',
    icon: ClipboardList,
    accent: 'text-primary-700 bg-primary-50 group-hover:bg-primary-100',
  },
  {
    to: '/orcamentos',
    label: 'Orçamentos',
    desc: 'Higienização, instalação e manutenção',
    icon: FileText,
    accent: 'text-amber-700 bg-amber-50 group-hover:bg-amber-100',
  },
  {
    to: '/clientes',
    label: 'Clientes',
    desc: 'Cadastro e histórico completo',
    icon: Users,
    accent: 'text-emerald-700 bg-emerald-50 group-hover:bg-emerald-100',
  },
  {
    to: '/financeiro',
    label: 'Financeiro',
    desc: 'Contas, conciliação, relatórios',
    icon: Wallet,
    accent: 'text-sky-700 bg-sky-50 group-hover:bg-sky-100',
  },
  {
    to: '/estoque',
    label: 'Estoque',
    desc: 'Peças e materiais disponíveis',
    icon: Package,
    accent: 'text-teal-700 bg-teal-50 group-hover:bg-teal-100',
  },
  {
    to: '/cadastros',
    label: 'Cadastros',
    desc: 'Fornecedores, categorias, equipamentos',
    icon: Archive,
    accent: 'text-slate-700 bg-slate-100 group-hover:bg-slate-200',
  },
]

function saudacao() {
  const hora = new Date().getHours()
  if (hora < 12) return 'Bom dia'
  if (hora < 18) return 'Boa tarde'
  return 'Boa noite'
}

export default function Home() {
  return (
    <div className="max-w-5xl mx-auto">
      <p className="text-sm text-gray-400 mb-1">{saudacao()}</p>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">O que você precisa fazer agora?</h2>

      <div className="flex flex-wrap gap-2 mb-10">
        <Link
          to="/ordens-servico"
          className="flex items-center gap-1.5 rounded-lg bg-primary-600 text-white px-4 py-2.5 text-sm font-medium shadow-sm hover:bg-primary-700 transition-colors"
        >
          <Plus size={16} /> Nova OS
        </Link>
        <Link
          to="/orcamentos"
          className="flex items-center gap-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 px-4 py-2.5 text-sm font-medium hover:border-gray-300 hover:bg-gray-50 transition-colors"
        >
          <Plus size={16} /> Novo orçamento
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {CARDS.map(({ to, label, desc, icon: Icon, accent }) => (
          <Link
            key={to}
            to={to}
            className="group flex flex-col gap-4 bg-white border border-gray-200 rounded-2xl p-6 hover:border-gray-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150"
          >
            <div className={`inline-flex w-fit p-3 rounded-xl transition-colors ${accent}`}>
              <Icon size={24} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
