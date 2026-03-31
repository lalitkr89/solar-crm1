import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'

// ─────────────────────────────────────────────────────────────
// TIME SLOT HELPER
// Slot format: '9:00 AM - 10:00 AM'
// Returns true if slot's START time has arrived (current time >= slot start)
// ─────────────────────────────────────────────────────────────
function isSlotReached(slot) {
  if (!slot) return true // no slot = always show

  try {
    const startPart = slot.split(' - ')[0].trim() // '9:00 AM'
    const [timePart, meridiem] = startPart.split(' ')
    let [hours, minutes] = timePart.split(':').map(Number)

    if (meridiem === 'PM' && hours !== 12) hours += 12
    if (meridiem === 'AM' && hours === 12) hours = 0

    const now = new Date()
    const slotStart = new Date()
    slotStart.setHours(hours, minutes, 0, 0)

    return now >= slotStart
  } catch {
    return true // parse fail = show it
  }
}

// ─────────────────────────────────────────────────────────────
// CITY / STATE AWARE AGENT SELECTOR  (NEW)
//
// 3-tier matching strategy:
//   Tier 1 — City match:  lead.city ∈ agent.assigned_cities  (case-insensitive)
//   Tier 2 — State match: lead.state == agent.assigned_state  (case-insensitive)
//   Tier 3 — Fallback:    any active agent, normal round-robin (least leads)
//
// Within each tier → sabse kam leads wala agent wins (fair distribution).
//
// @param agents  — array of agent rows (must include assigned_cities, assigned_state)
// @param counts  — { [agentId]: number } lead count map
// @param leadCity  — string | null
// @param leadState — string | null
// ─────────────────────────────────────────────────────────────
function pickAgentByLocation(agents, counts, leadCity, leadState) {
  const normalize = (s) => (s ?? '').trim().toLowerCase()
  const city = normalize(leadCity)
  const state = normalize(leadState)

  const leastLoaded = (pool) =>
    pool.reduce((min, a) => (counts[a.id] ?? 0) < (counts[min.id] ?? 0) ? a : min, pool[0])

  // Tier 1: city match
  if (city) {
    const cityMatch = agents.filter(a =>
      (a.assigned_cities ?? []).some(c => normalize(c) === city)
    )
    if (cityMatch.length > 0) return leastLoaded(cityMatch)
  }

  // Tier 2: state match
  if (state) {
    const stateMatch = agents.filter(a => normalize(a.assigned_state) === state)
    if (stateMatch.length > 0) return leastLoaded(stateMatch)
  }

  // Tier 3: fallback — any active agent, least loaded
  return leastLoaded(agents)
}

