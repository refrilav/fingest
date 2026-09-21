import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { todayISO } from '../lib/format'
import BuscaPessoa from '../components/BuscaPessoa'
import { ChevronLeft, ChevronRight, Plus, Grid3x3 } from 'lucide-react'

const HORA_INICIO_GRADE = 7 // 07:00
const HORA_FIM_GRADE = 20 // 20:00
const ALTURA_SLOT = 44 // px por 30 min
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const CORES_TIPO = {
  higienizacao: 'bg-teal-500',
  instalacao: 'bg-blue-500',
  manutencao_corretiva: 'bg-amber-500',
  outro: 'bg-gray-400',
}
const LABEL_TIPO = {
  higienizacao: 'Higienização',
  instalacao: 'Instalação',
  manutencao_corretiva: 'Manutenção corretiva',
  outro: 'Outro',
}

// Opções de duração, igual ao app de referência: 5 a 55 min de 5 em 5, depois horas
function gerarOpcoesDuracao() {
  const opcoes = []
  for (let m = 5; m < 60; m += 5) opcoes.push({ valor: m, label: `${m} min` })
  for (let m = 60; m <= 240; m += 5) {
    const h = Math.floor(m / 60)
    const resto = m % 60
    opcoes.push({ valor: m, label: resto === 0 ? `${h} h` : `${h} h ${resto} min` })
  }
  return opcoes
}
const OPCOES_DURACAO = gerarOpcoesDuracao()

