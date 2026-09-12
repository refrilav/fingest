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

const TAMANHOS_QR = { pequeno: 96, medio: 128, grande: 160 } // em px

export default function ImprimirQRCodes() {
  const { clienteId } = useParams()
  const [cliente, setCliente] = useState(null)
  const [ativos, setAtivos] = useState([])
  const [loading, setLoading] = useState(true)

  // configuração de impressão (folha A4)
  const [colunas, setColunas] = useState(3)
  const [tamanho, setTamanho] = useState('medio')

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

  const qrPx = TAMANHOS_QR[tamanho]

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

        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Colunas por página (A4)</label>
            <select
              value={colunas}
              onChange={(e) => setColunas(Number(e.target.value))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value={2}>2 colunas</option>
              <option value={3}>3 colunas</option>
              <option value={4}>4 colunas</option>
              <option value={5}>5 colunas</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tamanho da etiqueta</label>
            <select
              value={tamanho}
              onChange={(e) => setTamanho(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="pequeno">Pequena</option>
              <option value="medio">Média</option>
              <option value="grande">Grande</option>
            </select>
          </div>
        </div>

        <button
          onClick={() => window.print()}
          className="flex items-center gap-1 rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700"
        >
          <Printer size={16} /> Imprimir / Salvar PDF
        </button>
      </div>

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` }}
      >
        {ativos.map((a) => (
          <div key={a.id} className="border border-gray-300 rounded-lg p-3 flex flex-col items-center text-center break-inside-avoid">
            <img src="/logo.png" alt="Refrilav" className="h-8 mb-2 object-contain" />
            <img
              src={qrImagemUrl(urlPublica(a.id))}
              alt={`QR code REF-${a.codigo}`}
              style={{ width: qrPx, height: qrPx }}
              className="mb-2"
            />
            <p className="text-xs font-bold text-gray-800">REF-{a.codigo}</p>
            <p className="text-xs text-gray-600">{a.local || a.equipamentos?.nome || '—'}</p>
          </div>
        ))}
      </div>

      <style>{`
        @page {
          size: A4;
          margin: 10mm;
        }
        @media print {
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  )
}
