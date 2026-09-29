import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatDateBR } from '../lib/format'
import { ArrowLeft, Printer } from 'lucide-react'
import { CHECKLISTS, LABEL_GRUPO } from '../lib/pmoc'

const GRUPOS_ORDEM = ['M', 'H', 'S', 'A']

export default function PmocRelatorio() {
  const { id } = useParams()
  const [contrato, setContrato] = useState(null)
  const [resumo, setResumo] = useState(null)
  const [equipamentos, setEquipamentos] = useState([])
  const [visitas, setVisitas] = useState([])
  const [matriz, setMatriz] = useState({}) // matriz[equipamentoId][numero_mes] = { grupos, concluido }
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      const { data: c, error: erroC } = await supabase
        .from('pmoc_contratos')
        .select('*, clientes(nome, endereco, bairro, cidade)')
        .eq('id', id)
        .single()
      if (erroC) {
        setErro(erroC.message)
        setLoading(false)
        return
      }
      const { data: r } = await supabase.from('pmoc_contratos_resumo').select('*').eq('contrato_id', id).single()
      const { data: eq } = await supabase
        .from('pmoc_equipamentos')
        .select('*')
        .eq('contrato_id', id)
        .order('created_at')
      const { data: v } = await supabase
        .from('pmoc_visitas')
        .select('*')
        .eq('contrato_id', id)
        .order('numero_mes')

      const idsVisitas = (v || []).map((visita) => visita.id)
      const { data: itens } = await supabase
        .from('pmoc_visita_itens')
        .select('*')
        .in('visita_id', idsVisitas.length > 0 ? idsVisitas : ['00000000-0000-0000-0000-000000000000'])

      const visitasPorId = {}
      for (const visita of v || []) visitasPorId[visita.id] = visita

      const mat = {}
      for (const item of itens || []) {
        const visita = visitasPorId[item.visita_id]
        if (!visita) continue
        if (!mat[item.pmoc_equipamento_id]) mat[item.pmoc_equipamento_id] = {}
        mat[item.pmoc_equipamento_id][visita.numero_mes] = {
          grupos: item.grupos,
          concluido: item.concluido,
          data_execucao: item.data_execucao,
        }
      }

      setContrato(c)
      setResumo(r || null)
      setEquipamentos(eq || [])
      setVisitas(v || [])
      setMatriz(mat)
      setLoading(false)
    }
    carregar()
  }, [id])

  if (loading) return <p className="text-gray-400 text-sm">Carregando...</p>
  if (erro) return <p className="text-red-600 text-sm">{erro}</p>

  const cliente = contrato.clientes

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-4 print:hidden">
        <Link to={`/pmoc/contratos/${id}`} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={14} /> Voltar para o contrato
        </Link>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1 rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700"
        >
          <Printer size={16} /> Imprimir / exportar PDF
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 print:border-0 print:p-0">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Relatório de Conformidade PMOC</h1>
        <p className="text-sm text-gray-600 mb-4">
          Programa de Manutenção, Operação e Controle — Lei 13.589/2018, Portaria MS 3.523/1998, RDC ANVISA
          886/2024 e NBR 17037
        </p>

        <div className="flex flex-wrap gap-3 mb-6 text-xs">
          {GRUPOS_ORDEM.map((g) => (
            <span key={g} className="bg-gray-50 border border-gray-200 rounded-full px-3 py-1 text-gray-700">
              <strong>{g}</strong> = {LABEL_GRUPO[g]}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div>
            <p className="text-gray-500">Cliente / Estabelecimento</p>
            <p className="font-medium text-gray-800">{cliente?.nome}</p>
            <p className="text-gray-600">
              {[cliente?.endereco, cliente?.bairro, cliente?.cidade].filter(Boolean).join(', ')}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Contrato PMOC — início do ciclo</p>
            <p className="font-medium text-gray-800">{formatDateBR(contrato.data_inicio)}</p>
            <p className="text-gray-600">Status: {contrato.status}</p>
          </div>
        </div>

        {resumo && (
          <div className="mb-6 text-sm">
            <p className="text-gray-500">Carga térmica total instalada</p>
            <p className="font-medium text-gray-800">
              {Number(resumo.capacidade_total_btu).toLocaleString('pt-BR')} BTU/h
            </p>
          </div>
        )}

        <h2 className="text-sm font-semibold text-gray-800 mb-2">Total de execuções por equipamento no ciclo</h2>
        <table className="w-full text-xs mb-6 border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-600">
              <th className="text-left p-2 border border-gray-200">Equipamento</th>
              <th className="text-left p-2 border border-gray-200">Local</th>
              <th className="text-left p-2 border border-gray-200">BTU/h</th>
              {GRUPOS_ORDEM.map((g) => (
                <th key={g} className="p-2 border border-gray-200">{g}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {equipamentos.map((eq) => {
              const meses = matriz[eq.id] || {}
              const contagem = { M: 0, H: 0, S: 0, A: 0 }
              Object.values(meses).forEach(({ grupos }) => grupos.forEach((g) => (contagem[g] = (contagem[g] || 0) + 1)))
              return (
                <tr key={eq.id}>
                  <td className="p-2 border border-gray-200">{eq.descricao_equipamento || '—'}</td>
                  <td className="p-2 border border-gray-200">{eq.local || '—'}</td>
                  <td className="p-2 border border-gray-200">{eq.capacidade_btu ? Number(eq.capacidade_btu).toLocaleString('pt-BR') : '—'}</td>
                  {GRUPOS_ORDEM.map((g) => (
                    <td key={g} className="p-2 border border-gray-200 text-center">{contagem[g] || 0}</td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>

        <h2 className="text-sm font-semibold text-gray-800 mb-3">Execução mês a mês</h2>
        <div className="space-y-5 mb-6">
          {equipamentos.map((eq) => (
            <div key={eq.id} className="break-inside-avoid">
              <p className="text-xs font-semibold text-gray-800 mb-1">
                {eq.descricao_equipamento || '(equipamento)'}
                {eq.local && <span className="text-gray-400 font-normal"> · {eq.local}</span>}
              </p>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-600">
                    <th className="text-left p-1.5 border border-gray-200 w-16">Mês</th>
                    <th className="text-left p-1.5 border border-gray-200">Manutenção prevista</th>
                    <th className="text-left p-1.5 border border-gray-200 w-28">Status</th>
                    <th className="text-left p-1.5 border border-gray-200 w-28">Data de realização</th>
                  </tr>
                </thead>
                <tbody>
                  {visitas.map((v) => {
                    const cel = (matriz[eq.id] || {})[v.numero_mes]
                    if (!cel) return null
                    return (
                      <tr key={v.id}>
                        <td className="p-1.5 border border-gray-200">{v.numero_mes}</td>
                        <td className="p-1.5 border border-gray-200">
                          {cel.grupos.map((g) => LABEL_GRUPO[g]).join(' + ')}
                        </td>
                        <td className={`p-1.5 border border-gray-200 ${cel.concluido ? 'text-green-700' : 'text-gray-500'}`}>
                          {cel.concluido ? 'Realizado' : 'Pendente'}
                        </td>
                        <td className="p-1.5 border border-gray-200">
                          {cel.concluido && cel.data_execucao ? formatDateBR(cel.data_execucao) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        <h2 className="text-sm font-semibold text-gray-800 mb-2 mt-6">Atividades realizadas em cada tipo de manutenção</h2>
        <p className="text-xs text-gray-500 mb-3">
          Sempre que uma célula da tabela acima traz uma letra (M, H, S ou A), as atividades abaixo foram
          executadas naquele mês para o equipamento correspondente.
        </p>
        <div className="grid grid-cols-2 gap-4 mb-6">
          {GRUPOS_ORDEM.map((g) => (
            <div key={g} className="text-xs">
              <p className="font-semibold text-gray-800 mb-1">{g} — {LABEL_GRUPO[g]}</p>
              <ul className="list-disc list-inside text-gray-600 space-y-0.5">
                {CHECKLISTS[g].map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400 mt-6">
          Responsável Técnico: a ser identificado por carimbo no documento físico, conforme aplicável.
        </p>
      </div>
    </div>
  )
}
