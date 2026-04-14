import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
type AuthState = Parameters<typeof useAuthStore>[0] extends ((s: infer S) => unknown) ? S : never
import { useAlertWebSocket } from './hooks/useAlertWebSocket'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Recommendations from './pages/Recommendations'
import Budgets from './pages/Budgets'
import Login from './pages/Login'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s: AuthState) => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const location = useLocation()
  const isActive = location.pathname === href || (href !== '/' && location.pathname.startsWith(href))
  return (
    <a href={href} className={isActive ? 'active' : ''}>
      {children}
    </a>
  )
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const logout = useAuthStore((s: AuthState) => s.logout)
  useAlertWebSocket()

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">🔥 Phoenix</div>
        <nav className="sidebar-nav">
          <NavLink href="/">📊 Dashboard</NavLink>
          <NavLink href="/transactions">💳 Transactions</NavLink>
          <NavLink href="/budgets">💰 Budgets</NavLink>
          <NavLink href="/recommendations">💡 Recommendations</NavLink>
          <a href="#" onClick={(e) => { e.preventDefault(); logout(); }}>🚪 Logout</a>
        </nav>
      </aside>
      <main className="main-content">
        {children}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={
          <ProtectedRoute>
            <AppLayout><Dashboard /></AppLayout>
          </ProtectedRoute>
        } />
        <Route path="/transactions" element={
          <ProtectedRoute>
            <AppLayout><Transactions /></AppLayout>
          </ProtectedRoute>
        } />
        <Route path="/budgets" element={
          <ProtectedRoute>
            <AppLayout><Budgets /></AppLayout>
          </ProtectedRoute>
        } />
        <Route path="/recommendations" element={
          <ProtectedRoute>
            <AppLayout><Recommendations /></AppLayout>
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  )
}
