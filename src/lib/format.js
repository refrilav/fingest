// Convenção do projeto: datas são salvas e manipuladas como strings 'YYYY-MM-DD' ou
// 'YYYY-MM-DDTHH:mm'. NUNCA usar `new Date(str)` para exibir, pois isso aplica
// timezone e pode mudar o dia exibido. Sempre fatiar a própria string.

export function formatDateBR(dateStr) {
  if (!dateStr) return ''
  // dateStr esperado: 'YYYY-MM-DD' ou 'YYYY-MM-DDTHH:mm'
  const [datePart] = dateStr.split('T')
  const [year, month, day] = datePart.split('-')
  return `${day}/${month}/${year}`
}

export function formatDateTimeBR(dateStr) {
  if (!dateStr) return ''
  const clean = dateStr.substring(0, 16) // YYYY-MM-DDTHH:mm
  const [datePart, timePart] = clean.split('T')
  const [year, month, day] = datePart.split('-')
  return `${day}/${month}/${year}${timePart ? ' ' + timePart : ''}`
}

export function todayISO() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatCurrencyBRL(value) {
  const num = Number(value) || 0
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Converte 'DD/MM/YYYY' -> 'YYYY-MM-DD'. Aceita também Date do Excel (serial number)
// e já vindo em 'YYYY-MM-DD'. Retorna null se não conseguir interpretar.
export function parseDataBRparaISO(valor) {
  if (!valor && valor !== 0) return null

  // Já está em YYYY-MM-DD
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valor)) {
    return valor.substring(0, 10)
  }

  // Formato DD/MM/YYYY ou D/M/YYYY
  if (typeof valor === 'string') {
    const match = valor.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (match) {
      const [, day, month, year] = match
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    }
    // Traços como '—' ou vazio = sem data
    return null
  }

  // Número serial do Excel (dias desde 1899-12-30)
  if (typeof valor === 'number') {
    const epoch = new Date(Date.UTC(1899, 11, 30))
    const date = new Date(epoch.getTime() + valor * 86400000)
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  return null
}

// Compara duas datas 'YYYY-MM-DD' como strings (funciona pois o formato é ordenável)
export function isOverdue(dueDateStr, referenceDateStr = todayISO()) {
  if (!dueDateStr) return false
  return dueDateStr.substring(0, 10) < referenceDateStr.substring(0, 10)
}

// Recebe um mês no formato 'YYYY-MM' e devolve o primeiro e o último dia desse mês,
// como strings 'YYYY-MM-DD'. Útil para filtrar lançamentos por período.
export function getRangeMes(anoMes) {
  const [year, month] = anoMes.split('-').map(Number)
  const inicio = `${anoMes}-01`
  const ultimoDia = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const fim = `${anoMes}-${String(ultimoDia).padStart(2, '0')}`
  return { inicio, fim }
}

export function mesAtualISO() {
  return todayISO().substring(0, 7) // 'YYYY-MM'
}

// Gera array de meses 'YYYY-MM' entre início e fim (inclusive)
export function gerarIntervaloMeses(mesInicio, mesFim) {
  const meses = []
  let atual = `${mesInicio}-01`
  const limite = `${mesFim}-01`
  let protecao = 0
  while (atual <= limite && protecao < 240) {
    meses.push(atual.substring(0, 7))
    atual = addMonthsISO(atual, 1)
    protecao++
  }
  return meses
}

const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

// 'YYYY-MM' -> 'jul/26'
export function formatMesLabel(anoMes) {
  const [ano, mes] = anoMes.split('-').map(Number)
  return `${MESES_ABREV[mes - 1]}/${String(ano).substring(2)}`
}

// Soma N meses a uma data 'YYYY-MM-DD', ajustando para o último dia do mês quando
// o dia original não existir no mês de destino (ex: 31/01 + 1 mês -> 28 ou 29/02).
export function addMonthsISO(dateStr, meses) {
  const [year, month, day] = dateStr.substring(0, 10).split('-').map(Number)
  // meio-dia UTC evita qualquer problema de fuso horário na hora de extrair ano/mês/dia de volta
  const base = new Date(Date.UTC(year, month - 1 + meses, day, 12))
  // Se o dia "vazou" pro mês seguinte (dia inválido), volta pro último dia do mês certo
  const alvo = new Date(Date.UTC(year, month - 1 + meses + 1, 0, 12))
  const data = base.getUTCMonth() === alvo.getUTCMonth() ? base : alvo
  const y = data.getUTCFullYear()
  const m = String(data.getUTCMonth() + 1).padStart(2, '0')
  const d = String(data.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

