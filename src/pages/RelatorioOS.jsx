import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { formatDateBR, formatCurrencyBRL } from '../lib/format'
import BuscaPessoa from '../components/BuscaPessoa'
import { ArrowLeft, FileSpreadsheet, Printer, ClipboardList } from 'lucide-react'

const STATUS_ATUAL_OPCOES = [
  'Agendado',
  'Recolhida para oficina',
  'Peça encomendada',
  'Aguardando aprovação do orçamento',
  'Pronta para entrega',
  'Em atendimento no local',
]

const STATUS_LABEL = {
  nao_iniciada: 'Não iniciada',
  em_andamento: 'Em andamento',
  finalizada: 'Finalizada',
  cancelada: 'Cancelada',
}

// definição de todas as colunas possíveis do relatório
const COLUNAS = [
  { chave: 'numero', label: 'Nº', valor: (os) => `#${os.numero}` },
  { chave: 'cliente', label: 'Cliente', valor: (os) => os.clientes?.nome || '—' },
  { chave: 'telefone', label: 'Telefone', valor: (os) => os.clientes?.telefone || '—' },
  { chave: 'clienteFinal', label: 'Cliente final', valor: (os) => os.cliente_final || '—' },
  { chave: 'equipamento', label: 'Equipamento', valor: (os) => os.equipamentos?.nome || '—' },
  { chave: 'status', label: 'Status', valor: (os) => STATUS_LABEL[os.status] },
  {
    chave: 'statusAtual',
    label: 'Status atual',
    valor: (os) => os.status_atual || '—',
  },
  { chave: 'dataAbertura', label: 'Abertura', valor: (os) => formatDateBR(os.data_abertura) },
  { chave: 'dataConclusao', label: 'Conclusão', valor: (os) => (os.data_conclusao ? formatDateBR(os.data_conclusao) : '—') },
  { chave: 'descricaoProblema', label: 'Problema relatado', valor: (os) => os.descricao_problema || '—' },
  { chave: 'servicosRealizados', label: 'Serviços realizados', valor: (os) => os.servicos_realizados || '—' },
  { chave: 'valorFinal', label: 'Valor final', valor: (os) => (os.valor_final != null ? formatCurrencyBRL(os.valor_final) : '—') },
  {
    chave: 'garantia',
    label: 'Garantia',
    valor: (os) => (os.garantia_dias ? `${os.garantia_dias} ${os.garantia_unidade || 'dias'} ${os.garantia_referencia || ''}` : '—'),
  },
  { chave: 'endereco', label: 'Endereço', valor: (os) => os.endereco || '—' },
]

const COLUNAS_PADRAO = ['numero', 'cliente', 'equipamento', 'status', 'dataAbertura']

