import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatDateBR, formatCurrencyBRL, todayISO } from '../lib/format'
import { Printer, ArrowLeft } from 'lucide-react'

export default function Recibo() {
  const { id } = useParams() // id do lançamento
  const [lancamento, setLancamento] = useState(null)
  const [garantiaDias, setGarantiaDias] = useState('')
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)

  // Opções do que aparece no recibo
  const [mostrarServico, setMostrarServico] = useState(true)
  const [mostrarEquipamento, setMostrarEquipamento] = useState(true)
  const [mostrarEndereco, setMostrarEndereco] = useState(true)
  const [mostrarTelefone, setMostrarTelefone] = useState(true)
  const [mostrarGarantia, setMostrarGarantia] = useState(true)

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      const [lancRes, osRes] = await Promise.all([
        supabase
          .from('lancamentos')
          .select(
            '*, clientes(nome, telefone, documento, endereco), fornecedores(nome, telefone, documento, endereco), categorias(nome), equipamentos(nome)'
          )
          .eq('id', id)
          .single(),
        supabase.from('ordens_servico').select('numero, garantia_dias').eq('lancamento_id', id).maybeSingle(),
      ])
      if (lancRes.error) {
        setErro(lancRes.error.message)
        setLoading(false)
        return
      }
      setLancamento({ ...lancRes.data, os: osRes.data || null })
      if (osRes.data?.garantia_dias) setGarantiaDias(String(osRes.data.garantia_dias))
      setLoading(false)
      document.title = `Recibo - ${lancRes.data.clientes?.nome || lancRes.data.fornecedores?.nome || 'Refrilav'}`
    }
    carregar()
  }, [id])

  if (loading) return <p className="text-gray-400 text-sm p-6">Carregando...</p>
  if (erro) return <div className="p-6 text-red-600 text-sm">{erro}</div>
  if (!lancamento) return null

  const pessoa = lancamento.tipo === 'receber' ? lancamento.clientes : lancamento.fornecedores
  const valorExibido = lancamento.status === 'pago' ? lancamento.valor_pago : lancamento.valor

  return (
    <div className="max-w-xl mx-auto py-6 px-4 print:p-0 print:max-w-full">
      <div className="no-print mb-6">
        <Link to="/contas-a-receber" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> Voltar
        </Link>

        <div className="bg-white border border-gray-200 rounded-lg p-3 mb-3">
          <p className="text-xs font-medium text-gray-500 mb-2">O que aparece no recibo:</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700 mb-2">
            {lancamento.categorias?.nome && (
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={mostrarServico} onChange={(e) => setMostrarServico(e.target.checked)} />
                Serviço
              </label>
            )}
            {lancamento.equipamentos?.nome && (
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={mostrarEquipamento} onChange={(e) => setMostrarEquipamento(e.target.checked)} />
                Equipamento
              </label>
            )}
            {pessoa?.telefone && (
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={mostrarTelefone} onChange={(e) => setMostrarTelefone(e.target.checked)} />
                Telefone
              </label>
            )}
            {pessoa?.endereco && (
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={mostrarEndereco} onChange={(e) => setMostrarEndereco(e.target.checked)} />
                Endereço
              </label>
            )}
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={mostrarGarantia} onChange={(e) => setMostrarGarantia(e.target.checked)} />
              Garantia
            </label>
          </div>
          {mostrarGarantia && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Garantia (dias)</label>
              <input
                type="number"
                value={garantiaDias}
                onChange={(e) => setGarantiaDias(e.target.value)}
                placeholder="Ex: 90"
                className="w-40 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>
          )}
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
            <p className="text-xl font-bold text-gray-900">Recibo de Pagamento</p>
            {lancamento.os?.numero && <p className="text-sm text-gray-500">Ref. OS Nº {String(lancamento.os.numero).padStart(5, '0')}</p>}
            <p className="text-xs text-gray-400">Emitido em {formatDateBR(todayISO())}</p>
          </div>
        </div>

        <p className="text-sm text-gray-700 leading-relaxed mb-6">
          Recebemos de <strong>{pessoa?.nome || '—'}</strong>
          {pessoa?.documento ? ` (${pessoa.documento})` : ''}, a quantia de{' '}
          <strong>{formatCurrencyBRL(valorExibido)}</strong>, referente a: <strong>{lancamento.descricao}</strong>.
        </p>

        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Data do pagamento</p>
            <p className="text-gray-700">{lancamento.data_pagamento ? formatDateBR(lancamento.data_pagamento) : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Forma de pagamento</p>
            <p className="text-gray-700">{lancamento.forma_pagamento || '—'}</p>
          </div>
          {mostrarServico && lancamento.categorias?.nome && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Serviço</p>
              <p className="text-gray-700">{lancamento.categorias.nome}</p>
            </div>
          )}
          {mostrarEquipamento && lancamento.equipamentos?.nome && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Equipamento</p>
              <p className="text-gray-700">{lancamento.equipamentos.nome}</p>
            </div>
          )}
          {mostrarTelefone && pessoa?.telefone && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Telefone</p>
              <p className="text-gray-700">{pessoa.telefone}</p>
            </div>
          )}
          {mostrarEndereco && pessoa?.endereco && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Endereço</p>
              <p className="text-gray-700">{pessoa.endereco}</p>
            </div>
          )}
        </div>

        {mostrarGarantia && garantiaDias && (
          <p className="text-sm text-gray-700 mb-10">
            <strong>Garantia:</strong> {garantiaDias} dias a partir da data do pagamento.
          </p>
        )}

        <div className="text-center text-sm text-gray-600 mt-16">
          <div className="border-t border-gray-400 pt-1 w-64 mx-auto">Assinatura</div>
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
