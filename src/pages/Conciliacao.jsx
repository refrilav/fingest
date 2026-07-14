import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { parseOfx } from '../lib/parseOfx'
import { formatDateBR, formatCurrencyBRL } from '../lib/format'
import { Upload, Landmark, Check, Link2, X } from 'lucide-react'

export default function Conciliacao() {
  const [contas, setContas] = useState([])
  const [contaId, setContaId] = useState('')
  const [transacoes, setTransacoes] = useState([])
  const [sugestoes, setSugestoes] = useState({}) // { transacaoId: lancamentoId | '' }
  const [lancamentosAbertos, setLancamentosAbertos] = useState({ pagar: [], receber: [] })
  const [loading, setLoading] = useState(false)
  const [mensagem, setMensagem] = useState(null)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    async function carregarContas() {
      const { data } = await supabase.from('contas_bancarias').select('*').eq('ativo', true).order('nome')
      setContas(data || [])
      if (data && data.length > 0) setContaId(data[0].id)
    }
    carregarContas()
  }, [])

  async function carregarTransacoesELancamentos(conta) {
    setLoading(true)
    const [trans, pagar, receber] = await Promise.all([
      supabase
        .from('transacoes_bancarias')
        .select('*')
        .eq('conta_bancaria_id', conta)
        .eq('conciliado', false)
        .order('data')
        .range(0, 9999),
      supabase.from('lancamentos').select('*, fornecedores(nome)').eq('tipo', 'pagar').eq('status', 'aberto').range(0, 9999),
      supabase.from('lancamentos').select('*, clientes(nome)').eq('tipo', 'receber').eq('status', 'aberto').range(0, 9999),
    ])
    setTransacoes(trans.data || [])
    setLancamentosAbertos({ pagar: pagar.data || [], receber: receber.data || [] })
    setLoading(false)

    // gerar sugestões automáticas por valor + data mais próxima
    const novasSugestoes = {}
    for (const t of trans.data || []) {
      const candidatos = t.valor >= 0 ? receber.data || [] : pagar.data || []
      const valorAbs = Math.abs(Number(t.valor))
      const match = candidatos
        .filter((l) => Math.abs(Number(l.valor) - valorAbs) < 0.01)
        .sort((a, b) => {
          const da = Math.abs(new Date(a.data_vencimento) - new Date(t.data))
          const db = Math.abs(new Date(b.data_vencimento) - new Date(t.data))
          return da - db
        })[0]
      novasSugestoes[t.id] = match ? match.id : ''
    }
    setSugestoes(novasSugestoes)
  }

  useEffect(() => {
    if (contaId) carregarTransacoesELancamentos(contaId)
  }, [contaId])

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file || !contaId) return
    setErro(null)
    setMensagem(null)

    const texto = await file.text()
    const parsed = parseOfx(texto)

    if (parsed.length === 0) {
      setErro('Não consegui encontrar transações nesse arquivo. Confirme se é um OFX válido do seu banco.')
      return
    }

    const linhas = parsed.map((t) => ({
      conta_bancaria_id: contaId,
      fitid: t.fitid,
      data: t.data,
      valor: t.valor,
      descricao: t.descricao,
    }))

    // upsert ignorando duplicados (mesma conta + fitid já existente)
    const { error, data } = await supabase
      .from('transacoes_bancarias')
      .upsert(linhas, { onConflict: 'conta_bancaria_id,fitid', ignoreDuplicates: true })
      .select()

    if (error) {
      setErro(error.message)
      return
    }

    setMensagem(`${data.length} nova(s) transação(ões) importada(s) de ${parsed.length} lida(s) no arquivo (as demais já existiam).`)
    carregarTransacoesELancamentos(contaId)
    e.target.value = '' // limpa o input pra poder reenviar o mesmo arquivo se precisar
  }

  async function confirmarVinculo(transacao) {
    const lancamentoId = sugestoes[transacao.id]
    if (!lancamentoId) {
      setErro('Selecione um lançamento para vincular, ou use "Marcar sem vínculo".')
      return
    }

    const tipo = transacao.valor >= 0 ? 'receber' : 'pagar'
    const lancamento = lancamentosAbertos[tipo].find((l) => l.id === lancamentoId)
    if (!lancamento) return

    const [r1, r2] = await Promise.all([
      supabase
        .from('lancamentos')
        .update({
          status: 'pago',
          valor_pago: Math.abs(Number(transacao.valor)),
          data_pagamento: transacao.data,
        })
        .eq('id', lancamentoId),
      supabase
        .from('transacoes_bancarias')
        .update({ conciliado: true, lancamento_id: lancamentoId })
        .eq('id', transacao.id),
    ])

    if (r1.error || r2.error) {
      setErro((r1.error || r2.error).message)
      return
    }

    carregarTransacoesELancamentos(contaId)
  }

  async function marcarSemVinculo(transacaoId) {
    const { error } = await supabase
      .from('transacoes_bancarias')
      .update({ conciliado: true })
      .eq('id', transacaoId)
    if (error) {
      setErro(error.message)
      return
    }
    carregarTransacoesELancamentos(contaId)
  }

  return (
    <div className="max-w-4xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Conciliação Bancária</h2>
      <p className="text-gray-500 text-sm mb-6">
        Importe o extrato (OFX) do banco e vincule cada transação a um lançamento de contas a pagar/receber.
      </p>

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 flex items-center gap-4">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Conta bancária</label>
          <select
            value={contaId}
            onChange={(e) => setContaId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {contas.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
          {contas.length === 0 && (
            <p className="text-xs text-red-500 mt-1">Cadastre uma conta bancária primeiro.</p>
          )}
        </div>
        <label className="flex items-center gap-2 rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700 cursor-pointer">
          <Upload size={16} />
          Importar OFX
          <input type="file" accept=".ofx,.qfx" className="hidden" onChange={handleUpload} disabled={!contaId} />
        </label>
      </div>

      {erro && <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-2">{erro}</div>}
      {mensagem && <div className="mb-4 rounded-lg bg-green-50 text-green-700 text-sm px-4 py-2">{mensagem}</div>}

      {loading ? (
        <p className="text-gray-400 text-sm">Carregando...</p>
      ) : transacoes.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 flex flex-col items-center text-center text-gray-400">
          <Landmark size={32} className="mb-3" />
          <p className="text-sm">Nenhuma transação pendente de conciliação para esta conta.</p>
        </div>
      ) : (
        <ul className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {transacoes.map((t) => {
            const tipo = t.valor >= 0 ? 'receber' : 'pagar'
            const candidatos = lancamentosAbertos[tipo]
            return (
              <li key={t.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{t.descricao}</p>
                    <p className="text-xs text-gray-500">{formatDateBR(t.data)}</p>
                  </div>
                  <span className={`text-sm font-semibold ${t.valor >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrencyBRL(t.valor)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={sugestoes[t.id] || ''}
                    onChange={(e) => setSugestoes({ ...sugestoes, [t.id]: e.target.value })}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                  >
                    <option value="">Selecione um lançamento...</option>
                    {candidatos.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.descricao} — {formatCurrencyBRL(l.valor)} (venc. {formatDateBR(l.data_vencimento)})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => confirmarVinculo(t)}
                    disabled={!sugestoes[t.id]}
                    title="Confirmar vínculo"
                    className="flex items-center gap-1 rounded-lg bg-green-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Link2 size={14} /> Vincular
                  </button>
                  <button
                    onClick={() => marcarSemVinculo(t.id)}
                    title="Esta transação não corresponde a nenhum lançamento (ex: tarifa, transferência interna)"
                    className="flex items-center gap-1 rounded-lg bg-gray-100 text-gray-500 px-3 py-1.5 text-sm hover:bg-gray-200"
                  >
                    <X size={14} /> Sem vínculo
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
