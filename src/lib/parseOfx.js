// Parser simples de OFX (formato usado por bancos para extrato).
// OFX é um formato tipo SGML — tags sem fechamento obrigatório em versões antigas (OFX 1.x/SGML)
// ou XML válido em versões novas (OFX 2.x). Este parser lida com ambos via regex,
// que é mais tolerante a variações entre bancos do que um parser XML estrito.

function extrairTag(bloco, tag) {
  const regex = new RegExp(`<${tag}>([^<\r\n]*)`, 'i')
  const match = bloco.match(regex)
  return match ? match[1].trim() : null
}

// Datas OFX vêm como YYYYMMDDHHMMSS ou YYYYMMDD
function parseDataOfx(valor) {
  if (!valor) return null
  const digits = valor.replace(/[^\d]/g, '').substring(0, 8)
  if (digits.length < 8) return null
  const year = digits.substring(0, 4)
  const month = digits.substring(4, 6)
  const day = digits.substring(6, 8)
  return `${year}-${month}-${day}`
}

export function parseOfx(conteudoTexto) {
  const transacoes = []

  // Cada transação fica dentro de <STMTTRN>...</STMTTRN>
  const blocos = conteudoTexto.split(/<STMTTRN>/i).slice(1)

  for (const blocoBruto of blocos) {
    // corta no fechamento da tag, se existir, senão usa até o próximo STMTTRN (já cortado pelo split)
    const bloco = blocoBruto.split(/<\/STMTTRN>/i)[0]

    const fitid = extrairTag(bloco, 'FITID')
    const dtposted = extrairTag(bloco, 'DTPOSTED')
    const trnamt = extrairTag(bloco, 'TRNAMT')
    const memo = extrairTag(bloco, 'MEMO')
    const name = extrairTag(bloco, 'NAME')
    const trntype = extrairTag(bloco, 'TRNTYPE')

    if (!fitid || !trnamt) continue // transação inválida/incompleta, pula

    transacoes.push({
      fitid,
      data: parseDataOfx(dtposted),
      valor: Number(trnamt),
      descricao: memo || name || trntype || 'Transação bancária',
    })
  }

  return transacoes
}
