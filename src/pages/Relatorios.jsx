import { FileBarChart } from 'lucide-react'

export default function Relatorios() {
  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Relatórios / DRE</h2>
      <p className="text-gray-500 text-sm mb-6">
        Próxima fase: DRE por período e centro de custo, orçado x realizado, e exportação para Excel
        (mesmo padrão da Relatórios do refrilav-v2).
      </p>
      <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 flex flex-col items-center text-center text-gray-400">
        <FileBarChart size={32} className="mb-3" />
        <p className="text-sm">Os dados de lançamentos e categorias já estão prontos para alimentar esta tela.</p>
      </div>
    </div>
  )
}
