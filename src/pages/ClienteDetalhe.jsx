import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatDateBR, formatCurrencyBRL, todayISO } from '../lib/format'
import { ArrowLeft, ClipboardList, Receipt, FileText, Phone, MapPin, DollarSign, Printer, X, Package, QrCode } from 'lucide-react'

export default function ClienteDetalhe() {
  const { id } = useParams()
  const [cliente, setCliente] = useState(null)
  const [ordens, setOrdens] = useState([])
  const [vendas, setVendas] = useState([])
  const [osPendentes, setOsPendentes] = useState([]) // OS finalizadas sem cobrança gerada
  const [vendasPendentes, setVendasPendentes] = useState([]) // Vendas sem cobrança gerada
  const [lancamentos, setLancamentos] = useState([])
  const [propostas, setPropostas] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [selecionadas, setSelecionadas] = useState(new Set()) // chaves tipo "os-<id>" ou "venda-<id>"
  const [gerando, setGerando] = useState(false)

  async function carregar() {
    setLoading(true)
    const [clienteRes, osRes, vendasRes, osPendRes, vendasPendRes, lancRes, propRes] = await Promise.all([
      supabase.from('clientes').select('*').eq('id', id).single(),
      supabase
        .from('ordens_servico')
        .select('id, numero, status, descricao_problema, data_abertura, valor_final, cliente_final, lancamento_id, equipamentos(nome)')
        .eq('cliente_id', id)
        .order('numero', { ascending: false })
        .range(0, 9999),
      supabase
        .from('vendas')
        .select('id, numero, data_venda, lancamento_id, venda_itens(quantidade, valor_unitario, nome_peca)')
        .eq('cliente_id', id)
        .order('numero', { ascending: false })
        .range(0, 9999),
      supabase
        .from('ordens_servico')
        .select('id, numero, descricao_problema, data_conclusao, valor_final, cliente_final, categoria_id, equipamento_id')
        .eq('cliente_id', id)
        .eq('status', 'finalizada')
        .is('lancamento_id', null)
        .order('numero', { ascending: true }),
      supabase
        .from('vendas')
        .select('id, numero, data_venda, venda_itens(quantidade, valor_unitario, nome_peca)')
        .eq('cliente_id', id)
        .is('lancamento_id', null)
        .order('numero', { ascending: true }),
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
    setVendas(vendasRes.data || [])
    setOsPendentes(osPendRes.data || [])
    setVendasPendentes(vendasPendRes.data || [])
    setLancamentos(lancRes.data || [])
    setPropostas(propRes.data || [])
    // já vem tudo selecionado por padrão
    setSelecionadas(
      new Set([
        ...(osPendRes.data || []).map((o) => `os-${o.id}`),
        ...(vendasPendRes.data || []).map((v) => `venda-${v.id}`),
      ])
    )
    setLoading(false)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (loading) return <p className="text-gray-400 text-sm">Carregando...</p>
  if (erro) return <div className="rounded-lg bg-red-50 text-red-700 text-sm px-4 py-2 max-w-lg">{erro}</div>
  if (!cliente) return null

  function totalVenda(v) {
    return (v.venda_itens || []).reduce((acc, i) => acc + Number(i.quantidade) * Number(i.valor_unitario), 0)
  }

  const totalRecebido = lancamentos.filter((l) => l.status === 'pago').reduce((acc, l) => acc + Number(l.valor_pago), 0)
  const totalEmAberto = lancamentos.filter((l) => l.status === 'aberto').reduce((acc, l) => acc + Number(l.valor), 0)
  const totalPendenteCobranca =
    osPendentes.reduce((acc, o) => acc + Number(o.valor_final || 0), 0) +
    vendasPendentes.reduce((acc, v) => acc + totalVenda(v), 0)
  const totalSelecionado =
    osPendentes.filter((o) => selecionadas.has(`os-${o.id}`)).reduce((acc, o) => acc + Number(o.valor_final || 0), 0) +
    vendasPendentes.filter((v) => selecionadas.has(`venda-${v.id}`)).reduce((acc, v) => acc + totalVenda(v), 0)
  const lancamentosVinculados = new Set([
    ...ordens.filter((o) => o.lancamento_id).map((o) => o.lancamento_id),
    ...vendas.filter((v) => v.lancamento_id).map((v) => v.lancamento_id),
  ])

  function alternarSelecao(chave) {
    const novas = new Set(selecionadas)
    if (novas.has(chave)) novas.delete(chave)
    else novas.add(chave)
    setSelecionadas(novas)
  }

  async function gerarCobrancaConsolidada() {
    const osSelecionadas = osPendentes.filter((o) => selecionadas.has(`os-${o.id}`))
    const vendasSelecionadas = vendasPendentes.filter((v) => selecionadas.has(`venda-${v.id}`))

    if (osSelecionadas.length === 0 && vendasSelecionadas.length === 0) {
      setErro('Selecione pelo menos uma OS ou venda para gerar a cobrança.')
      return
    }
    setGerando(true)
    setErro(null)

    const valorTotal =
      osSelecionadas.reduce((acc, o) => acc + Number(o.valor_final || 0), 0) +
      vendasSelecionadas.reduce((acc, v) => acc + totalVenda(v), 0)

    const refsOS = osSelecionadas.map((o) => `OS #${o.numero}`)
    const refsVendas = vendasSelecionadas.map((v) => `Venda #${v.numero}`)
    const referencias = [...refsOS, ...refsVendas].join(', ')
    const hoje = todayISO()

    const { data: novoLancamento, error: erroLancamento } = await supabase
      .from('lancamentos')
      .insert({
        tipo: 'receber',
        descricao: `Cobrança consolidada — ${referencias}`.substring(0, 250),
        valor: valorTotal,
        data_vencimento: hoje,
        data_competencia: hoje,
        cliente_id: id,
        categoria_id: osSelecionadas[0]?.categoria_id || null,
        observacoes: `Cobrança consolidada gerada a partir de: ${referencias}.`,
      })
      .select()
      .single()

    if (erroLancamento) {
      setErro(erroLancamento.message)
      setGerando(false)
      return
    }

    if (osSelecionadas.length > 0) {
      const { error: erroOS } = await supabase
        .from('ordens_servico')
        .update({ lancamento_id: novoLancamento.id })
        .in('id', osSelecionadas.map((o) => o.id))
      if (erroOS) {
        setErro(erroOS.message)
        setGerando(false)
        return
      }
    }

    if (vendasSelecionadas.length > 0) {
      const { error: erroVendas } = await supabase
        .from('vendas')
        .update({ lancamento_id: novoLancamento.id })
        .in('id', vendasSelecionadas.map((v) => v.id))
      if (erroVendas) {
        setErro(erroVendas.message)
        setGerando(false)
        return
      }
    }

    setGerando(false)
    carregar()
  }

  async function cancelarCobranca(lancamentoId) {
    if (
      !confirm(
        'Cancelar esta cobrança? As OS\'s/vendas vinculadas voltam pra lista "aguardando cobrança" e você pode gerar uma nova depois.'
      )
    )
      return

    setErro(null)

    const [{ error: erroOS }, { error: erroVendas }] = await Promise.all([
      supabase.from('ordens_servico').update({ lancamento_id: null }).eq('lancamento_id', lancamentoId),
      supabase.from('vendas').update({ lancamento_id: null }).eq('lancamento_id', lancamentoId),
    ])

    if (erroOS || erroVendas) {
      setErro((erroOS || erroVendas).message)
      return
    }

    const { error: erroLancamento } = await supabase
      .from('lancamentos')
      .update({ status: 'cancelado' })
      .eq('id', lancamentoId)

    if (erroLancamento) {
      setErro(erroLancamento.message)
      return
    }

    carregar()
  }

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
        <Link
          to={`/clientes/${id}/ativos`}
          className="inline-flex items-center gap-1.5 mt-3 text-sm text-primary-700 hover:underline"
        >
          <QrCode size={15} /> Equipamentos com QR Code
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-500">Total recebido</p>
          <p className="text-lg font-bold text-green-600">{formatCurrencyBRL(totalRecebido)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-500">Em aberto</p>
          <p className="text-lg font-bold text-amber-600">{formatCurrencyBRL(totalEmAberto)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-500">Aguardando cobrança</p>
          <p className="text-lg font-bold text-blue-600">{formatCurrencyBRL(totalPendenteCobranca)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-500">Ordens de serviço</p>
          <p className="text-lg font-bold text-gray-900">{ordens.length}</p>
        </div>
      </div>

      {erro && <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-2">{erro}</div>}

      {(osPendentes.length > 0 || vendasPendentes.length > 0) && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-blue-900 mb-1">
            <DollarSign size={15} /> OS's e vendas aguardando cobrança
          </h3>
          <p className="text-xs text-blue-700 mb-3">
            Marque o que você quer juntar numa única cobrança agora (por padrão tudo já vem marcado).
          </p>
          <ul className="space-y-1 mb-3">
            {osPendentes.map((o) => (
              <li key={`os-${o.id}`} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={selecionadas.has(`os-${o.id}`)}
                  onChange={() => alternarSelecao(`os-${o.id}`)}
                  className="shrink-0"
                />
                <span className="flex-1 text-gray-700">
                  <span className="text-xs font-mono text-gray-400">OS #{o.numero}</span> {o.descricao_problema}
                  {o.cliente_final ? ` · Cliente final: ${o.cliente_final}` : ''}
                  <span className="block text-xs text-gray-400">
                    Concluída em {o.data_conclusao ? formatDateBR(o.data_conclusao) : '—'}
                  </span>
                </span>
                <span className="font-medium text-gray-800">{formatCurrencyBRL(o.valor_final)}</span>
              </li>
            ))}
            {vendasPendentes.map((v) => (
              <li key={`venda-${v.id}`} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={selecionadas.has(`venda-${v.id}`)}
                  onChange={() => alternarSelecao(`venda-${v.id}`)}
                  className="shrink-0"
                />
                <span className="flex-1 text-gray-700">
                  <span className="text-xs font-mono text-gray-400">Venda #{v.numero}</span>{' '}
                  {(v.venda_itens || []).map((i) => i.nome_peca).join(', ')}
                  <span className="block text-xs text-gray-400">{formatDateBR(v.data_venda)}</span>
                </span>
                <span className="font-medium text-gray-800">{formatCurrencyBRL(totalVenda(v))}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between">
            <p className="text-sm text-blue-900">
              Total selecionado: <strong>{formatCurrencyBRL(totalSelecionado)}</strong>
            </p>
            <button
              onClick={gerarCobrancaConsolidada}
              disabled={gerando || selecionadas.size === 0}
              className="flex items-center gap-1 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              <Receipt size={15} /> {gerando ? 'Gerando...' : 'Gerar cobrança consolidada'}
            </button>
          </div>
        </div>
      )}

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
                <p className="text-xs text-gray-500">
                  {formatDateBR(os.data_abertura)}
                  {os.cliente_final ? ` · Cliente final: ${os.cliente_final}` : ''}
                </p>
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

      {vendas.length > 0 && (
        <div className="mb-6">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
            <Package size={15} /> Vendas de Peças
          </h3>
          <ul className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
            {vendas.map((v) => (
              <li key={v.id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <p className="text-sm text-gray-800">
                    <span className="text-xs font-mono text-gray-400">#{v.numero}</span>{' '}
                    {(v.venda_itens || []).map((i) => i.nome_peca).join(', ')}
                  </p>
                  <p className="text-xs text-gray-500">{formatDateBR(v.data_venda)}</p>
                </div>
                <span className="text-sm text-gray-700">{formatCurrencyBRL(totalVenda(v))}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

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
                {lancamentosVinculados.has(l.id) && (
                  <Link
                    to={`/cobranca/${l.id}/imprimir`}
                    title="Ver relatório das OS's/vendas incluídas"
                    className="text-gray-400 hover:text-primary-600 p-1 rounded"
                  >
                    <Printer size={15} />
                  </Link>
                )}
                {lancamentosVinculados.has(l.id) && l.status === 'aberto' && (
                  <button
                    onClick={() => cancelarCobranca(l.id)}
                    title="Cancelar esta cobrança e liberar as OS's/vendas pra gerar de novo"
                    className="text-gray-400 hover:text-red-600 p-1 rounded"
                  >
                    <X size={15} />
                  </button>
                )}
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
