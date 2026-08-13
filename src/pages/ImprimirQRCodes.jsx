import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Printer } from 'lucide-react'

// URL pública que o QR code vai apontar — abre sem precisar de login
function urlPublica(ativoId) {
  return `${window.location.origin}/publico/ativo/${ativoId}`
}

// Gera a imagem do QR code via API pública (sem precisar instalar biblioteca)
function qrImagemUrl(texto) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=8&data=${encodeURIComponent(texto)}`
}

export default function ImprimirQRCodes() {
  const { clienteId } = useParams()
  const [cliente, setCliente] = useState(null)
  const [ativos, setAtivos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      const [clienteRes, ativosRes] = await Promise.all([
        supabase.from('clientes').select('nome').eq('id', clienteId).single(),
        supabase.from('ativos').select('*, equipamentos(nome)').eq('cliente_id', clienteId).eq('ativo', true).order('codigo'),
      ])
      setCliente(clienteRes.data)
      setAtivos(ativosRes.data || [])
      setLoading(false)
    }
    carregar()
  }, [clienteId])

  if (loading) return <p className="text-gray-400 text-sm p-6">Carregando...</p>

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 print:p-0 print:max-w-full">
      <div className="no-print mb-6">
        <Link to={`/clientes/${clienteId}/ativos`} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> Voltar
        </Link>
        <h2 className="text-xl font-bold text-gray-900 mb-1">QR Codes — {cliente?.nome}</h2>
        <p className="text-gray-500 text-sm mb-3">
          {ativos.length} etiqueta(s). Cada uma aponta pra uma página pública com o histórico daquele equipamento.
          Imprima e recorte, ou mande esse conteúdo pra gráfica.
        </p>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1 rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700"
        >
          <Printer size={16} /> Imprimir / Salvar PDF
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 print:grid-cols-3">
        {ativos.map((a) => (
          <div key={a.id} className="border border-gray-300 rounded-lg p-3 flex flex-col items-center text-center break-inside-avoid">
            <img src={qrImagemUrl(urlPublica(a.id))} alt={`QR code REF-${a.codigo}`} className="w-32 h-32 mb-2" />
            <p className="text-xs font-bold text-gray-800">REF-{a.codigo}</p>
            <p className="text-xs text-gray-600">{a.local || a.equipamentos?.nome || '—'}</p>
            <p className="text-[10px] text-gray-400 mt-1">Refrilav Assistência Técnica</p>
          </div>
        ))}
      </div>

      <style>{`
        @page {
          margin: 10mm;
        }
        @media print {
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  )
}
