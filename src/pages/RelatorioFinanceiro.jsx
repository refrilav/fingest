import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { formatDateBR, formatCurrencyBRL, todayISO, isOverdue } from '../lib/format'
import BuscaPessoa from '../components/BuscaPessoa'
import { ArrowLeft, FileSpreadsheet, Printer, Wallet } from 'lucide-react'

const STATUS_LABEL = { aberto: 'Em aberto', pago: 'Pago', cancelado: 'Cancelado', vencido: 'Vencido' }

// definição de todas as colunas possíveis do relatório
const COLUNAS = [
  { chave: 'tipo', label: 'Tipo', valor: (l) => (l.tipo === 'pagar' ? 'A pagar' : 'A receber') },
  { chave: 'descricao', label: 'Descrição', valor: (l) => l.descricao || '—' },
  { chave: 'categoria', label: 'Categoria', valor: (l) => l.categorias?.nome || '—' },
  { chave: 'centroCusto', label: 'Centro de custo', valor: (l) => l.centros_de_custo?.nome || '—' },
  { chave: 'pessoa', label: 'Cliente/Fornecedor', valor: (l) => l.clientes?.nome || l.fornecedores?.nome || '—' },
  { chave: 'contaBancaria', label: 'Conta bancária', valor: (l) => l.contas_bancarias?.nome || '—' },
  { chave: 'equipamento', label: 'Equipamento', valor: (l) => l.equipamentos?.nome || '—' },
  { chave: 'dataVencimento', label: 'Vencimento', valor: (l) => formatDateBR(l.data_vencimento) },
  { chave: 'dataCompetencia', label: 'Competência', valor: (l) => (l.data_competencia ? formatDateBR(l.data_competencia) : '—') },
  { chave: 'dataPagamento', label: 'Pagamento', valor: (l) => (l.data_pagamento ? formatDateBR(l.data_pagamento) : '—') },
  { chave: 'valor', label: 'Valor', valor: (l) => formatCurrencyBRL(l.valor) },
  { chave: 'desconto', label: 'Desconto', valor: (l) => formatCurrencyBRL(l.desconto || 0) },
  { chave: 'juros', label: 'Juros/Multa', valor: (l) => formatCurrencyBRL(l.juros || 0) },
  { chave: 'valorPago', label: 'Valor pago', valor: (l) => (l.status === 'pago' ? formatCurrencyBRL(l.valor_pago) : '—') },
  { chave: 'status', label: 'Status', valor: (l) => STATUS_LABEL[statusReal(l)] },
  { chave: 'formaPagamento', label: 'Forma de pagamento', valor: (l) => l.forma_pagamento || '—' },
  { chave: 'parcela', label: 'Parcela', valor: (l) => (l.total_parcelas ? `${l.numero_parcela}/${l.total_parcelas}` : '—') },
  { chave: 'recorrente', label: 'Recorrente', valor: (l) => (l.recorrente ? 'Sim' : 'Não') },
  { chave: 'taxaCartao', label: 'Taxa de cartão', valor: (l) => (l.taxa_cartao_valor ? formatCurrencyBRL(l.taxa_cartao_valor) : '—') },
  { chave: 'observacoes', label: 'Observações', valor: (l) => l.observacoes || '—' },
]

const COLUNAS_PADRAO = ['descricao', 'categoria', 'pessoa', 'dataVencimento', 'valor', 'status']

function statusReal(l) {
  if (l.status === 'aberto' && isOverdue(l.data_vencimento)) return 'vencido'
  return l.status
}

