// src/lib/pmoc.js
// Lógica do módulo PMOC (Programa de Manutenção, Operação e Controle).
//
// ⚠️ IMPORTANTE SOBRE O CONTEÚDO DOS CHECKLISTS (CHECKLISTS abaixo):
// Como o sandbox foi reiniciado, não tenho mais o texto exato dos itens que
// você me passou pra cada grupo (M/H/S/A). Coloquei aqui uma base de itens
// comuns de Portaria MS 3.523/1998 + NBR 17037/RDC 886/2024, só pra o sistema
// já funcionar de ponta a ponta. Depois me manda de novo a lista exata (ou
// edita direto aqui, é só texto simples) que eu ajusto — a lógica de geração
// não muda, só o conteúdo.
//
// Convenção do projeto: datas como string 'YYYY-MM-DD', nunca usar
// `new Date(str)` pra exibir.

import { addMonthsISO } from './format'

// ---------------------------------------------------------
// Conteúdo dos checklists por grupo (cumulativos)
// M = Mensal | H = Higienização (frequência configurável por equipamento)
// S = Semestral (fixo, meses 6 e 12) | A = Anual (fixo, mês 12)
// ---------------------------------------------------------
export const CHECKLISTS = {
  M: [
    'Verificar e registrar temperatura e umidade relativa do ambiente',
    'Inspecionar funcionamento geral do equipamento (ruídos, vibrações, vazamentos)',
    'Verificar dreno de condensado e limpeza da bandeja',
    'Limpar filtros de ar laváveis',
    'Verificar sujidade aparente nas grelhas de insuflamento e retorno',
  ],
  H: [
    'Higienização completa dos filtros de ar',
    'Higienização de serpentinas (evaporadora e condensadora)',
    'Higienização de bandejas de condensado e dutos acessíveis',
    'Desinfecção das superfícies internas do gabinete',
    'Verificação e limpeza das grelhas de insuflamento/retorno',
  ],
  S: [
    'Verificar isolamento térmico e acústico dos dutos',
    'Medir e registrar pressão e temperatura do fluido refrigerante',
    'Verificar aperto de conexões elétricas',
    'Verificar estado de correias, rolamentos e mancais (quando aplicável)',
    'Verificar equilíbrio de vazão de ar nas seções do sistema',
  ],
  A: [
    'Avaliação geral da qualidade do ar interno (PMOC anual)',
    'Verificação completa do sistema de exaustão e renovação de ar',
    'Inspeção de dutos com verificação de infiltrações/danos estruturais',
    'Revisão geral de componentes elétricos e mecânicos',
    'Emissão de relatório anual de conformidade do sistema',
  ],
}

export const LABEL_GRUPO = { M: 'Mensal', H: 'Higienização', S: 'Semestral', A: 'Anual' }
export const FREQUENCIAS_HIGIENIZACAO = ['trimestral', 'semestral', 'anual']

// ---------------------------------------------------------
// Quais grupos se aplicam em um determinado mês do ciclo (1 a 12),
// dado a frequência de higienização configurada para o equipamento.
// M está presente em todo mês. S nos meses 6 e 12. A no mês 12.
// H depende da frequência: trimestral (3,6,9,12) / semestral (6,12) / anual (12)
// ---------------------------------------------------------
export function gruposDoMes(numeroMes, frequenciaHigienizacao) {
  const grupos = ['M']

  const mesesH =
    frequenciaHigienizacao === 'trimestral'
      ? [3, 6, 9, 12]
      : frequenciaHigienizacao === 'semestral'
      ? [6, 12]
      : [12] // anual

  if (mesesH.includes(numeroMes)) grupos.push('H')
  if (numeroMes === 6 || numeroMes === 12) grupos.push('S')
  if (numeroMes === 12) grupos.push('A')

  return grupos
}

// Monta o array de itens do checklist (cumulativo) pra um conjunto de grupos
export function montarChecklistItens(grupos) {
  const itens = []
  for (const g of grupos) {
    for (const item of CHECKLISTS[g] || []) {
      itens.push({ item, grupo: g, concluido: false })
    }
  }
  return itens
}

// ---------------------------------------------------------
// Status calculado de uma visita (nunca guardado no banco)
// ---------------------------------------------------------
export function statusVisita(visita, hojeISO) {
  if (visita.data_realizada) return 'realizada'
  if (visita.data_prevista < hojeISO) return 'atrasada'
  return 'pendente'
}

export const COR_STATUS_VISITA = {
  realizada: 'bg-green-50 text-green-700 border-green-200',
  atrasada: 'bg-red-50 text-red-700 border-red-200',
  pendente: 'bg-gray-50 text-gray-600 border-gray-200',
}

export const LABEL_STATUS_VISITA = {
  realizada: 'Realizada',
  atrasada: 'Atrasada',
  pendente: 'Pendente',
}

