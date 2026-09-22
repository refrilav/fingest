import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatDateBR } from '../lib/format'
import { Calendar, User, FileText, Clock } from 'lucide-react'

// Soma meses a uma data 'YYYY-MM-DD' sem usar new Date() pra exibir (convenção do projeto)
function somarMeses(dataISO, meses) {
  const [y, m, d] = dataISO.split('-').map(Number)
  const totalMeses = m - 1 + meses
  const novoAno = y + Math.floor(totalMeses / 12)
  const novoMes = (totalMeses % 12) + 1
  return `${novoAno}-${String(novoMes).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

const TIPOS_SERVICO = {
  higienizacao: { label: 'Higienização', emoji: '🧽', cor: 'bg-teal-50 text-teal-700' },
  instalacao: { label: 'Instalação', emoji: '⚙️', cor: 'bg-blue-50 text-blue-700' },
  manutencao_corretiva: { label: 'Manutenção corretiva', emoji: '🔧', cor: 'bg-amber-50 text-amber-700' },
  outro: { label: 'Serviço', emoji: '🛠️', cor: 'bg-gray-100 text-gray-600' },
}

function infoTipo(tipo) {
  return TIPOS_SERVICO[tipo] || TIPOS_SERVICO.outro
}

export default function PublicoAtivo() {
  const { id } = useParams()
  const [ativo, setAtivo] = useState(null)
  const [cliente, setCliente] = useState(null)
  const [historico, setHistorico] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [laudosPorOS, setLaudosPorOS] = useState({})

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      const [ativoRes, histRes, laudosRes] = await Promise.all([
        supabase.from('ativos').select('cliente_id, codigo, local, modelo, intervalo_meses, equipamentos(nome)').eq('id', id).single(),
        supabase
          .from('historico_ativo_publico')
          .select('*')
          .eq('ativo_id', id)
          .order('data_conclusao', { ascending: false }),
        supabase.from('laudo_ativos').select('laudo_id, laudos(ordem_servico_id)').eq('ativo_id', id),
      ])
      if (ativoRes.error) {
        setErro('Não encontramos esse equipamento.')
        setLoading(false)
        return
      }
      setAtivo(ativoRes.data)
      setHistorico(histRes.data || [])
      setLaudosPorOS(
        Object.fromEntries((laudosRes.data || []).map((v) => [v.laudos?.ordem_servico_id, v.laudo_id]))
      )

      // dados do cliente vêm de uma view pública enxuta (mesma usada no laudo) — a
      // tabela "clientes" de verdade só pode ser lida por quem está logado no sistema.
      if (ativoRes.data.cliente_id) {
        const { data: clienteData } = await supabase
          .from('clientes_publico_laudo')
          .select('nome, endereco, bairro, cidade')
          .eq('id', ativoRes.data.cliente_id)
          .maybeSingle()
        setCliente(clienteData)
      }

      setLoading(false)
    }
    carregar()
  }, [id])

  if (loading) return <p className="text-gray-400 text-sm p-6 text-center">Carregando...</p>
  if (erro) return <p className="text-red-600 text-sm p-6 text-center">{erro}</p>
  if (!ativo) return null

  if (!ativo.cliente_id) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 flex flex-col items-center justify-center text-center">
        <img src="/logo.png" alt="Refrilav" className="h-14 mb-6" />
        <div className="bg-white border border-gray-200 rounded-2xl p-6 max-w-sm">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary-50 mx-auto mb-4">
            <Clock size={22} className="text-primary-600" />
          </div>
          <p className="text-gray-800 font-medium mb-1">Este equipamento ainda está sendo cadastrado</p>
          <p className="text-sm text-gray-500">
            Em breve, ao escanear este QR Code, você poderá acompanhar aqui todo o histórico de manutenção deste
            equipamento — datas, serviços realizados e próxima higienização prevista.
          </p>
        </div>
        <p className="text-xs text-gray-400 text-center mt-6">Refrilav Assistência Técnica</p>
      </div>
    )
  }

  // "Próxima higienização" recalcula depois de Higienização ou Instalação — e também
  // depois de OS's antigas sem tipo definido (de antes dessa classificação existir).
  // Só fica de fora quando for marcado de propósito como Manutenção corretiva ou Outro.
  const ultimaRelevante = historico.find(
    (h) => !h.tipo_servico || h.tipo_servico === 'higienizacao' || h.tipo_servico === 'instalacao'
  )
  const proxima = ultimaRelevante?.data_conclusao ? somarMeses(ultimaRelevante.data_conclusao, ativo.intervalo_meses) : null

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
          {cliente?.nome && (
            <>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Cliente</p>
              <p className="text-base font-semibold text-gray-800 mb-2">
                {cliente.nome}
                {cliente.endereco ? (
                  <span className="block text-xs font-normal text-gray-500 mt-0.5">
                    {[cliente.endereco, cliente.bairro, cliente.cidade].filter(Boolean).join(', ')}
                  </span>
                ) : null}
              </p>
            </>
          )}
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

        <p className="text-sm font-semibold text-gray-700 mb-2">Histórico de manutenção</p>
        {historico.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum serviço registrado ainda.</p>
        ) : (
          <ul className="space-y-2">
            {historico.map((h, i) => {
              const tipo = infoTipo(h.tipo_servico)
              return (
                <li key={i} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${tipo.cor}`}>
                      {tipo.emoji} {tipo.label}
                    </span>
                    <p className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Calendar size={12} className="text-gray-400" />
                      {h.data_conclusao ? formatDateBR(h.data_conclusao) : '—'}
                    </p>
                  </div>
                  {h.servicos_realizados && (
                    <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{h.servicos_realizados}</p>
                  )}
                  {h.tecnico && (
                    <p className="flex items-center gap-1.5 text-xs text-gray-500 mt-1.5">
                      <User size={12} className="text-gray-400" /> {h.tecnico}
                    </p>
                  )}
                  {laudosPorOS[h.os_id] && (
                    <Link
                      to={`/laudo/${laudosPorOS[h.os_id]}/imprimir`}
                      className="flex items-center gap-1.5 text-xs text-primary-700 hover:underline mt-2"
                    >
                      <FileText size={12} /> Ver laudo de manutenção
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <p className="text-xs text-gray-400 text-center mt-6">Refrilav Assistência Técnica</p>
      </div>
    </div>
  )
}
