import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Home from './pages/Home'
import OrdensServico from './pages/OrdensServico'
import Orcamentos from './pages/Orcamentos'
import Vendas from './pages/Vendas'
import VendasHub from './pages/VendasHub'
import Compras from './pages/Compras'
import Estoque from './pages/Estoque'
import Lancamentos from './pages/Lancamentos'
import Conciliacao from './pages/Conciliacao'
import Relatorios from './pages/Relatorios'
import FluxoCaixa from './pages/FluxoCaixa'
import Categorias from './pages/Categorias'
import Fornecedores from './pages/Fornecedores'
import Clientes from './pages/Clientes'
import ClienteDetalhe from './pages/ClienteDetalhe'
import ContasBancarias from './pages/ContasBancarias'
import ImportarPessoas from './pages/ImportarPessoas'
import Transferencias from './pages/Transferencias'
import AjustesSaldo from './pages/AjustesSaldo'
import ExtratoConta from './pages/ExtratoConta'
import ImprimirOS from './pages/ImprimirOS'
import Recibo from './pages/Recibo'
import ImprimirOrcamento from './pages/ImprimirOrcamento'
import ImprimirCobranca from './pages/ImprimirCobranca'
import RelatorioOS from './pages/RelatorioOS'
import RelatorioFinanceiro from './pages/RelatorioFinanceiro'
import AtivosCliente from './pages/AtivosCliente'
import ImprimirQRCodes from './pages/ImprimirQRCodes'
import PublicoAtivo from './pages/PublicoAtivo'
import GerarLaudo from './pages/GerarLaudo'
import ImprimirLaudo from './pages/ImprimirLaudo'
import Financeiro from './pages/Financeiro'
import Cadastros from './pages/Cadastros'
import EstoqueQRCodes from './pages/EstoqueQRCodes'
import ImprimirQRCodesEstoque from './pages/ImprimirQRCodesEstoque'
import Agenda from './pages/Agenda'

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
      <Route path="/publico/ativo/:id" element={<PublicoAtivo />} />
      <Route path="/laudo/:id/imprimir" element={<ImprimirLaudo />} />
      <Route
        path="/ordens-servico/:id/imprimir"
        element={
          <RotaProtegida>
            <ImprimirOS />
          </RotaProtegida>
        }
      />
      <Route
        path="/recibo/:id"
        element={
          <RotaProtegida>
            <Recibo />
          </RotaProtegida>
        }
      />
      <Route
        path="/orcamentos/:id/imprimir"
        element={
          <RotaProtegida>
            <ImprimirOrcamento />
          </RotaProtegida>
        }
      />
      <Route
        path="/cobranca/:id/imprimir"
        element={
          <RotaProtegida>
            <ImprimirCobranca />
          </RotaProtegida>
        }
      />
      <Route
        path="/ordens-servico/relatorio"
        element={
          <RotaProtegida>
            <RelatorioOS />
          </RotaProtegida>
        }
      />
      <Route
        path="/financeiro/relatorio"
        element={
          <RotaProtegida>
            <RelatorioFinanceiro />
          </RotaProtegida>
        }
      />
      <Route
        path="/clientes/:clienteId/ativos/qrcodes"
        element={
          <RotaProtegida>
            <ImprimirQRCodes />
          </RotaProtegida>
        }
      />
      <Route
        path="/ordens-servico/:osId/laudo"
        element={
          <RotaProtegida>
            <GerarLaudo />
          </RotaProtegida>
        }
      />
      <Route
        path="/estoque-qrcodes/imprimir"
        element={
          <RotaProtegida>
            <ImprimirQRCodesEstoque />
          </RotaProtegida>
        }
      />
      <Route
        path="/"
        element={
          <RotaProtegida>
            <Layout />
          </RotaProtegida>
        }
      >
        <Route index element={<Agenda />} />
        <Route path="menu" element={<Home />} />
        <Route path="financeiro" element={<Financeiro />} />
        <Route path="cadastros" element={<Cadastros />} />
        <Route path="ordens-servico" element={<OrdensServico />} />
        <Route path="orcamentos" element={<Orcamentos />} />
        <Route path="estoque" element={<Estoque />} />
        <Route path="vendas" element={<VendasHub />} />
        <Route path="vendas/pecas" element={<Vendas />} />
        <Route path="compras" element={<Compras />} />
        <Route path="estoque-qrcodes" element={<EstoqueQRCodes />} />
        <Route path="contas-a-pagar" element={<Lancamentos tipo="pagar" />} />
        <Route path="contas-a-receber" element={<Lancamentos tipo="receber" />} />
        <Route path="conciliacao" element={<Conciliacao />} />
        <Route path="relatorios" element={<Relatorios />} />
        <Route path="fluxo-caixa" element={<FluxoCaixa />} />
        <Route path="categorias" element={<Categorias />} />
        <Route path="fornecedores" element={<Fornecedores />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="clientes/:id" element={<ClienteDetalhe />} />
        <Route path="clientes/:clienteId/ativos" element={<AtivosCliente />} />
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