// Constrói data local sem risco de fuso (evita "new Date(string)")
function dataLocal(dataISO) {
  const [y, m, d] = dataISO.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function paraISO(dateObj) {
  return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`
}
function somarDias(dataISO, dias) {
  const d = dataLocal(dataISO)
  d.setDate(d.getDate() + dias)
  return paraISO(d)
}
function inicioDaSemana(dataISO) {
  const d = dataLocal(dataISO)
  d.setDate(d.getDate() - d.getDay())
  return paraISO(d)
}
function formatDiaPill(dataISO) {
  const d = dataLocal(dataISO)
  const [, m, dia] = dataISO.split('-')
  return `${DIAS_SEMANA[d.getDay()]}, ${dia}/${m}`
}
function formatTituloData(dataISO) {
  const [y, m, d] = dataISO.split('-')
  return `${d}/${m}/${y}`
}

const CRIAR_VAZIO = {
  tipoRegistro: 'agendamento', // 'agendamento' | 'bloqueio'
  data: todayISO(),
  horaInicio: '08:00',
  duracaoMinutos: 30,
  cliente_id: '',
  tipo_servico: '',
  descricao_problema: '',
  titulo: 'Bloqueio',
  observacoes: '',
  endereco: '',
  cliente_final: '',
  mostrarMais: false,
}

export default function Agenda() {
  const navigate = useNavigate()
  const [visao, setVisao] = useState('dia') // 'dia' | 'semana'
  const [dataAtual, setDataAtual] = useState(todayISO())
  const [agendamentos, setAgendamentos] = useState([])
  const [bloqueios, setBloqueios] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)

  const [criando, setCriando] = useState(false)
  const [form, setForm] = useState(CRIAR_VAZIO)
  const [salvando, setSalvando] = useState(false)

  const inicioSemana = inicioDaSemana(dataAtual)
  const diasDaSemana = Array.from({ length: 7 }, (_, i) => somarDias(inicioSemana, i))
  const diasVisiveis = visao === 'dia' ? [dataAtual] : diasDaSemana

  async function carregar() {
    setLoading(true)
    const de = visao === 'dia' ? dataAtual : diasDaSemana[0]
    const ate = visao === 'dia' ? dataAtual : diasDaSemana[6]
    const [osRes, bloqRes] = await Promise.all([
      supabase
        .from('ordens_servico')
        .select('id, numero, descricao_problema, tipo_servico, data_agendamento, duracao_minutos, clientes(nome)')
        .not('data_agendamento', 'is', null)
        .gte('data_agendamento', `${de}T00:00`)
        .lte('data_agendamento', `${ate}T23:59`)
        .neq('status', 'cancelada'),
      supabase.from('agenda_bloqueios').select('*').gte('data', de).lte('data', ate),
    ])
    if (osRes.error) setErro(osRes.error.message)
    else setAgendamentos(osRes.data || [])
    setBloqueios(bloqRes.data || [])
    setLoading(false)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataAtual, visao])

  const slots = useMemo(() => {
    const total = (HORA_FIM_GRADE - HORA_INICIO_GRADE) * 2
    return Array.from({ length: total }, (_, i) => {
      const min = HORA_INICIO_GRADE * 60 + i * 30
      return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
    })
  }, [])

  function posicaoBloco(horaStr, duracaoMinutos) {
    const [h, m] = horaStr.split(':').map(Number)
    const minutosDoInicio = h * 60 + m - HORA_INICIO_GRADE * 60
    return {
      top: (minutosDoInicio / 30) * ALTURA_SLOT,
      height: Math.max(((duracaoMinutos || 30) / 30) * ALTURA_SLOT - 2, 20),
    }
  }

  function itensDoDia(diaISO) {
    const osDoDia = agendamentos.filter((os) => os.data_agendamento?.startsWith(diaISO))
    const bloqDoDia = bloqueios.filter((b) => b.data === diaISO)
    return { osDoDia, bloqDoDia }
  }

  function abrirCriacao(diaISO, horaStr) {
    setForm({ ...CRIAR_VAZIO, data: diaISO, horaInicio: horaStr })
    setCriando(true)
  }

  async function handleClienteSelecionado(clienteId) {
    setForm((f) => ({ ...f, cliente_id: clienteId }))
    if (!clienteId) return
    const { data } = await supabase.from('clientes').select('endereco').eq('id', clienteId).single()
    if (data?.endereco) {
      setForm((f) => (f.endereco ? f : { ...f, endereco: data.endereco, mostrarMais: true }))
    }
  }

  function fecharCriacao() {
    setCriando(false)
    setForm(CRIAR_VAZIO)
    setErro(null)
  }

  async function salvarCriacao(e) {
    e.preventDefault()
    setErro(null)

    if (form.tipoRegistro === 'bloqueio') {
      setSalvando(true)
      const { error } = await supabase.from('agenda_bloqueios').insert({
        data: form.data,
        hora_inicio: form.horaInicio,
        duracao_minutos: form.duracaoMinutos,
        titulo: form.titulo || 'Bloqueio',
        observacoes: form.observacoes || null,
      })
      setSalvando(false)
      if (error) {
        setErro(error.message)
        return
      }
      fecharCriacao()
      carregar()
      return
    }

    if (!form.cliente_id) {
      setErro('Selecione o cliente.')
      return
    }
    setSalvando(true)
    const { error } = await supabase.from('ordens_servico').insert({
      cliente_id: form.cliente_id,
      descricao_problema: form.descricao_problema.trim(),
      tipo_servico: form.tipo_servico || null,
      endereco: form.endereco || null,
      cliente_final: form.cliente_final || null,
      observacoes: form.observacoes || null,
      data_abertura: todayISO(),
      status: 'em_andamento',
      status_atual: 'Agendado',
      data_agendamento: `${form.data}T${form.horaInicio}`,
      duracao_minutos: form.duracaoMinutos,
      mostrar_problema_na_impressao: true,
    })
    setSalvando(false)
    if (error) {
      setErro(error.message)
      return
    }
    fecharCriacao()
    carregar()
  }

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setVisao('dia')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium ${visao === 'dia' ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500'}`}
          >
            Dia
          </button>
          <button
            onClick={() => setVisao('semana')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium ${visao === 'semana' ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500'}`}
          >
            Semana
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setDataAtual(somarDias(dataAtual, visao === 'dia' ? -1 : -7))}
            className="p-2 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setDataAtual(todayISO())}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            HOJE
          </button>
          <button
            onClick={() => setDataAtual(somarDias(dataAtual, visao === 'dia' ? 1 : 7))}
            className="p-2 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <p className="text-sm font-medium text-gray-700 hidden sm:block">{formatTituloData(dataAtual)}</p>

        <Link to="/menu" title="Menu" className="ml-auto p-2 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50">
          <Grid3x3 size={16} />
        </Link>
        <button
          onClick={() => abrirCriacao(dataAtual, '08:00')}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-primary-600 text-white hover:bg-primary-700"
        >
          <Plus size={18} />
        </button>
      </div>

      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        {diasDaSemana.map((dia) => (
          <button
            key={dia}
            onClick={() => setDataAtual(dia)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border ${
              dia === dataAtual
                ? 'bg-red-500 text-white border-red-500'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {formatDiaPill(dia)}
          </button>
        ))}
      </div>

      {erro && <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-2">{erro}</div>}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex">
          <div className="w-14 shrink-0 border-r border-gray-100">
            <div className="h-10 border-b border-gray-100" />
            {slots.map((s, i) => (
              <div key={s} style={{ height: ALTURA_SLOT }} className="text-[10px] text-gray-400 pl-1 pt-0.5">
                {i % 2 === 0 ? s : ''}
              </div>
            ))}
          </div>

          <div className="flex-1 flex overflow-x-auto">
            {diasVisiveis.map((diaISO) => {
              const { osDoDia, bloqDoDia } = itensDoDia(diaISO)
              return (
                <div key={diaISO} className={`relative border-r border-gray-100 ${visao === 'semana' ? 'flex-1 min-w-[110px]' : 'flex-1'}`}>
                  <div className="h-10 border-b border-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">
                    {visao === 'semana' ? formatDiaPill(diaISO) : 'Equipe'}
                  </div>

                  <div className="relative">
                    {slots.map((s) => (
                      <div
                        key={s}
                        style={{ height: ALTURA_SLOT }}
                        onClick={() => abrirCriacao(diaISO, s)}
                        className="border-b border-gray-50 hover:bg-primary-50 cursor-pointer transition-colors"
                      />
                    ))}

                    {bloqDoDia.map((b) => {
                      const pos = posicaoBloco(b.hora_inicio.substring(0, 5), b.duracao_minutos)
                      return (
                        <div
                          key={b.id}
                          style={{ top: pos.top, height: pos.height }}
                          className="absolute left-0.5 right-0.5 rounded-md bg-gray-200 bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(0,0,0,0.06)_4px,rgba(0,0,0,0.06)_8px)] px-1.5 py-0.5 text-[11px] text-gray-500 overflow-hidden"
                        >
                          {b.titulo}
                        </div>
                      )
                    })}

                    {osDoDia.map((os) => {
                      const pos = posicaoBloco(os.data_agendamento.split('T')[1]?.substring(0, 5) || '00:00', os.duracao_minutos)
                      return (
                        <button
                          key={os.id}
                          onClick={() => navigate(`/ordens-servico?abrir=${os.id}`)}
                          style={{ top: pos.top, height: pos.height }}
                          className={`absolute left-0.5 right-0.5 rounded-md ${CORES_TIPO[os.tipo_servico] || 'bg-primary-500'} text-white px-1.5 py-0.5 text-[11px] text-left overflow-hidden hover:opacity-90`}
                        >
                          <p className="font-medium truncate">{os.clientes?.nome || '(Sem cliente)'}</p>
                          {pos.height > 30 && <p className="truncate opacity-90">OS #{os.numero}</p>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {loading && <p className="text-gray-400 text-xs mt-2">Carregando...</p>}

      {criando && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50" onClick={fecharCriacao}>
          <form
            onSubmit={salvarCriacao}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Criando Atendimento</h3>
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, tipoRegistro: 'agendamento' })}
                  className={`px-3 py-1 rounded-md text-xs font-medium ${form.tipoRegistro === 'agendamento' ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500'}`}
                >
                  Agendamento
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, tipoRegistro: 'bloqueio' })}
                  className={`px-3 py-1 rounded-md text-xs font-medium ${form.tipoRegistro === 'bloqueio' ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500'}`}
                >
                  Bloqueio
                </button>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {erro && <div className="rounded-lg bg-red-50 text-red-700 text-xs px-3 py-2">{erro}</div>}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Data</label>
                  <input
                    type="date"
                    value={form.data}
                    onChange={(e) => setForm({ ...form, data: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Hora início</label>
                  <input
                    type="time"
                    value={form.horaInicio}
                    onChange={(e) => setForm({ ...form, horaInicio: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Duração</label>
                <select
                  value={form.duracaoMinutos}
                  onChange={(e) => setForm({ ...form, duracaoMinutos: Number(e.target.value) })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  {OPCOES_DURACAO.map((o) => (
                    <option key={o.valor} value={o.valor}>{o.label}</option>
                  ))}
                </select>
              </div>

              {form.tipoRegistro === 'agendamento' ? (
                <>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Cliente</label>
                    <BuscaPessoa
                      tabela="clientes"
                      value={form.cliente_id}
                      onChange={handleClienteSelecionado}
                      placeholder="Digite para buscar..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Tipo de serviço (opcional)</label>
                    <select
                      value={form.tipo_servico}
                      onChange={(e) => setForm({ ...form, tipo_servico: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="">Selecionar...</option>
                      {Object.entries(LABEL_TIPO).map(([valor, label]) => (
                        <option key={valor} value={valor}>{label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Descrição breve (opcional)</label>
                    <textarea
                      value={form.descricao_problema}
                      onChange={(e) => setForm({ ...form, descricao_problema: e.target.value })}
                      rows={2}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>

                  {!form.mostrarMais ? (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, mostrarMais: true })}
                      className="text-xs text-primary-700 hover:underline"
                    >
                      Mais campos (endereço, observações...)
                    </button>
                  ) : (
                    <div className="space-y-2 pt-1 border-t border-gray-100">
                      <input
                        placeholder="Endereço do atendimento"
                        value={form.endereco}
                        onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                      <input
                        placeholder="Cliente final (opcional — se for parceiro/intermediário)"
                        value={form.cliente_final}
                        onChange={(e) => setForm({ ...form, cliente_final: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                      <textarea
                        placeholder="Observações"
                        value={form.observacoes}
                        onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                        rows={2}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Título</label>
                    <input
                      value={form.titulo}
                      onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                      placeholder="Ex: Almoço, Compromisso pessoal"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <textarea
                    placeholder="Observações (opcional)"
                    value={form.observacoes}
                    onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </>
              )}
            </div>

            <div className="flex items-center justify-between p-4 border-t border-gray-100">
              <button type="button" onClick={fecharCriacao} className="px-4 py-2 text-sm text-gray-500">
                Fechar
              </button>
              <button
                type="submit"
                disabled={salvando}
                className="rounded-lg bg-primary-600 text-white px-5 py-2 text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
