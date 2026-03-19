import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://qfubojuspemgmdldnouw.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmdWJvanVzcGVtZ21kbGRub3V3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NDI0MTEsImV4cCI6MjA4OTMxODQxMX0.PMg5sl4p80prxNGfFPb9GFkY-kRKRxDuXO8V_cp_ijg'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
