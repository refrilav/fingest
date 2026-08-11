import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatDateBR, formatCurrencyBRL } from '../lib/format'
import { Printer, ArrowLeft } from 'lucide-react'

export default function ImprimirOS() {
  const { id } = useParams()
  const [os, setOs] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)

  // Opções do que aparece na impressão (ajustável na hora, além da preferência salva na OS)
  const [mostrarProblema, setMostrarProblema] = useState(true)
  const [mostrarServicos, setMostrarServicos] = useState(true)
  const [mostrarPecas, setMostrarPecas] = useState(true)
  const [mostrarGarantia, setMostrarGarantia] = useState(true)

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      const { data, error } = await supabase
        .from('ordens_servico')
        .select(
          '*, clientes(nome, telefone, endereco, documento), equipamentos(nome), categorias(nome), ordens_servico_pecas(id, nome_peca, quantidade, valor_unitario)'
        )
        .eq('id', id)
        .single()
      if (error) {
        setErro(error.message)
        setLoading(false)
        return
      }
      setOs(data)
      setMostrarProblema(data.mostrar_problema_na_impressao ?? true)
      setLoading(false)
      document.title = `OS ${String(data.numero).padStart(5, '0')} - ${data.clientes?.nome || 'Refrilav'}`
    }
    carregar()
  }, [id])

  if (loading) return <p className="text-gray-400 text-sm p-6">Carregando...</p>
  if (erro) return <div className="p-6 text-red-600 text-sm">{erro}</div>
  if (!os) return null

  const totalPecas = (os.ordens_servico_pecas || []).reduce(
    (acc, i) => acc + Number(i.quantidade) * Number(i.valor_unitario),
    0
  )
  // Quando a OS foi concluída no modo "Valor fechado", valor_mao_de_obra fica null —
  // nesse caso não faz sentido mostrar Peças/Mão de obra discriminados, só o Total.
  const modoFechado = os.valor_mao_de_obra === null && os.status === 'finalizada'
  const totalGeral = modoFechado ? Number(os.valor_final || 0) : totalPecas + Number(os.valor_mao_de_obra || 0)

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 print:p-0 print:max-w-full">
      <div className="no-print mb-6">
        <Link to="/ordens-servico" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> Voltar
        </Link>

        <div className="bg-white border border-gray-200 rounded-lg p-3 mb-3">
          <p className="text-xs font-medium text-gray-500 mb-2">O que aparece na impressão:</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={mostrarProblema} onChange={(e) => setMostrarProblema(e.target.checked)} />
              Problema relatado
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={mostrarServicos} onChange={(e) => setMostrarServicos(e.target.checked)} />
              Serviços realizados
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={mostrarPecas} onChange={(e) => setMostrarPecas(e.target.checked)} />
              Peças utilizadas
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={mostrarGarantia} onChange={(e) => setMostrarGarantia(e.target.checked)} />
              Garantia
            </label>
          </div>
        </div>

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
            <p className="text-xl font-bold text-gray-900">Ordem de Serviço</p>
            <p className="text-sm text-gray-500">Nº {String(os.numero).padStart(5, '0')}</p>
            <p className="text-xs text-gray-400">Abertura: {formatDateBR(os.data_abertura)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Cliente</p>
            <p className="font-medium text-gray-800">{os.clientes?.nome || '—'}</p>
            {os.clientes?.telefone && <p className="text-gray-600">{os.clientes.telefone}</p>}
            {os.clientes?.documento && <p className="text-gray-600">{os.clientes.documento}</p>}
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Endereço do atendimento</p>
            <p className="text-gray-700">{os.endereco || os.clientes?.endereco || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Equipamento</p>
            <p className="text-gray-700">{os.equipamentos?.nome || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Status</p>
            <p className="text-gray-700">
              {{ nao_iniciada: 'Não iniciada', em_andamento: 'Em andamento', finalizada: 'Finalizada', cancelada: 'Cancelada' }[os.status]}
            </p>
          </div>
        </div>

        {mostrarProblema && (
          <div className="mb-6">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Problema relatado</p>
            <p className="text-sm text-gray-700 border border-gray-200 rounded-lg p-3 min-h-[3rem] whitespace-pre-wrap">
              {os.descricao_problema}
            </p>
          </div>
        )}

        {mostrarServicos && (
          <div className="mb-6">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Serviços realizados</p>
            <p className="text-sm text-gray-700 border border-gray-200 rounded-lg p-3 min-h-[3rem] whitespace-pre-wrap">
              {os.servicos_realizados || '—'}
            </p>
          </div>
        )}

        {mostrarPecas && (os.ordens_servico_pecas || []).length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Peças utilizadas</p>
            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-gray-50 text-left text-xs text-gray-500">
                  <th className="px-3 py-1.5">Peça</th>
                  <th className="px-3 py-1.5 text-right">Qtd.</th>
                  <th className="px-3 py-1.5 text-right">Valor unit.</th>
                  <th className="px-3 py-1.5 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {os.ordens_servico_pecas.map((item) => (
                  <tr key={item.id} className="border-t border-gray-100">
                    <td className="px-3 py-1.5 text-gray-700">{item.nome_peca}</td>
                    <td className="px-3 py-1.5 text-right text-gray-600">{item.quantidade}</td>
                    <td className="px-3 py-1.5 text-right text-gray-600">{formatCurrencyBRL(item.valor_unitario)}</td>
                    <td className="px-3 py-1.5 text-right text-gray-700">
                      {formatCurrencyBRL(Number(item.quantidade) * Number(item.valor_unitario))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end mb-6">
          <div className="w-64 text-sm space-y-1">
            {!modoFechado && (
              <>
                <div className="flex justify-between text-gray-600">
                  <span>Peças</span>
                  <span>{formatCurrencyBRL(totalPecas)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Mão de obra</span>
                  <span>{formatCurrencyBRL(os.valor_mao_de_obra || 0)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between font-bold text-gray-900 border-t border-gray-300 pt-1">
              <span>Total</span>
              <span>{formatCurrencyBRL(totalGeral)}</span>
            </div>
          </div>
        </div>

        {mostrarGarantia && os.garantia_dias && (
          <p className="text-sm text-gray-700 mb-6">
            <strong>Garantia:</strong> {os.garantia_dias} dias a partir da conclusão do serviço
            {os.data_conclusao ? ` (${formatDateBR(os.data_conclusao)})` : ''}.
          </p>
        )}

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