export default function RelatorioFinanceiro() {
  const [searchParams] = useSearchParams()
  const [lista, setLista] = useState([])
  const [categorias, setCategorias] = useState([])
  const [centros, setCentros] = useState([])
  const [contas, setContas] = useState([])
  const [loading, setLoading] = useState(true)

  const [filtroTipo, setFiltroTipo] = useState(searchParams.get('tipo') || 'ambos')
  const [filtroStatus, setFiltroStatus] = useState(['aberto', 'vencido', 'pago', 'cancelado'])
  const [filtroCategoriaId, setFiltroCategoriaId] = useState('')
  const [filtroCentroCustoId, setFiltroCentroCustoId] = useState('')
  const [filtroContaId, setFiltroContaId] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [fornecedorId, setFornecedorId] = useState('')
  const [campoData, setCampoData] = useState('vencimento') // 'vencimento' | 'competencia' | 'pagamento'
  const [dataDe, setDataDe] = useState('')
  const [dataAte, setDataAte] = useState('')
  const [colunasSelecionadas, setColunasSelecionadas] = useState(COLUNAS_PADRAO)

  const [gerado, setGerado] = useState(false)
  const [resultados, setResultados] = useState([])

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      const [lancRes, catRes, centRes, contaRes] = await Promise.all([
        supabase
          .from('lancamentos')
          .select(
            '*, categorias(nome), centros_de_custo(nome), fornecedores(nome), clientes(nome), contas_bancarias(nome), equipamentos(nome)'
          )
          .order('data_vencimento', { ascending: false })
          .range(0, 9999),
        supabase.from('categorias').select('*').eq('ativo', true).order('nome').range(0, 9999),
        supabase.from('centros_de_custo').select('*').eq('ativo', true).order('nome').range(0, 9999),
        supabase.from('contas_bancarias').select('*').eq('ativo', true).order('nome').range(0, 9999),
      ])
      setLista(lancRes.data || [])
      setCategorias(catRes.data || [])
      setCentros(centRes.data || [])
      setContas(contaRes.data || [])
      setLoading(false)
    }
    carregar()
  }, [])

  function alternarColuna(chave) {
    setColunasSelecionadas((prev) => (prev.includes(chave) ? prev.filter((c) => c !== chave) : [...prev, chave]))
  }

  function alternarStatus(status) {
    setFiltroStatus((prev) => (prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]))
  }

  function gerarRelatorio() {
    const filtrado = lista.filter((l) => {
      if (filtroTipo !== 'ambos' && l.tipo !== filtroTipo) return false
      if (!filtroStatus.includes(statusReal(l))) return false
      if (filtroCategoriaId && l.categoria_id !== filtroCategoriaId) return false
      if (filtroCentroCustoId && l.centro_custo_id !== filtroCentroCustoId) return false
      if (filtroContaId && l.conta_bancaria_id !== filtroContaId) return false
      if (clienteId && l.cliente_id !== clienteId) return false
      if (fornecedorId && l.fornecedor_id !== fornecedorId) return false
      if (dataDe || dataAte) {
        const campo = { vencimento: l.data_vencimento, competencia: l.data_competencia, pagamento: l.data_pagamento }[campoData]
        if (!campo) return false
        if (dataDe && campo < dataDe) return false
        if (dataAte && campo > dataAte) return false
      }
      return true
    })
    setResultados(filtrado)
    setGerado(true)
  }

  const colunasAtivas = COLUNAS.filter((c) => colunasSelecionadas.includes(c.chave))

  function exportarExcel() {
    const linhas = [colunasAtivas.map((c) => c.label)]
    resultados.forEach((l) => linhas.push(colunasAtivas.map((c) => c.valor(l))))
    const ws = XLSX.utils.aoa_to_sheet(linhas)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Financeiro')
    XLSX.writeFile(wb, 'Relatorio_Financeiro.xlsx')
  }

  const totalGeral = resultados.reduce((acc, l) => acc + (l.status === 'pago' ? Number(l.valor_pago) : Number(l.valor)), 0)

  const resumoFiltro = [
    filtroTipo === 'ambos' ? 'Pagar + Receber' : filtroTipo === 'pagar' ? 'Contas a Pagar' : 'Contas a Receber',
    filtroStatus.length < 4 ? filtroStatus.map((s) => STATUS_LABEL[s]).join(' + ') : null,
    dataDe || dataAte
      ? `${{ vencimento: 'Vencimento', competencia: 'Competência', pagamento: 'Pagamento' }[campoData]}: ${dataDe ? formatDateBR(dataDe) : '...'} a ${dataAte ? formatDateBR(dataAte) : '...'}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="max-w-4xl">
      <div className="no-print">
        <Link to="/financeiro" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> Voltar
        </Link>

        <h2 className="text-2xl font-bold text-gray-900 mb-1">Relatório Financeiro</h2>
        <p className="text-gray-500 text-sm mb-4">Filtre e escolha as colunas antes de gerar.</p>

        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tipo</label>
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="ambos">Contas a Pagar + a Receber</option>
                <option value="pagar">Só Contas a Pagar</option>
                <option value="receber">Só Contas a Receber</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Status (marque quantos quiser)</label>
              <div className="flex flex-wrap gap-x-3 gap-y-1 rounded-lg border border-gray-300 px-3 py-2">
                {Object.entries(STATUS_LABEL).map(([valor, label]) => (
                  <label key={valor} className="flex items-center gap-1.5 text-sm text-gray-600">
                    <input type="checkbox" checked={filtroStatus.includes(valor)} onChange={() => alternarStatus(valor)} />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <select
              value={filtroCategoriaId}
              onChange={(e) => setFiltroCategoriaId(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Todas as categorias</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
            <select
              value={filtroCentroCustoId}
              onChange={(e) => setFiltroCentroCustoId(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Todos os centros de custo</option>
              {centros.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
            <select
              value={filtroContaId}
              onChange={(e) => setFiltroContaId(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Todas as contas bancárias</option>
              {contas.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>

            {filtroTipo !== 'pagar' && (
              <BuscaPessoa tabela="clientes" value={clienteId} onChange={setClienteId} placeholder="Filtrar por cliente (opcional)..." />
            )}
            {filtroTipo !== 'receber' && (
              <BuscaPessoa tabela="fornecedores" value={fornecedorId} onChange={setFornecedorId} placeholder="Filtrar por fornecedor (opcional)..." />
            )}
          </div>

          <div className="flex flex-wrap items-end gap-2 mb-1">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Filtrar período por</label>
              <select
                value={campoData}
                onChange={(e) => setCampoData(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="vencimento">Data de vencimento</option>
                <option value="competencia">Data de competência</option>
                <option value="pagamento">Data de pagamento</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">De</label>
              <input type="date" value={dataDe} onChange={(e) => setDataDe(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Até</label>
              <input type="date" value={dataAte} onChange={(e) => setDataAte(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Colunas do relatório</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {COLUNAS.map((c) => (
              <label key={c.chave} className="flex items-center gap-1.5 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={colunasSelecionadas.includes(c.chave)}
                  onChange={() => alternarColuna(c.chave)}
                />
                {c.label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={gerarRelatorio}
            disabled={colunasAtivas.length === 0 || filtroStatus.length === 0 || loading}
            className="flex items-center gap-1 rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            <Wallet size={16} /> Gerar relatório
          </button>
          {gerado && (
            <>
              <button
                onClick={exportarExcel}
                className="flex items-center gap-1 rounded-lg bg-gray-100 text-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-200"
              >
                <FileSpreadsheet size={16} /> Exportar Excel
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1 rounded-lg bg-gray-100 text-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-200"
              >
                <Printer size={16} /> Imprimir / Salvar PDF
              </button>
            </>
          )}
        </div>
      </div>

      {gerado && (
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-0.5">Relatório Financeiro</h3>
          {resumoFiltro && <p className="text-xs text-gray-500 mb-3">{resumoFiltro}</p>}
          {resultados.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum lançamento encontrado com esses filtros.</p>
          ) : (
            <>
              <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs text-gray-500">
                    {colunasAtivas.map((c) => (
                      <th key={c.chave} className="px-3 py-1.5">{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resultados.map((l) => (
                    <tr key={l.id} className="border-t border-gray-100">
                      {colunasAtivas.map((c) => (
                        <td key={c.chave} className="px-3 py-1.5 text-gray-700 align-top">{c.valor(l)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-sm text-right font-medium text-gray-800 mt-2">Total: {formatCurrencyBRL(totalGeral)}</p>
            </>
          )}
          <p className="text-xs text-gray-400 mt-4 text-center">Refrilav Assistência Técnica · {resultados.length} lançamento(s)</p>
        </div>
      )}

      <style>{`
        @media print {
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  )
}
