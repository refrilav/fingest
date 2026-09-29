import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatDateBR, todayISO } from '../lib/format'
import { CHECKLISTS, LABEL_GRUPO, gruposDoMes } from '../lib/pmoc'
import { ArrowLeft, Printer } from 'lucide-react'

const GRUPOS_ORDEM = ['M', 'H', 'S', 'A']

// Campo rotulado dentro de uma caixa, no estilo do modelo de referência
function Campo({ label, value, className = '' }) {
  return (
    <div className={`border border-gray-300 p-1.5 ${className}`}>
      <p className="text-[10px] font-semibold text-gray-600 uppercase">{label}</p>
      <p className="text-sm text-gray-900 min-h-[18px]">{value || ''}</p>
    </div>
  )
}

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
        .select('*, clientes(nome, documento, endereco, bairro, cidade, telefone, email)')
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

      <div className="bg-white border border-gray-200 rounded-lg p-6 print:border-0 print:p-0 text-sm">
        {/* Cabeçalho */}
        <div className="flex items-center gap-3 mb-1">
          <img src="/logo.png" alt="Refrilav" className="h-12 w-auto" />
          <div>
            <h1 className="text-lg font-bold text-gray-900 uppercase">
              PMOC — Plano de Manutenção, Operação e Controle
            </h1>
            <p className="text-xs text-gray-600 uppercase">
              Sistemas de ar condicionado — Refrilav Assistência Técnica
            </p>
          </div>
        </div>
        <p className="text-xs text-gray-500 mb-6">
          Elaborado conforme Lei 13.589/2018, Portaria MS nº 3.523/1998, RDC ANVISA nº 886/2024 e NBR 17037.
        </p>

        {/* 1. Identificação do ambiente */}
        <h2 className="text-sm font-bold text-gray-800 mb-1">1 — IDENTIFICAÇÃO DO AMBIENTE OU ESTABELECIMENTO</h2>
        <div className="grid grid-cols-3 mb-6">
          <Campo label="Unidade / Razão social" value={cliente?.nome} className="col-span-3" />
          <Campo label="Endereço completo" value={[cliente?.endereco, cliente?.bairro].filter(Boolean).join(', ')} className="col-span-2" />
          <Campo label="Cidade" value={cliente?.cidade} />
          <Campo label="Telefone" value={cliente?.telefone} />
          <Campo label="E-mail" value={cliente?.email} />
          <Campo label="CPF/CNPJ" value={cliente?.documento} />
        </div>

        {/* 2. Empresa responsável */}
        <h2 className="text-sm font-bold text-gray-800 mb-1">2 — EMPRESA RESPONSÁVEL PELA MANUTENÇÃO</h2>
        <div className="grid grid-cols-2 mb-6">
          <Campo label="Empresa" value="Refrilav Assistência Técnica" />
          <Campo label="Atividade" value="Manutenção de sistemas de climatização" />
        </div>

        {/* 3. RT */}
        <h2 className="text-sm font-bold text-gray-800 mb-1">3 — IDENTIFICAÇÃO DO RESPONSÁVEL TÉCNICO</h2>
        <div className="grid grid-cols-2 mb-1">
          <Campo label="Nome / Razão social" value="" />
          <Campo label="CPF/CNPJ" value="" />
          <Campo label="Endereço completo" value="" className="col-span-2" />
          <Campo label="Telefone" value="" />
          <Campo label="E-mail" value="" />
          <Campo label="Registro no conselho de classe" value="" />
          <Campo label="ART" value="" />
          <Campo label="Data de início do contrato" value={formatDateBR(contrato.data_inicio)} />
          <Campo label="Prazo" value="12 meses (ciclo)" />
        </div>
        <p className="text-[10px] text-gray-400 mb-6">
          Campos acima a serem preenchidos por carimbo/assinatura no documento físico, quando exigível
          (carga térmica acima de 60.000 BTU/h).
        </p>

        {/* 4. Relação de equipamentos */}
        <h2 className="text-sm font-bold text-gray-800 mb-1">4 — RELAÇÃO DOS EQUIPAMENTOS CLIMATIZADORES</h2>
        {resumo && (
          <p className="text-xs mb-2">
            Carga térmica total instalada: <strong>{Number(resumo.capacidade_total_btu).toLocaleString('pt-BR')} BTU/h</strong>
            {resumo.exige_rt && ' — acima de 60.000 BTU/h (exige Responsável Técnico, conforme Portaria MS 3.523/1998)'}
          </p>
        )}
        <table className="w-full text-xs border-collapse mb-6">
          <thead>
            <tr className="bg-gray-100 text-gray-700">
              <th className="text-left p-2 border border-gray-300">Equipamento</th>
              <th className="text-left p-2 border border-gray-300">Local</th>
              <th className="text-left p-2 border border-gray-300">Capacidade (BTU/h)</th>
              <th className="text-left p-2 border border-gray-300">Frequência de higienização</th>
            </tr>
          </thead>
          <tbody>
            {equipamentos.map((eq) => (
              <tr key={eq.id}>
                <td className="p-2 border border-gray-300">{eq.descricao_equipamento || '—'}</td>
                <td className="p-2 border border-gray-300">{eq.local || '—'}</td>
                <td className="p-2 border border-gray-300">
                  {eq.capacidade_btu ? Number(eq.capacidade_btu).toLocaleString('pt-BR') : '—'}
                </td>
                <td className="p-2 border border-gray-300 capitalize">{eq.frequencia_higienizacao}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 5. Plano de manutenção */}
        <h2 className="text-sm font-bold text-gray-800 mb-2">5 — PLANO DE MANUTENÇÃO, OPERAÇÃO E CONTROLE</h2>

        <div className="border border-gray-300 p-2 mb-3 text-xs bg-gray-50">
          <p className="font-semibold">Periodicidades das manutenções programadas:</p>
          <p>
            {GRUPOS_ORDEM.map((g) => `${g} – ${LABEL_GRUPO[g]}`).join('   ')}
          </p>
        </div>

        {GRUPOS_ORDEM.map((g) => (
          <table key={g} className="w-full text-xs border-collapse mb-4">
            <thead>
              <tr>
                <th colSpan={3} className="text-left p-2 border border-gray-300 bg-gray-100 uppercase">
                  {g} — {LABEL_GRUPO[g]}
                </th>
              </tr>
              <tr className="bg-gray-50 text-gray-600">
                <th className="p-1.5 border border-gray-300 w-12">Item</th>
                <th className="text-left p-1.5 border border-gray-300">Descrição do serviço de manutenção</th>
                <th className="p-1.5 border border-gray-300 w-24">Periodicidade</th>
              </tr>
            </thead>
            <tbody>
              {CHECKLISTS[g].map((item, i) => (
                <tr key={i}>
                  <td className="p-1.5 border border-gray-300 text-center">{i + 1}</td>
                  <td className="p-1.5 border border-gray-300">{item}</td>
                  <td className="p-1.5 border border-gray-300 text-center font-medium">{g}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}

        <p className="text-[10px] text-gray-500 mb-6">
          A periodicidade H (Higienização) segue a frequência definida por equipamento na tabela da seção 4
          (trimestral, semestral ou anual). As periodicidades M (Mensal), S (Semestral, meses 6 e 12) e A
          (Anual, mês 12) são fixas para todos os equipamentos do sistema. Serviços adicionais, corretivos ou
          fora do escopo programado serão executados sempre que necessário, mediante avaliação técnica.
        </p>

        {/* 6. Cronograma */}
        <h2 className="text-sm font-bold text-gray-800 mb-2">6 — CRONOGRAMA ANUAL PLANEJADO (1º CICLO)</h2>
        <table className="w-full text-xs border-collapse mb-2">
          <thead>
            <tr className="bg-gray-100 text-gray-700">
              <th className="text-left p-1.5 border border-gray-300">Equipamento</th>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((mes) => (
                <th key={mes} className="p-1.5 border border-gray-300">M{mes}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {equipamentos.map((eq) => (
              <tr key={eq.id}>
                <td className="p-1.5 border border-gray-300">
                  {eq.descricao_equipamento || '—'}
                  {eq.local && <span className="text-gray-400"> · {eq.local}</span>}
                </td>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((mes) => (
                  <td key={mes} className="p-1.5 border border-gray-300 text-center text-gray-600">
                    {gruposDoMes(mes, eq.frequencia_higienizacao).join('+')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[10px] text-gray-500 mb-8">
          Este cronograma é o planejamento do 1º ciclo (12 meses a partir de {formatDateBR(contrato.data_inicio)}).
          O acompanhamento da execução real, mês a mês, está no Relatório de Conformidade PMOC deste contrato.
        </p>

        {/* Recomendações */}
        <h2 className="text-sm font-bold text-gray-800 mb-1">
          RECOMENDAÇÕES AOS USUÁRIOS EM SITUAÇÕES DE FALHA DO EQUIPAMENTO E OUTRAS DE EMERGÊNCIA
        </h2>
        <div className="border border-gray-300 mb-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border-b border-gray-200 last:border-b-0 h-6" />
          ))}
        </div>

        {/* Considerações gerais */}
        <h2 className="text-sm font-bold text-gray-800 mb-2">CONSIDERAÇÕES GERAIS</h2>
        <ol className="list-decimal list-inside text-xs text-gray-700 space-y-1 mb-10">
          <li>As rotinas de manutenção devem ser aplicadas em conjunto e de forma complementar às recomendações do fabricante dos equipamentos.</li>
          <li>Todos os produtos utilizados na limpeza dos componentes deverão ser biodegradáveis e, quando aplicável, registrados no Ministério da Saúde.</li>
          <li>Toda verificação efetuada deverá ser seguida dos procedimentos necessários para o funcionamento correto do sistema.</li>
          <li>Em casos específicos, como condições ambientais críticas, a periodicidade de alguns serviços poderá ser reduzida para atender adequadamente ao objetivo de conservação e funcionamento dos equipamentos.</li>
          <li>Este documento não contém a identificação nominal do Responsável Técnico — a identificação (nome, registro e ART) é aposta por carimbo/assinatura na via física, quando exigível.</li>
        </ol>

        {/* Assinaturas */}
        <div className="grid grid-cols-2 gap-8 mt-12">
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
        <p className="text-[10px] text-gray-400 mt-8">Documento emitido em {formatDateBR(todayISO())}.</p>
      </div>
    </div>
  )
}
