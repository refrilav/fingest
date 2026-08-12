import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatDateBR, formatCurrencyBRL, todayISO } from '../lib/format'
import BuscaPessoa from '../components/BuscaPessoa'
import BuscaPeca from '../components/BuscaPeca'
import SelectCategoria from '../components/SelectCategoria'
import { Plus, Trash2, X, ArrowLeft, Package } from 'lucide-react'

const CAMPOS_VAZIOS = {
  cliente_id: '',
  data_venda: todayISO(),
  categoria_id: '',
  observacoes: '',
  faturamento: 'agora', // 'agora' | 'acumular'
}

export default function Vendas() {
  const [lista, setLista] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [form, setForm] = useState(CAMPOS_VAZIOS)
  const [itens, setItens] = useState([])
  const [mostrarForm, setMostrarForm] = useState(false)
  const [salvando, setSalvando] = useState(false)

  async function carregar() {
    setLoading(true)
    const [vendasRes, catsRes] = await Promise.all([
      supabase
        .from('vendas')
        .select('*, clientes(nome, telefone), venda_itens(id, nome_peca, quantidade, valor_unitario), lancamentos(status)')
        .order('numero', { ascending: false })
        .range(0, 9999),
      supabase.from('categorias').select('*').eq('tipo', 'receita').eq('ativo', true).order('nome').range(0, 9999),
    ])
    if (vendasRes.error) setErro(vendasRes.error.message)
    else setLista(vendasRes.data)
    setCategorias(catsRes.data || [])
    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  function cancelarFormulario() {
    setForm(CAMPOS_VAZIOS)
    setItens([])
    setMostrarForm(false)
  }

  async function adicionarItem(peca) {
    setItens([...itens, { pecaId: peca.id, nome: peca.nome, quantidade: 1, valorUnitario: Number(peca.valor_venda), estoqueDisponivel: Number(peca.quantidade_estoque) }])
    // desconta do estoque na hora (mesmo padrão da OS)
    await supabase.from('pecas').update({ quantidade_estoque: Number(peca.quantidade_estoque) - 1 }).eq('id', peca.id)
  }

  async function removerItem(index) {
    const item = itens[index]
    if (item.pecaId) {
      const { data: pecaAtual } = await supabase.from('pecas').select('quantidade_estoque').eq('id', item.pecaId).single()
      if (pecaAtual) {
        await supabase.from('pecas').update({ quantidade_estoque: Number(pecaAtual.quantidade_estoque) + Number(item.quantidade) }).eq('id', item.pecaId)
      }
    }
    setItens(itens.filter((_, i) => i !== index))
  }

  async function atualizarQuantidade(index, novaQuantidade) {
    const item = itens[index]
    const diferenca = novaQuantidade - item.quantidade
    if (item.pecaId && diferenca !== 0) {
      const { data: pecaAtual } = await supabase.from('pecas').select('quantidade_estoque').eq('id', item.pecaId).single()
      if (pecaAtual) {
        await supabase.from('pecas').update({ quantidade_estoque: Number(pecaAtual.quantidade_estoque) - diferenca }).eq('id', item.pecaId)
      }
    }
    const novos = [...itens]
    novos[index] = { ...novos[index], quantidade: novaQuantidade }
    setItens(novos)
  }

  function atualizarValor(index, novoValor) {
    const novos = [...itens]
    novos[index] = { ...novos[index], valorUnitario: novoValor }
    setItens(novos)
  }

  const totalVenda = itens.reduce((acc, i) => acc + Number(i.quantidade) * Number(i.valorUnitario), 0)

  async function salvar(e) {
    e.preventDefault()
    if (!form.cliente_id) {
      setErro('Selecione um cliente.')
      return
    }
    if (itens.length === 0) {
      setErro('Adicione pelo menos uma peça.')
      return
    }
    setSalvando(true)
    setErro(null)

    const { data: novaVenda, error: erroVenda } = await supabase
      .from('vendas')
      .insert({ cliente_id: form.cliente_id, data_venda: form.data_venda, observacoes: form.observacoes || null })
      .select()
      .single()

    if (erroVenda) {
      setErro(erroVenda.message)
      setSalvando(false)
      return
    }

    const linhasItens = itens.map((i) => ({
      venda_id: novaVenda.id,
      peca_id: i.pecaId,
      nome_peca: i.nome,
      quantidade: i.quantidade,
      valor_unitario: i.valorUnitario,
    }))
    const { error: erroItens } = await supabase.from('venda_itens').insert(linhasItens)
    if (erroItens) {
      setErro(erroItens.message)
      setSalvando(false)
      return
    }

    if (form.faturamento === 'agora') {
      const numeros = `Venda #${novaVenda.numero}`
      const { data: novoLancamento, error: erroLancamento } = await supabase
        .from('lancamentos')
        .insert({
          tipo: 'receber',
          descricao: `${numeros} — ${itens.length} peça(s)`,
          valor: totalVenda,
          data_vencimento: form.data_venda,
          data_competencia: form.data_venda,
          categoria_id: form.categoria_id || null,
          cliente_id: form.cliente_id,
          observacoes: `Gerado automaticamente pela venda #${novaVenda.numero}.`,
        })
        .select()
        .single()

      if (erroLancamento) {
        setErro(erroLancamento.message)
        setSalvando(false)
        return
      }

      await supabase.from('vendas').update({ lancamento_id: novoLancamento.id }).eq('id', novaVenda.id)
    }

    setSalvando(false)
    cancelarFormulario()
    carregar()
  }

  return (
    <div className="max-w-3xl">
      <Link to="/vendas" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Voltar
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1 gap-2">
        <h2 className="text-2xl font-bold text-gray-900">Vendas de Peças</h2>
        <button
          onClick={() => (mostrarForm ? cancelarFormulario() : setMostrarForm(true))}
          className="flex items-center gap-1 rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700"
        >
          <Plus size={16} /> Nova venda
        </button>
      </div>
      <p className="text-gray-500 text-sm mb-4">Venda avulsa de peças, com desconto automático do estoque.</p>

      {erro && <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-2">{erro}</div>}

      {mostrarForm && (
        <form onSubmit={salvar} className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <BuscaPessoa
              tabela="clientes"
              value={form.cliente_id}
              onChange={(id) => setForm({ ...form, cliente_id: id })}
              placeholder="Buscar cliente por nome, telefone ou endereço..."
            />
            <input
              type="date"
              value={form.data_venda}
              onChange={(e) => setForm({ ...form, data_venda: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <p className="text-sm font-medium text-gray-700 mb-2">Peças</p>
          <BuscaPeca onSelecionar={adicionarItem} placeholder="Buscar peça pra adicionar..." />

          {itens.length > 0 && (
            <ul className="mt-2 space-y-1 mb-3">
              {itens.map((item, i) => (
                <li key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 text-sm">
                  <span className="flex-1 text-gray-700">{item.nome}</span>
                  <input
                    type="number"
                    step="0.01"
                    value={item.quantidade}
                    onChange={(e) => atualizarQuantidade(i, Number(e.target.value) || 0)}
                    className="w-16 rounded border border-gray-300 px-2 py-1 text-right"
                  />
                  <span className="text-gray-400">×</span>
                  <input
                    type="number"
                    step="0.01"
                    value={item.valorUnitario}
                    onChange={(e) => atualizarValor(i, Number(e.target.value) || 0)}
                    className="w-24 rounded border border-gray-300 px-2 py-1 text-right"
                  />
                  <span className="w-24 text-right font-medium text-gray-700">
                    {formatCurrencyBRL(item.quantidade * item.valorUnitario)}
                  </span>
                  <button type="button" onClick={() => removerItem(i)} className="text-gray-400 hover:text-red-600">
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="text-sm text-gray-700 mb-3">
            Total da venda: <strong>{formatCurrencyBRL(totalVenda)}</strong>
          </p>

          <SelectCategoria
            tipo="receita"
            categorias={categorias}
            value={form.categoria_id}
            onChange={(id) => setForm({ ...form, categoria_id: id })}
            onCriada={(nova) => {
              setCategorias((prev) => [...prev, nova].sort((a, b) => a.nome.localeCompare(b.nome)))
              setForm((f) => ({ ...f, categoria_id: nova.id }))
            }}
            className="mb-3"
          />

          <div className="flex gap-2 bg-gray-50 rounded-lg p-1 mb-3">
            <button
              type="button"
              onClick={() => setForm({ ...form, faturamento: 'agora' })}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                form.faturamento === 'agora' ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500'
              }`}
            >
              Cobrar agora
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, faturamento: 'acumular' })}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                form.faturamento === 'acumular' ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500'
              }`}
            >
              Acumular p/ cobrar depois
            </button>
          </div>
          {form.faturamento === 'acumular' && (
            <p className="text-xs text-blue-700 mb-3">
              A venda fica registrada, mas não gera conta a receber agora — depois, na ficha do cliente, você junta
              com outras OS's/vendas numa cobrança consolidada.
            </p>
          )}

          <textarea
            placeholder="Observações (opcional)"
            value={form.observacoes}
            onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mb-3"
          />

          <div className="flex justify-end gap-2">
            <button type="button" onClick={cancelarFormulario} className="px-4 py-2 text-sm text-gray-500">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : 'Registrar venda'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">Carregando...</p>
      ) : lista.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 flex flex-col items-center text-center text-gray-400">
          <Package size={28} className="mb-3" />
          <p className="text-sm">Nenhuma venda ainda.</p>
        </div>
      ) : (
        <ul className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {lista.map((v) => {
            const total = (v.venda_itens || []).reduce((acc, i) => acc + Number(i.quantidade) * Number(i.valor_unitario), 0)
            const statusLabel = !v.lancamento_id ? 'Pendente' : v.lancamentos?.status === 'pago' ? 'Paga' : 'Faturada'
            const statusColor = !v.lancamento_id ? 'bg-amber-100 text-amber-700' : v.lancamentos?.status === 'pago' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
            return (
              <li key={v.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm text-gray-800">
                    <span className="text-xs font-mono text-gray-400">#{v.numero}</span> {v.clientes?.nome || '(Sem cliente)'}
                    {' · '}
                    {(v.venda_itens || []).length} peça(s)
                  </p>
                  <p className="text-xs text-gray-500">{formatDateBR(v.data_venda)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">{formatCurrencyBRL(total)}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor}`}>{statusLabel}</span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
