import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatDateBR } from '../lib/format'
import { Wrench, Calendar, User } from 'lucide-react'

// Soma meses a uma data 'YYYY-MM-DD' sem usar new Date() pra exibir (convenção do projeto)
function somarMeses(dataISO, meses) {
  const [y, m, d] = dataISO.split('-').map(Number)
  const totalMeses = m - 1 + meses
  const novoAno = y + Math.floor(totalMeses / 12)
  const novoMes = (totalMeses % 12) + 1
  return `${novoAno}-${String(novoMes).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export default function PublicoAtivo() {
  const { id } = useParams()
  const [ativo, setAtivo] = useState(null)
  const [historico, setHistorico] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      const [ativoRes, histRes] = await Promise.all([
        supabase.from('ativos').select('codigo, local, modelo, intervalo_meses, equipamentos(nome)').eq('id', id).single(),
        supabase
          .from('historico_ativo_publico')
          .select('*')
          .eq('ativo_id', id)
          .order('data_conclusao', { ascending: false }),
      ])
      if (ativoRes.error) {
        setErro('Não encontramos esse equipamento.')
        setLoading(false)
        return
      }
      setAtivo(ativoRes.data)
      setHistorico(histRes.data || [])
      setLoading(false)
    }
    carregar()
  }, [id])

  if (loading) return <p className="text-gray-400 text-sm p-6 text-center">Carregando...</p>
  if (erro) return <p className="text-red-600 text-sm p-6 text-center">{erro}</p>
  if (!ativo) return null

  const ultima = historico[0]
  const proxima = ultima?.data_conclusao ? somarMeses(ultima.data_conclusao, ativo.intervalo_meses) : null

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-md mx-auto">
        <div className="flex flex-col items-center mb-6">
          <img src="/logo.png" alt="Refrilav" className="h-14 mb-2" />
          <p className="text-xs text-gray-400 text-center">
            (51) 99790-6220 · Av. Independência, 2335, Santa Cruz do Sul/RS
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Equipamento</p>
          <p className="text-lg font-bold text-gray-900">{ativo.local || '(sem local)'}</p>
          <p className="text-sm text-gray-600">
            {ativo.equipamentos?.nome || ''} {ativo.modelo ? `· ${ativo.modelo}` : ''}
          </p>
          <p className="text-xs text-gray-400 mt-1">Referência REF-{ativo.codigo}</p>
        </div>

        {proxima && (
          <div className="bg-primary-50 border border-primary-200 rounded-2xl p-4 mb-4 text-center">
            <p className="text-xs text-primary-700 uppercase tracking-wide mb-0.5">Próxima higienização prevista</p>
            <p className="text-lg font-bold text-primary-800">{formatDateBR(proxima)}</p>
          </div>
        )}

        <p className="text-sm font-semibold text-gray-700 mb-2">Histórico de higienização</p>
        {historico.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhuma higienização registrada ainda.</p>
        ) : (
          <ul className="space-y-2">
            {historico.map((h, i) => (
              <li key={i} className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
                  <Calendar size={14} className="text-gray-400" />
                  {h.data_conclusao ? formatDateBR(h.data_conclusao) : '—'}
                </p>
                {h.servicos_realizados && (
                  <p className="flex items-start gap-1.5 text-sm text-gray-600 mt-1.5">
                    <Wrench size={14} className="text-gray-400 mt-0.5 shrink-0" />
                    <span className="whitespace-pre-wrap">{h.servicos_realizados}</span>
                  </p>
                )}
                {h.tecnico && (
                  <p className="flex items-center gap-1.5 text-xs text-gray-500 mt-1.5">
                    <User size={12} className="text-gray-400" /> {h.tecnico}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-gray-400 text-center mt-6">Refrilav Assistência Técnica</p>
      </div>
    </div>
  )
}
