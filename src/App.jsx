import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Lancamentos from './pages/Lancamentos'
import Conciliacao from './pages/Conciliacao'
import Relatorios from './pages/Relatorios'
import Categorias from './pages/Categorias'
import Fornecedores from './pages/Fornecedores'
import Clientes from './pages/Clientes'
import ContasBancarias from './pages/ContasBancarias'
import ImportarPessoas from './pages/ImportarPessoas'
import Transferencias from './pages/Transferencias'
import AjustesSaldo from './pages/AjustesSaldo'
import ExtratoConta from './pages/ExtratoConta'
import FluxoCaixa from './pages/FluxoCaixa'

function RotaProtegida({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Carregando...</div>
  if (!session) return <Navigate to="/login" replace />
  return children
}

function Rotas() {
  const { session } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
      <Route
        path="/"
        element={
          <RotaProtegida>
            <Layout />
          </RotaProtegida>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="contas-a-pagar" element={<Lancamentos tipo="pagar" />} />
        <Route path="contas-a-receber" element={<Lancamentos tipo="receber" />} />
        <Route path="conciliacao" element={<Conciliacao />} />
        <Route path="relatorios" element={<Relatorios />} />
        <Route path="fluxo-caixa" element={<FluxoCaixa />} />
        <Route path="categorias" element={<Categorias />} />
        <Route path="fornecedores" element={<Fornecedores />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="clientes/importar" element={<ImportarPessoas tipo="clientes" />} />
        <Route path="fornecedores/importar" element={<ImportarPessoas tipo="fornecedores" />} />
        <Route path="contas-bancarias" element={<ContasBancarias />} />
        <Route path="transferencias" element={<Transferencias />} />
        <Route path="ajustes-saldo" element={<AjustesSaldo />} />
        <Route path="contas-bancarias/:id" element={<ExtratoConta />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Rotas />
      </AuthProvider>
    </BrowserRouter>
  )
}
