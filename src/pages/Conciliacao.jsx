import { Landmark } from 'lucide-react'

export default function Conciliacao() {
  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Conciliação Bancária</h2>
      <p className="text-gray-500 text-sm mb-6">
        Próxima fase: importação de extrato OFX, deduplicação por <code className="bg-gray-100 px-1 rounded">fitid</code> e
        vínculo automático/manual com os lançamentos de contas a pagar/receber.
      </p>
      <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 flex flex-col items-center text-center text-gray-400">
        <Landmark size={32} className="mb-3" />
        <p className="text-sm">
          A tabela <code className="bg-gray-100 px-1 rounded">transacoes_bancarias</code> já existe no banco.
          Me avise quando quiser construir esta tela.
        </p>
      </div>
    </div>
  )
}