// ─────────────────────────────────────────────────────────────
// CALLING QUEUE  ← UNCHANGED
// Priority order:
//   1. Callbacks due — callback_date <= today AND slot time reached
//      (dispositions: any 'Call Later *' including Under Construction)
//   2. Already assigned fresh leads — disposition null, assigned to me, FIFO
//   3. Unassigned pool leads — assigned_to null, FIFO (assigned on Start Calling)
//   4. Not Connected — 1st/2nd/3rd/4th attempt only, oldest updated_at first
//      (Invalid/Wrong Number ALWAYS skipped)
//
// NOTE: Unassigned leads are NOT assigned here — assignment happens in
// handleStartCalling / goToNextLead so it only triggers on actual calling start.
// ─────────────────────────────────────────────────────────────
export async function getCallingQueue(agentId) {
  const today = format(new Date(), 'yyyy-MM-dd')

  try {
    // ── Priority 1: Due callbacks (assigned to me) ────────────
    const { data: callbackLeads } = await supabase
      .from('leads')
      .select('id, name, phone, city, disposition, callback_date, callback_slot')
      .eq('assigned_to', agentId)
      .eq('stage', 'new')
      .lte('callback_date', today)
      .ilike('disposition', 'Call Later%')
      .order('callback_date', { ascending: true })
      .order('callback_slot', { ascending: true })

    const dueCallbacks = (callbackLeads ?? []).filter(lead => {
      if (lead.callback_date < today) return true   // overdue = always show
      return isSlotReached(lead.callback_slot)       // aaj ka = slot check
    })

    // ── Priority 2: Fresh leads already assigned to me ───────
    const { data: myFreshLeads } = await supabase
      .from('leads')
      .select('id, name, phone, city, disposition, created_at')
      .eq('assigned_to', agentId)
      .eq('stage', 'new')
      .is('disposition', null)
      .order('created_at', { ascending: true })

    // ── Priority 3: Unassigned pool (not yet given to anyone) ─
    // These will be assigned to agentId one-by-one as calling progresses
    const { data: unassignedLeads } = await supabase
      .from('leads')
      .select('id, name, phone, city, disposition, created_at')
      .is('assigned_to', null)
      .is('presales_agent_id', null)
      .eq('stage', 'new')
      .is('disposition', null)
      .order('created_at', { ascending: true })

    // ── Priority 4: Not Connected (Invalid/Wrong skipped) ─────
    const NOT_CONNECTED_VALID = [
      'Not Connected 1st-Attempt',
      'Not Connected 2nd-Attempt',
      'Not Connected 3rd-Attempt',
      'Not Connected 4th-Attempt',
    ]

    const { data: notConnectedLeads } = await supabase
      .from('leads')
      .select('id, name, phone, city, disposition, updated_at')
      .eq('assigned_to', agentId)
      .eq('stage', 'new')
      .in('disposition', NOT_CONNECTED_VALID)
      .order('updated_at', { ascending: true })

    // ── Combine, deduplicate ──────────────────────────────────
    const seen = new Set()
    const queue = []

    for (const lead of [
      ...(dueCallbacks ?? []),
      ...(myFreshLeads ?? []),
      ...(unassignedLeads ?? []),
      ...(notConnectedLeads ?? []),
    ]) {
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

// ─────────────────────────────────────────────────────────────
// ASSIGN LEAD ON CALLING START  ← UNCHANGED
// Sirf tab call karo jab agent actually us lead pe jaaye
// Race condition safe — agar kisi aur ne le liya to next lo
// ─────────────────────────────────────────────────────────────
export async function assignLeadIfUnassigned(leadId, agentId) {
  try {
    const { data: lead } = await supabase
      .from('leads')
      .select('id, assigned_to')
      .eq('id', leadId)
      .single()

    if (!lead) return false

    // Pehle se assigned hai (mujhe ya kisi aur ko) — assign mat karo
    if (lead.assigned_to !== null) return true

    // Unassigned hai — mujhe assign karo (race condition safe)
    const { data: updated, error } = await supabase
      .from('leads')
      .update({
        assigned_to: agentId,
        presales_agent_id: agentId,
      })
      .eq('id', leadId)
      .is('assigned_to', null)   // double assign guard
      .select()
      .single()

    return !error && !!updated
  } catch {
    return false
  }
}

// ─────────────────────────────────────────────────────────────
// ROUND ROBIN — Presales  (UPDATED: city/state aware)
//
// Pehle: sirf sabse-kam-leads wala agent
// Ab:    city match → state match → least-loaded fallback
//
// Extra field fetch: assigned_cities, assigned_state
// ─────────────────────────────────────────────────────────────
export async function getNextCaller(team = 'presales', leadCity = null, leadState = null) {
  try {
    const { data: agents } = await supabase
      .from('users')
      .select('id, name, assigned_cities, assigned_state')   // ← new fields
      .eq('team', team)
      .eq('role', `${team}_agent`)
      .eq('is_active', true)
      .order('name')

    if (!agents || agents.length === 0) return null

    // Lead count per agent
    const { data: counts } = await supabase
      .from('leads')
      .select('presales_agent_id')
      .in('presales_agent_id', agents.map(a => a.id))

    const countMap = {}
    agents.forEach(a => { countMap[a.id] = 0 })
      ; (counts ?? []).forEach(l => {
        if (l.presales_agent_id && countMap[l.presales_agent_id] !== undefined) {
          countMap[l.presales_agent_id]++
        }
      })

    return pickAgentByLocation(agents, countMap, leadCity, leadState)

  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────
// BULK IMPORT ASSIGN  (UPDATED: passes city/state from lead row)
// ─────────────────────────────────────────────────────────────
export async function autoAssignLead(leadId, team = 'presales', leadCity = null, leadState = null) {
  const caller = await getNextCaller(team, leadCity, leadState)
  if (!caller) return null

  await supabase
    .from('leads')
    .update({
      assigned_to: caller.id,
      presales_agent_id: caller.id,
    })
    .eq('id', leadId)

  return caller
}

// ─────────────────────────────────────────────────────────────
// DIRECT ASSIGN — Add Lead modal se logged-in agent ko  ← UNCHANGED
// ─────────────────────────────────────────────────────────────
export async function assignLeadToCurrentUser(leadId, agentId) {
  if (!agentId) return null

  await supabase
    .from('leads')
    .update({
      assigned_to: agentId,
      presales_agent_id: agentId,
    })
    .eq('id', leadId)

  return { id: agentId }
}

// ─────────────────────────────────────────────────────────────
// NEXT UNASSIGNED LEAD — Disposition ke baad auto-assign  (UPDATED: city/state aware)
// Agent ne ek lead dispose ki → turant next unassigned lead milegi
// Race condition safe: double assign nahi hoga
// ─────────────────────────────────────────────────────────────
export async function assignNextUnassignedLead(agentId) {
  try {
    const { data: leads } = await supabase
      .from('leads')
      .select('id, name, phone, city, state')   // ← state bhi fetch karo
      .is('assigned_to', null)
      .is('presales_agent_id', null)
      .eq('stage', 'new')
      .order('created_at', { ascending: true })
      .limit(1)

    if (!leads || leads.length === 0) return null

    const nextLead = leads[0]

    // City/state-aware best agent dhundo
    const bestAgent = await getNextCaller('presales', nextLead.city, nextLead.state)
    if (!bestAgent) return null

    // Sirf tab update karo jab abhi bhi unassigned ho (race condition safe)
    const { data: updated, error } = await supabase
      .from('leads')
      .update({
        assigned_to: bestAgent.id,
        presales_agent_id: bestAgent.id,
      })
      .eq('id', nextLead.id)
      .is('assigned_to', null)  // guard: kisi aur ne pehle le liya to fail
      .select()
      .single()

    if (error || !updated) return null
    return nextLead

  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────
// SALES: getNextSalesAgent  (UPDATED: city/state aware)
// ─────────────────────────────────────────────────────────────
export async function getNextSalesAgent(leadCity = null, leadState = null) {
  try {
    const { data: agents } = await supabase
      .from('users')
      .select('id, name, assigned_cities, assigned_state')   // ← new fields
      .eq('team', 'sales')
      .eq('role', 'sales_agent')
      .eq('is_active', true)
      .order('name')

    if (!agents || agents.length === 0) return null

    const { data: counts } = await supabase
      .from('leads')
      .select('sales_agent_id')
      .in('sales_agent_id', agents.map(a => a.id))

    const countMap = {}
    agents.forEach(a => { countMap[a.id] = 0 })
      ; (counts ?? []).forEach(l => {
        if (l.sales_agent_id && countMap[l.sales_agent_id] !== undefined) {
          countMap[l.sales_agent_id]++
        }
      })

    return pickAgentByLocation(agents, countMap, leadCity, leadState)

  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────
// SALES: assignToSales  (UPDATED: city/state pass karo)
// ─────────────────────────────────────────────────────────────
export async function assignToSales(leadId, leadCity = null, leadState = null) {
  const agent = await getNextSalesAgent(leadCity, leadState)
  if (!agent) return null

  await supabase
    .from('leads')
    .update({
      assigned_to: agent.id,
      sales_agent_id: agent.id,
    })
    .eq('id', leadId)

  return agent
}

// ─────────────────────────────────────────────────────────────
// SALES CALLING QUEUE  ← UNCHANGED
// Priority 1: Aaj + overdue meetings (meeting_date <= today, sales_outcome=null, slot check)
// Priority 2: call_later_interested jinka sales_callback_date <= today + slot reached
// Priority 3: call_not_connected_1/2/3 (oldest first)
// + Unassigned sales pool (assigned on Start Calling, presales jaisa)
// ─────────────────────────────────────────────────────────────
export async function getSalesCallingQueue(agentId) {
  const today = format(new Date(), 'yyyy-MM-dd')

  try {
    // ── Priority 1: Aaj + overdue meetings, koi outcome nahi ─
    const { data: meetingLeads } = await supabase
      .from('leads')
      .select('id, name, phone, city, meeting_date, meeting_slot, sales_outcome')
      .eq('sales_agent_id', agentId)
      .eq('stage', 'meeting_scheduled')
      .is('sales_outcome', null)
      .lte('meeting_date', today)
      .order('meeting_date', { ascending: true })
      .order('meeting_slot', { ascending: true })

    const dueMeetings = (meetingLeads ?? []).filter(lead => {
      if (lead.meeting_date < today) return true
      return isSlotReached(lead.meeting_slot)
    })

    // ── Priority 2: call_later_interested callback due ───────
    const { data: callbackLeads } = await supabase
      .from('leads')
      .select('id, name, phone, city, sales_outcome, sales_callback_date, sales_callback_slot')
      .eq('sales_agent_id', agentId)
      .eq('stage', 'meeting_scheduled')
      .eq('sales_outcome', 'call_later_interested')
      .lte('sales_callback_date', today)
      .order('sales_callback_date', { ascending: true })
      .order('sales_callback_slot', { ascending: true })

    const dueCallbacks = (callbackLeads ?? []).filter(lead => {
      if (lead.sales_callback_date < today) return true
      return isSlotReached(lead.sales_callback_slot)
    })

    // ── Priority 3: Not Connected 1/2/3 (oldest first) ───────
    const { data: notConnectedLeads } = await supabase
      .from('leads')
      .select('id, name, phone, city, sales_outcome, updated_at')
      .eq('sales_agent_id', agentId)
      .eq('stage', 'meeting_scheduled')
      .in('sales_outcome', [
        'call_not_connected_1',
        'call_not_connected_2',
        'call_not_connected_3',
      ])
      .order('updated_at', { ascending: true })

    // ── Unassigned sales pool ─────────────────────────────────
    const { data: unassignedLeads } = await supabase
      .from('leads')
      .select('id, name, phone, city, meeting_date, meeting_slot')
      .is('sales_agent_id', null)
      .eq('stage', 'meeting_scheduled')
      .order('meeting_date', { ascending: true })

    // ── Combine, deduplicate ──────────────────────────────────
    const seen = new Set()
    const queue = []

    for (const lead of [
      ...(dueMeetings ?? []),
      ...(dueCallbacks ?? []),
      ...(notConnectedLeads ?? []),
      ...(unassignedLeads ?? []),
    ]) {
      if (!seen.has(lead.id)) {
        seen.add(lead.id)
        queue.push(lead)
      }
    }

    return queue

  } catch (e) {
    console.error('getSalesCallingQueue error:', e)
    return []
  }
}

// ─────────────────────────────────────────────────────────────
// SALES FOLLOW UP QUEUE  ← UNCHANGED
// Priority 1: HOT/MODERATE/COLD jinka sales_followup_date <= today + slot reached
// Priority 2: call_later_underconstruction jinka sales_followup_date <= today + slot reached
// ─────────────────────────────────────────────────────────────
export async function getSalesFollowUpQueue(agentId) {
  const today = format(new Date(), 'yyyy-MM-dd')

  try {
    // ── Priority 1: HOT/MODERATE/COLD followup due ───────────
    const { data: followupLeads } = await supabase
      .from('leads')
      .select('id, name, phone, city, sales_outcome, sales_followup_date, sales_followup_slot')
      .eq('sales_agent_id', agentId)
      .eq('stage', 'meeting_scheduled')
      .in('sales_outcome', [
        'meeting_done_hot',
        'meeting_done_moderate',
        'meeting_done_cold',
      ])
      .lte('sales_followup_date', today)
      .order('sales_followup_date', { ascending: true })
      .order('sales_followup_slot', { ascending: true })

    const dueFollowups = (followupLeads ?? []).filter(lead => {
      if (lead.sales_followup_date < today) return true
      return isSlotReached(lead.sales_followup_slot)
    })

    // ── Priority 2: call_later_underconstruction followup due ─
    const { data: ucLeads } = await supabase
      .from('leads')
      .select('id, name, phone, city, sales_outcome, sales_followup_date, sales_followup_slot')
      .eq('sales_agent_id', agentId)
      .eq('stage', 'meeting_scheduled')
      .eq('sales_outcome', 'call_later_underconstruction')
      .lte('sales_followup_date', today)
      .order('sales_followup_date', { ascending: true })
      .order('sales_followup_slot', { ascending: true })

    const dueUC = (ucLeads ?? []).filter(lead => {
      if (lead.sales_followup_date < today) return true
      return isSlotReached(lead.sales_followup_slot)
    })

    // ── Combine, deduplicate ──────────────────────────────────
    const seen = new Set()
    const queue = []

    for (const lead of [
      ...(dueFollowups ?? []),
      ...(dueUC ?? []),
    ]) {
      if (!seen.has(lead.id)) {
        seen.add(lead.id)
        queue.push(lead)
      }
    }

    return queue

  } catch (e) {
    console.error('getSalesFollowUpQueue error:', e)
    return []
  }
}

// ─────────────────────────────────────────────────────────────
// ASSIGN SALES LEAD IF UNASSIGNED  ← UNCHANGED
// Presales jaisa — race condition safe
// ─────────────────────────────────────────────────────────────
export async function assignSalesLeadIfUnassigned(leadId, agentId) {
  try {
    const { data: lead } = await supabase
      .from('leads')
      .select('id, sales_agent_id')
      .eq('id', leadId)
      .single()

    if (!lead) return false
    if (lead.sales_agent_id !== null) return true

    const { data: updated, error } = await supabase
      .from('leads')
      .update({
        sales_agent_id: agentId,
        assigned_to: agentId,
      })
      .eq('id', leadId)
      .is('sales_agent_id', null)
      .select()
      .single()

    return !error && !!updated
  } catch {
    return false
  }
}