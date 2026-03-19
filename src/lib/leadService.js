import { supabase } from '@/lib/supabase'
import { cleanPhone } from '@/lib/phone'

const NUMERIC_FIELDS = [
  'roof_area', 'sanctioned_load', 'monthly_bill',
  'units_per_month', 'system_size_kw', 'quoted_amount',
]

// Fetch single lead by phone
export async function getLeadByPhone(phone) {
  const cleaned = cleanPhone(phone)
  const { data } = await supabase
    .from('leads')
    .select('*, assigned_user:assigned_to(id,name,role)')
    .eq('phone', cleaned)
    .single()
  return data
}

// Fetch lead by ID
export async function getLeadById(id) {
  const { data } = await supabase
    .from('leads')
    .select(`
      *,
      assigned_user:assigned_to(id,name,role),
      presales_agent:presales_agent_id(id,name),
      sales_agent:sales_agent_id(id,name),
      finance_agent:finance_agent_id(id,name),
      ops_agent:ops_agent_id(id,name),
      amc_agent:amc_agent_id(id,name)
    `)
    .eq('id', id)
    .single()
  return data
}

// Create a new lead
export async function createLead(data) {
  const payload = { ...data }

  // Clean phones
  payload.phone           = cleanPhone(data.phone)
  payload.alternate_phone = data.alternate_phone ? cleanPhone(data.alternate_phone) : null
  payload.stage           = 'new'

  // Numeric fields: empty string -> null, otherwise Number
  NUMERIC_FIELDS.forEach(f => {
    payload[f] = (payload[f] !== '' && payload[f] != null) ? Number(payload[f]) : null
  })

  // All string fields: empty string -> null
  Object.keys(payload).forEach(k => {
    if (payload[k] === '') payload[k] = null
  })

  const { data: lead, error } = await supabase
    .from('leads')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return lead
}

// Update a lead
export async function updateLead(id, updates) {
  const { data, error } = await supabase
    .from('leads')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// Log an activity to lead_history
export async function logActivity({ leadId, action, field, oldVal, newVal, userId, userName }) {
  await supabase.from('lead_history').insert({
    lead_id:       leadId,
    action,
    updated_field: field   ?? null,
    old_value:     oldVal != null ? String(oldVal) : null,
    new_value:     newVal != null ? String(newVal) : null,
    updated_by:    userName ?? 'System',
    updated_by_id: userId   ?? null,
  })
}

// Move lead to a new stage + log it
export async function moveStage(lead, newStage, userId, userName) {
  const updated = await updateLead(lead.id, { stage: newStage })
  await logActivity({
    leadId:   lead.id,
    action:   'Stage changed',
    field:    'stage',
    oldVal:   lead.stage,
    newVal:   newStage,
    userId,
    userName,
  })
  return updated
}

// Get full history for a lead
export async function getLeadHistory(leadId) {
  const { data } = await supabase
    .from('lead_history')
    .select('*')
    .eq('lead_id', leadId)
    .order('updated_at', { ascending: false })
  return data ?? []
}

// Fetch leads for a given stage
export async function getLeadsByStage(stages) {
  const { data } = await supabase
    .from('leads')
    .select('*, assigned_user:assigned_to(id,name)')
    .in('stage', Array.isArray(stages) ? stages : [stages])
    .order('updated_at', { ascending: false })
  return data ?? []
}

// Today's callbacks and meetings
export async function getTodaysActions() {
  const { data } = await supabase
    .from('v_todays_actions')
    .select('*')
  return data ?? []
}

// Log a call attempt
export async function logCall({ leadId, callerId, callStatus, disposition, remarks, durationSecs }) {
  const { error } = await supabase.from('call_logs').insert({
    lead_id:       leadId,
    caller_id:     callerId,
    call_status:   callStatus,
    disposition,
    remarks,
    duration_secs: durationSecs ?? null,
  })
  if (error) throw error
}
