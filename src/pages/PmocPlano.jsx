import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatDateBR, todayISO } from '../lib/format'
import { CHECKLISTS, LABEL_GRUPO, gruposDoMes } from '../lib/pmoc'
import { ArrowLeft, Printer } from 'lucide-react'

const GRUPOS_ORDEM = ['M', 'H', 'S', 'A']

export default function PmocPlano() {
  const { id } = useParams()
  const [contrato, setContrato] = useState(null)
  const [resumo, setResumo] = useState(null)
  const [equipamentos, setEquipamentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      const { data: c, error: erroC } = await supabase
        .from('pmoc_contratos')
        .select('*, clientes(nome, documento, endereco, bairro, cidade, telefone)')
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
        .is('data_saida', null)
        .order('created_at')

      setContrato(c)
      setResumo(r || null)
      setEquipamentos(eq || [])
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
        <div className="flex items-center gap-3 mb-3">
          <img src="/logo.png" alt="Refrilav" className="h-12 w-auto" />
          <h1 className="text-xl font-bold text-gray-900">Plano de Manutenção, Operação e Controle (PMOC)</h1>
        </div>
        <p className="text-sm text-gray-600 mb-6">
          Elaborado conforme Lei 13.589/2018, Portaria MS nº 3.523/1998, RDC ANVISA nº 886/2024 e NBR 17037,
          para sistemas de climatização artificial de ambientes de uso público e coletivo.
        </p>

        {/* 1. Identificação do estabelecimento */}
        <h2 className="text-sm font-semibold text-gray-800 mb-2 border-b border-gray-200 pb-1">
          1. Identificação do estabelecimento
        </h2>
        <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
          <div>
            <p className="text-gray-500 text-xs">Razão social / Nome</p>
            <p className="font-medium text-gray-800">{cliente?.nome}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">CPF/CNPJ</p>
            <p className="font-medium text-gray-800">{cliente?.documento || '—'}</p>
          </div>
          <div className="col-span-2">
            <p className="text-gray-500 text-xs">Endereço</p>
            <p className="font-medium text-gray-800">
              {[cliente?.endereco, cliente?.bairro, cliente?.cidade].filter(Boolean).join(', ') || '—'}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Contato</p>
            <p className="font-medium text-gray-800">{cliente?.telefone || '—'}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Início de vigência do plano</p>
            <p className="font-medium text-gray-800">{formatDateBR(contrato.data_inicio)}</p>
          </div>
        </div>

        {/* 2. Empresa responsável */}
        <h2 className="text-sm font-semibold text-gray-800 mb-2 border-b border-gray-200 pb-1">
          2. Empresa responsável pela manutenção
        </h2>
        <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
          <div>
            <p className="text-gray-500 text-xs">Empresa</p>
            <p className="font-medium text-gray-800">Refrilav Assistência Técnica</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Atividade</p>
            <p className="font-medium text-gray-800">Manutenção de sistemas de climatização</p>
          </div>
        </div>

        {/* 3. RT */}
        <h2 className="text-sm font-semibold text-gray-800 mb-2 border-b border-gray-200 pb-1">
          3. Responsável Técnico
        </h2>
        <div className="border border-dashed border-gray-300 rounded-lg p-4 mb-6 text-sm text-gray-400">
          Nome, registro no conselho de classe e ART a serem identificados por carimbo/assinatura no
          documento físico, conforme exigência aplicável a este estabelecimento.
        </div>

        {/* 4. Sistema */}
        <h2 className="text-sm font-semibold text-gray-800 mb-2 border-b border-gray-200 pb-1">
          4. Descrição do sistema de climatização
        </h2>
        {resumo && (
          <p className="text-sm mb-2">
            Carga térmica total instalada: <strong>{Number(resumo.capacidade_total_btu).toLocaleString('pt-BR')} BTU/h</strong>
            {resumo.exige_rt && ' — acima de 60.000 BTU/h (exige Responsável Técnico, conforme Portaria MS 3.523/1998)'}
          </p>
        )}
        <table className="w-full text-xs border-collapse mb-6">
          <thead>
            <tr className="bg-gray-50 text-gray-600">
              <th className="text-left p-2 border border-gray-200">Equipamento</th>
              <th className="text-left p-2 border border-gray-200">Local</th>
              <th className="text-left p-2 border border-gray-200">Capacidade (BTU/h)</th>
              <th className="text-left p-2 border border-gray-200">Frequência de higienização</th>
            </tr>
          </thead>
          <tbody>
            {equipamentos.map((eq) => (
              <tr key={eq.id}>
                <td className="p-2 border border-gray-200">{eq.descricao_equipamento || '—'}</td>
                <td className="p-2 border border-gray-200">{eq.local || '—'}</td>
                <td className="p-2 border border-gray-200">
                  {eq.capacidade_btu ? Number(eq.capacidade_btu).toLocaleString('pt-BR') : '—'}
                </td>
                <td className="p-2 border border-gray-200 capitalize">{eq.frequencia_higienizacao}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 5. Metodologia */}
        <h2 className="text-sm font-semibold text-gray-800 mb-2 border-b border-gray-200 pb-1">
          5. Metodologia — atividades por periodicidade
        </h2>
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
        <p className="text-xs text-gray-500 mb-6">
          A periodicidade H (Higienização) segue a frequência definida por equipamento na tabela da seção 4
          (trimestral, semestral ou anual). As periodicidades M (Mensal), S (Semestral, meses 6 e 12) e A
          (Anual, mês 12) são fixas para todos os equipamentos do sistema.
        </p>

        {/* 6. Cronograma */}
        <h2 className="text-sm font-semibold text-gray-800 mb-2 border-b border-gray-200 pb-1">
          6. Cronograma anual planejado (1º ciclo)
        </h2>
        <table className="w-full text-xs border-collapse mb-6">
          <thead>
            <tr className="bg-gray-50 text-gray-600">
              <th className="text-left p-1.5 border border-gray-200">Equipamento</th>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((mes) => (
                <th key={mes} className="p-1.5 border border-gray-200">M{mes}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {equipamentos.map((eq) => (
              <tr key={eq.id}>
                <td className="p-1.5 border border-gray-200">
                  {eq.descricao_equipamento || '—'}
                  {eq.local && <span className="text-gray-400"> · {eq.local}</span>}
                </td>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((mes) => (
                  <td key={mes} className="p-1.5 border border-gray-200 text-center text-gray-600">
                    {gruposDoMes(mes, eq.frequencia_higienizacao).join('+')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-gray-500 mb-8">
          Este cronograma é o planejamento do 1º ciclo (12 meses a partir de {formatDateBR(contrato.data_inicio)}).
          O acompanhamento da execução real, mês a mês, está no Relatório de Conformidade PMOC deste contrato.
        </p>

        {/* Assinaturas */}
        <div className="grid grid-cols-2 gap-8 mt-12 text-sm">
          <div>
            <div className="border-t border-gray-400 pt-2 mt-10">
              {cliente?.nome}
              <p className="text-xs text-gray-500">Contratante</p>
            </div>
          </div>
          <div>
            <div className="border-t border-gray-400 pt-2 mt-10">
              Responsável Técnico (carimbo/assinatura)
              <p className="text-xs text-gray-500">Refrilav Assistência Técnica</p>
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-8">Documento emitido em {formatDateBR(todayISO())}.</p>
      </div>
    </div>
  )
}
