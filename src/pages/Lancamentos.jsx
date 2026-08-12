import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { formatDateBR, formatCurrencyBRL, todayISO, isOverdue, addMonthsISO, getRangeMes, mesAtualISO } from '../lib/format'
import { Plus, Trash2, CheckCircle2, X, Repeat, Pencil, Download, Search, BarChart3, Receipt } from 'lucide-react'
import BuscaPessoa from '../components/BuscaPessoa'
import SelectCategoria from '../components/SelectCategoria'

const CAMPOS_VAZIOS = {
  descricao: '',
  valor: '',
  data_vencimento: todayISO(),
  data_competencia: todayISO(),
  categoria_id: '',
  centro_custo_id: '',
  fornecedor_id: '',
  cliente_id: '',
  equipamento_id: '',
  observacoes: '',
  forma_pagamento: '',
  desconto: '',
  juros: '',
  repeticao: 'unico', // 'unico' | 'parcelado' | 'recorrente'
  quantidade: '2',
  conta_bancaria_id: '',
  data_pagamento: '',
}

// tipo: 'pagar' | 'receber'
export default function Lancamentos({ tipo }) {
  const [lista, setLista] = useState([])
  const [categorias, setCategorias] = useState([])
  const [centros, setCentros] = useState([])
  const [equipamentos, setEquipamentos] = useState([])
  const [contasBancarias, setContasBancarias] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [form, setForm] = useState(CAMPOS_VAZIOS)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [periodo, setPeriodo] = useState(mesAtualISO()) // 'YYYY-MM' ou 'todos'
  const [busca, setBusca] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('todas')
  const [pagandoId, setPagandoId] = useState(null)
  const [renegociandoId, setRenegociandoId] = useState(null)
  const [renegociarForm, setRenegociarForm] = useState({ quantidade: '2', dataPrimeira: todayISO() })
  const [contaEscolhida, setContaEscolhida] = useState('')
  const [pagamentoForm, setPagamentoForm] = useState({ forma: 'Pix', parcelas: '1', desconto: '', taxaPercentual: '' })
  const [editandoId, setEditandoId] = useState(null)

  const tabelaPessoa = tipo === 'pagar' ? 'fornecedores' : 'clientes'
  const campoPessoa = tipo === 'pagar' ? 'fornecedor_id' : 'cliente_id'
  const tipoCategoria = tipo === 'pagar' ? 'despesa' : 'receita'
  const titulo = tipo === 'pagar' ? 'Contas a Pagar' : 'Contas a Receber'

  async function carregar() {
    setLoading(true)
    const [lanc, cats, cent, equips, contas] = await Promise.all([
      supabase
        .from('lancamentos')
        .select('*, categorias(nome), centros_de_custo(nome), fornecedores(nome), clientes(nome), equipamentos(nome), contas_bancarias(nome)')
        .eq('tipo', tipo)
        .order('data_vencimento')
        .range(0, 9999),
      supabase.from('categorias').select('*').eq('tipo', tipoCategoria).eq('ativo', true).order('nome').range(0, 9999),
      supabase.from('centros_de_custo').select('*').eq('ativo', true).order('nome').range(0, 9999),
      tipo === 'receber'
        ? supabase.from('equipamentos').select('*').eq('ativo', true).order('nome').range(0, 9999)
        : Promise.resolve({ data: [] }),
      supabase.from('contas_bancarias').select('*').eq('ativo', true).order('nome').range(0, 9999),
    ])

    if (lanc.error) setErro(lanc.error.message)
    else setLista(lanc.data)
    setCategorias(cats.data || [])
    setCentros(cent.data || [])
    setEquipamentos(equips.data || [])
    setContasBancarias(contas.data || [])
    setLoading(false)
  }

  useEffect(() => {
    carregar()
    setForm(CAMPOS_VAZIOS)
    setMostrarForm(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo])

  async function salvar(e) {
    e.preventDefault()
    if (!form.descricao.trim() || !form.valor || !form.data_vencimento) return

    // Modo edição: atualiza um único lançamento existente, sem lógica de parcelamento
    if (editandoId) {
      const desconto = Number(form.desconto) || 0
      const juros = Number(form.juros) || 0
      const valor = Number(form.valor)

      const payload = {
        descricao: form.descricao.trim(),
        valor,
        desconto,
        juros,
        data_vencimento: form.data_vencimento,
        data_competencia: form.data_competencia || form.data_vencimento,
        categoria_id: form.categoria_id || null,
        centro_custo_id: form.centro_custo_id || null,
        [campoPessoa]: form[campoPessoa] || null,
        equipamento_id: tipo === 'receber' ? form.equipamento_id || null : null,
        observacoes: form.observacoes || null,
        forma_pagamento: form.forma_pagamento || null,
      }

      // Se o lançamento já está pago, permite editar também dados do pagamento
      const itemOriginal = lista.find((l) => l.id === editandoId)
      if (itemOriginal?.status === 'pago') {
        payload.valor_pago = valor - desconto + juros
        payload.data_pagamento = form.data_pagamento || itemOriginal.data_pagamento
        payload.conta_bancaria_id = form.conta_bancaria_id || null
      }

      const { error } = await supabase.from('lancamentos').update(payload).eq('id', editandoId)
      if (error) {
        setErro(error.message)
        return
      }
      setForm(CAMPOS_VAZIOS)
      setEditandoId(null)
      setMostrarForm(false)
      carregar()
      return
    }

    const basePayload = {
      tipo,
      categoria_id: form.categoria_id || null,
      centro_custo_id: form.centro_custo_id || null,
      [campoPessoa]: form[campoPessoa] || null,
      equipamento_id: tipo === 'receber' ? form.equipamento_id || null : null,
      observacoes: form.observacoes || null,
      forma_pagamento: form.forma_pagamento || null,
    }

    let linhas = []

    if (form.repeticao === 'unico') {
      linhas = [
        {
          ...basePayload,
          descricao: form.descricao.trim(),
          valor: Number(form.valor),
          desconto: Number(form.desconto) || 0,
          juros: Number(form.juros) || 0,
          data_vencimento: form.data_vencimento,
          data_competencia: form.data_competencia || form.data_vencimento,
        },
      ]
    } else if (form.repeticao === 'parcelado') {
      // "valor" é o TOTAL, dividido igualmente entre as parcelas.
      // A última parcela absorve a diferença de arredondamento dos centavos.
      const totalParcelas = Math.max(2, Number(form.quantidade) || 2)
      const valorTotal = Number(form.valor)
      const valorParcela = Math.floor((valorTotal / totalParcelas) * 100) / 100
      const somaParcelas = valorParcela * (totalParcelas - 1)
      const grupoId = crypto.randomUUID()

      for (let i = 0; i < totalParcelas; i++) {
        const valorDaVez = i === totalParcelas - 1 ? Number((valorTotal - somaParcelas).toFixed(2)) : valorParcela
        const vencimento = addMonthsISO(form.data_vencimento, i)
        linhas.push({
          ...basePayload,
          descricao: `${form.descricao.trim()} (${i + 1}/${totalParcelas})`,
          valor: valorDaVez,
          desconto: 0,
          data_vencimento: vencimento,
          data_competencia: vencimento,
          grupo_id: grupoId,
          numero_parcela: i + 1,
          total_parcelas: totalParcelas,
        })
      }
    } else if (form.repeticao === 'recorrente') {
      // "valor" se repete integralmente em cada ocorrência (ex: aluguel mensal)
      const quantidade = Math.max(2, Number(form.quantidade) || 2)
      const grupoId = crypto.randomUUID()

      for (let i = 0; i < quantidade; i++) {
        const vencimento = addMonthsISO(form.data_vencimento, i)
        linhas.push({
          ...basePayload,
          descricao: `${form.descricao.trim()} (${i + 1}/${quantidade})`,
          valor: Number(form.valor),
          desconto: Number(form.desconto) || 0,
          data_vencimento: vencimento,
          data_competencia: vencimento,
          recorrente: true,
          grupo_id: grupoId,
          numero_parcela: i + 1,
          total_parcelas: quantidade,
        })
      }
    }

    const { error } = await supabase.from('lancamentos').insert(linhas)
    if (error) {
      setErro(error.message)
      return
    }
    setForm(CAMPOS_VAZIOS)
    setMostrarForm(false)
    carregar()
  }

  function iniciarEdicao(item) {
    setForm({
      descricao: item.descricao || '',
      valor: String(item.valor ?? ''),
      data_vencimento: (item.data_vencimento || '').substring(0, 10),
      data_competencia: (item.data_competencia || item.data_vencimento || '').substring(0, 10),
      categoria_id: item.categoria_id || '',
      centro_custo_id: item.centro_custo_id || '',
      fornecedor_id: item.fornecedor_id || '',
      cliente_id: item.cliente_id || '',
      equipamento_id: item.equipamento_id || '',
      observacoes: item.observacoes || '',
      forma_pagamento: item.forma_pagamento || '',
      desconto: String(item.desconto ?? '0'),
      juros: String(item.juros ?? '0'),
      repeticao: 'unico',
      quantidade: '2',
      conta_bancaria_id: item.conta_bancaria_id || '',
      data_pagamento: (item.data_pagamento || '').substring(0, 10),
    })
    setEditandoId(item.id)
    setMostrarForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelarFormulario() {
    setForm(CAMPOS_VAZIOS)
    setEditandoId(null)
    setMostrarForm(false)
  }

  const FORMAS_PAGAMENTO_BAIXA = ['Pix', 'Dinheiro', 'Cartão de Débito', 'Cartão de Crédito', 'Boleto', 'Transferência', 'Outro']

  function abrirPagamento(item) {
    setPagandoId(item.id)
    setContaEscolhida(contasBancarias.length > 0 ? contasBancarias[0].id : '')
    setPagamentoForm({
      forma: item.forma_pagamento || 'Pix',
      parcelas: '1',
      desconto: '',
      taxaPercentual: '',
      tipoBaixa: 'total',
      valorParcial: '',
      dataPagamento: todayISO(),
    })
  }

  function calcularValorPago(item) {
    const valorBase = pagamentoForm.tipoBaixa === 'parcial' ? Number(pagamentoForm.valorParcial) || 0 : Number(item.valor)
    const desconto = Number(pagamentoForm.desconto) || 0
    const juros = pagamentoForm.tipoBaixa === 'parcial' ? 0 : Number(item.juros) || 0
    const ehCartao = pagamentoForm.forma === 'Cartão de Crédito' || pagamentoForm.forma === 'Cartão de Débito'
    const taxaValor = ehCartao ? valorBase * ((Number(pagamentoForm.taxaPercentual) || 0) / 100) : 0
    return { valorBase, valorPago: valorBase - desconto - taxaValor + juros, taxaValor, desconto, ehCartao }
  }

  async function confirmarPagamento(item) {
    if (!contaEscolhida) {
      setErro('Selecione de qual conta saiu/entrou o valor.')
      return
    }
    const { valorBase, valorPago, taxaValor, desconto, ehCartao } = calcularValorPago(item)

    if (pagamentoForm.tipoBaixa === 'parcial') {
      if (!valorBase || valorBase <= 0 || valorBase >= Number(item.valor)) {
        setErro('O valor parcial precisa ser maior que zero e menor que o valor total do lançamento.')
        return
      }

      // 1. registra o valor recebido agora como um lançamento pago à parte
      const { error: erroParcial } = await supabase.from('lancamentos').insert({
        tipo,
        descricao: `${item.descricao} (parcial)`,
        valor: valorBase,
        valor_pago: valorPago,
        status: 'pago',
        data_vencimento: item.data_vencimento,
        data_pagamento: pagamentoForm.dataPagamento || todayISO(),
        data_competencia: item.data_competencia,
        categoria_id: item.categoria_id,
        centro_custo_id: item.centro_custo_id,
        equipamento_id: item.equipamento_id,
        [campoPessoa]: item[campoPessoa],
        conta_bancaria_id: contaEscolhida,
        forma_pagamento: pagamentoForm.forma,
        desconto,
        parcelas_cartao: pagamentoForm.forma === 'Cartão de Crédito' ? Number(pagamentoForm.parcelas) || 1 : null,
        taxa_cartao_percentual: ehCartao ? Number(pagamentoForm.taxaPercentual) || 0 : null,
        taxa_cartao_valor: ehCartao ? taxaValor : null,
        observacoes: `Pagamento parcial referente a "${item.descricao}".`,
      })
      if (erroParcial) {
        setErro(erroParcial.message)
        return
      }

      // 2. o lançamento original passa a representar só o saldo restante
      const restante = Number((Number(item.valor) - valorBase).toFixed(2))
      const { error: erroRestante } = await supabase.from('lancamentos').update({ valor: restante }).eq('id', item.id)
      if (erroRestante) {
        setErro(erroRestante.message)
        return
      }
    } else {
      const { error } = await supabase
        .from('lancamentos')
        .update({
          status: 'pago',
          valor_pago: valorPago,
          data_pagamento: pagamentoForm.dataPagamento || todayISO(),
          conta_bancaria_id: contaEscolhida,
          forma_pagamento: pagamentoForm.forma,
          desconto,
          parcelas_cartao: pagamentoForm.forma === 'Cartão de Crédito' ? Number(pagamentoForm.parcelas) || 1 : null,
          taxa_cartao_percentual: ehCartao ? Number(pagamentoForm.taxaPercentual) || 0 : null,
          taxa_cartao_valor: ehCartao ? taxaValor : null,
        })
        .eq('id', item.id)
      if (error) {
        setErro(error.message)
        return
      }
    }
    setPagandoId(null)
    carregar()
  }

  function abrirRenegociacao(item) {
    setRenegociandoId(item.id)
    setRenegociarForm({ quantidade: '2', dataPrimeira: todayISO() })
  }

  async function confirmarRenegociacao(item) {
    const totalParcelas = Math.max(2, Number(renegociarForm.quantidade) || 2)
    const valorTotal = Number(item.valor)
    const valorParcela = Math.floor((valorTotal / totalParcelas) * 100) / 100
    const somaParcelas = valorParcela * (totalParcelas - 1)
    const grupoId = crypto.randomUUID()

    const linhas = []
    for (let i = 0; i < totalParcelas; i++) {
      const valorDaVez = i === totalParcelas - 1 ? Number((valorTotal - somaParcelas).toFixed(2)) : valorParcela
      const vencimento = addMonthsISO(renegociarForm.dataPrimeira, i)
      linhas.push({
        tipo,
        descricao: `${item.descricao} (renegociado ${i + 1}/${totalParcelas})`,
        valor: valorDaVez,
        data_vencimento: vencimento,
        data_competencia: vencimento,
        categoria_id: item.categoria_id,
        centro_custo_id: item.centro_custo_id,
        equipamento_id: item.equipamento_id,
        [campoPessoa]: item[campoPessoa],
        grupo_id: grupoId,
        numero_parcela: i + 1,
        total_parcelas: totalParcelas,
        observacoes: `Renegociação do lançamento original: "${item.descricao}".`,
      })
    }

    const { error: erroInsert } = await supabase.from('lancamentos').insert(linhas)
    if (erroInsert) {
      setErro(erroInsert.message)
      return
    }

    const { error: erroOriginal } = await supabase
      .from('lancamentos')
      .update({
        status: 'cancelado',
        observacoes: `${item.observacoes ? item.observacoes + ' ' : ''}Renegociado em ${totalParcelas}x.`,
      })
      .eq('id', item.id)
    if (erroOriginal) {
      setErro(erroOriginal.message)
      return
    }

    setRenegociandoId(null)
    carregar()
  }

  async function cancelar(item) {
    if (!confirm('Cancelar este lançamento?')) return
    const { error } = await supabase.from('lancamentos').update({ status: 'cancelado' }).eq('id', item.id)
    if (error) {
      setErro(error.message)
      return
    }
    carregar()
  }

  async function excluir(id) {
    if (!confirm('Excluir permanentemente este lançamento?')) return
    const { error } = await supabase.from('lancamentos').delete().eq('id', id)
    if (error) {
      setErro(error.message)
      return
    }
    carregar()
  }

  const listaFiltrada = lista.filter((item) => {
    if (periodo !== 'todos') {
      const { inicio, fim } = getRangeMes(periodo)
      const venc = (item.data_vencimento || '').substring(0, 10)
      if (venc < inicio || venc > fim) return false
    }
    if (filtroStatus === 'vencido') {
      if (!(item.status === 'aberto' && isOverdue(item.data_vencimento))) return false
    } else if (filtroStatus !== 'todos' && item.status !== filtroStatus) {
      return false
    }
    if (filtroCategoria !== 'todas') {
      const catId = item.categoria_id || 'sem_categoria'
      if (catId !== filtroCategoria) return false
    }
    if (busca.trim()) {
      const termo = busca.trim().toLowerCase()
      const pessoaNome = (tipo === 'pagar' ? item.fornecedores?.nome : item.clientes?.nome) || ''
      const alvo = [item.descricao, item.categorias?.nome, pessoaNome, item.observacoes, item.equipamentos?.nome]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!alvo.includes(termo)) return false
    }
    return true
  })

  const totalFiltrado = listaFiltrada.reduce(
    (acc, i) => acc + (i.status === 'pago' ? Number(i.valor_pago) : Number(i.valor)),
    0
  )

  // Resumo de totais por categoria, considerando o mesmo filtro de status/período/busca
  // (mas ignorando o próprio filtro de categoria, pra sempre mostrar todas as opções)
  const listaParaResumo = lista.filter((item) => {
    if (periodo !== 'todos') {
      const { inicio, fim } = getRangeMes(periodo)
      const venc = (item.data_vencimento || '').substring(0, 10)
      if (venc < inicio || venc > fim) return false
    }
    if (filtroStatus === 'vencido') {
      if (!(item.status === 'aberto' && isOverdue(item.data_vencimento))) return false
    } else if (filtroStatus !== 'todos' && item.status !== filtroStatus) {
      return false
    }
    if (busca.trim()) {
      const termo = busca.trim().toLowerCase()
      const pessoaNome = (tipo === 'pagar' ? item.fornecedores?.nome : item.clientes?.nome) || ''
      const alvo = [item.descricao, item.categorias?.nome, pessoaNome, item.observacoes, item.equipamentos?.nome]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!alvo.includes(termo)) return false
    }
    return true
  })

  const resumoPorCategoria = {}
  for (const item of listaParaResumo) {
    const catId = item.categoria_id || 'sem_categoria'
    const catNome = item.categorias?.nome || '(Sem categoria)'
    const valor = item.status === 'pago' ? Number(item.valor_pago) : Number(item.valor)
    if (!resumoPorCategoria[catId]) resumoPorCategoria[catId] = { nome: catNome, total: 0, quantidade: 0 }
    resumoPorCategoria[catId].total += valor
    resumoPorCategoria[catId].quantidade += 1
  }
  const resumoOrdenado = Object.entries(resumoPorCategoria)
    .map(([id, dados]) => ({ id, ...dados }))
    .sort((a, b) => b.total - a.total)
  const totalGeralResumo = resumoOrdenado.reduce((acc, r) => acc + r.total, 0)

  const itemEditando = editandoId ? lista.find((l) => l.id === editandoId) : null
  const editandoItemPago = itemEditando?.status === 'pago'

  function exportarExcel() {
    const linhas = [
      [
        'Descrição',
        'Categoria',
        'Centro de Custo',
        tipo === 'pagar' ? 'Fornecedor' : 'Cliente',
        'Equipamento',
        'Vencimento',
        'Competência',
        'Pagamento',
        'Valor',
        'Desconto',
        'Juros/Multa',
        'Valor Pago',
        'Status',
        'Forma de Pagamento',
        'Conta Bancária',
        'Parcela',
        'Recorrente',
        'Observações',
      ],
    ]
    listaFiltrada.forEach((item) => {
      const pessoaNome = tipo === 'pagar' ? item.fornecedores?.nome : item.clientes?.nome
      linhas.push([
        item.descricao,
        item.categorias?.nome || '',
        item.centros_de_custo?.nome || '',
        pessoaNome || '',
        item.equipamentos?.nome || '',
        formatDateBR(item.data_vencimento),
        item.data_competencia ? formatDateBR(item.data_competencia) : '',
        item.data_pagamento ? formatDateBR(item.data_pagamento) : '',
        Number(item.valor),
        Number(item.desconto) || 0,
        Number(item.juros) || 0,
        item.status === 'pago' ? Number(item.valor_pago) : '',
        item.status,
        item.forma_pagamento || '',
        item.contas_bancarias?.nome || '',
        item.total_parcelas ? `${item.numero_parcela}/${item.total_parcelas}` : '',
        item.recorrente ? 'Sim' : 'Não',
        item.observacoes || '',
      ])
    })
    linhas.push([])
    linhas.push(['Total geral', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', totalFiltrado])
    linhas.push([])
    linhas.push(['Resumo por categoria'])
    resumoOrdenado.forEach((r) => {
      linhas.push([r.nome, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', r.total, `${r.quantidade} lançamento(s)`])
    })

    const ws = XLSX.utils.aoa_to_sheet(linhas)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, titulo)
    XLSX.writeFile(wb, `${titulo.replace(/\s+/g, '_')}.xlsx`)
  }

  return (
    <div className="max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1 gap-2">
        <h2 className="text-2xl font-bold text-gray-900">{titulo}</h2>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button
            onClick={exportarExcel}
            className="flex items-center gap-1 rounded-lg bg-gray-100 text-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-200"
          >
            <Download size={16} /> Exportar Excel
          </button>
          <button
            onClick={() => {
              if (mostrarForm) {
                cancelarFormulario()
              } else {
                setForm(CAMPOS_VAZIOS)
                setMostrarForm(true)
              }
            }}
            className="flex items-center gap-1 rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700"
          >
            <Plus size={16} /> Novo lançamento
          </button>
        </div>
      </div>
      <p className="text-gray-500 text-sm mb-4">
        Total {filtroStatus === 'todos' ? '' : `(${filtroStatus})`}:{' '}
        <span className="font-semibold text-gray-700">{formatCurrencyBRL(totalFiltrado)}</span>
      </p>

      {erro && <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-2">{erro}</div>}

      {mostrarForm && (
        <form onSubmit={salvar} className="bg-white border border-gray-200 rounded-lg p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {editandoId && (
            <p className="col-span-1 sm:col-span-2 text-sm font-medium text-primary-700 -mb-1">Editando lançamento</p>
          )}
          <input
            placeholder="Descrição *"
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            className="col-span-1 sm:col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            required
          />

          {!editandoId && (
            <div className="col-span-1 sm:col-span-2 flex gap-2 bg-gray-50 rounded-lg p-1">
              {[
                { valor: 'unico', label: 'Único' },
                { valor: 'parcelado', label: 'Parcelado' },
                { valor: 'recorrente', label: 'Recorrente' },
              ].map((opt) => (
                <button
                  key={opt.valor}
                  type="button"
                  onClick={() => setForm({ ...form, repeticao: opt.valor })}
                  className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                    form.repeticao === opt.valor ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          <input
            type="number"
            step="0.01"
            placeholder={form.repeticao === 'parcelado' ? 'Valor total *' : 'Valor *'}
            value={form.valor}
            onChange={(e) => setForm({ ...form, valor: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            required
          />

          <input
            type="date"
            value={form.data_vencimento}
            onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            required
          />

          {form.repeticao !== 'unico' && (
            <input
              type="number"
              min="2"
              max="60"
              placeholder={form.repeticao === 'parcelado' ? 'Nº de parcelas' : 'Repetir por quantos meses'}
              value={form.quantidade}
              onChange={(e) => setForm({ ...form, quantidade: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              required
            />
          )}

          {form.repeticao !== 'unico' && (
            <div className="col-span-1 sm:col-span-2 flex items-center gap-2 text-xs text-gray-500 bg-primary-50 rounded-lg px-3 py-2">
              <Repeat size={14} className="text-primary-600 shrink-0" />
              {form.repeticao === 'parcelado' ? (
                <span>
                  1ª parcela vence em <strong>{form.data_vencimento.split('-').reverse().join('/')}</strong>, as demais
                  mensalmente. Valor de cada parcela: {' '}
                  <strong>
                    {form.valor && form.quantidade
                      ? formatCurrencyBRL(Number(form.valor) / Math.max(2, Number(form.quantidade) || 2))
                      : '—'}
                  </strong>
                </span>
              ) : (
                <span>
                  1ª ocorrência em <strong>{form.data_vencimento.split('-').reverse().join('/')}</strong>, repetindo o
                  mesmo valor mensalmente por <strong>{form.quantidade || '—'}</strong> vezes.
                </span>
              )}
            </div>
          )}
          <SelectCategoria
            tipo={tipoCategoria}
            categorias={categorias}
            value={form.categoria_id}
            onChange={(id) => setForm({ ...form, categoria_id: id })}
            onCriada={(nova) => {
              setCategorias((prev) => [...prev, nova].sort((a, b) => a.nome.localeCompare(b.nome)))
              setForm((f) => ({ ...f, categoria_id: nova.id }))
            }}
          />
          <select
            value={form.centro_custo_id}
            onChange={(e) => setForm({ ...form, centro_custo_id: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Centro de custo...</option>
            {centros.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
          <BuscaPessoa
            tabela={tabelaPessoa}
            value={form[campoPessoa]}
            onChange={(id) => setForm({ ...form, [campoPessoa]: id })}
            placeholder={tipo === 'pagar' ? 'Buscar fornecedor por nome...' : 'Buscar cliente por nome...'}
          />
          {tipo === 'receber' && (
            <select
              value={form.equipamento_id}
              onChange={(e) => setForm({ ...form, equipamento_id: e.target.value })}
              className="col-span-1 sm:col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Equipamento...</option>
              {equipamentos.map((eq) => (
                <option key={eq.id} value={eq.id}>{eq.nome}</option>
              ))}
            </select>
          )}
          <input
            placeholder={tipo === 'pagar' ? 'Forma de pagamento (Pix, Boleto...)' : 'Forma de recebimento (Pix, Dinheiro...)'}
            value={form.forma_pagamento}
            onChange={(e) => setForm({ ...form, forma_pagamento: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Desconto (opcional)"
            value={form.desconto}
            onChange={(e) => setForm({ ...form, desconto: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Juros/multa (opcional)"
            value={form.juros}
            onChange={(e) => setForm({ ...form, juros: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />

          {editandoItemPago && (
            <>
              <div className="col-span-1 sm:col-span-2 text-xs text-gray-500 -mb-2 mt-1">Dados do pagamento</div>
              <select
                value={form.conta_bancaria_id}
                onChange={(e) => setForm({ ...form, conta_bancaria_id: e.target.value })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">{tipo === 'pagar' ? 'Saiu de...' : 'Entrou em...'}</option>
                {contasBancarias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
              <input
                type="date"
                value={form.data_pagamento}
                onChange={(e) => setForm({ ...form, data_pagamento: e.target.value })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </>
          )}
          <textarea
            placeholder="Observações"
            value={form.observacoes}
            onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            className="col-span-1 sm:col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            rows={2}
          />
          <div className="col-span-1 sm:col-span-2 flex justify-end gap-2">
            <button type="button" onClick={cancelarFormulario} className="px-4 py-2 text-sm text-gray-500">
              Cancelar
            </button>
            <button type="submit" className="rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700">
              {editandoId ? 'Salvar alterações' : 'Salvar'}
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por descrição, categoria, cliente/fornecedor..."
            className="w-full rounded-lg border border-gray-300 pl-8 pr-8 py-2 text-sm"
          />
          {busca && (
            <button onClick={() => setBusca('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>
        <select
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm sm:w-56"
        >
          <option value="todas">Todas as categorias</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
          <option value="sem_categoria">(Sem categoria)</option>
        </select>
      </div>

      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex gap-2">
          {['todos', 'aberto', 'vencido', 'pago', 'cancelado'].map((s) => (
            <button
              key={s}
              onClick={() => setFiltroStatus(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
                filtroStatus === s ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={periodo === 'todos' ? '' : periodo}
            onChange={(e) => setPeriodo(e.target.value || mesAtualISO())}
            disabled={periodo === 'todos'}
            className="rounded-lg border border-gray-300 px-2 py-1 text-xs disabled:bg-gray-100 disabled:text-gray-400"
          />
          <label className="flex items-center gap-1 text-xs text-gray-500">
            <input
              type="checkbox"
              checked={periodo === 'todos'}
              onChange={(e) => setPeriodo(e.target.checked ? 'todos' : mesAtualISO())}
            />
            Todos os períodos
          </label>
        </div>
      </div>

      {resumoOrdenado.length > 0 && (
        <details className="mb-4 bg-white border border-gray-200 rounded-lg" open>
          <summary className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 cursor-pointer select-none">
            <BarChart3 size={15} className="text-primary-600" />
            Totais por categoria
          </summary>
          <ul className="divide-y divide-gray-100 border-t border-gray-100">
            {resumoOrdenado.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-4 py-1.5 text-sm">
                <button
                  onClick={() => setFiltroCategoria(filtroCategoria === r.id ? 'todas' : r.id)}
                  className={`text-left hover:underline ${filtroCategoria === r.id ? 'text-primary-700 font-medium' : 'text-gray-600'}`}
                >
                  {r.nome} <span className="text-gray-400 font-normal">({r.quantidade})</span>
                </button>
                <span className="flex items-center gap-2">
                  <span className="text-gray-800 font-medium">{formatCurrencyBRL(r.total)}</span>
                  <span className="text-gray-400 text-xs w-12 text-right">
                    {totalGeralResumo ? `${((r.total / totalGeralResumo) * 100).toFixed(0)}%` : ''}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">Carregando...</p>
      ) : (
        <ul className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {listaFiltrada.map((item) => {
            const vencido = item.status === 'aberto' && isOverdue(item.data_vencimento)
            const pessoaNome = tipo === 'pagar' ? item.fornecedores?.nome : item.clientes?.nome
            return (
              <li key={item.id} className="px-4 py-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 break-words">{item.descricao}</p>
                    <p className="text-xs text-gray-500">
                      Venc: {formatDateBR(item.data_vencimento)}
                      {item.categorias?.nome ? ` · ${item.categorias.nome}` : ''}
                      {item.equipamentos?.nome ? ` · ${item.equipamentos.nome}` : ''}
                      {pessoaNome ? ` · ${pessoaNome}` : ''}
                      {item.status === 'pago' && item.contas_bancarias?.nome ? ` · ${item.contas_bancarias.nome}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    {item.status === 'pago' && Math.abs(Number(item.valor_pago) - Number(item.valor)) > 0.005 ? (
                      <div className="text-right">
                        <span className="text-sm font-medium text-gray-700 line-through decoration-gray-300">
                          {formatCurrencyBRL(item.valor)}
                        </span>
                        <span className="block text-sm font-semibold text-gray-900">
                          {formatCurrencyBRL(item.valor_pago)}
                        </span>
                        <span className="block text-[11px] text-gray-400">
                          {Number(item.valor_pago) > Number(item.valor)
                            ? `+${formatCurrencyBRL(Number(item.valor_pago) - Number(item.valor))} juros/taxa`
                            : `-${formatCurrencyBRL(Number(item.valor) - Number(item.valor_pago))} desconto`}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm font-medium text-gray-700">{formatCurrencyBRL(item.valor)}</span>
                    )}
                    <StatusBadge status={item.status} vencido={vencido} />
                    {item.status === 'aberto' && (
                      <button
                        onClick={() => abrirPagamento(item)}
                        title={tipo === 'pagar' ? 'Marcar como pago' : 'Marcar como recebido'}
                        className="text-green-600 hover:bg-green-50 p-1 rounded"
                      >
                        <CheckCircle2 size={18} />
                      </button>
                    )}
                    {item.status === 'aberto' && (
                      <button onClick={() => cancelar(item)} className="text-gray-400 hover:text-orange-500 p-1 rounded">
                        <X size={16} />
                      </button>
                    )}
                    {item.status === 'aberto' && (
                      <button
                        onClick={() => abrirRenegociacao(item)}
                        title="Renegociar em mais vezes"
                        className="text-gray-400 hover:text-blue-600 p-1 rounded"
                      >
                        <Repeat size={16} />
                      </button>
                    )}
                    {tipo === 'receber' && item.status === 'pago' && (
                      <Link
                        to={`/recibo/${item.id}`}
                        title="Ver / imprimir recibo"
                        className="text-gray-400 hover:text-primary-600 p-1 rounded"
                      >
                        <Receipt size={16} />
                      </Link>
                    )}
                    <button
                      onClick={() => iniciarEdicao(item)}
                      title="Editar lançamento"
                      className="text-gray-400 hover:text-primary-600 p-1 rounded"
                    >
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => excluir(item.id)} className="text-gray-400 hover:text-red-600 p-1 rounded">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {pagandoId === item.id && (
                  <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex gap-2 bg-white rounded-lg p-1 mb-2 border border-gray-200">
                      <button
                        type="button"
                        onClick={() => setPagamentoForm({ ...pagamentoForm, tipoBaixa: 'total' })}
                        className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                          pagamentoForm.tipoBaixa === 'total' ? 'bg-green-600 text-white' : 'text-gray-500'
                        }`}
                      >
                        Pagamento total
                      </button>
                      <button
                        type="button"
                        onClick={() => setPagamentoForm({ ...pagamentoForm, tipoBaixa: 'parcial' })}
                        className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                          pagamentoForm.tipoBaixa === 'parcial' ? 'bg-green-600 text-white' : 'text-gray-500'
                        }`}
                      >
                        Pagamento parcial
                      </button>
                    </div>

                    {pagamentoForm.tipoBaixa === 'parcial' && (
                      <div className="mb-2">
                        <label className="block text-[11px] text-green-800 mb-0.5">
                          Valor recebido agora (de {formatCurrencyBRL(item.valor)})
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Valor parcial"
                          value={pagamentoForm.valorParcial}
                          onChange={(e) => setPagamentoForm({ ...pagamentoForm, valorParcial: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                        />
                        <p className="text-[11px] text-green-700 mt-0.5">
                          O restante ({formatCurrencyBRL(Math.max(0, Number(item.valor) - (Number(pagamentoForm.valorParcial) || 0)))})
                          continua em aberto — dá pra dar baixa nele depois, ou usar "Renegociar em mais vezes".
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="block text-[11px] text-green-800 mb-0.5">
                          {tipo === 'pagar' ? 'Saiu de' : 'Entrou em'}
                        </label>
                        <select
                          value={contaEscolhida}
                          onChange={(e) => setContaEscolhida(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                        >
                          <option value="">Selecione a conta/caixa...</option>
                          {contasBancarias.map((c) => (
                            <option key={c.id} value={c.id}>{c.nome}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-green-800 mb-0.5">Forma de pagamento</label>
                        <select
                          value={pagamentoForm.forma}
                          onChange={(e) => setPagamentoForm({ ...pagamentoForm, forma: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                        >
                          {FORMAS_PAGAMENTO_BAIXA.map((f) => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-green-800 mb-0.5">Data do pagamento</label>
                        <input
                          type="date"
                          value={pagamentoForm.dataPagamento}
                          onChange={(e) => setPagamentoForm({ ...pagamentoForm, dataPagamento: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                        />
                      </div>

                      {pagamentoForm.forma === 'Cartão de Crédito' && (
                        <div>
                          <label className="block text-[11px] text-green-800 mb-0.5">Em quantas vezes</label>
                          <input
                            type="number"
                            min="1"
                            max="24"
                            value={pagamentoForm.parcelas}
                            onChange={(e) => setPagamentoForm({ ...pagamentoForm, parcelas: e.target.value })}
                            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                          />
                        </div>
                      )}

                      {(pagamentoForm.forma === 'Cartão de Crédito' || pagamentoForm.forma === 'Cartão de Débito') && (
                        <div>
                          <label className="block text-[11px] text-green-800 mb-0.5">Taxa da maquininha (%)</label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Ex: 3,5"
                            value={pagamentoForm.taxaPercentual}
                            onChange={(e) => setPagamentoForm({ ...pagamentoForm, taxaPercentual: e.target.value })}
                            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-[11px] text-green-800 mb-0.5">Desconto dado (opcional)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="R$ 0,00"
                          value={pagamentoForm.desconto}
                          onChange={(e) => setPagamentoForm({ ...pagamentoForm, desconto: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                        />
                      </div>
                    </div>

                    <p className="text-xs text-green-800 mb-2">
                      {pagamentoForm.tipoBaixa === 'parcial' ? 'Valor líquido recebido agora' : `Valor líquido a ${tipo === 'pagar' ? 'pagar' : 'receber'}`}:{' '}
                      <strong>{formatCurrencyBRL(calcularValorPago(item).valorPago)}</strong>
                      {calcularValorPago(item).taxaValor > 0 && (
                        <span className="text-green-600"> (taxa de {formatCurrencyBRL(calcularValorPago(item).taxaValor)} já descontada)</span>
                      )}
                    </p>
                    {calcularValorPago(item).valorPago <= 0 && (
                      <p className="text-xs text-red-600 font-medium mb-2">
                        ⚠️ O valor líquido está zerado ou negativo — confere se o desconto/taxa não está maior que o valor do lançamento.
                      </p>
                    )}

                    <div className="flex justify-end gap-2">
                      <button onClick={() => setPagandoId(null)} className="px-3 py-1.5 text-sm text-gray-500">
                        Cancelar
                      </button>
                      <button
                        onClick={() => confirmarPagamento(item)}
                        className="flex items-center gap-1 rounded-lg bg-green-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-green-700"
                      >
                        <CheckCircle2 size={14} /> Confirmar
                      </button>
                    </div>
                  </div>
                )}

                {renegociandoId === item.id && (
                  <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs text-blue-800 mb-2">
                      Divide o valor de <strong>{formatCurrencyBRL(item.valor)}</strong> em novas parcelas mensais. O
                      lançamento original é cancelado e substituído pelas novas parcelas.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="block text-[11px] text-blue-800 mb-0.5">Em quantas vezes</label>
                        <input
                          type="number"
                          min="2"
                          max="60"
                          value={renegociarForm.quantidade}
                          onChange={(e) => setRenegociarForm({ ...renegociarForm, quantidade: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-blue-800 mb-0.5">Vencimento da 1ª parcela</label>
                        <input
                          type="date"
                          value={renegociarForm.dataPrimeira}
                          onChange={(e) => setRenegociarForm({ ...renegociarForm, dataPrimeira: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-blue-800 mb-2">
                      Cada parcela:{' '}
                      <strong>
                        {formatCurrencyBRL(Number(item.valor) / Math.max(2, Number(renegociarForm.quantidade) || 2))}
                      </strong>
                    </p>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setRenegociandoId(null)} className="px-3 py-1.5 text-sm text-gray-500">
                        Cancelar
                      </button>
                      <button
                        onClick={() => confirmarRenegociacao(item)}
                        className="flex items-center gap-1 rounded-lg bg-blue-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-blue-700"
                      >
                        <Repeat size={14} /> Confirmar renegociação
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
          {listaFiltrada.length === 0 && (
            <li className="px-4 py-3 text-sm text-gray-400">Nenhum lançamento encontrado.</li>
          )}
        </ul>
      )}
    </div>
  )
}

function StatusBadge({ status, vencido }) {
  if (status === 'aberto' && vencido) {
    return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">Vencido</span>
  }
  const map = {
    aberto: 'bg-yellow-100 text-yellow-700',
    pago: 'bg-green-100 text-green-700',
    cancelado: 'bg-gray-100 text-gray-500',
  }
  const label = { aberto: 'Em aberto', pago: 'Pago', cancelado: 'Cancelado' }
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status]}`}>{label[status]}</span>
}
