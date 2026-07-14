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

// Compara duas datas 'YYYY-MM-DD' como strings (funciona pois o formato é ordenável)
export function isOverdue(dueDateStr, referenceDateStr = todayISO()) {
  if (!dueDateStr) return false
  return dueDateStr.substring(0, 10) < referenceDateStr.substring(0, 10)
}
