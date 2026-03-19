import { useNavigate } from 'react-router-dom'

export default function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="text-6xl font-bold text-slate-200">404</div>
      <p className="text-slate-500">Page not found</p>
      <button onClick={() => navigate('/')} className="btn">← Back to dashboard</button>
    </div>
  )
}
