import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  LayoutDashboard, Kanban, Phone, Users, Wallet,
  HardHat, Shield, CalendarCheck, Zap, LogOut,
  ChevronRight, UserCog, Upload,
} from 'lucide-react'

const TEAM_COLOR = {
  presales: '#7F77DD',
  sales: '#378ADD',
  finance: '#1D9E75',
  ops: '#D85A30',
  amc: '#BA7517',
}

export default function Sidebar() {
  const { profile, role, isSuperAdmin, isManager, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  const initial = profile?.name?.[0]?.toUpperCase() ?? '?'
  const teamColor = TEAM_COLOR[profile?.team] ?? '#378ADD'

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
          <Zap size={16} className="text-white" />
        </div>
        <div>
          <div className="text-white text-sm font-semibold leading-tight">SolarCRM</div>
          <div className="text-white/30 text-xs">Residential</div>
        </div>
      </div>

      {/* User pill */}
      <div className="mx-3 my-3 p-2.5 rounded-xl flex items-center gap-2.5"
        style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
          style={{ background: teamColor }}>
          {initial}
        </div>
        <div className="min-w-0">
          <div className="text-white text-xs font-medium truncate">{profile?.name ?? 'User'}</div>
          <div className="text-white/40 text-xs truncate capitalize">{role?.replace('_', ' ')}</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 pb-2 flex flex-col gap-0.5">
        <div className="section-label">Main</div>

        <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <LayoutDashboard size={15} /> Dashboard
        </NavLink>

        <NavLink to="/today" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <CalendarCheck size={15} /> Today's actions
        </NavLink>

        {(isManager || isSuperAdmin) && (
          <NavLink to="/kanban" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Kanban size={15} /> Pipeline kanban
          </NavLink>
        )}

        {/* Team-specific links */}
        {(role?.startsWith('presales') || isSuperAdmin) && (
          <>
            <div className="section-label">Pre-sales</div>
            <NavLink to="/presales" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Phone size={15} /> Calling dashboard
            </NavLink>
            <NavLink to="/bulk-import" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Upload size={15} /> Bulk import
            </NavLink>
          </>
        )}

        {(role?.startsWith('sales') || isSuperAdmin) && (
          <>
            <div className="section-label">Sales</div>
            <NavLink to="/sales" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Users size={15} /> Meetings & leads
            </NavLink>
          </>
        )}

        {(role?.startsWith('finance') || isSuperAdmin) && (
          <>
            <div className="section-label">Finance</div>
            <NavLink to="/finance" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Wallet size={15} /> Payments
            </NavLink>
          </>
        )}

        {(role?.startsWith('ops') || isSuperAdmin) && (
          <>
            <div className="section-label">Ops</div>
            <NavLink to="/ops" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <HardHat size={15} /> Docs & installation
            </NavLink>
          </>
        )}

        {(role?.startsWith('amc') || isSuperAdmin) && (
          <>
            <div className="section-label">AMC</div>
            <NavLink to="/amc" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Shield size={15} /> Service & renewals
            </NavLink>
          </>
        )}

        {isSuperAdmin && (
          <>
            <div className="section-label">Admin</div>
            <NavLink to="/users" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <UserCog size={15} /> Manage users
            </NavLink>
          </>
        )}
      </nav>

      {/* Logout */}
      <div className="px-2 pb-4 border-t border-white/10 pt-3">
        <button
          onClick={handleLogout}
          className="nav-item w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
        >
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </aside>
  )
}
