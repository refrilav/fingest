import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { lerPlanilhaDePessoas } from '../lib/importarPlanilha'
import { Upload, FileSpreadsheet, Check, AlertTriangle } from 'lucide-react'

const CAMPO_LABEL = {
  nome: 'Nome',
  documento: 'CPF/CNPJ',
  telefone: 'Telefone',
  email: 'E-mail',
  endereco: 'Endereço',
  bairro: 'Bairro',
  cidade: 'Cidade',
}

const TAMANHO_LOTE = 500

// tipo: 'clientes' | 'fornecedores'
export default function ImportarPessoas({ tipo }) {
  const [arquivo, setArquivo] = useState(null)
  const [linhas, setLinhas] = useState([])
  const [colunasDetectadas, setColunasDetectadas] = useState({})
  const [totalBruto, setTotalBruto] = useState(0)
  const [erro, setErro] = useState(null)
  const [importando, setImportando] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const [resultado, setResultado] = useState(null)

  const titulo = tipo === 'clientes' ? 'Clientes' : 'Fornecedores'

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setErro(null)
    setResultado(null)
    setArquivo(file)

    try {
      const { linhas: lidas, colunasDetectadas: cols, totalBruto: total } = await lerPlanilhaDePessoas(file)
      if (lidas.length === 0) {
        setErro('Não encontrei nenhuma linha com "Nome" preenchido nessa planilha. Confira o arquivo.')
        return
      }
      setLinhas(lidas)
      setColunasDetectadas(cols)
      setTotalBruto(total)
    } catch (err) {
      setErro('Não consegui ler esse arquivo. Confirme se é um .xlsx ou .csv válido.')
    }
  }

  async function importar() {
    setImportando(true)
    setErro(null)
    setProgresso(0)

    // Busca nomes já cadastrados para evitar duplicar em reimportações
    const { data: existentes } = await supabase.from(tipo).select('nome, telefone')
    const jaExiste = new Set((existentes || []).map((e) => `${(e.nome || '').toLowerCase()}|${e.telefone || ''}`))

    const novos = linhas.filter((l) => !jaExiste.has(`${(l.nome || '').toLowerCase()}|${l.telefone || ''}`))
    const duplicadas = linhas.length - novos.length

    let inseridos = 0
    let falhas = 0

    for (let i = 0; i < novos.length; i += TAMANHO_LOTE) {
      const lote = novos.slice(i, i + TAMANHO_LOTE)
      const { error, data } = await supabase.from(tipo).insert(lote).select('id')
      if (error) {
        falhas += lote.length
        setErro(`Erro ao importar um lote: ${error.message}`)
      } else {
        inseridos += data.length
      }
      setProgresso(Math.min(100, Math.round(((i + lote.length) / Math.max(novos.length, 1)) * 100)))
    }

    setResultado({ inseridos, duplicadas, falhas, total: linhas.length })
    setImportando(false)
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Importar {titulo}</h2>
      <p className="text-gray-500 text-sm mb-6">
        Envie uma planilha (.xlsx ou .csv) com pelo menos a coluna "Nome". As colunas Telefone,
        CPF/CNPJ, E-mail, Endereço, Bairro e Cidade são detectadas automaticamente se existirem.
      </p>

      {erro && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-3">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          {erro}
        </div>
      )}

      <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white p-8 cursor-pointer hover:border-primary-400 transition-colors mb-6">
        <Upload size={28} className="text-gray-400" />
        <span className="text-sm text-gray-600">
          {arquivo ? arquivo.name : 'Clique para escolher a planilha'}
        </span>
        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
      </label>

      {linhas.length > 0 && !resultado && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <FileSpreadsheet size={18} className="text-primary-600" />
            <p className="text-sm font-medium text-gray-800">
              {linhas.length} de {totalBruto} linha(s) prontas para importar
            </p>
          </div>

          <p className="text-xs text-gray-500 mb-2">Colunas detectadas:</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(colunasDetectadas).map(([campo, colOriginal]) => (
              <span key={campo} className="text-xs bg-primary-50 text-primary-700 rounded-full px-2 py-1">
                {CAMPO_LABEL[campo]} ← "{colOriginal}"
              </span>
            ))}
            {!colunasDetectadas.nome && (
              <span className="text-xs bg-red-50 text-red-600 rounded-full px-2 py-1">Nome não detectado!</span>
            )}
          </div>

          <p className="text-xs text-gray-500 mb-2">Prévia (primeiras 5 linhas):</p>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500">
                  {Object.keys(colunasDetectadas).map((campo) => (
                    <th key={campo} className="pr-4 pb-1">{CAMPO_LABEL[campo]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.slice(0, 5).map((l, i) => (
                  <tr key={i} className="text-gray-700">
                    {Object.keys(colunasDetectadas).map((campo) => (
                      <td key={campo} className="pr-4 py-0.5">{l[campo] || '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={importar}
            disabled={importando}
            className="flex items-center gap-2 rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700 disabled:opacity-60"
          >
            <Check size={16} />
            {importando ? `Importando... ${progresso}%` : `Importar ${linhas.length} ${titulo.toLowerCase()}`}
          </button>
        </div>
      )}

      {resultado && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm font-medium text-green-800 mb-1">Importação concluída</p>
          <ul className="text-sm text-green-700 space-y-0.5">
            <li>✅ {resultado.inseridos} novo(s) {titulo.toLowerCase()} importado(s)</li>
            {resultado.duplicadas > 0 && (
              <li>↺ {resultado.duplicadas} já existiam (mesmo nome + telefone) e foram ignorados</li>
            )}
            {resultado.falhas > 0 && <li>⚠️ {resultado.falhas} falharam ao importar</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
