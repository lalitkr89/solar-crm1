import Sidebar from './Sidebar'

export default function Layout({ children }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="main-content flex-1 p-6">
        {children}
      </main>
    </div>
  )
}
