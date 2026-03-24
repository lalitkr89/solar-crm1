import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'

// Pages
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import LeadProfilePage from '@/pages/LeadProfilePage'
import KanbanPage from '@/pages/KanbanPage'
import TodayPage from '@/pages/TodayPage'
import PresalesPage from '@/pages/PresalesPage'
import SalesPage from '@/pages/SalesPage'
import FinancePage from '@/pages/FinancePage'
import OpsPage from '@/pages/OpsPage'
import AmcPage from '@/pages/AmcPage'
import UsersPage from '@/pages/UsersPage'
import NotFoundPage from '@/pages/NotFoundPage'
import BulkImportPage from '@/pages/BulkImportPage'
import SalesApprovalPage from '@/pages/SalesApprovalPage'
import PSDispositionApprovalsPage from '@/pages/PSDispositionApprovalsPage'

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (!user) return <Navigate to="/login" replace />
  return children
}

function RequireRole({ roles, children }) {
  const { role, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (!roles.includes(role)) return <Navigate to="/" replace />
  return children
}

function FullScreenLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-slate-500">Loading...</span>
      </div>
    </div>
  )
}

function AppRoutes() {
  const { user, role } = useAuth()

  // Redirect logged-in users away from login
  if (user && window.location.pathname === '/login') {
    return <Navigate to="/" replace />
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route path="/" element={
        <RequireAuth><DashboardPage /></RequireAuth>
      } />

      <Route path="/today" element={
        <RequireAuth><TodayPage /></RequireAuth>
      } />

      <Route path="/leads/:id" element={
        <RequireAuth><LeadProfilePage /></RequireAuth>
      } />

      <Route path="/kanban" element={
        <RequireAuth>
          <RequireRole roles={['super_admin', 'presales_manager', 'sales_manager', 'finance_manager', 'ops_manager', 'amc_manager']}>
            <KanbanPage />
          </RequireRole>
        </RequireAuth>
      } />

      <Route path="/presales" element={
        <RequireAuth>
          <RequireRole roles={['super_admin', 'presales_manager', 'presales_agent']}>
            <PresalesPage />
          </RequireRole>
        </RequireAuth>
      } />

      <Route path="/sales" element={
        <RequireAuth>
          <RequireRole roles={['super_admin', 'sales_manager', 'sales_agent']}>
            <SalesPage />
          </RequireRole>
        </RequireAuth>
      } />

      <Route path="/finance" element={
        <RequireAuth>
          <RequireRole roles={['super_admin', 'finance_manager', 'finance_agent']}>
            <FinancePage />
          </RequireRole>
        </RequireAuth>
      } />

      <Route path="/ops" element={
        <RequireAuth>
          <RequireRole roles={['super_admin', 'ops_manager', 'ops_agent']}>
            <OpsPage />
          </RequireRole>
        </RequireAuth>
      } />

      <Route path="/amc" element={
        <RequireAuth>
          <RequireRole roles={['super_admin', 'amc_manager', 'amc_agent']}>
            <AmcPage />
          </RequireRole>
        </RequireAuth>
      } />

      <Route path="/users" element={
        <RequireAuth>
          <RequireRole roles={['super_admin']}>
            <UsersPage />
          </RequireRole>
        </RequireAuth>
      } />
      <Route path="/bulk-import" element={
        <RequireAuth>
          <RequireRole roles={['super_admin', 'presales_manager']}>
            <BulkImportPage />
          </RequireRole>
        </RequireAuth>
      } />

      <Route path="/sales-approval" element={
        <RequireAuth>
          <RequireRole roles={['super_admin', 'sales_manager']}>
            <SalesApprovalPage />
          </RequireRole>
        </RequireAuth>
      } />

      <Route path="/ps-disposition-approvals" element={
        <RequireAuth>
          <RequireRole roles={['super_admin', 'presales_manager']}>
            <PSDispositionApprovalsPage />
          </RequireRole>
        </RequireAuth>
      } />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}