export default function RelatorioOS() {
  const [lista, setLista] = useState([])
  const [equipamentos, setEquipamentos] = useState([])
  const [loading, setLoading] = useState(true)

  const [filtroStatus, setFiltroStatus] = useState('todas')
  const [filtroStatusAtual, setFiltroStatusAtual] = useState('todos')
  const [campoData, setCampoData] = useState('abertura') // 'abertura' | 'conclusao'
  const [dataDe, setDataDe] = useState('')
  const [dataAte, setDataAte] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [equipamentoId, setEquipamentoId] = useState('')
  const [colunasSelecionadas, setColunasSelecionadas] = useState(COLUNAS_PADRAO)

  const [gerado, setGerado] = useState(false)
  const [resultados, setResultados] = useState([])

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      const [osRes, equipRes] = await Promise.all([
        supabase
          .from('ordens_servico')
          .select(
            '*, clientes(nome, telefone), equipamentos(nome)'
          )
          .order('numero', { ascending: false })
          .range(0, 9999),
        supabase.from('equipamentos').select('*').eq('ativo', true).order('nome').range(0, 9999),
      ])
      setLista(osRes.data || [])
      setEquipamentos(equipRes.data || [])
      setLoading(false)
    }
    carregar()
  }, [])

  function alternarColuna(chave) {
    setColunasSelecionadas((prev) => (prev.includes(chave) ? prev.filter((c) => c !== chave) : [...prev, chave]))
  }

  function gerarRelatorio() {
    const filtrado = lista.filter((os) => {
      if (filtroStatus !== 'todas' && os.status !== filtroStatus) return false
      if (filtroStatus === 'em_andamento' && filtroStatusAtual !== 'todos') {
        if ((os.status_atual || '') !== filtroStatusAtual) return false
      }
      if (clienteId && os.cliente_id !== clienteId) return false
      if (equipamentoId && os.equipamento_id !== equipamentoId) return false
      if (dataDe || dataAte) {
        const campo = campoData === 'abertura' ? os.data_abertura : os.data_conclusao
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
    resultados.forEach((os) => linhas.push(colunasAtivas.map((c) => c.valor(os))))
    const ws = XLSX.utils.aoa_to_sheet(linhas)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'OS')
    XLSX.writeFile(wb, 'Relatorio_OS.xlsx')
  }

  const resumoFiltro = [
    filtroStatus === 'todas' ? 'Todos os status' : STATUS_LABEL[filtroStatus],
    filtroStatus === 'em_andamento' && filtroStatusAtual !== 'todos' ? filtroStatusAtual : null,
    dataDe || dataAte
      ? `${campoData === 'abertura' ? 'Abertura' : 'Conclusão'}: ${dataDe ? formatDateBR(dataDe) : '...'} a ${dataAte ? formatDateBR(dataAte) : '...'}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="max-w-4xl">
      <div className="no-print">
        <Link to="/ordens-servico" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> Voltar
        </Link>

        <h2 className="text-2xl font-bold text-gray-900 mb-1">Relatório de OS</h2>
        <p className="text-gray-500 text-sm mb-4">Filtre e escolha as colunas antes de gerar.</p>

        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Status</label>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="todas">Todos</option>
                <option value="nao_iniciada">Não iniciada</option>
                <option value="em_andamento">Em andamento</option>
                <option value="finalizada">Finalizada</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>

            {filtroStatus === 'em_andamento' && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Status atual</label>
                <select
                  value={filtroStatusAtual}
                  onChange={(e) => setFiltroStatusAtual(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="todos">Todos</option>
                  {STATUS_ATUAL_OPCOES.map((op) => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </select>
              </div>
            )}

            <BuscaPessoa tabela="clientes" value={clienteId} onChange={setClienteId} placeholder="Filtrar por cliente (opcional)..." />

            <select
              value={equipamentoId}
              onChange={(e) => setEquipamentoId(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Todos os equipamentos</option>
              {equipamentos.map((eq) => (
                <option key={eq.id} value={eq.id}>{eq.nome}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-end gap-2 mb-1">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Filtrar período por</label>
              <select
                value={campoData}
                onChange={(e) => setCampoData(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="abertura">Data de abertura</option>
                <option value="conclusao">Data de conclusão</option>
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
            disabled={colunasAtivas.length === 0 || loading}
            className="flex items-center gap-1 rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            <ClipboardList size={16} /> Gerar relatório
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
          <h3 className="text-lg font-bold text-gray-900 mb-0.5">Relatório de Ordens de Serviço</h3>
          {resumoFiltro && <p className="text-xs text-gray-500 mb-3">{resumoFiltro}</p>}
          {resultados.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhuma OS encontrada com esses filtros.</p>
          ) : (
            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-gray-50 text-left text-xs text-gray-500">
                  {colunasAtivas.map((c) => (
                    <th key={c.chave} className="px-3 py-1.5">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resultados.map((os) => (
                  <tr key={os.id} className="border-t border-gray-100">
                    {colunasAtivas.map((c) => (
                      <td key={c.chave} className="px-3 py-1.5 text-gray-700 align-top">{c.valor(os)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-xs text-gray-400 mt-4 text-center">Refrilav Assistência Técnica · {resultados.length} OS listada(s)</p>
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
