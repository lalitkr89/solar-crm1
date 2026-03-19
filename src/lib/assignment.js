import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'

// ── Round robin — bulk import ke liye ────────────────────────
export async function getNextCaller(team = 'presales') {
  try {
    const { data: callers } = await supabase
      .from('users')
      .select('id, name')
      .eq('team', team)
      .eq('role', `${team}_agent`)
      .eq('is_active', true)
      .order('name')

    if (!callers || callers.length === 0) return null

    const { data: lastLeads } = await supabase
      .from('leads')
      .select('presales_agent_id')
      .not('presales_agent_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)

    if (!lastLeads || lastLeads.length === 0) return callers[0]

    const lastId = lastLeads[0].presales_agent_id
    const idx = callers.findIndex(c => c.id === lastId)
    if (idx === -1) return callers[0]
    return callers[(idx + 1) % callers.length]
  } catch {
    return null
  }
}

// ── Bulk import assign ────────────────────────────────────────
export async function autoAssignLead(leadId, team = 'presales') {
  const caller = await getNextCaller(team)
  if (!caller) return null

  await supabase
    .from('leads')
    .update({ assigned_to: caller.id, presales_agent_id: caller.id })
    .eq('id', leadId)

  return caller
}

// ── Direct assign — Add Lead modal se logged-in agent ko ─────
export async function assignLeadToCurrentUser(leadId, agentId) {
  if (!agentId) return null
  await supabase
    .from('leads')
    .update({ assigned_to: agentId, presales_agent_id: agentId })
    .eq('id', leadId)
  return { id: agentId }
}

// ── Next unassigned lead — disposition save ke baad ──────────
export async function assignNextUnassignedLead(agentId) {
  try {
    const { data: leads } = await supabase
      .from('leads')
      .select('id, name, phone, city')
      .is('assigned_to', null)
      .is('presales_agent_id', null)
      .eq('stage', 'new')
      .order('created_at', { ascending: true })
      .limit(1)

    if (!leads || leads.length === 0) return null

    const nextLead = leads[0]
    const { error } = await supabase
      .from('leads')
      .update({ assigned_to: agentId, presales_agent_id: agentId })
      .eq('id', nextLead.id)
      .is('assigned_to', null) // race condition avoid

    if (error) return null
    return nextLead
  } catch {
    return null
  }
}

// ── CALLING QUEUE — Start Calling ke liye ────────────────────
// Priority:
// 1. Aaj ke callbacks (assigned to me, aaj ka callback_date)
// 2. Fresh new leads (assigned to me, koi disposition nahi)
// 3. Not Connected leads (oldest first, Invalid Number skip)
export async function getCallingQueue(agentId) {
  const today = format(new Date(), 'yyyy-MM-dd')

  try {
    // 1️⃣ Aaj ke callbacks — sirf apne assigned
    const { data: callbacks } = await supabase
      .from('leads')
      .select('id, name, phone, city, disposition, callback_date, callback_slot')
      .eq('assigned_to', agentId)
      .eq('callback_date', today)
      .eq('stage', 'new')
      .order('callback_slot', { ascending: true })

    // 2️⃣ Fresh leads — koi disposition nahi, assigned to me
    const { data: freshLeads } = await supabase
      .from('leads')
      .select('id, name, phone, city, disposition')
      .eq('assigned_to', agentId)
      .eq('stage', 'new')
      .is('disposition', null)
      .order('created_at', { ascending: true })

    // 3️⃣ Not Connected leads — oldest first, invalid number skip
    const { data: notConnected } = await supabase
      .from('leads')
      .select('id, name, phone, city, disposition, updated_at')
      .eq('assigned_to', agentId)
      .eq('stage', 'new')
      .in('disposition', [
        'Not Connected 1st-Attempt',
        'Not Connected 2nd-Attempt',
        'Not Connected 3rd-Attempt',
        'Not Connected 4th-Attempt',
        // Invalid/Wrong Number intentionally excluded
      ])
      .order('updated_at', { ascending: true }) // oldest update pehle

    // Combine — duplicates hata do (callback aur fresh overlap ho sakta)
    const seen = new Set()
    const queue = []

    for (const lead of [...(callbacks ?? []), ...(freshLeads ?? []), ...(notConnected ?? [])]) {
      if (!seen.has(lead.id)) {
        seen.add(lead.id)
        queue.push(lead)
      }
    }

    return queue
  } catch (e) {
    console.error('getCallingQueue error:', e)
    return []
  }
}

// ── Sales agent assignment ────────────────────────────────────
export async function getNextSalesAgent() {
  try {
    const { data: agents } = await supabase
      .from('users')
      .select('id, name')
      .eq('team', 'sales')
      .eq('role', 'sales_agent')
      .eq('is_active', true)
      .order('name')

    if (!agents || agents.length === 0) return null

    const { data: lastLeads } = await supabase
      .from('leads')
      .select('sales_agent_id')
      .not('sales_agent_id', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1)

    if (!lastLeads || lastLeads.length === 0) return agents[0]

    const lastId = lastLeads[0].sales_agent_id
    const idx = agents.findIndex(a => a.id === lastId)
    if (idx === -1) return agents[0]
    return agents[(idx + 1) % agents.length]
  } catch {
    return null
  }
}

export async function assignToSales(leadId) {
  const agent = await getNextSalesAgent()
  if (!agent) return null

  await supabase
    .from('leads')
    .update({ assigned_to: agent.id, sales_agent_id: agent.id })
    .eq('id', leadId)

  return agent
}