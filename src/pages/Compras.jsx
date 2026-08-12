import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { parseNFeXML } from '../lib/parseNFe'
import { formatDateBR, formatCurrencyBRL, todayISO } from '../lib/format'
import BuscaPessoa from '../components/BuscaPessoa'
import BuscaPeca from '../components/BuscaPeca'
import SelectCategoria from '../components/SelectCategoria'
import { ArrowLeft, Upload, Plus, X, Package, FileText, Check } from 'lucide-react'

const CAMPOS_VAZIOS = {
  fornecedor_id: '',
  data_compra: todayISO(),
  numero_nota: '',
  chave_acesso: '',
  categoria_id: '',
  observacoes: '',
}

const PARCELA_VAZIA = { dataVencimento: todayISO(), valor: '' }

// item: { descricao, quantidade, valorUnitario, pecaId (se casado com peça existente), valorVenda, criarNova }
const ITEM_VAZIO = { descricao: '', quantidade: '1', valorUnitario: '', pecaId: '', pecaNome: '', valorVenda: '', criarNova: false }

export default function Compras() {
  const [lista, setLista] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState(CAMPOS_VAZIOS)
  const [itens, setItens] = useState([])
  const [parcelas, setParcelas] = useState([{ ...PARCELA_VAZIA }])
  const [entraEstoque, setEntraEstoque] = useState(null) // null = ainda não decidiu, true/false depois
  const [salvando, setSalvando] = useState(false)
  const [lendoXml, setLendoXml] = useState(false)

  async function carregar() {
    setLoading(true)
    const [comprasRes, catsRes] = await Promise.all([
      supabase
        .from('compras')
        .select('*, fornecedores(nome), compra_itens(id, descricao, quantidade, valor_unitario)')
        .order('numero', { ascending: false })
        .range(0, 9999),
      supabase.from('categorias').select('*').eq('tipo', 'despesa').eq('ativo', true).order('nome').range(0, 9999),
    ])
    if (comprasRes.error) setErro(comprasRes.error.message)
    else setLista(comprasRes.data)
    setCategorias(catsRes.data || [])
    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  function cancelarFormulario() {
    setForm(CAMPOS_VAZIOS)
    setItens([])
    setParcelas([{ ...PARCELA_VAZIA }])
    setEntraEstoque(null)
    setMostrarForm(false)
    setErro(null)
  }

  function abrirFormulario() {
    setForm(CAMPOS_VAZIOS)
    setItens([{ ...ITEM_VAZIO }])
    setParcelas([{ ...PARCELA_VAZIA }])
    setEntraEstoque(null)
    setMostrarForm(true)
  }

  async function handleUploadXml(e) {
    const file = e.target.files[0]
    if (!file) return
    setLendoXml(true)
    setErro(null)
    try {
      const texto = await file.text()
      const dados = parseNFeXML(texto)

      // tenta casar com um fornecedor já cadastrado pelo CNPJ
      let fornecedorId = ''
      if (dados.fornecedor.documento) {
        const { data: existente } = await supabase
          .from('fornecedores')
          .select('id')
          .eq('documento', dados.fornecedor.documento)
          .maybeSingle()
        if (existente) fornecedorId = existente.id
      }

      setForm({
        ...form,
        fornecedor_id: fornecedorId,
        data_compra: dados.dataEmissao || todayISO(),
        numero_nota: dados.numeroNota || '',
        chave_acesso: dados.chaveAcesso || '',
      })
      setItens(
        dados.itens.map((i) => ({
          descricao: i.descricao,
          quantidade: String(i.quantidade),
          valorUnitario: String(i.valorUnitario),
          pecaId: '',
          pecaNome: '',
          valorVenda: '',
          criarNova: false,
        }))
      )

      if (dados.duplicatas && dados.duplicatas.length > 0) {
        setParcelas(
          dados.duplicatas.map((d) => ({
            dataVencimento: d.dataVencimento || todayISO(),
            valor: String(d.valor),
          }))
        )
      } else {
        // nota sem seção de duplicatas — assume pagamento à vista, vencimento na data de emissão
        setParcelas([{ dataVencimento: dados.dataEmissao || todayISO(), valor: String(dados.valorTotal) }])
      }

      if (!fornecedorId && dados.fornecedor.nome) {
        setErro(
          `Não achei "${dados.fornecedor.nome}" nos seus fornecedores. Busque/cadastre ele no campo abaixo (CNPJ: ${dados.fornecedor.documento || '—'}).`
        )
      }
    } catch (err) {
      setErro(err.message)
    }
    setLendoXml(false)
    e.target.value = ''
  }

  function adicionarItemManual() {
    setItens([...itens, { ...ITEM_VAZIO }])
  }

  function atualizarItem(index, campo, valor) {
    const novos = [...itens]
    novos[index] = { ...novos[index], [campo]: valor }
    setItens(novos)
  }

  function removerItem(index) {
    setItens(itens.filter((_, i) => i !== index))
  }

  function casarComPeca(index, peca) {
    const novos = [...itens]
    novos[index] = {
      ...novos[index],
      pecaId: peca.id,
      pecaNome: peca.nome,
      valorVenda: String(peca.valor_venda ?? ''),
      criarNova: false,
    }
    setItens(novos)
  }

  function atualizarParcela(index, campo, valor) {
    const novas = [...parcelas]
    novas[index] = { ...novas[index], [campo]: valor }
    setParcelas(novas)
  }

  function adicionarParcela() {
    setParcelas([...parcelas, { ...PARCELA_VAZIA }])
  }

  function removerParcela(index) {
    if (parcelas.length === 1) return
    setParcelas(parcelas.filter((_, i) => i !== index))
  }

  const totalCompra = itens.reduce((acc, i) => acc + (Number(i.quantidade) || 0) * (Number(i.valorUnitario) || 0), 0)
  const totalParcelas = parcelas.reduce((acc, p) => acc + (Number(p.valor) || 0), 0)

  async function salvar(e) {
    e.preventDefault()
    if (!form.fornecedor_id) {
      setErro('Selecione o fornecedor.')
      return
    }
    if (itens.length === 0) {
      setErro('Adicione pelo menos um item.')
      return
    }
    if (entraEstoque === null) {
      setErro('Diga se essa compra entra no estoque ou não.')
      return
    }
    if (parcelas.some((p) => !p.dataVencimento || !p.valor || Number(p.valor) <= 0)) {
      setErro('Preencha data e valor de todas as parcelas.')
      return
    }
    if (entraEstoque) {
      const semValorVenda = itens.find((i) => !i.valorVenda || Number(i.valorVenda) <= 0)
      if (semValorVenda) {
        setErro(`Falta o valor de venda de "${semValorVenda.descricao}".`)
        return
      }
    }

    setSalvando(true)
    setErro(null)

    const { data: novaCompra, error: erroCompra } = await supabase
      .from('compras')
      .insert({
        fornecedor_id: form.fornecedor_id,
        data_compra: form.data_compra,
        numero_nota: form.numero_nota || null,
        chave_acesso: form.chave_acesso || null,
        valor_total: totalCompra,
        entrou_estoque: entraEstoque,
        observacoes: form.observacoes || null,
      })
      .select()
      .single()

    if (erroCompra) {
      setErro(erroCompra.message)
      setSalvando(false)
      return
    }

    // Se entra em estoque, garante a peça (cria se for nova) antes de gravar o item
    const itensComPeca = []
    for (const item of itens) {
      let pecaId = item.pecaId || null

      if (entraEstoque) {
        if (pecaId) {
          const { data: pecaAtual } = await supabase.from('pecas').select('quantidade_estoque').eq('id', pecaId).single()
          await supabase
            .from('pecas')
            .update({
              quantidade_estoque: Number(pecaAtual?.quantidade_estoque || 0) + Number(item.quantidade),
              valor_custo: Number(item.valorUnitario),
              valor_venda: Number(item.valorVenda),
            })
            .eq('id', pecaId)
        } else {
          const { data: novaPeca, error: erroPeca } = await supabase
            .from('pecas')
            .insert({
              nome: item.descricao,
              valor_custo: Number(item.valorUnitario),
              valor_venda: Number(item.valorVenda),
              quantidade_estoque: Number(item.quantidade),
            })
            .select()
            .single()
          if (erroPeca) {
            setErro(erroPeca.message)
            setSalvando(false)
            return
          }
          pecaId = novaPeca.id
        }
      }

      itensComPeca.push({
        compra_id: novaCompra.id,
        descricao: item.descricao,
        quantidade: Number(item.quantidade),
        valor_unitario: Number(item.valorUnitario),
        valor_venda: entraEstoque ? Number(item.valorVenda) : null,
        peca_id: pecaId,
      })
    }

    const { error: erroItens } = await supabase.from('compra_itens').insert(itensComPeca)
    if (erroItens) {
      setErro(erroItens.message)
      setSalvando(false)
      return
    }

    // Gera a(s) conta(s) a pagar — uma por parcela, se houver mais de uma
    const grupoId = parcelas.length > 1 ? crypto.randomUUID() : null
    const linhasLancamento = parcelas.map((p, i) => ({
      tipo: 'pagar',
      descricao: `Compra #${novaCompra.numero}${form.numero_nota ? ` — NF ${form.numero_nota}` : ''}${
        parcelas.length > 1 ? ` (${i + 1}/${parcelas.length})` : ''
      }`,
      valor: Number(p.valor),
      data_vencimento: p.dataVencimento,
      data_competencia: form.data_compra,
      categoria_id: form.categoria_id || null,
      fornecedor_id: form.fornecedor_id,
      observacoes: `Gerado automaticamente pela compra #${novaCompra.numero}.`,
      grupo_id: grupoId,
      numero_parcela: parcelas.length > 1 ? i + 1 : null,
      total_parcelas: parcelas.length > 1 ? parcelas.length : null,
    }))

    const { data: novosLancamentos, error: erroLancamento } = await supabase
      .from('lancamentos')
      .insert(linhasLancamento)
      .select()

    if (erroLancamento) {
      setErro(erroLancamento.message)
      setSalvando(false)
      return
    }

    await supabase.from('compras').update({ lancamento_id: novosLancamentos[0].id }).eq('id', novaCompra.id)

    setSalvando(false)
    cancelarFormulario()
    carregar()
  }

  return (
    <div className="max-w-3xl">
      <Link to="/financeiro" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Voltar
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1 gap-2">
        <h2 className="text-2xl font-bold text-gray-900">Compras</h2>
        <button
          onClick={() => (mostrarForm ? cancelarFormulario() : abrirFormulario())}
          className="flex items-center gap-1 rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700"
        >
          <Plus size={16} /> Nova compra
        </button>
      </div>
      <p className="text-gray-500 text-sm mb-4">Importe o XML da nota ou lance manualmente. Gera conta a pagar automaticamente.</p>

      {erro && <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-2">{erro}</div>}

      {mostrarForm && (
        <form onSubmit={salvar} className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-6 cursor-pointer hover:border-primary-400 transition-colors mb-4">
            <Upload size={22} className="text-gray-400" />
            <span className="text-sm text-gray-600">
              {lendoXml ? 'Lendo XML...' : 'Clique para importar o XML da nota fiscal (opcional)'}
            </span>
            <input type="file" accept=".xml" className="hidden" onChange={handleUploadXml} disabled={lendoXml} />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <BuscaPessoa
              tabela="fornecedores"
              value={form.fornecedor_id}
              onChange={(id) => setForm({ ...form, fornecedor_id: id })}
              placeholder="Buscar fornecedor por nome, telefone..."
            />
            <input
              type="date"
              value={form.data_compra}
              onChange={(e) => setForm({ ...form, data_compra: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              placeholder="Número da nota (opcional)"
              value={form.numero_nota}
              onChange={(e) => setForm({ ...form, numero_nota: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              placeholder="Chave de acesso (opcional)"
              value={form.chave_acesso}
              onChange={(e) => setForm({ ...form, chave_acesso: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <p className="text-sm font-medium text-gray-700 mb-2">Itens da compra</p>
          <div className="space-y-2 mb-2">
            {itens.map((item, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-2">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center mb-1">
                  <input
                    placeholder="Descrição"
                    value={item.descricao}
                    onChange={(e) => atualizarItem(i, 'descricao', e.target.value)}
                    className="sm:col-span-5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Qtd."
                    value={item.quantidade}
                    onChange={(e) => atualizarItem(i, 'quantidade', e.target.value)}
                    className="sm:col-span-2 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-right"
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Valor unit."
                    value={item.valorUnitario}
                    onChange={(e) => atualizarItem(i, 'valorUnitario', e.target.value)}
                    className="sm:col-span-2 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-right"
                  />
                  <span className="sm:col-span-2 text-right text-sm font-medium text-gray-700">
                    {formatCurrencyBRL((Number(item.quantidade) || 0) * (Number(item.valorUnitario) || 0))}
                  </span>
                  <button type="button" onClick={() => removerItem(i)} className="sm:col-span-1 text-gray-400 hover:text-red-600 justify-self-end">
                    <X size={16} />
                  </button>
                </div>

                {entraEstoque && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    {item.pecaId ? (
                      <div className="flex items-center justify-between text-xs bg-green-50 text-green-800 rounded-lg px-2 py-1.5 mb-1">
                        <span>Casado com a peça: <strong>{item.pecaNome}</strong></span>
                        <button type="button" onClick={() => atualizarItem(i, 'pecaId', '')} className="text-green-700 hover:underline">
                          Trocar
                        </button>
                      </div>
                    ) : (
                      <div className="mb-1">
                        <BuscaPeca onSelecionar={(peca) => casarComPeca(i, peca)} placeholder="Buscar peça já cadastrada (ou deixe em branco pra criar nova)..." />
                      </div>
                    )}
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Valor de venda desse item *"
                      value={item.valorVenda}
                      onChange={(e) => atualizarItem(i, 'valorVenda', e.target.value)}
                      className="w-full sm:w-56 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={adicionarItemManual}
            className="flex items-center gap-1 text-sm text-primary-700 hover:bg-primary-50 rounded-lg px-3 py-1.5 mb-3"
          >
            <Plus size={14} /> Adicionar item manualmente
          </button>

          <p className="text-sm text-gray-700 mb-3">
            Total da compra: <strong>{formatCurrencyBRL(totalCompra)}</strong>
          </p>

          <p className="text-sm font-medium text-gray-700 mb-2">Essa compra entra no estoque?</p>
          <div className="flex gap-2 bg-gray-50 rounded-lg p-1 mb-4">
            <button
              type="button"
              onClick={() => setEntraEstoque(true)}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                entraEstoque === true ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500'
              }`}
            >
              Sim, entra no estoque
            </button>
            <button
              type="button"
              onClick={() => setEntraEstoque(false)}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                entraEstoque === false ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500'
              }`}
            >
              Não (ex: material de uso próprio)
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <SelectCategoria
              tipo="despesa"
              categorias={categorias}
              value={form.categoria_id}
              onChange={(id) => setForm({ ...form, categoria_id: id })}
              onCriada={(nova) => {
                setCategorias((prev) => [...prev, nova].sort((a, b) => a.nome.localeCompare(b.nome)))
                setForm((f) => ({ ...f, categoria_id: nova.id }))
              }}
            />
          </div>

          <p className="text-sm font-medium text-gray-700 mb-2">
            Parcelas da conta a pagar {parcelas.length > 1 ? `(${parcelas.length}x)` : ''}
          </p>
          <div className="space-y-2 mb-2">
            {parcelas.map((p, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-gray-50 rounded-lg p-2">
                <span className="sm:col-span-1 text-xs text-gray-400 font-mono">{i + 1}ª</span>
                <input
                  type="date"
                  value={p.dataVencimento}
                  onChange={(e) => atualizarParcela(i, 'dataVencimento', e.target.value)}
                  className="sm:col-span-6 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Valor"
                  value={p.valor}
                  onChange={(e) => atualizarParcela(i, 'valor', e.target.value)}
                  className="sm:col-span-4 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-right"
                />
                <button
                  type="button"
                  onClick={() => removerParcela(i)}
                  disabled={parcelas.length === 1}
                  className="sm:col-span-1 text-gray-400 hover:text-red-600 justify-self-end disabled:opacity-30"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={adicionarParcela}
            className="flex items-center gap-1 text-sm text-primary-700 hover:bg-primary-50 rounded-lg px-3 py-1.5 mb-2"
          >
            <Plus size={14} /> Adicionar parcela
          </button>
          <p className={`text-xs mb-3 ${Math.abs(totalParcelas - totalCompra) > 0.01 ? 'text-amber-600' : 'text-gray-400'}`}>
            Total das parcelas: {formatCurrencyBRL(totalParcelas)}
            {Math.abs(totalParcelas - totalCompra) > 0.01 &&
              ` (diferente do total dos itens: ${formatCurrencyBRL(totalCompra)})`}
          </p>

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
              className="flex items-center gap-1 rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              <Check size={16} /> {salvando ? 'Salvando...' : 'Registrar compra'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">Carregando...</p>
      ) : lista.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 flex flex-col items-center text-center text-gray-400">
          <FileText size={28} className="mb-3" />
          <p className="text-sm">Nenhuma compra ainda.</p>
        </div>
      ) : (
        <ul className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {lista.map((c) => (
            <li key={c.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm text-gray-800">
                  <span className="text-xs font-mono text-gray-400">#{c.numero}</span> {c.fornecedores?.nome || '(Sem fornecedor)'}
                  {c.numero_nota ? ` · NF ${c.numero_nota}` : ''}
                </p>
                <p className="text-xs text-gray-500">
                  {formatDateBR(c.data_compra)} · {(c.compra_itens || []).length} item(ns)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">{formatCurrencyBRL(c.valor_total)}</span>
                {c.entrou_estoque && (
                  <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">
                    <Package size={11} /> Estoque
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
