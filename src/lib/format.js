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

