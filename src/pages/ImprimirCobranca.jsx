import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatDateBR, formatCurrencyBRL } from '../lib/format'
import { Printer, ArrowLeft } from 'lucide-react'

export default function ImprimirCobranca() {
  const { id } = useParams() // id do lançamento (cobrança consolidada)
  const [lancamento, setLancamento] = useState(null)
  const [ordens, setOrdens] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      const [lancRes, osRes] = await Promise.all([
        supabase
          .from('lancamentos')
          .select('*, clientes(nome, telefone, documento, endereco)')
          .eq('id', id)
          .single(),
        supabase
          .from('ordens_servico')
          .select('id, numero, descricao_problema, servicos_realizados, cliente_final, data_conclusao, valor_final, equipamentos(nome)')
          .eq('lancamento_id', id)
          .order('numero', { ascending: true }),
      ])

      if (lancRes.error) {
        setErro(lancRes.error.message)
        setLoading(false)
        return
      }
      setLancamento(lancRes.data)
      setOrdens(osRes.data || [])
      setLoading(false)
      document.title = `Relatorio_OS_${lancRes.data.clientes?.nome || 'cobranca'}`
    }
    carregar()
  }, [id])

  if (loading) return <p className="text-gray-400 text-sm p-6">Carregando...</p>
  if (erro) return <div className="p-6 text-red-600 text-sm">{erro}</div>
  if (!lancamento) return null

  const totalOS = ordens.reduce((acc, o) => acc + Number(o.valor_final || 0), 0)

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 print:p-0 print:max-w-full">
      <div className="no-print mb-6">
        <Link to={`/clientes/${lancamento.cliente_id}`} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> Voltar para o cliente
        </Link>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 mb-3">
          Dica: na janela de impressão do navegador, procure "Mais configurações" e desmarque
          <strong> "Cabeçalhos e rodapés"</strong> — assim não sai data/hora/link no papel ou no PDF.
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1 rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700"
        >
          <Printer size={16} /> Imprimir / Salvar PDF
        </button>
      </div>

      <div className="bg-white border border-gray-200 print:border-0 rounded-lg p-8 print:p-0 print:rounded-none">
        <div className="flex items-center justify-between border-b-2 border-gray-800 pb-4 mb-6">
          <img src="/logo.png" alt="Refrilav" className="h-14" />
          <div className="text-right">
            <p className="text-xl font-bold text-gray-900">Relatório de Serviços</p>
            <p className="text-sm text-gray-500">Cobrança consolidada</p>
            <p className="text-xs text-gray-400">Emitido em {formatDateBR(lancamento.data_vencimento)}</p>
          </div>
        </div>

        <div className="mb-6 text-sm">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Cliente</p>
          <p className="font-medium text-gray-800">{lancamento.clientes?.nome || '—'}</p>
          {lancamento.clientes?.documento && <p className="text-gray-600">{lancamento.clientes.documento}</p>}
          {lancamento.clientes?.telefone && <p className="text-gray-600">{lancamento.clientes.telefone}</p>}
        </div>

        <div className="mb-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Ordens de serviço incluídas</p>
          <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-gray-50 text-left text-xs text-gray-500">
                <th className="px-3 py-1.5">OS</th>
                <th className="px-3 py-1.5">Cliente final</th>
                <th className="px-3 py-1.5">Serviço</th>
                <th className="px-3 py-1.5">Conclusão</th>
                <th className="px-3 py-1.5 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {ordens.map((os) => (
                <tr key={os.id} className="border-t border-gray-100 align-top">
                  <td className="px-3 py-1.5 text-gray-700 font-mono text-xs">#{os.numero}</td>
                  <td className="px-3 py-1.5 text-gray-700">{os.cliente_final || '—'}</td>
                  <td className="px-3 py-1.5 text-gray-600">
                    {os.servicos_realizados || os.descricao_problema || '—'}
                    {os.equipamentos?.nome ? ` (${os.equipamentos.nome})` : ''}
                  </td>
                  <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">
                    {os.data_conclusao ? formatDateBR(os.data_conclusao) : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right text-gray-700 whitespace-nowrap">
                    {formatCurrencyBRL(os.valor_final)}
                  </td>
                </tr>
              ))}
              {ordens.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-center text-gray-400">
                    Nenhuma OS vinculada a esta cobrança.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end mb-6">
          <div className="w-56 text-sm space-y-1">
            <div className="flex justify-between text-gray-600">
              <span>Total das OS ({ordens.length})</span>
              <span>{formatCurrencyBRL(totalOS)}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 border-t border-gray-300 pt-1">
              <span>Total da cobrança</span>
              <span>{formatCurrencyBRL(lancamento.valor)}</span>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-4 mt-8 text-center text-xs text-gray-500">
          <p className="font-medium text-gray-700">Refrilav Assistência Técnica</p>
          <p>(51) 99790-6220 · Av. Independência, 2335, Santa Cruz do Sul/RS · CNPJ 54.476.046/0001-00</p>
        </div>
      </div>

      <style>{`
        @page {
          margin: 12mm;
        }
        @media print {
          .no-print { display: none !important; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>
    </div>
  )
}
