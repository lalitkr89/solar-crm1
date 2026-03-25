// ── Column definitions ────────────────────────────────────────
export const COLS = [
  { key: '_select', label: '', w: 36, sortable: false, g: 0 },
  { key: 'name', label: 'Name / Phone', w: 180, sortable: true, g: 0 },
  { key: 'city', label: 'City', w: 90, sortable: true, g: 0 },
  { key: 'lead_source', label: 'Source', w: 110, sortable: true, g: 0 },
  { key: 'assigned_name', label: 'PS agent', w: 90, sortable: true, g: 1 },
  { key: 'call_status', label: 'Status', w: 100, sortable: true, g: 1 },
  { key: 'disposition', label: 'Disposition', w: 210, sortable: true, g: 1 },
  { key: 'calling_date', label: 'Called date', w: 90, sortable: true, g: 1, isDate: true },
  { key: 'callback_date', label: 'Callback', w: 100, sortable: true, g: 1, isDate: true },
  { key: 'sales_outcome', label: 'Sales outcome', w: 140, sortable: true, g: 2 },
  { key: 'meeting_date', label: 'Meeting date', w: 105, sortable: true, g: 2, isDate: true },
  { key: 'sales_agent_name', label: 'Sales agent', w: 100, sortable: true, g: 2 },
]

export const G_COLORS = ['#1e40af', '#7c3aed', '#065f46']
export const G_LABELS = ['Lead info', 'Pre-sales', 'Sales']

export const FILTER_OPS = [
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does not contain' },
  { value: 'equals', label: 'Equals' },
  { value: 'starts_with', label: 'Starts with' },
  { value: 'blank', label: 'Is blank' },
  { value: 'not_blank', label: 'Is not blank' },
]

export const SALES_OUTCOME_LABELS = {
  call_not_connected_1: 'Not Conn. 1',
  call_not_connected_2: 'Not Conn. 2',
  call_not_connected_3: 'Not Conn. 3',
  invalid_number: 'Invalid',
  call_later_interested: 'Call Later',
  meeting_rescheduled: 'Rescheduled 📅',
  call_later_underconstruction: 'Under Const.',
  non_qualified_roof: 'NQ - Roof',
  non_qualified_bill: 'NQ - Bill',
  non_qualified_ownership: 'NQ - Ownership',
  non_qualified_not_govt_meter: 'NQ - Meter',
  non_qualified_no_connection: 'NQ - No Conn.',
  not_serviceable_offgrid: 'Not Serviceable',
  not_serviceable_location: 'Not Serviceable',
  not_interested: 'Not Interested',
  solarpro_enquiry: 'SolarPro',
  meeting_done_hot: 'HOT 🔥',
  meeting_done_moderate: 'MODERATE 🌡️',
  meeting_done_cold: 'COLD ❄️',
  meeting_done_order_closed: 'ORDER CLOSED 🎉',
}

export const NOT_CONNECTED_DISPOSITIONS = [
  'Not Connected 1st-Attempt', 'Not Connected 2nd-Attempt',
  'Not Connected 3rd-Attempt', 'Not Connected 4th-Attempt', 'Invalid/Wrong Number',
]

export const CONNECTED_DISPOSITIONS = [
  'Meeting Scheduled (BD)', 'Meet Later (Qualified)', 'Call Later (Interested)',
  'Call Later (Under Construction)', 'Language Barrier',
  'Non Qualified - Roof Area Insufficient', 'Non Qualified - Bill Amount Insufficient',
  'Non Qualified - No Roof Ownership', 'Non Qualified - Not Govt Meter',
  'Non Qualified - Meter Connection Not Yet Available',
  'Not Serviceable - Offgrid Enquiry', 'Not Serviceable - SS not in location',
  'Not Interested in Solar', 'Not Interested in Solar - Price Issue',
  'Housing Society Enquiry', 'Commercial Lead', 'SolarPro Enquiry',
]

export const PRESALES_STAGES = [
  { value: 'new', label: 'New' },
  { value: 'meeting_scheduled', label: 'Meeting Scheduled' },
  { value: 'qc_followup', label: 'Rearrange Meeting' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'non_qualified', label: 'Non Qualified' },
  { value: 'lost', label: 'Lost' },
]

export const TIME_SLOTS = [
  '9:00 AM - 10:00 AM', '10:00 AM - 11:00 AM', '11:00 AM - 12:00 PM',
  '12:00 PM - 1:00 PM', '1:00 PM - 2:00 PM', '2:00 PM - 3:00 PM',
  '3:00 PM - 4:00 PM', '4:00 PM - 5:00 PM', '5:00 PM - 6:00 PM', '6:00 PM - 7:00 PM',
]

export const LEAD_SOURCES = [
  'Facebook Ad', 'Google Ad', 'Instagram', 'YouTube',
  'Referral', 'Walk-in', 'Website', 'IVR', 'Other',
]

export const PROPERTY_TYPES = ['Residential', 'Commercial', 'Industrial', 'Agricultural']
export const OWNERSHIP_TYPES = ['Owned', 'Rented', 'Family Owned']
export const ROOF_TYPES = ['RCC / Concrete', 'Tin / Metal Sheet', 'Asbestos', 'Mangalore Tile', 'Other']
export const SYSTEM_TYPES = ['On-grid', 'Off-grid', 'Hybrid']
export const REFERRAL_TYPES = ['Existing Customer', 'Employee', 'SolarPro', 'Others']
