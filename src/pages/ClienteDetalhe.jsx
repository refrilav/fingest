import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatDateBR, formatCurrencyBRL } from '../lib/format'
import { ArrowLeft, ClipboardList, Receipt, FileText, Phone, MapPin } from 'lucide-react'

export default function ClienteDetalhe() {
  const { id } = useParams()
  const [cliente, setCliente] = useState(null)
  const [ordens, setOrdens] = useState([])
  const [lancamentos, setLancamentos] = useState([])
  const [propostas, setPropostas] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      const [clienteRes, osRes, lancRes, propRes] = await Promise.all([
        supabase.from('clientes').select('*').eq('id', id).single(),
        supabase
          .from('ordens_servico')
          .select('id, numero, status, descricao_problema, data_abertura, valor_final, equipamentos(nome)')
          .eq('cliente_id', id)
          .order('numero', { ascending: false })
          .range(0, 9999),
        supabase
          .from('lancamentos')
          .select('id, descricao, valor, valor_pago, status, data_vencimento, data_pagamento')
          .eq('cliente_id', id)
          .eq('tipo', 'receber')
          .order('data_vencimento', { ascending: false })
          .range(0, 9999),
        supabase
          .from('propostas')
          .select('id, numero, tipo, status, data_emissao, proposta_itens(quantidade, valor_unitario)')
          .eq('cliente_id', id)
          .order('numero', { ascending: false })
          .range(0, 9999),
      ])

      if (clienteRes.error) {
        setErro(clienteRes.error.message)
        setLoading(false)
        return
      }
      setCliente(clienteRes.data)
      setOrdens(osRes.data || [])
      setLancamentos(lancRes.data || [])
      setPropostas(propRes.data || [])
      setLoading(false)
    }
    carregar()
  }, [id])

  if (loading) return <p className="text-gray-400 text-sm">Carregando...</p>
  if (erro) return <div className="rounded-lg bg-red-50 text-red-700 text-sm px-4 py-2 max-w-lg">{erro}</div>
  if (!cliente) return null

  const totalRecebido = lancamentos.filter((l) => l.status === 'pago').reduce((acc, l) => acc + Number(l.valor_pago), 0)
  const totalEmAberto = lancamentos.filter((l) => l.status === 'aberto').reduce((acc, l) => acc + Number(l.valor), 0)

  return (
    <div className="max-w-4xl">
      <Link to="/clientes" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Voltar para Clientes
      </Link>

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{cliente.nome}</h2>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-600">
          {cliente.telefone && (
            <span className="flex items-center gap-1">
              <Phone size={13} /> {cliente.telefone}
            </span>
          )}
          {(cliente.endereco || cliente.bairro || cliente.cidade) && (
            <span className="flex items-center gap-1">
              <MapPin size={13} /> {[cliente.endereco, cliente.bairro, cliente.cidade].filter(Boolean).join(', ')}
            </span>
          )}
          {cliente.documento && <span>{cliente.documento}</span>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-500">Total recebido</p>
          <p className="text-lg font-bold text-green-600">{formatCurrencyBRL(totalRecebido)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-500">Em aberto</p>
          <p className="text-lg font-bold text-amber-600">{formatCurrencyBRL(totalEmAberto)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-500">Ordens de serviço</p>
          <p className="text-lg font-bold text-gray-900">{ordens.length}</p>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
          <ClipboardList size={15} /> Ordens de Serviço
        </h3>
        <ul className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {ordens.map((os) => (
            <li key={os.id} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <p className="text-sm text-gray-800">
                  <span className="text-xs font-mono text-gray-400">#{os.numero}</span> {os.descricao_problema}
                  {os.equipamentos?.nome ? ` · ${os.equipamentos.nome}` : ''}
                </p>
                <p className="text-xs text-gray-500">{formatDateBR(os.data_abertura)}</p>
              </div>
              <div className="flex items-center gap-2">
                {os.valor_final != null && <span className="text-sm text-gray-700">{formatCurrencyBRL(os.valor_final)}</span>}
                <StatusBadgeOS status={os.status} />
              </div>
            </li>
          ))}
          {ordens.length === 0 && <li className="px-4 py-3 text-sm text-gray-400">Nenhuma OS ainda.</li>}
        </ul>
      </div>

      <div className="mb-6">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
          <Receipt size={15} /> Financeiro (Contas a Receber)
        </h3>
        <ul className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {lancamentos.map((l) => (
            <li key={l.id} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <p className="text-sm text-gray-800">{l.descricao}</p>
                <p className="text-xs text-gray-500">
                  Venc: {formatDateBR(l.data_vencimento)}
                  {l.data_pagamento ? ` · Pago em ${formatDateBR(l.data_pagamento)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700">
                  {formatCurrencyBRL(l.status === 'pago' ? l.valor_pago : l.valor)}
                </span>
                <StatusBadgeLancamento status={l.status} />
              </div>
            </li>
          ))}
          {lancamentos.length === 0 && <li className="px-4 py-3 text-sm text-gray-400">Nenhum lançamento ainda.</li>}
        </ul>
      </div>

      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
          <FileText size={15} /> Orçamentos
        </h3>
        <ul className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {propostas.map((p) => {
            const total = (p.proposta_itens || []).reduce((acc, i) => acc + Number(i.quantidade) * Number(i.valor_unitario), 0)
            return (
              <li key={p.id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <p className="text-sm text-gray-800">
                    <span className="text-xs font-mono text-gray-400">#{p.numero}</span> {TIPO_LABEL[p.tipo]}
                  </p>
                  <p className="text-xs text-gray-500">{formatDateBR(p.data_emissao)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700">{formatCurrencyBRL(total)}</span>
                  <StatusBadgeProposta status={p.status} />
                </div>
              </li>
            )
          })}
          {propostas.length === 0 && <li className="px-4 py-3 text-sm text-gray-400">Nenhum orçamento ainda.</li>}
        </ul>
      </div>
    </div>
  )
}

const TIPO_LABEL = { higienizacao: 'Higienização', instalacao: 'Instalação', manutencao: 'Manutenção Corretiva' }

function StatusBadgeOS({ status }) {
  const map = {
    nao_iniciada: 'bg-gray-100 text-gray-600',
    em_andamento: 'bg-amber-100 text-amber-700',
    finalizada: 'bg-green-100 text-green-700',
    cancelada: 'bg-red-50 text-red-500',
  }
  const label = { nao_iniciada: 'Não iniciada', em_andamento: 'Em andamento', finalizada: 'Finalizada', cancelada: 'Cancelada' }
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status]}`}>{label[status]}</span>
}

function StatusBadgeLancamento({ status }) {
  const map = { aberto: 'bg-yellow-100 text-yellow-700', pago: 'bg-green-100 text-green-700', cancelado: 'bg-gray-100 text-gray-500' }
  const label = { aberto: 'Em aberto', pago: 'Pago', cancelado: 'Cancelado' }
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status]}`}>{label[status]}</span>
}

function StatusBadgeProposta({ status }) {
  const map = {
    rascunho: 'bg-gray-100 text-gray-600',
    enviado: 'bg-amber-100 text-amber-700',
    aprovado: 'bg-green-100 text-green-700',
    recusado: 'bg-red-50 text-red-500',
  }
  const label = { rascunho: 'Rascunho', enviado: 'Enviado', aprovado: 'Aprovado', recusado: 'Recusado' }
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status]}`}>{label[status]}</span>
}
