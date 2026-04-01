// src/App.jsx
// REPLACE your existing file with this
// RequireRole ab database permissions use karta hai

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'

// Pages — sab same hain, kuch nahi badla
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import LeadProfilePage from '@/pages/lead-profile/LeadProfilePage'
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
import SalesAnalyticsPage from '@/pages/SalesAnalyticsPage'
import PSDispositionApprovalsPage from '@/pages/PSDispositionApprovalsPage'
import AttendancePage from '@/pages/AttendancePage'
import RolesPage from '@/pages/RolesPage'   // NEW

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

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (!user) return <Navigate to="/login" replace />
  return children
}

// ── NEW: RequireRole ab canAccessPage use karta hai ─────────
// Backward compatible — existing hardcoded roles bhi kaam karte hain
// DB permissions bhi kaam karti hain
function RequireRole({ path, roles, children }) {
  const { role, loading, canAccessPage, isSuperAdmin } = useAuth()
  if (loading) return <FullScreenLoader />

  // Super admin always allowed
  if (isSuperAdmin) return children

  // DB-based check (naya system)
  if (path && canAccessPage(path)) return children

  // Fallback: old hardcoded check (backward compat)
  if (roles && roles.includes(role)) return children

  return <Navigate to="/" replace />
}

function AppRoutes() {
  const { user } = useAuth()

  if (user && window.location.pathname === '/login') {
    return <Navigate to="/" replace />
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Dashboard — sab dekh sakte hain */}
      <Route path="/" element={
        <RequireAuth><DashboardPage /></RequireAuth>
      } />

      <Route path="/today" element={
        <RequireAuth><TodayPage /></RequireAuth>
      } />

      {/* Lead profile — sirf auth chahiye, role nahi */}
      <Route path="/leads/:id" element={
        <RequireAuth><LeadProfilePage /></RequireAuth>
      } />

      {/* Kanban */}
      <Route path="/kanban" element={
        <RequireAuth>
          <RequireRole path="/kanban" roles={['super_admin', 'presales_manager', 'sales_manager', 'finance_manager', 'ops_manager', 'amc_manager']}>
            <KanbanPage />
          </RequireRole>
        </RequireAuth>
      } />

      {/* Presales */}
      <Route path="/presales" element={
        <RequireAuth>
          <RequireRole path="/presales" roles={['super_admin', 'presales_manager', 'presales_agent']}>
            <PresalesPage />
          </RequireRole>
        </RequireAuth>
      } />

      <Route path="/bulk-import" element={
        <RequireAuth>
          <RequireRole path="/bulk-import" roles={['super_admin', 'presales_manager', 'presales_agent']}>
            <BulkImportPage />
          </RequireRole>
        </RequireAuth>
      } />

      <Route path="/ps-disposition-approvals" element={
        <RequireAuth>
          <RequireRole path="/ps-disposition-approvals" roles={['super_admin', 'presales_manager']}>
            <PSDispositionApprovalsPage />
          </RequireRole>
        </RequireAuth>
      } />

      <Route path="/attendance" element={
        <RequireAuth>
          <RequireRole path="/attendance" roles={['super_admin', 'presales_manager']}>
            <AttendancePage />
          </RequireRole>
        </RequireAuth>
      } />

      {/* Sales */}
      <Route path="/sales" element={
        <RequireAuth>
          <RequireRole path="/sales" roles={['super_admin', 'sales_manager', 'sales_agent']}>
            <SalesPage />
          </RequireRole>
        </RequireAuth>
      } />

      <Route path="/sales-analytics" element={
        <RequireAuth>
          <RequireRole path="/sales-analytics" roles={['super_admin', 'sales_manager', 'sales_agent']}>
            <SalesAnalyticsPage />
          </RequireRole>
        </RequireAuth>
      } />

      <Route path="/sales-approval" element={
        <RequireAuth>
          <RequireRole path="/sales-approval" roles={['super_admin', 'sales_manager']}>
            <SalesApprovalPage />
          </RequireRole>
        </RequireAuth>
      } />

      {/* Finance */}
      <Route path="/finance" element={
        <RequireAuth>
          <RequireRole path="/finance" roles={['super_admin', 'finance_manager', 'finance_agent']}>
            <FinancePage />
          </RequireRole>
        </RequireAuth>
      } />

      {/* Ops */}
      <Route path="/ops" element={
        <RequireAuth>
          <RequireRole path="/ops" roles={['super_admin', 'ops_manager', 'ops_agent']}>
            <OpsPage />
          </RequireRole>
        </RequireAuth>
      } />

      {/* AMC */}
      <Route path="/amc" element={
        <RequireAuth>
          <RequireRole path="/amc" roles={['super_admin', 'amc_manager', 'amc_agent']}>
            <AmcPage />
          </RequireRole>
        </RequireAuth>
      } />

      {/* Admin */}
      <Route path="/users" element={
        <RequireAuth>
          <RequireRole path="/users" roles={['super_admin']}>
            <UsersPage />
          </RequireRole>
        </RequireAuth>
      } />

      {/* NEW: Roles management page */}
      <Route path="/roles" element={
        <RequireAuth>
          <RequireRole path="/roles" roles={['super_admin']}>
            <RolesPage />
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
