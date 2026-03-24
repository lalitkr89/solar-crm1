import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Zap, Mail, Lock, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signIn(email, password)
      setTimeout(() => navigate('/'), 400)
    } catch (err) {
      setError(err.message || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#0B1F35]">

      {/* 🌞 SOLAR GLOW BACKGROUND */}
      <div className="absolute inset-0">
        {/* sun glow */}
        <div className="absolute w-[500px] h-[500px] bg-orange-400/30 blur-[120px] top-[-150px] right-[-100px]" />

        {/* blue energy glow */}
        <div className="absolute w-[400px] h-[400px] bg-blue-500/20 blur-[120px] bottom-[-100px] left-[-100px]" />
      </div>

      {/* 💎 CARD */}
      <div className="relative z-10 w-full max-w-md px-6">
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 shadow-2xl">

          {/* LOGO */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-yellow-300 flex items-center justify-center shadow-lg mb-3">
              <Zap className="text-black" />
            </div>
            <h1 className="text-white text-xl font-semibold tracking-tight">
              SolarCRM
            </h1>
            <p className="text-xs text-orange-300">
              Powering solar businesses ⚡
            </p>
          </div>

          {/* TITLE */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-semibold text-white">
              Welcome back
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Track leads. Close deals. Grow faster.
            </p>
          </div>

          {/* ERROR */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 mb-4">
              <AlertCircle size={16} className="text-red-400" />
              <span className="text-sm text-red-300">{error}</span>
            </div>
          )}

          {/* FORM */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            {/* EMAIL */}
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="email"
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white
                  focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 outline-none"
                  placeholder="you@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* PASSWORD */}
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="password"
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white
                  focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 outline-none"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>

              <div className="text-right mt-1">
                <a href="#" className="text-xs text-orange-300 hover:underline">
                  Forgot password?
                </a>
              </div>
            </div>

            {/* BUTTON */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 mt-2 rounded-lg font-medium text-black
              bg-gradient-to-r from-orange-400 to-yellow-300
              hover:from-orange-300 hover:to-yellow-200
              transition transform hover:-translate-y-[1px] active:scale-[0.98]
              shadow-lg flex items-center justify-center"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>

          </form>

          <p className="text-center text-xs text-slate-500 mt-6">
            From first lead to final installation — seamlessly ⚡
          </p>

        </div>
      </div>
    </div>
  )
}