import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { Wallet } from 'lucide-react'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState(null)
  const [carregando, setCarregando] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setErro(null)
    setCarregando(true)
    const { error } = await signIn(email, senha)
    setCarregando(false)
    if (error) setErro('E-mail ou senha inválidos.')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-8 w-full max-w-sm">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <Wallet className="text-primary-600" size={24} />
          <h1 className="text-lg font-bold text-gray-900">FinGest</h1>
        </div>

        {erro && <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{erro}</div>}

        <label className="block text-sm text-gray-600 mb-1">E-mail</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mb-4"
          required
        />

        <label className="block text-sm text-gray-600 mb-1">Senha</label>
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mb-6"
          required
        />

        <button
          type="submit"
          disabled={carregando}
          className="w-full rounded-lg bg-primary-600 text-white py-2 text-sm font-medium hover:bg-primary-700 disabled:opacity-60"
        >
          {carregando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
