import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatDateBR } from '../lib/format'
import { ClipboardList, ChevronRight, AlertTriangle } from 'lucide-react'

const STATUS_LABEL = { ativo: 'Ativo', encerrado: 'Encerrado', suspenso: 'Suspenso' }
const STATUS_COR = {
  ativo: 'bg-green-100 text-green-700',
  encerrado: 'bg-gray-100 text-gray-500',
  suspenso: 'bg-amber-100 text-amber-700',
}

export default function PmocContratos() {
  const [lista, setLista] = useState([])
  const [resumos, setResumos] = useState({})
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)

  async function carregar() {
    setLoading(true)
    const { data, error } = await supabase
      .from('pmoc_contratos')
      .select('*, clientes(nome)')
      .order('created_at', { ascending: false })
      .range(0, 9999)
    if (error) {
      setErro(error.message)
      setLoading(false)
      return
    }
    setLista(data)

    const { data: resumoData } = await supabase.from('pmoc_contratos_resumo').select('*')
    const mapa = {}
    for (const r of resumoData || []) mapa[r.contrato_id] = r
    setResumos(mapa)

    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-2xl font-bold text-gray-900">PMOC — Contratos</h2>
        <Link
          to="/pmoc/propostas"
          className="flex items-center gap-1 rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700"
        >
          <ClipboardList size={16} /> Ver propostas
        </Link>
      </div>
      <p className="text-gray-500 text-sm mb-6">
        Controle de conformidade PMOC — sem RT armazenado no sistema (carimbo é feito no
        documento físico).
      </p>

      {erro && <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-2">{erro}</div>}

      {loading ? (
        <p className="text-gray-400 text-sm">Carregando...</p>
      ) : (
        <ul className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {lista.map((c) => {
            const resumo = resumos[c.id]
            return (
              <li key={c.id}>
                <Link
                  to={`/pmoc/contratos/${c.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">{c.clientes?.nome}</p>
                    <p className="text-xs text-gray-500">
                      Início: {formatDateBR(c.data_inicio)}
                      {resumo && ` · ${resumo.total_equipamentos_ativos} equipamento(s) · ${Number(resumo.capacidade_total_btu).toLocaleString('pt-BR')} BTU/h`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {resumo?.exige_rt && (
                      <span
                        title="Exige Responsável Técnico"
                        className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 rounded-full px-2 py-1"
                      >
                        <AlertTriangle size={12} /> Exige RT
                      </span>
                    )}
                    <span className={`text-xs rounded-full px-2 py-1 font-medium ${STATUS_COR[c.status]}`}>
                      {STATUS_LABEL[c.status]}
                    </span>
                    <ChevronRight size={16} className="text-gray-400" />
                  </div>
                </Link>
              </li>
            )
          })}
          {lista.length === 0 && (
            <li className="px-4 py-3 text-sm text-gray-400">
              Nenhum contrato ainda. Aprove uma proposta e converta em contrato.
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
