import { supabase } from './supabase'

// Calcula o saldo ATUAL de cada conta bancária:
// saldo_inicial + receitas pagas na conta - despesas pagas na conta
// + transferências recebidas - transferências enviadas
export async function calcularSaldosContas() {
  const [contas, lancamentosPagos, transferencias, ajustes] = await Promise.all([
    supabase.from('contas_bancarias').select('id, nome, saldo_inicial').eq('ativo', true),
    supabase
      .from('lancamentos')
      .select('conta_bancaria_id, tipo, valor_pago')
      .eq('status', 'pago')
      .not('conta_bancaria_id', 'is', null)
      .range(0, 9999),
    supabase.from('transferencias').select('conta_origem_id, conta_destino_id, valor').range(0, 9999),
    supabase.from('ajustes_saldo').select('conta_bancaria_id, valor').range(0, 9999),
  ])

  const saldos = {} // contaId -> saldo atual
  for (const c of contas.data || []) {
    saldos[c.id] = Number(c.saldo_inicial)
  }

  for (const l of lancamentosPagos.data || []) {
    if (!(l.conta_bancaria_id in saldos)) continue
    saldos[l.conta_bancaria_id] += l.tipo === 'receber' ? Number(l.valor_pago) : -Number(l.valor_pago)
  }

  for (const t of transferencias.data || []) {
    if (t.conta_origem_id in saldos) saldos[t.conta_origem_id] -= Number(t.valor)
    if (t.conta_destino_id in saldos) saldos[t.conta_destino_id] += Number(t.valor)
  }

  for (const a of ajustes.data || []) {
    if (a.conta_bancaria_id in saldos) saldos[a.conta_bancaria_id] += Number(a.valor)
  }

  return { saldos, contas: contas.data || [] }
}
