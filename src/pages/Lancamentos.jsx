import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatDateBR, formatCurrencyBRL, todayISO, isOverdue, addMonthsISO } from '../lib/format'
import { Plus, Trash2, CheckCircle2, X, Repeat, Pencil } from 'lucide-react'
import BuscaPessoa from '../components/BuscaPessoa'

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
  const [pagandoId, setPagandoId] = useState(null)
  const [contaEscolhida, setContaEscolhida] = useState('')
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
  }

  function cancelarFormulario() {
    setForm(CAMPOS_VAZIOS)
    setEditandoId(null)
    setMostrarForm(false)
  }

  function abrirPagamento(item) {
    setPagandoId(item.id)
    setContaEscolhida(contasBancarias.length > 0 ? contasBancarias[0].id : '')
  }

  async function confirmarPagamento(item) {
    if (!contaEscolhida) {
      setErro('Selecione de qual conta saiu/entrou o valor.')
      return
    }
    const desconto = Number(item.desconto) || 0
    const juros = Number(item.juros) || 0
    const { error } = await supabase
      .from('lancamentos')
      .update({
        status: 'pago',
        valor_pago: Number(item.valor) - desconto + juros,
        data_pagamento: todayISO(),
        conta_bancaria_id: contaEscolhida,
      })
      .eq('id', item.id)
    if (error) {
      setErro(error.message)
      return
    }
    setPagandoId(null)
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
    if (filtroStatus === 'todos') return true
    if (filtroStatus === 'vencido') return item.status === 'aberto' && isOverdue(item.data_vencimento)
    return item.status === filtroStatus
  })

  const totalAberto = lista
    .filter((i) => i.status === 'aberto')
    .reduce((acc, i) => acc + Number(i.valor), 0)

  const itemEditando = editandoId ? lista.find((l) => l.id === editandoId) : null
  const editandoItemPago = itemEditando?.status === 'pago'

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-2xl font-bold text-gray-900">{titulo}</h2>
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
      <p className="text-gray-500 text-sm mb-4">
        Total em aberto: <span className="font-semibold text-gray-700">{formatCurrencyBRL(totalAberto)}</span>
      </p>

      {erro && <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-2">{erro}</div>}

      {mostrarForm && (
        <form onSubmit={salvar} className="bg-white border border-gray-200 rounded-lg p-4 mb-6 grid grid-cols-2 gap-3">
          {editandoId && (
            <p className="col-span-2 text-sm font-medium text-primary-700 -mb-1">Editando lançamento</p>
          )}
          <input
            placeholder="Descrição *"
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            className="col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            required
          />

          {!editandoId && (
            <div className="col-span-2 flex gap-2 bg-gray-50 rounded-lg p-1">
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
            <div className="col-span-2 flex items-center gap-2 text-xs text-gray-500 bg-primary-50 rounded-lg px-3 py-2">
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
          <select
            value={form.categoria_id}
            onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Categoria...</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
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
              className="col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
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
              <div className="col-span-2 text-xs text-gray-500 -mb-2 mt-1">Dados do pagamento</div>
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
            className="col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            rows={2}
          />
          <div className="col-span-2 flex justify-end gap-2">
            <button type="button" onClick={cancelarFormulario} className="px-4 py-2 text-sm text-gray-500">
              Cancelar
            </button>
            <button type="submit" className="rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700">
              {editandoId ? 'Salvar alterações' : 'Salvar'}
            </button>
          </div>
        </form>
      )}

      <div className="flex gap-2 mb-3">
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

      {loading ? (
        <p className="text-gray-400 text-sm">Carregando...</p>
      ) : (
        <ul className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {listaFiltrada.map((item) => {
            const vencido = item.status === 'aberto' && isOverdue(item.data_vencimento)
            const pessoaNome = tipo === 'pagar' ? item.fornecedores?.nome : item.clientes?.nome
            return (
              <li key={item.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{item.descricao}</p>
                    <p className="text-xs text-gray-500">
                      Venc: {formatDateBR(item.data_vencimento)}
                      {item.categorias?.nome ? ` · ${item.categorias.nome}` : ''}
                      {item.equipamentos?.nome ? ` · ${item.equipamentos.nome}` : ''}
                      {pessoaNome ? ` · ${pessoaNome}` : ''}
                      {item.status === 'pago' && item.contas_bancarias?.nome ? ` · ${item.contas_bancarias.nome}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
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
                  <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                    <span className="text-sm text-green-800 shrink-0">
                      {tipo === 'pagar' ? 'Saiu de:' : 'Entrou em:'}
                    </span>
                    <select
                      value={contaEscolhida}
                      onChange={(e) => setContaEscolhida(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                    >
                      <option value="">Selecione a conta/caixa...</option>
                      {contasBancarias.map((c) => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setPagandoId(null)}
                      className="px-3 py-1.5 text-sm text-gray-500"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => confirmarPagamento(item)}
                      className="flex items-center gap-1 rounded-lg bg-green-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-green-700"
                    >
                      <CheckCircle2 size={14} /> Confirmar
                    </button>
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
