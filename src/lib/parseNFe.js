// Parser de XML de NFe (nota fiscal eletrônica brasileira), usando o DOMParser
// nativo do navegador. Cobre a estrutura padrão (infNFe/emit/det/prod/total),
// que é a mesma em praticamente todos os emissores.

function texto(elemento, seletor) {
  const el = elemento?.querySelector(seletor)
  return el ? el.textContent.trim() : null
}

export function parseNFeXML(xmlString) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlString, 'text/xml')

  const erro = doc.querySelector('parsererror')
  if (erro) {
    throw new Error('Não consegui ler esse arquivo como XML. Confirme se é o XML da nota (não o PDF/DANFE).')
  }

  const infNFe = doc.querySelector('infNFe')
  if (!infNFe) {
    throw new Error('Não encontrei os dados da NFe nesse arquivo. Confirme se é o XML correto.')
  }

  // Fornecedor (emitente da nota)
  const emit = infNFe.querySelector('emit')
  const cnpjBruto = texto(emit, 'CNPJ') || texto(emit, 'CPF')
  const cnpjFormatado =
    cnpjBruto && cnpjBruto.length === 14
      ? cnpjBruto.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
      : cnpjBruto

  const fornecedor = {
    nome: texto(emit, 'xNome'),
    documento: cnpjFormatado,
    telefone: texto(emit, 'fone'),
  }

  // Identificação da nota
  const ide = infNFe.querySelector('ide')
  const numeroNota = texto(ide, 'nNF')
  const dhEmi = texto(ide, 'dhEmi') || texto(ide, 'dEmi')
  const dataEmissao = dhEmi ? dhEmi.substring(0, 10) : null

  // Chave de acesso: tenta pegar do protocolo, senão extrai do atributo Id
  let chaveAcesso = texto(doc, 'protNFe infProt chNFe')
  if (!chaveAcesso) {
    const idAttr = infNFe.getAttribute('Id') || ''
    const match = idAttr.match(/(\d{44})/)
    if (match) chaveAcesso = match[1]
  }

  // Itens
  const itens = Array.from(infNFe.querySelectorAll('det')).map((det) => {
    const prod = det.querySelector('prod')
    return {
      descricao: texto(prod, 'xProd') || 'Item sem descrição',
      quantidade: Number(texto(prod, 'qCom')) || 1,
      valorUnitario: Number(texto(prod, 'vUnCom')) || 0,
      valorTotal: Number(texto(prod, 'vProd')) || 0,
    }
  })

  // Valor total da nota
  const valorTotal = Number(texto(infNFe, 'total ICMSTot vNF')) || itens.reduce((acc, i) => acc + i.valorTotal, 0)

  if (itens.length === 0) {
    throw new Error('Não encontrei nenhum item (produto) nessa nota.')
  }

  // Duplicatas (parcelas do pagamento) — ficam em <cobr><dup>
  const duplicatas = Array.from(infNFe.querySelectorAll('cobr dup')).map((dup) => ({
    numero: texto(dup, 'nDup'),
    dataVencimento: texto(dup, 'dVenc'),
    valor: Number(texto(dup, 'vDup')) || 0,
  }))

  return { fornecedor, numeroNota, dataEmissao, chaveAcesso, valorTotal, itens, duplicatas }
}
