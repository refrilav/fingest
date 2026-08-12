import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatDateBR, formatCurrencyBRL } from '../lib/format'
import { Printer, ArrowLeft } from 'lucide-react'

const TIPO_LABEL = {
  higienizacao: 'Higienização de Ar-Condicionado',
  instalacao: 'Instalação de Ar-Condicionado',
  manutencao: 'Manutenção Corretiva',
}

export default function ImprimirOrcamento() {
  const { id } = useParams()
  const [proposta, setProposta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      const { data, error } = await supabase
        .from('propostas')
        .select('*, clientes(nome, telefone, endereco), proposta_itens(id, local, descricao, quantidade, valor_unitario, ordem)')
        .eq('id', id)
        .single()
      if (error) {
        setErro(error.message)
        setLoading(false)
        return
      }
      setProposta(data)
      setLoading(false)
      document.title = `Orcamento ${String(data.numero).padStart(5, '0')} - ${data.clientes?.nome || 'Refrilav'}`
    }
    carregar()
  }, [id])

  if (loading) return <p className="text-gray-400 text-sm p-6">Carregando...</p>
  if (erro) return <div className="p-6 text-red-600 text-sm">{erro}</div>
  if (!proposta) return null

  const itens = (proposta.proposta_itens || []).sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
  const totalGeral = itens.reduce((acc, i) => acc + Number(i.quantidade) * Number(i.valor_unitario), 0)

  // calcula a data de validade somando dias (não meses) — helper local simples
  function somarDias(dataISO, dias) {
    const [y, m, d] = dataISO.split('-').map(Number)
    const data = new Date(Date.UTC(y, m - 1, d + dias))
    return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, '0')}-${String(data.getUTCDate()).padStart(2, '0')}`
  }

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 print:p-0 print:max-w-full">
      <div className="no-print mb-6">
        <Link to="/orcamentos" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> Voltar
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
            <p className="text-xl font-bold text-gray-900">Orçamento</p>
            <p className="text-sm text-gray-500">{TIPO_LABEL[proposta.tipo]}</p>
            <p className="text-xs text-gray-400">Nº {String(proposta.numero).padStart(5, '0')} · {formatDateBR(proposta.data_emissao)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Cliente</p>
            <p className="font-medium text-gray-800">{proposta.clientes?.nome || '—'}</p>
            {proposta.clientes?.telefone && <p className="text-gray-600">{proposta.clientes.telefone}</p>}
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Local</p>
            <p className="text-gray-700">{proposta.clientes?.endereco || '—'}</p>
          </div>
        </div>

        {proposta.texto_explicativo && (
          <div className="mb-6">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Sobre o serviço</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{proposta.texto_explicativo}</p>
          </div>
        )}

        <div className="mb-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Itens do orçamento</p>
          <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-gray-50 text-left text-xs text-gray-500">
                <th className="px-3 py-1.5">Local</th>
                <th className="px-3 py-1.5">Detalhe</th>
                <th className="px-3 py-1.5 text-right">Qtd.</th>
                <th className="px-3 py-1.5 text-right">Valor unit.</th>
                <th className="px-3 py-1.5 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item) => (
                <tr key={item.id} className="border-t border-gray-100">
                  <td className="px-3 py-1.5 text-gray-700">{item.local}</td>
                  <td className="px-3 py-1.5 text-gray-500">{item.descricao || '—'}</td>
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

        <div className="flex justify-end mb-6">
          <div className="w-56 text-sm">
            <div className="flex justify-between font-bold text-gray-900 border-t border-gray-300 pt-1">
              <span>Total</span>
              <span>{formatCurrencyBRL(totalGeral)}</span>
            </div>
          </div>
        </div>

        {proposta.observacoes_complementares && (
          <div className="mb-6">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Observações complementares</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{proposta.observacoes_complementares}</p>
          </div>
        )}

        {proposta.validade_dias && (
          <p className="text-sm text-gray-700 mb-6">
            Orçamento válido até <strong>{formatDateBR(somarDias(proposta.data_emissao, proposta.validade_dias))}</strong>{' '}
            ({proposta.validade_dias} dias a partir da emissão).
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
