import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getLeadById, getLeadHistory } from '@/lib/leadService'
import { supabase } from '@/lib/supabase'
import { trackActivity } from '@/lib/attendanceService'

export function useLeadData(id) {
  const { profile } = useAuth()
  const [lead, setLead] = useState(null)
  const [history, setHistory] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
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
  }, [id])

  useEffect(() => {
    load()
    // Track lead open activity (once per lead change)
    if (profile?.id) {
      trackActivity(profile.id, 'lead_open', { lead_id: id })
    }
  }, [id])  // eslint-disable-line react-hooks/exhaustive-deps

  return { lead, setLead, history, payments, loading, reload: load }
}