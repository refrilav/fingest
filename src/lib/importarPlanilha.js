import * as XLSX from 'xlsx'

// Aliases de nomes de coluna conhecidos -> campo do sistema.
// Comparação é case-insensitive e ignora acentos/espaços extras.
const ALIASES = {
  nome: ['nome', 'cliente', 'fornecedor', 'razao social', 'razão social'],
  documento: ['documento', 'cpf', 'cnpj', 'cpf/cnpj', 'cpf cnpj'],
  telefone: ['telefone', 'celular', 'fone', 'whatsapp', 'contato'],
  email: ['email', 'e-mail'],
  endereco: ['endereco', 'endereço', 'rua', 'logradouro'],
  bairro: ['bairro'],
  cidade: ['cidade', 'municipio', 'município'],
}

function normalizar(str) {
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .trim()
}

// Lê o arquivo (File do input) e retorna { linhas, colunasDetectadas }
// linhas: array de objetos já mapeados para os campos do sistema (nome, documento, telefone, ...)
export async function lerPlanilhaDePessoas(file) {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const primeiraAba = workbook.SheetNames[0]
  const linhasBrutas = XLSX.utils.sheet_to_json(workbook.Sheets[primeiraAba], { defval: null })

  if (linhasBrutas.length === 0) {
    return { linhas: [], colunasDetectadas: {} }
  }

  const colunasOriginais = Object.keys(linhasBrutas[0])
  const colunasDetectadas = {} // campo do sistema -> nome da coluna original

  for (const [campo, aliases] of Object.entries(ALIASES)) {
    const encontrada = colunasOriginais.find((col) => aliases.includes(normalizar(col)))
    if (encontrada) colunasDetectadas[campo] = encontrada
  }

  const linhas = linhasBrutas
    .map((linha) => {
      const item = {}
      for (const [campo, colunaOriginal] of Object.entries(colunasDetectadas)) {
        const valor = linha[colunaOriginal]
        const valorLimpo = valor === null || valor === undefined ? '' : String(valor).trim()
        item[campo] = valorLimpo === '' ? null : valorLimpo
      }
      return item
    })
    .filter((item) => item.nome) // descarta linhas sem nome

  return { linhas, colunasDetectadas, totalBruto: linhasBrutas.length }
}
