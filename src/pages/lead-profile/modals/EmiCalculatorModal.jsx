import { useState, useMemo, useEffect } from 'react'
import { Modal } from '@/components/ui'

export default function EmiCalculatorModal({ open, onClose, defaultAmount }) {
  const [loanAmt, setLoanAmt] = useState('')
  const [tenure, setTenure] = useState('')
  const [tenureType, setTenureType] = useState('years')
  const [rate, setRate] = useState('')
  const [method, setMethod] = useState('reducing')

  useEffect(() => {
    if (open && defaultAmount && !loanAmt) setLoanAmt(String(defaultAmount))
  }, [open])

  const result = useMemo(() => {
    const P = parseFloat(loanAmt)
    const r = parseFloat(rate)
    const t = parseFloat(tenure)
    if (!P || !r || !t || P <= 0 || r <= 0 || t <= 0) return null
    const months = tenureType === 'years' ? t * 12 : t
    if (method === 'reducing') {
      const monthlyRate = r / 100 / 12
      const emi = (P * monthlyRate * Math.pow(1 + monthlyRate, months)) /
        (Math.pow(1 + monthlyRate, months) - 1)
      const totalPayable = emi * months
      return { emi: Math.round(emi), totalPayable: Math.round(totalPayable), totalInterest: Math.round(totalPayable - P), months }
    } else {
      const totalInterest = P * (r / 100) * (months / 12)
      const totalPayable = P + totalInterest
      return { emi: Math.round(totalPayable / months), totalPayable: Math.round(totalPayable), totalInterest: Math.round(totalInterest), months }
    }
  }, [loanAmt, tenure, tenureType, rate, method])

  const fmt = (n) => Number(n).toLocaleString('en-IN')

  return (
    <Modal open={open} onClose={onClose} title="EMI Calculator" width={480}>
      <div className="flex flex-col gap-4">

        {/* Method Toggle */}
        <div>
          <label className="label mb-2">Calculation method</label>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            {[
              { key: 'reducing', label: '📉 Reducing Balance', sub: '(Mostly Govt Bank)' },
              { key: 'flat', label: '📋 Flat Rate', sub: '(Mostly NBFC /Private Lender)' },
            ].map(m => (
              <button key={m.key} type="button" onClick={() => setMethod(m.key)}
                className={`flex-1 py-2.5 px-3 text-left transition-colors ${method === m.key ? 'bg-violet-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                <div className="text-xs font-semibold">{m.label}</div>
                <div className={`text-[10px] ${method === m.key ? 'text-violet-200' : 'text-slate-400'}`}>{m.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">Loan Amount (₹)</label>
            <input className="input" type="number" placeholder="e.g. 300000"
              value={loanAmt} onChange={e => setLoanAmt(e.target.value)} />
            {defaultAmount && !loanAmt && (
              <button type="button" onClick={() => setLoanAmt(String(defaultAmount))}
                className="mt-1 text-[11px] text-violet-600 underline">
                Use quoted amount: ₹{fmt(defaultAmount)}
              </button>
            )}
          </div>
          <div>
            <label className="label">Interest Rate (% per year)</label>
            <input className="input" type="number" step="0.1" placeholder="e.g. 10.5"
              value={rate} onChange={e => setRate(e.target.value)} />
          </div>
          <div>
            <label className="label">Tenure</label>
            <div className="flex gap-1">
              <input className="input" type="number" placeholder="e.g. 5"
                value={tenure} onChange={e => setTenure(e.target.value)} style={{ flex: 1 }} />
              <select className="select" value={tenureType} onChange={e => setTenureType(e.target.value)} style={{ width: 90 }}>
                <option value="years">Years</option>
                <option value="months">Months</option>
              </select>
            </div>
          </div>
        </div>

        {/* Result */}
        {result ? (
          <div className="rounded-xl bg-violet-50 border border-violet-200 p-4">
            <div className="text-center mb-3">
              <p className="text-xs text-violet-500 font-semibold uppercase tracking-widest mb-1">Monthly EMI</p>
              <p className="text-3xl font-bold text-violet-700">₹{fmt(result.emi)}</p>
              <p className="text-xs text-violet-400 mt-0.5">for {result.months} months</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center mt-3 pt-3 border-t border-violet-200">
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Principal</p>
                <p className="text-sm font-semibold text-slate-700">₹{fmt(loanAmt)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Total Interest</p>
                <p className="text-sm font-semibold text-red-600">₹{fmt(result.totalInterest)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Total Payable</p>
                <p className="text-sm font-semibold text-slate-700">₹{fmt(result.totalPayable)}</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-violet-200">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Principal</span><span>Interest</span>
              </div>
              <div className="flex rounded-full overflow-hidden h-2.5">
                <div className="bg-violet-500 transition-all"
                  style={{ width: `${Math.round((parseFloat(loanAmt) / result.totalPayable) * 100)}%` }} />
                <div className="bg-red-300 flex-1" />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>{Math.round((parseFloat(loanAmt) / result.totalPayable) * 100)}%</span>
                <span>{Math.round((result.totalInterest / result.totalPayable) * 100)}%</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-6 text-center text-slate-400 text-sm">
            Loan amount, rate aur tenure daalo — EMI calculate ho jaayegi ⚡
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button onClick={onClose} className="btn">Close</button>
        </div>
      </div>
    </Modal>
  )
}
