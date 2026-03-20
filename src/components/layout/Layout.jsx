import Sidebar from './Sidebar'

export default function Layout({ children }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      {/* Desktop: margin for sidebar. Mobile: no margin, full width */}
      <main className="flex-1 min-w-0 overflow-x-hidden
        p-3 pt-14
        lg:p-6 lg:pt-6 lg:ml-[var(--sidebar-w)]">
        {children}
      </main>
    </div>
  )
}