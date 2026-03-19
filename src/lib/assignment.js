import { supabase } from '@/lib/supabase'

// Ported from your assignment_service.py — get_next_caller()
export async function getNextCaller(team = 'presales') {
  try {
    // Get all active callers for the team
    const { data: callers } = await supabase
      .from('users')
      .select('id, name')
      .eq('team', team)
      .eq('role', `${team}_agent`)
      .eq('is_active', true)
      .order('name')

    if (!callers || callers.length === 0) return null

    // Get the last assigned lead for this team
    const { data: lastLeads } = await supabase
      .from('leads')
      .select('presales_agent_id')
      .not('presales_agent_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)

    if (!lastLeads || lastLeads.length === 0) return callers[0]

    const lastId = lastLeads[0].presales_agent_id
    const idx    = callers.findIndex(c => c.id === lastId)

    if (idx === -1) return callers[0]

    // Round-robin: next in list
    return callers[(idx + 1) % callers.length]
  } catch {
    return null
  }
}

// Assign a lead to the next caller (round-robin)
export async function autoAssignLead(leadId, team = 'presales') {
  const caller = await getNextCaller(team)
  if (!caller) return null

  await supabase
    .from('leads')
    .update({
      assigned_to:       caller.id,
      presales_agent_id: caller.id,
    })
    .eq('id', leadId)

  return caller
}


// Get next sales agent — round robin
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

    // Get last assigned sales lead
    const { data: lastLeads } = await supabase
      .from('leads')
      .select('sales_agent_id')
      .not('sales_agent_id', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1)

    if (!lastLeads || lastLeads.length === 0) return agents[0]

    const lastId = lastLeads[0].sales_agent_id
    const idx    = agents.findIndex(a => a.id === lastId)
    if (idx === -1) return agents[0]
    return agents[(idx + 1) % agents.length]
  } catch {
    return null
  }
}

// Assign lead to sales team when meeting is scheduled
export async function assignToSales(leadId) {
  const agent = await getNextSalesAgent()
  if (!agent) return null

  await supabase
    .from('leads')
    .update({
      assigned_to:    agent.id,
      sales_agent_id: agent.id,
    })
    .eq('id', leadId)

  return agent
}