// ---------------------------------------------------------
// Geração do ciclo de 12 visitas de um contrato, já com os itens de
// checklist por equipamento ativo em cada mês.
// Chamar logo após criar o contrato E os pmoc_equipamentos iniciais.
// ---------------------------------------------------------
export async function gerarCicloPmoc(supabase, contrato, equipamentosAtivos) {
  // equipamentosAtivos: linhas de pmoc_equipamentos (já inseridas) do contrato
  const visitasParaInserir = []
  for (let numeroMes = 1; numeroMes <= 12; numeroMes++) {
    visitasParaInserir.push({
      contrato_id: contrato.id,
      numero_mes: numeroMes,
      data_prevista: addMonthsISO(contrato.data_inicio, numeroMes - 1),
    })
  }

  const { data: visitasCriadas, error: erroVisitas } = await supabase
    .from('pmoc_visitas')
    .insert(visitasParaInserir)
    .select('*')

  if (erroVisitas) return { error: erroVisitas }

  const itensParaInserir = []
  for (const visita of visitasCriadas) {
    for (const equip of equipamentosAtivos) {
      // só inclui equipamento se já estava "dentro" do contrato nesse mês
      if (equip.data_entrada > visita.data_prevista) continue
      if (equip.data_saida && equip.data_saida <= visita.data_prevista) continue

      const grupos = gruposDoMes(visita.numero_mes, equip.frequencia_higienizacao)
      itensParaInserir.push({
        visita_id: visita.id,
        pmoc_equipamento_id: equip.id,
        grupos,
        checklist: montarChecklistItens(grupos),
      })
    }
  }

  if (itensParaInserir.length > 0) {
    const { error: erroItens } = await supabase.from('pmoc_visita_itens').insert(itensParaInserir)
    if (erroItens) return { error: erroItens }
  }

  return { visitas: visitasCriadas, error: null }
}

// ---------------------------------------------------------
// Adicionar equipamento no meio do ciclo: cria o vínculo pmoc_equipamentos
// e gera os itens de checklist só nas visitas FUTURAS ainda não realizadas.
// ---------------------------------------------------------
export async function adicionarEquipamentoContrato(supabase, contratoId, dadosEquipamento, hojeISO) {
  const { data: equip, error: erroEquip } = await supabase
    .from('pmoc_equipamentos')
    .insert({ contrato_id: contratoId, data_entrada: hojeISO, ...dadosEquipamento })
    .select('*')
    .single()

  if (erroEquip) return { error: erroEquip }

  const { data: visitasFuturas, error: erroVisitas } = await supabase
    .from('pmoc_visitas')
    .select('*')
    .eq('contrato_id', contratoId)
    .is('data_realizada', null)
    .gte('data_prevista', hojeISO)

  if (erroVisitas) return { error: erroVisitas }

  const itensParaInserir = (visitasFuturas || []).map((visita) => {
    const grupos = gruposDoMes(visita.numero_mes, equip.frequencia_higienizacao)
    return {
      visita_id: visita.id,
      pmoc_equipamento_id: equip.id,
      grupos,
      checklist: montarChecklistItens(grupos),
    }
  })

  if (itensParaInserir.length > 0) {
    const { error: erroItens } = await supabase.from('pmoc_visita_itens').insert(itensParaInserir)
    if (erroItens) return { error: erroItens }
  }

  return { equipamento: equip, error: null }
}

// ---------------------------------------------------------
// Remover equipamento do contrato (não exclui histórico): marca data_saida
// e apaga os itens de checklist só das visitas FUTURAS ainda não realizadas.
// ---------------------------------------------------------
export async function removerEquipamentoContrato(supabase, pmocEquipamentoId, dataSaidaISO) {
  const { error: erroUpdate } = await supabase
    .from('pmoc_equipamentos')
    .update({ data_saida: dataSaidaISO })
    .eq('id', pmocEquipamentoId)

  if (erroUpdate) return { error: erroUpdate }

  // apaga itens de visitas ainda não realizadas a partir da data de saída
  const { data: itensFuturos } = await supabase
    .from('pmoc_visita_itens')
    .select('id, pmoc_visitas!inner(data_prevista, data_realizada)')
    .eq('pmoc_equipamento_id', pmocEquipamentoId)

  const idsParaApagar = (itensFuturos || [])
    .filter((i) => !i.pmoc_visitas.data_realizada && i.pmoc_visitas.data_prevista >= dataSaidaISO)
    .map((i) => i.id)

  if (idsParaApagar.length > 0) {
    const { error: erroDelete } = await supabase.from('pmoc_visita_itens').delete().in('id', idsParaApagar)
    if (erroDelete) return { error: erroDelete }
  }

  return { error: null }
}

// ---------------------------------------------------------
// Alterar frequência de higienização de um equipamento: recalcula os
// grupos/checklist só das visitas FUTURAS ainda não realizadas.
// ---------------------------------------------------------
export async function alterarFrequenciaHigienizacao(supabase, pmocEquipamentoId, novaFrequencia, hojeISO) {
  const { error: erroUpdate } = await supabase
    .from('pmoc_equipamentos')
    .update({ frequencia_higienizacao: novaFrequencia })
    .eq('id', pmocEquipamentoId)

  if (erroUpdate) return { error: erroUpdate }

  const { data: itens, error: erroItens } = await supabase
    .from('pmoc_visita_itens')
    .select('id, pmoc_visitas!inner(numero_mes, data_prevista, data_realizada)')
    .eq('pmoc_equipamento_id', pmocEquipamentoId)

  if (erroItens) return { error: erroItens }

  const paraAtualizar = (itens || []).filter(
    (i) => !i.pmoc_visitas.data_realizada && i.pmoc_visitas.data_prevista >= hojeISO
  )

  for (const item of paraAtualizar) {
    const grupos = gruposDoMes(item.pmoc_visitas.numero_mes, novaFrequencia)
    await supabase
      .from('pmoc_visita_itens')
      .update({ grupos, checklist: montarChecklistItens(grupos) })
      .eq('id', item.id)
  }

  return { error: null }
}
