import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useAlertWebSocket } from './hooks/useAlertWebSocket'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Recommendations from './pages/Recommendations'
import Login from './pages/Login'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const logout = useAuthStore(s => s.logout)
  useAlertWebSocket()

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">🔥 Phoenix</div>
        <nav className="sidebar-nav">
          <a href="/" className="active">📊 Dashboard</a>
          <a href="/transactions">💳 Transactions</a>
          <a href="/recommendations">💡 Recommendations</a>
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
        <Route path="/recommendations" element={
          <ProtectedRoute>
            <AppLayout><Recommendations /></AppLayout>
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  )
}
