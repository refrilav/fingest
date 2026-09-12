import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Printer } from 'lucide-react'

// URL pública que o QR code vai apontar — abre sem precisar de login
function urlPublica(ativoId) {
  return `${window.location.origin}/publico/ativo/${ativoId}`
}

// Gera a imagem do QR code via API pública, sempre em alta resolução (a exibição
// em si é controlada pela largura da coluna, não pelo tamanho pedido aqui)
function qrImagemUrl(texto) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=8&data=${encodeURIComponent(texto)}`
}

export default function ImprimirQRCodesEstoque() {
  const [estoque, setEstoque] = useState([])
  const [loading, setLoading] = useState(true)
  const [colunas, setColunas] = useState(3)

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      const { data } = await supabase.from('ativos').select('id, codigo').is('cliente_id', null).eq('ativo', true).order('codigo')
      setEstoque(data || [])
      setLoading(false)
    }
    carregar()
  }, [])

  if (loading) return <p className="text-gray-400 text-sm p-6">Carregando...</p>

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 print:p-0 print:max-w-full">
      <div className="no-print mb-6">
        <Link to="/estoque-qrcodes" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> Voltar
        </Link>
        <h2 className="text-xl font-bold text-gray-900 mb-1">QR Codes — Estoque</h2>
        <p className="text-gray-500 text-sm mb-3">
          {estoque.length} etiqueta(s) ainda sem cliente vinculado. Cole nos equipamentos em campo e vincule depois.
        </p>

        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <label className="block text-xs text-gray-500 mb-1">Colunas por página (A4) — controla o tamanho de tudo</label>
          <select
            value={colunas}
            onChange={(e) => setColunas(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value={2}>2 colunas (maior)</option>
            <option value={3}>3 colunas</option>
            <option value={4}>4 colunas</option>
            <option value={5}>5 colunas (menor)</option>
          </select>
        </div>

        <button
          onClick={() => window.print()}
          className="flex items-center gap-1 rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700"
        >
          <Printer size={16} /> Imprimir / Salvar PDF
        </button>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` }}>
        {estoque.map((a) => (
          <div key={a.id} className="border border-gray-300 rounded-lg p-3 flex flex-col items-center text-center break-inside-avoid">
            <img src="/logo.png" alt="Refrilav" className="h-8 mb-2 object-contain" />
            <img
              src={qrImagemUrl(urlPublica(a.id))}
              alt={`QR code REF-${a.codigo}`}
              style={{ width: '100%', aspectRatio: '1 / 1' }}
              className="mb-2"
            />
            <p className="text-xs font-bold text-gray-800">REF-{a.codigo}</p>
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
