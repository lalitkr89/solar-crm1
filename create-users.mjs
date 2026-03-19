// create-users.mjs
// Run: node create-users.mjs
// This uses Supabase Admin API to create all test users

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://qfubojuspemgmdldnouw.supabase.co'

// !! SERVICE ROLE KEY chahiye — Supabase Dashboard → Settings → API
// → Legacy anon, service_role API keys → service_role key copy karo
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmdWJvanVzcGVtZ21kbGRub3V3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzc0MjQxMSwiZXhwIjoyMDg5MzE4NDExfQ.2DJy3rK_S3smlshg7Ez6rrVCcHN_CLbWUEuhE1JZt9M'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const USERS = [
  { email: 'presales.manager@solarcrm.local', name: 'Presales Manager', role: 'presales_manager', team: 'presales' },
  { email: 'anjali.k@solarcrm.local', name: 'Anjali K', role: 'presales_agent', team: 'presales' },
  { email: 'rohit.v@solarcrm.local', name: 'Rohit V', role: 'presales_agent', team: 'presales' },
  { email: 'priya.m@solarcrm.local', name: 'Priya M', role: 'presales_agent', team: 'presales' },
  { email: 'sales.manager@solarcrm.local', name: 'Sales Manager', role: 'sales_manager', team: 'sales' },
  { email: 'arjun.m@solarcrm.local', name: 'Arjun M', role: 'sales_agent', team: 'sales' },
  { email: 'neha.s@solarcrm.local', name: 'Neha S', role: 'sales_agent', team: 'sales' },
  { email: 'finance.manager@solarcrm.local', name: 'Finance Manager', role: 'finance_manager', team: 'finance' },
  { email: 'deepa.s@solarcrm.local', name: 'Deepa S', role: 'finance_agent', team: 'finance' },
  { email: 'ops.manager@solarcrm.local', name: 'Ops Manager', role: 'ops_manager', team: 'ops' },
  { email: 'kavita.r@solarcrm.local', name: 'Kavita R', role: 'ops_agent', team: 'ops' },
  { email: 'amc.manager@solarcrm.local', name: 'AMC Manager', role: 'amc_manager', team: 'amc' },
  { email: 'vinod.p@solarcrm.local', name: 'Vinod P', role: 'amc_agent', team: 'amc' },
]

async function createUsers() {
  console.log('Creating users...\n')

  for (const u of USERS) {
    // 1. Create auth user
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: 'Solar@1234',
      email_confirm: true,
      user_metadata: { name: u.name }
    })

    if (error) {
      console.log(`❌ ${u.email} — ${error.message}`)
      continue
    }

    const uid = data.user.id

    // 2. Insert into public.users
    const { error: dbErr } = await supabase
      .from('users')
      .upsert({
        id: uid,
        name: u.name,
        email: u.email,
        role: u.role,
        team: u.team,
        is_active: true
      }, { onConflict: 'id' })

    if (dbErr) {
      console.log(`⚠️  ${u.email} auth ok but db error — ${dbErr.message}`)
    } else {
      console.log(`✅ ${u.email} (${u.role})`)
    }
  }

  console.log('\nDone! Login with any email above, password: Solar@1234')
}

createUsers()
