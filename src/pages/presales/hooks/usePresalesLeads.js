import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { cleanPhone } from '@/lib/phone'
import { applyFilter } from '../config/utils'

export function usePresalesLeads() {
  const { profile, isManager, isSuperAdmin } = useAuth()
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    let q = supabase
      .from('leads')
      .select(`id, name, phone, city, stage, call_status, disposition,
        calling_date, callback_date, callback_slot,
        meeting_date, meeting_slot, lead_source,
        sales_outcome, sales_lead_status,
        assigned_to,
        presales_agent_id, presales_agent:presales_agent_id(name),
        sales_agent_id, sales_agent:sales_agent_id(name),
        updated_at`)
      .in('stage', ['new', 'meeting_scheduled', 'qc_followup', 'non_qualified', 'not_interested', 'lost', 'sale_pending_approval', 'sale_closed', 'sale_rejected'])
      .order('updated_at', { ascending: false })

    if (!isManager && !isSuperAdmin) q = q.eq('presales_agent_id', profile.id)

    const { data } = await q
    setLeads((data ?? []).map(l => ({
      ...l,
      assigned_name: l.presales_agent?.name ?? '',
      sales_agent_name: l.sales_agent?.name ?? '',
      phone_clean: cleanPhone(l.phone),
    })))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return { leads, loading, reload: load }
}
