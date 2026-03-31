import { useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  LayoutDashboard, Kanban, Phone, Users, Wallet,
  HardHat, Shield, CalendarCheck, Zap, LogOut,
  UserCog, Upload, Menu, X, ClipboardCheck,
  Activity, PauseCircle, BookOpen, UtensilsCrossed, Cookie, ClipboardList, TrendingUp,
} from 'lucide-react'
import { useAttendance } from '@/hooks/useAttendance'
import { STATUS_MAP, fmtSecs } from '@/lib/attendanceService'

const STATUS_ICONS = {
  active: Activity,
  hold: PauseCircle,
  training: BookOpen,
  lunch: UtensilsCrossed,
  snacks: Cookie,
}

const TEAM_COLOR = {
  presales: '#7F77DD',
  sales: '#378ADD',
  finance: '#1D9E75',
  ops: '#D85A30',
  amc: '#BA7517',
}

function NavContent({ onClose, profile, role, isSuperAdmin, isManager, onLogout, pendingCount = 0, pendingDispCount = 0, attendance }) {
  const initial = profile?.name?.[0]?.toUpperCase() ?? '?'
  const teamColor = TEAM_COLOR[profile?.team] ?? '#378ADD'
  const { isAgent, currentStatus, liveSecs, switching, statuses, handleSwitch } = attendance
  const [statusOpen, setStatusOpen] = useState(false)
  const dropdownRef = useRef(null)

  const cfg = currentStatus ? STATUS_MAP[currentStatus] : null
  const Icon = currentStatus ? STATUS_ICONS[currentStatus] : null

  // Close dropdown on outside click
  useEffect(() => {
    if (!statusOpen) return
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setStatusOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [statusOpen])

  return (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
          <Zap size={16} className="text-white" />
        </div>
        <div className="flex-1">
          <div className="text-white text-sm font-semibold leading-tight">SolarCRM</div>
          <div className="text-white/30 text-xs">Residential</div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-white/50 hover:text-white p-1">
            <X size={18} />
          </button>
        )}
      </div>

      {/* ── User card + Status dropdown ── */}
      <div ref={dropdownRef} className="mx-3 my-3 relative">

        {/* Clickable user card */}
        <button
          onClick={() => isAgent ? setStatusOpen(o => !o) : null}
          style={{
            width: '100%',
            background: statusOpen ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${cfg ? cfg.color + '55' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 14,
            padding: '10px 12px',
            cursor: isAgent ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            transition: 'all 0.2s ease',
          }}>

          {/* Avatar with status glow ring */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: teamColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: '#fff',
              boxShadow: cfg ? `0 0 0 2px #0B1F35, 0 0 0 4px ${cfg.color}` : 'none',
              transition: 'box-shadow 0.3s ease',
            }}>
              {initial}
            </div>
            {/* Pulsing dot for active status */}
            {cfg && (
              <span style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 9, height: 9, borderRadius: '50%',
                background: cfg.color,
                border: '2px solid #0B1F35',
                display: 'block',
              }} />
            )}
          </div>

          {/* Name + status row */}
          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.name ?? 'User'}
            </div>
            {isAgent && cfg ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color }}>
                  {cfg.label}
                </span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontVariantNumeric: 'tabular-nums' }}>
                  · {fmtSecs(liveSecs)}
                </span>
              </div>
            ) : (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2, textTransform: 'capitalize' }}>
                {role?.replace('_', ' ')}
              </div>
            )}
          </div>

          {/* Chevron */}
          {isAgent && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ flexShrink: 0, transform: statusOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          )}
        </button>

        {/* ── Dropdown panel ── */}
        {isAgent && statusOpen && (
          <div ref={dropdownRef} style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 100,
            background: '#0f2942',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 14,
            overflow: 'hidden',
            boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
          }}>
            <div style={{ padding: '8px 12px 6px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>
              Set Status
            </div>
            <div style={{ padding: '0 6px 6px' }}>
              {statuses.map(s => {
                const Ic = STATUS_ICONS[s.key]
                const isActive = currentStatus === s.key
                return (
                  <button
                    key={s.key}
                    onClick={() => { handleSwitch(s.key); setStatusOpen(false) }}
                    disabled={switching}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: 'none',
                      background: isActive ? s.color + '22' : 'transparent',
                      cursor: switching ? 'not-allowed' : 'pointer',
                      opacity: switching && !isActive ? 0.5 : 1,
                      transition: 'background 0.15s ease',
                    }}>
                    {/* Colored icon circle */}
                    <span style={{
                      width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                      background: isActive ? s.color : s.color + '20',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.2s',
                    }}>
                      <Ic size={13} color={isActive ? '#fff' : s.color} />
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: isActive ? s.color : 'rgba(255,255,255,0.7)', flex: 1, textAlign: 'left' }}>
                      {s.label}
                    </span>
                    {isActive && (
                      <span style={{
                        fontSize: 10, fontWeight: 700,
                        color: s.color,
                        background: s.color + '22',
                        padding: '2px 7px',
                        borderRadius: 20,
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {fmtSecs(liveSecs)}
                      </span>
                    )}
                    {isActive && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 pb-2 flex flex-col gap-0.5">
        <div className="section-label">Main</div>

        <NavLink to="/" end onClick={onClose}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <LayoutDashboard size={15} /> Dashboard
        </NavLink>

        <NavLink to="/today" onClick={onClose}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <CalendarCheck size={15} /> Today's actions
        </NavLink>

        {(isManager || isSuperAdmin) && (
          <NavLink to="/kanban" onClick={onClose}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Kanban size={15} /> Pipeline kanban
          </NavLink>
        )}

        {(role?.startsWith('presales') || isSuperAdmin) && (
          <>
            <div className="section-label">Pre-sales</div>
            <NavLink to="/presales" onClick={onClose}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Phone size={15} /> Calling dashboard
            </NavLink>
            <NavLink to="/bulk-import" onClick={onClose}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Upload size={15} /> Bulk import
            </NavLink>
            {(role === 'presales_manager' || isSuperAdmin) && (
              <>
                <NavLink to="/ps-disposition-approvals" onClick={onClose}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                  <ClipboardCheck size={15} /> Disposition Approvals
                  {pendingDispCount > 0 && (
                    <span className="ml-auto bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                      {pendingDispCount}
                    </span>
                  )}
                </NavLink>
                <NavLink to="/attendance" onClick={onClose}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                  <ClipboardList size={15} /> Attendance
                </NavLink>
              </>
            )}
          </>
        )}

        {(role?.startsWith('sales') || isSuperAdmin) && (
          <>
            <div className="section-label">Sales</div>
            <NavLink to="/sales" onClick={onClose}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Users size={15} /> Meetings & leads
            </NavLink>
            <NavLink to="/sales-analytics" onClick={onClose}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <TrendingUp size={15} /> Analytics
            </NavLink>
            {(role === 'sales_manager' || isSuperAdmin) && (
              <NavLink to="/sales-approval" onClick={onClose}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <ClipboardCheck size={15} /> Order Approvals
                {pendingCount > 0 && (
                  <span className="ml-auto bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                    {pendingCount}
                  </span>
                )}
              </NavLink>
            )}
          </>
        )}

        {(role?.startsWith('finance') || isSuperAdmin) && (
          <>
            <div className="section-label">Finance</div>
            <NavLink to="/finance" onClick={onClose}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Wallet size={15} /> Payments
            </NavLink>
          </>
        )}

        {(role?.startsWith('ops') || isSuperAdmin) && (
          <>
            <div className="section-label">Ops</div>
            <NavLink to="/ops" onClick={onClose}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <HardHat size={15} /> Docs & installation
            </NavLink>
          </>
        )}

        {(role?.startsWith('amc') || isSuperAdmin) && (
          <>
            <div className="section-label">AMC</div>
            <NavLink to="/amc" onClick={onClose}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Shield size={15} /> Service & renewals
            </NavLink>
          </>
        )}

        {isSuperAdmin && (
          <>
            <div className="section-label">Admin</div>
            <NavLink to="/users" onClick={onClose}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <UserCog size={15} /> Manage users
            </NavLink>
          </>
        )}
      </nav>

      {/* Logout */}
      <div className="px-2 pb-4 border-t border-white/10 pt-3">
        <button onClick={onLogout}
          className="nav-item w-full text-red-400 hover:text-red-300 hover:bg-red-500/10">
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </>
  )
}

export default function Sidebar() {
  const { profile, role, isSuperAdmin, isManager, signOut } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [pendingDispCount, setPendingDispCount] = useState(0)
  const attendance = useAttendance()

  useEffect(() => {
    if (role === 'sales_manager' || role === 'super_admin') {
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('stage', 'sale_pending_approval')
        .then(({ count }) => setPendingCount(count ?? 0))
    }
    if (role === 'presales_manager' || role === 'super_admin') {
      supabase
        .from('disposition_approvals')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .then(({ count }) => setPendingDispCount(count ?? 0))
    }
  }, [role])

  async function handleLogout() {
    await attendance.handleClockOut()   // close attendance session
    await signOut()
    navigate('/login')
  }

  const navProps = {
    profile, role, isSuperAdmin, isManager,
    onLogout: handleLogout,
    pendingCount,
    pendingDispCount,
    attendance,
  }

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="sidebar">
        <NavContent {...navProps} onClose={null} />
      </aside>

      {/* ── Mobile hamburger ── */}
      <button
        className="mobile-menu-btn"
        onClick={() => setMobileOpen(true)}
        style={{
          position: 'fixed', top: 12, left: 12, zIndex: 50,
          width: 36, height: 36, borderRadius: 8,
          background: '#0B1F35', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}>
        <Menu size={18} color="white" />
      </button>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <div className="mobile-overlay"
          style={{
            position: 'fixed', inset: 0, zIndex: 60,
            display: 'flex',
          }}>
          {/* Backdrop */}
          <div
            onClick={() => setMobileOpen(false)}
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.5)',
            }} />
          {/* Drawer */}
          <div style={{
            position: 'relative', zIndex: 70,
            width: '75vw', maxWidth: 280,
            background: '#0B1F35',
            display: 'flex', flexDirection: 'column',
            height: '100%', overflowY: 'auto',
          }}>
            <NavContent {...navProps} onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
    </>
  )
}