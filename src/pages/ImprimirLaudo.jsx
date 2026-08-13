import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Printer, ArrowLeft } from 'lucide-react'

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

// "2026-07-03" -> "03 de julho de 2026"
function dataPorExtenso(dataISO) {
  if (!dataISO) return ''
  const [ano, mes, dia] = dataISO.split('-')
  return `${dia} de ${MESES[Number(mes) - 1]} de ${ano}`
}

export default function ImprimirLaudo() {
  const { id } = useParams()
  const [laudo, setLaudo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      const { data, error } = await supabase
        .from('laudos')
        .select('*, clientes(nome, documento, endereco, bairro, cidade), ativos(local)')
        .eq('id', id)
        .single()
      if (error) {
        setErro('Não encontramos esse laudo.')
        setLoading(false)
        return
      }
      setLaudo(data)
      setLoading(false)
      document.title = `Laudo_${data.clientes?.nome || 'Refrilav'}`
    }
    carregar()
  }, [id])

  if (loading) return <p className="text-gray-400 text-sm p-6 text-center">Carregando...</p>
  if (erro) return <p className="text-red-600 text-sm p-6 text-center">{erro}</p>
  if (!laudo) return null

  const cliente = laudo.clientes

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 print:p-0 print:max-w-full">
      <div className="no-print mb-6">
        <Link to="/ordens-servico" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
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

      <div className="bg-white border border-gray-200 print:border-0 rounded-lg p-8 print:p-0 print:rounded-none text-sm">
        <div className="flex items-center gap-4 border-b-2 border-gray-800 pb-4 mb-4">
          <img src="/logo.png" alt="Refrilav" className="h-14" />
          <div>
            <p className="font-bold text-gray-900">REFRILAV ASSISTÊNCIA TÉCNICA</p>
            <p className="text-xs text-gray-500">CNPJ 54.476.046/0001-00</p>
            <p className="text-xs text-gray-500">Av. Independência, 2335, Santa Cruz do Sul/RS</p>
            <p className="text-xs text-gray-500">(51) 99790-6220</p>
          </div>
        </div>

        <h1 className="text-center font-bold text-gray-900 mb-4">CERTIFICADO DE MANUTENÇÃO PREVENTIVA</h1>

        <table className="w-full border border-gray-300 mb-4">
          <tbody>
            <tr>
              <td className="border border-gray-300 bg-gray-50 px-2 py-1 font-medium">1 - Identificação da Empresa</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-2 py-1">{cliente?.nome || '—'}</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-2 py-1">{cliente?.documento ? `CPF/CNPJ: ${cliente.documento}` : ''}</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-2 py-1">
                {[laudo.ativos?.local, cliente?.endereco].filter(Boolean).join(', ') || '—'}
              </td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-2 py-1">
                Bairro {cliente?.bairro || '—'} | Cidade: {(cliente?.cidade || 'SANTA CRUZ DO SUL').toUpperCase()} | UF: RS
              </td>
            </tr>
          </tbody>
        </table>

        <table className="w-full border border-gray-300 mb-4">
          <tbody>
            <tr>
              <td colSpan={2} className="border border-gray-300 bg-gray-50 px-2 py-1 font-medium">2 - Relação dos equipamentos</td>
            </tr>
            <tr className="bg-gray-50 text-xs">
              <td className="border border-gray-300 px-2 py-1 font-medium">Equipamento</td>
              <td className="border border-gray-300 px-2 py-1 font-medium">Capacidade BTU</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-2 py-1">{laudo.equipamento_descricao || '—'}</td>
              <td className="border border-gray-300 px-2 py-1">{laudo.capacidade_btu || '—'}</td>
            </tr>
          </tbody>
        </table>

        <p className="font-medium text-gray-800 mb-1">a) Check-list Higienização</p>
        <table className="w-full border border-gray-300 mb-4">
          <thead>
            <tr className="bg-gray-50 text-xs">
              <th className="border border-gray-300 px-2 py-1 text-left font-medium">Descrição da Atividade</th>
              <th className="border border-gray-300 px-2 py-1 text-left font-medium">Status</th>
              <th className="border border-gray-300 px-2 py-1 text-left font-medium">Observações</th>
            </tr>
          </thead>
          <tbody>
            {(laudo.checklist || []).map((item, i) => (
              <tr key={i}>
                <td className="border border-gray-300 px-2 py-1">{item.descricao}</td>
                <td className="border border-gray-300 px-2 py-1">{item.status}</td>
                <td className="border border-gray-300 px-2 py-1">{item.observacoes || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="text-gray-700 mb-8">
          Santa Cruz do Sul, {dataPorExtenso(laudo.data_emissao)}
        </p>

        <p className="text-center text-gray-700">Refrilav Assistência Técnica</p>
      </div>

      <style>{`
        @page {
          margin: 12mm;
        }
        @media print {
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  )
}
