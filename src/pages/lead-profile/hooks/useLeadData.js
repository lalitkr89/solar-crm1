import { useState, useEffect } from 'react'
import { getLeadById, getLeadHistory } from '@/lib/leadService'
import { supabase } from '@/lib/supabase'

export function useLeadData(id) {
  const [lead, setLead] = useState(null)
  const [history, setHistory] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const [l, h] = await Promise.all([getLeadById(id), getLeadHistory(id)])
    setLead(l)
    setHistory(h)
    const { data: p } = await supabase
      .from('payments')
      .select('*')
      .eq('lead_id', id)
      .order('created_at')
    setPayments(p ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  return { lead, setLead, history, payments, loading }
}
