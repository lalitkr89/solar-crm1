import { useState, useRef } from 'react'
import Layout from '@/components/layout/Layout'
import { PageHeader, Spinner } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { cleanPhone } from '@/lib/phone'
import { autoAssignLead } from '@/lib/assignment'
import { Upload, Download, CheckCircle2, AlertCircle, RefreshCw, FileText, X, ChevronDown, ChevronUp } from 'lucide-react'

// ── Valid dropdown values ─────────────────────────────────────
const VALID_VALUES = {
  lead_source: ['Facebook Ad', 'Google Ad', 'Instagram', 'YouTube', 'Referral', 'Walk-in', 'Website', 'IVR', 'Other'],
  property_type: ['Residential', 'Commercial', 'Industrial', 'Agricultural'],
  ownership: ['Owned', 'Rented', 'Family Owned'],
  roof_type: ['RCC / Concrete', 'Tin / Metal Sheet', 'Asbestos', 'Mangalore Tile', 'Other'],
  system_type: ['On-grid', 'Off-grid', 'Hybrid'],
  referral_type: ['Existing Customer', 'Employee', 'SolarPro', 'Others'],
}

// Referral types jinke liye name + ID dono zaroori hain
const REFERRAL_NEEDS_ID = ['Existing Customer', 'SolarPro']

// ── CSV columns ───────────────────────────────────────────────
const CSV_HEADERS = [
  'name', 'phone', 'alternate_phone', 'email',
  'city', 'pincode', 'address',
  'lead_source',
  'referral_type',   // sirf tab fill karo jab lead_source = Referral
  'referral_name',   // Existing Customer / SolarPro / Employee / Others ka naam
  'referral_id',     // Existing Customer ya SolarPro ka ID (optional for others)
  'property_type', 'ownership',
  'roof_type', 'roof_area', 'electricity_board',
  'sanctioned_load', 'monthly_bill', 'units_per_month',
  'system_size_kw', 'system_type',
  'remarks',
]

const NUMERIC_FIELDS = [
  'roof_area', 'sanctioned_load', 'monthly_bill',
  'units_per_month', 'system_size_kw',
]

const SAMPLE_ROWS = [
  // Referral — Existing Customer (name + ID required)
  [
    'Rajesh Kumar', '9876543210', '9876543211', 'rajesh@gmail.com',
    'Noida', '201301', 'Sector 62 Noida',
    'Referral', 'Existing Customer', 'Amit Sharma', 'CUST-1042',
    'Residential', 'Owned', 'RCC / Concrete',
    '500', 'PVVNL', '5', '3500', '350', '3', 'On-grid',
    'Interested in solar',
  ],
  // Referral — SolarPro (name + ID required)
  [
    'Sunita Devi', '8765432109', '', '',
    'Gurgaon', '122001', 'DLF Phase 2',
    'Referral', 'SolarPro', 'SP Partner Noida', 'SP-204',
    'Commercial', 'Owned', 'Tin / Metal Sheet',
    '800', 'DHBVN', '10', '8000', '800', '5', 'Hybrid',
    '',
  ],
  // Referral — Employee (sirf naam chahiye)
  [
    'Mohan Lal', '+91 98765 43210', '', '',
    'Delhi', '110001', 'Lajpat Nagar',
    'Referral', 'Employee', 'Priya Singh', '',
    'Residential', 'Rented', 'RCC / Concrete',
    '300', 'BSES', '3', '2000', '200', '2', 'On-grid',
    'Call after 6pm only',
  ],
  // Facebook Ad — referral fields blank
  [
    'Kavita Sharma', '9988776655', '', '',
    'Faridabad', '121001', 'Sector 15',
    'Facebook Ad', '', '', '',
    'Residential', 'Owned', 'RCC / Concrete',
    '400', 'DHBVN', '4', '2500', '250', '3', 'On-grid',
    '',
  ],
]

// ── Download sample CSV ───────────────────────────────────────
function downloadSampleCSV() {
  const headerRow = CSV_HEADERS.join(',')
  const dataRows = SAMPLE_ROWS.map(row =>
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  )
  const csv = [headerRow, ...dataRows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'solar_crm_leads_import_format.csv'; a.click()
  URL.revokeObjectURL(url)
}

// ── Parse CSV ─────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h =>
    h.trim().replace(/^"|"$/g, '').trim().toLowerCase().replace(/\s+/g, '_')
  )
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i])
    if (cells.every(c => !c.trim())) continue
    const obj = {}
    headers.forEach((h, idx) => { obj[h] = cells[idx]?.trim() ?? '' })
    rows.push(obj)
  }
  return rows
}

function parseCSVLine(line) {
  const result = []; let current = ''; let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) { result.push(current); current = '' }
    else current += ch
  }
  result.push(current)
  return result
}

// ── Normalize row ─────────────────────────────────────────────
function normalizeRow(row) {
  const c = { ...row }

  // Phone cleaning
  if (c.phone) c.phone = cleanPhone(c.phone)
  if (c.alternate_phone) c.alternate_phone = cleanPhone(c.alternate_phone) || null

  // Referral logic — agar lead_source Referral nahi hai toh referral fields clear
  if (c.lead_source !== 'Referral') {
    c.referral_type = null
    c.referral_name = null
    c.referral_id = null
  }

  // Numeric fields
  NUMERIC_FIELDS.forEach(f => {
    if (c[f] === '' || c[f] == null) c[f] = null
    else { const n = Number(c[f]); c[f] = isNaN(n) ? null : n }
  })

  // Empty strings → null
  Object.keys(c).forEach(k => { if (c[k] === '') c[k] = null })
  return c
}

// ── Validate dropdowns + referral rules ──────────────────────
function validateRow(row) {
  const warnings = []
  const errors = []

  // Dropdown validation
  Object.entries(VALID_VALUES).forEach(([field, validList]) => {
    const val = row[field]
    if (val && !validList.includes(val)) {
      warnings.push(`"${val}" is not a standard value for ${field}`)
    }
  })

  // Referral validation
  if (row.lead_source === 'Referral') {
    if (!row.referral_type) {
      warnings.push('lead_source is Referral but referral_type is empty')
    } else if (REFERRAL_NEEDS_ID.includes(row.referral_type)) {
      if (!row.referral_name) {
        errors.push(`referral_type "${row.referral_type}" requires referral_name`)
      }
      if (!row.referral_id) {
        warnings.push(`referral_type "${row.referral_type}" should have referral_id`)
      }
    }
  } else if (row.referral_type || row.referral_name || row.referral_id) {
    warnings.push('referral fields filled but lead_source is not Referral — will be ignored')
  }

  return { warnings, errors }
}

// ── Smart merge — only blank fields update ───────────────────
function mergeWithExisting(existing, incoming) {
  const updates = {}; const updatedFields = []; const skippedFields = []
  Object.keys(incoming).forEach(key => {
    if (key === 'phone' || key === 'id') return
    const inVal = incoming[key]; const exVal = existing[key]
    if (inVal !== null && inVal !== undefined && inVal !== '') {
      if (exVal === null || exVal === undefined || exVal === '') {
        updates[key] = inVal; updatedFields.push(key)
      } else {
        skippedFields.push(key)
      }
    }
  })
  return { updates, updatedFields, skippedFields }
}

// ── Main Page ─────────────────────────────────────────────────
export default function BulkImportPage() {
  const fileRef = useRef()
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState([])
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState(null)
  const [errors, setErrors] = useState([])
  const [showRef, setShowRef] = useState(false)

  function handleFileChange(e) {
    const f = e.target.files[0]
    if (!f) return
    setFile(f); setResults(null); setErrors([]); setProgress(0)
    const reader = new FileReader()
    reader.onload = (ev) => setPreview(parseCSV(ev.target.result).slice(0, 5))
    reader.readAsText(f)
  }

  function handleDrop(e) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f && f.name.endsWith('.csv')) handleFileChange({ target: { files: [f] } })
  }

  async function handleImport() {
    if (!file) return
    setImporting(true); setResults(null); setErrors([]); setProgress(0)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const rows = parseCSV(ev.target.result)
      if (rows.length === 0) { setErrors(['CSV mein koi data nahi mila']); setImporting(false); return }

      let newCount = 0, updatedCount = 0, skippedCount = 0
      const errorList = [], rowResults = []

      for (let i = 0; i < rows.length; i++) {
        setProgress(Math.round(((i + 1) / rows.length) * 100))
        const raw = rows[i]
        const row = normalizeRow(raw)

        // Phone validation
        if (!row.phone || row.phone.length !== 10) {
          errorList.push(`Row ${i + 2}: Invalid phone "${raw.phone || ''}" — skipped`)
          skippedCount++
          rowResults.push({ row: i + 2, name: raw.name, phone: raw.phone, status: 'error', reason: 'Invalid phone number' })
          continue
        }

        // Validate dropdowns + referral rules
        const { warnings, errors: rowErrors } = validateRow(row)

        // Hard errors — skip row
        if (rowErrors.length > 0) {
          errorList.push(`Row ${i + 2} (${raw.name || 'Unknown'}): ${rowErrors.join(', ')}`)
          skippedCount++
          rowResults.push({ row: i + 2, name: raw.name, phone: raw.phone, status: 'error', reason: rowErrors.join(', '), warnings })
          continue
        }

        try {
          const { data: existing } = await supabase
            .from('leads').select('*')
            .or(`phone.eq.${row.phone},alternate_phone.eq.${row.phone}`)
            .maybeSingle()

          if (existing) {
            const { updates, updatedFields, skippedFields } = mergeWithExisting(existing, row)
            if (Object.keys(updates).length > 0) {
              await supabase.from('leads').update(updates).eq('id', existing.id)
              updatedCount++
              rowResults.push({
                row: i + 2, name: row.name || existing.name, phone: row.phone,
                status: 'updated',
                detail: `${updatedFields.length} fields updated: ${updatedFields.join(', ')}`,
                skipped: skippedFields.length > 0 ? `${skippedFields.length} fields already had data` : '',
                warnings,
              })
            } else {
              skippedCount++
              rowResults.push({
                row: i + 2, name: existing.name, phone: row.phone,
                status: 'skipped', detail: 'All fields already filled — nothing to update', warnings,
              })
            }
          } else {
            const payload = { ...row, stage: 'new' }
            Object.keys(payload).forEach(k => {
              if (payload[k] === null || payload[k] === undefined) delete payload[k]
            })
            const { data: newLead, error: insertErr } = await supabase
              .from('leads').insert(payload).select().single()
            if (insertErr) throw insertErr
            newCount++
            rowResults.push({
              row: i + 2, name: row.name, phone: row.phone,
              status: 'new', detail: 'New lead created & assigned', warnings,
            })
          }
        } catch (err) {
          errorList.push(`Row ${i + 2} (${raw.name || 'Unknown'}): ${err.message}`)
          skippedCount++
          rowResults.push({ row: i + 2, name: raw.name, phone: raw.phone, status: 'error', reason: err.message })
        }
      }

      setResults({ total: rows.length, new: newCount, updated: updatedCount, skipped: skippedCount, rows: rowResults })
      setErrors(errorList)
      setImporting(false); setProgress(100)
    }
    reader.readAsText(file)
  }

  function reset() {
    setFile(null); setPreview([]); setResults(null); setErrors([]); setProgress(0)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <Layout>
      <PageHeader title="Bulk lead import" subtitle="CSV file se ek saath multiple leads add karo">
        <button onClick={downloadSampleCSV} className="btn">
          <Download size={13} /> Download sample CSV
        </button>
      </PageHeader>

      {/* Import rules */}
      <div className="card mb-4 bg-blue-50 border-blue-200">
        <h3 className="text-blue-800 mb-2">📋 Import rules</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="flex gap-2">
            <span className="text-blue-500 font-bold text-sm">1.</span>
            <p className="text-xs text-blue-700">
              <strong>Phone cleaning:</strong> +91, spaces, dashes automatically remove honge.
            </p>
          </div>
          <div className="flex gap-2">
            <span className="text-blue-500 font-bold text-sm">2.</span>
            <p className="text-xs text-blue-700">
              <strong>Duplicate:</strong> Number exist kare toh sirf <strong>blank fields update</strong> honge. Filled fields safe.
            </p>
          </div>
          <div className="flex gap-2">
            <span className="text-blue-500 font-bold text-sm">3.</span>
            <p className="text-xs text-blue-700">
              <strong>Referral:</strong> lead_source = Referral ho toh referral_type bhi bharein. Existing Customer / SolarPro ke liye referral_name zaroori hai.
            </p>
          </div>
          <div className="flex gap-2">
            <span className="text-blue-500 font-bold text-sm">4.</span>
            <p className="text-xs text-blue-700">
              <strong>New leads:</strong> Automatically presales team mein round-robin assign. Stage "New" set hoga.
            </p>
          </div>
        </div>
      </div>

      {/* Field reference */}
      <div className="card mb-5 border-slate-200">
        <button className="w-full flex items-center justify-between" onClick={() => setShowRef(r => !r)}>
          <h3 className="text-slate-700">📌 Field reference — valid values (click to expand)</h3>
          {showRef ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </button>

        {showRef && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(VALID_VALUES).map(([field, values]) => (
              <div key={field} className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-3 py-2 bg-slate-800">
                  <p className="text-xs font-mono font-semibold text-white">{field}</p>
                </div>
                <div className="p-2 flex flex-wrap gap-1.5">
                  {values.map(v => (
                    <span key={v} className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            ))}

            {/* Referral rules */}
            <div className="rounded-lg border border-purple-200 overflow-hidden">
              <div className="px-3 py-2 bg-purple-800">
                <p className="text-xs font-mono font-semibold text-white">Referral rules</p>
              </div>
              <div className="p-2 flex flex-col gap-1.5">
                <p className="text-xs text-slate-600">lead_source = <span className="font-mono font-semibold">Referral</span> hone par:</p>
                <div className="flex flex-col gap-1 pl-2">
                  <p className="text-xs text-slate-600">
                    <span className="font-mono font-semibold text-purple-700">Existing Customer</span> — referral_name ✅ zaroori, referral_id ⚠️ recommended
                  </p>
                  <p className="text-xs text-slate-600">
                    <span className="font-mono font-semibold text-purple-700">SolarPro</span> — referral_name ✅ zaroori, referral_id ⚠️ recommended
                  </p>
                  <p className="text-xs text-slate-600">
                    <span className="font-mono font-semibold text-slate-600">Employee</span> — sirf referral_name kaafi
                  </p>
                  <p className="text-xs text-slate-600">
                    <span className="font-mono font-semibold text-slate-600">Others</span> — sirf referral_name kaafi
                  </p>
                </div>
                <p className="text-xs text-amber-600 mt-1">⚠️ Agar lead_source Referral nahi hai toh referral fields ignore honge</p>
              </div>
            </div>

            {/* Numeric fields */}
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <div className="px-3 py-2 bg-slate-800">
                <p className="text-xs font-mono font-semibold text-white">Numeric fields (sirf number)</p>
              </div>
              <div className="p-2">
                {NUMERIC_FIELDS.map(f => (
                  <p key={f} className="text-xs font-mono text-slate-600 py-0.5">{f}</p>
                ))}
              </div>
            </div>

            {/* Phone formats */}
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <div className="px-3 py-2 bg-slate-800">
                <p className="text-xs font-mono font-semibold text-white">phone / alternate_phone (sab valid)</p>
              </div>
              <div className="p-2 flex flex-col gap-0.5">
                {['9876543210 ✓', '+919876543210 ✓', '+91-9876543210 ✓', '+91 98765 43210 ✓', '09876543210 ✓'].map(ex => (
                  <span key={ex} className="text-xs font-mono text-green-600">{ex}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {!results ? (
        <>
          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-10 text-center mb-5 transition-colors cursor-pointer ${file ? 'border-blue-400 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
              }`}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <FileText size={32} className="text-blue-500" />
                <p className="text-sm font-semibold text-blue-700">{file.name}</p>
                <p className="text-xs text-blue-500">{preview.length}+ rows detected (first 5 shown below)</p>
                <button onClick={e => { e.stopPropagation(); reset() }}
                  className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1 mt-1">
                  <X size={11} /> Remove file
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload size={32} className="text-slate-300" />
                <p className="text-sm font-semibold text-slate-600">CSV file yahan drop karo ya click karo</p>
                <p className="text-xs text-slate-400">Sirf .csv format supported</p>
                <button onClick={e => { e.stopPropagation(); downloadSampleCSV() }}
                  className="text-xs text-blue-500 hover:underline mt-1 flex items-center gap-1">
                  <Download size={11} /> Sample CSV format download karo
                </button>
              </div>
            )}
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="card p-0 overflow-hidden mb-5">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                <h3>Preview — first {preview.length} rows</h3>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ minWidth: 900, width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {['Name', 'Phone (cleaned)', 'City', 'Lead Source', 'Referral Type', 'Referral Name', 'Referral ID', 'Property', 'Monthly Bill', 'Warnings'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => {
                      const cleaned = cleanPhone(row.phone || '')
                      const phoneValid = cleaned.length === 10
                      const normalized = normalizeRow(row)
                      const { warnings, errors: rowErrors } = validateRow(normalized)
                      const allIssues = [...rowErrors.map(e => '❌ ' + e), ...warnings.map(w => '⚠️ ' + w)]
                      return (
                        <tr key={i} className={`border-b border-slate-100 hover:bg-slate-50 ${rowErrors.length > 0 ? 'bg-red-50' : ''}`}>
                          <td className="px-3 py-2 text-sm text-slate-800">{row.name || '—'}</td>
                          <td className="px-3 py-2 text-sm font-mono">
                            <span className={phoneValid ? 'text-green-600' : 'text-red-500'}>{cleaned || '—'}</span>
                            {!phoneValid && cleaned && <span className="ml-1 text-xs text-red-500">⚠️ invalid</span>}
                          </td>
                          <td className="px-3 py-2 text-sm text-slate-600">{row.city || '—'}</td>
                          <td className="px-3 py-2 text-sm">
                            <span className={row.lead_source && !VALID_VALUES.lead_source.includes(row.lead_source) ? 'text-amber-600 font-medium' : 'text-slate-600'}>
                              {row.lead_source || '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-sm">
                            {row.lead_source === 'Referral' ? (
                              <span className={row.referral_type && !VALID_VALUES.referral_type.includes(row.referral_type) ? 'text-amber-600 font-medium' : 'text-purple-700 font-medium'}>
                                {row.referral_type || '—'}
                              </span>
                            ) : <span className="text-slate-300 text-xs">n/a</span>}
                          </td>
                          <td className="px-3 py-2 text-sm text-slate-600">
                            {row.lead_source === 'Referral' ? (row.referral_name || '—') : <span className="text-slate-300 text-xs">n/a</span>}
                          </td>
                          <td className="px-3 py-2 text-sm text-slate-600">
                            {row.lead_source === 'Referral' ? (row.referral_id || '—') : <span className="text-slate-300 text-xs">n/a</span>}
                          </td>
                          <td className="px-3 py-2 text-sm">
                            <span className={row.property_type && !VALID_VALUES.property_type.includes(row.property_type) ? 'text-amber-600 font-medium' : 'text-slate-600'}>
                              {row.property_type || '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-sm text-slate-600">
                            {row.monthly_bill ? `₹${row.monthly_bill}` : '—'}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {allIssues.length > 0
                              ? <span className={rowErrors.length > 0 ? 'text-red-600' : 'text-amber-600'}>{allIssues.join(' | ')}</span>
                              : <span className="text-green-500">✓ OK</span>
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Import button */}
          {file && (
            <div className="flex items-center gap-3">
              <button onClick={handleImport} disabled={importing} className="btn-primary px-6 py-2.5 disabled:opacity-50">
                {importing
                  ? <span className="flex items-center gap-2"><Spinner size={14} /> Importing... {progress}%</span>
                  : <span className="flex items-center gap-2"><Upload size={14} /> Start import</span>
                }
              </button>
              {importing && (
                <div className="flex-1 max-w-xs bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div className="h-2 bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="card text-center">
              <div className="text-2xl font-semibold text-slate-800">{results.total}</div>
              <div className="text-xs text-slate-500 mt-0.5">Total rows</div>
            </div>
            <div className="card text-center border-green-200 bg-green-50">
              <div className="text-2xl font-semibold text-green-700">{results.new}</div>
              <div className="text-xs text-green-600 mt-0.5">New leads added</div>
            </div>
            <div className="card text-center border-blue-200 bg-blue-50">
              <div className="text-2xl font-semibold text-blue-700">{results.updated}</div>
              <div className="text-xs text-blue-600 mt-0.5">Existing leads updated</div>
            </div>
            <div className="card text-center border-amber-200 bg-amber-50">
              <div className="text-2xl font-semibold text-amber-700">{results.skipped}</div>
              <div className="text-xs text-amber-600 mt-0.5">Skipped / errors</div>
            </div>
          </div>

          {/* Row results */}
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3>Import results — row by row</h3>
              <button onClick={reset} className="btn text-xs py-1 px-2.5">
                <RefreshCw size={11} /> Import another file
              </button>
            </div>
            <div style={{ overflowX: 'auto', maxHeight: 480, overflowY: 'auto' }}>
              <table style={{ minWidth: 700, width: '100%', borderCollapse: 'collapse' }}>
                <thead className="sticky top-0">
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Row', 'Name', 'Phone', 'Status', 'Detail', 'Warnings'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.rows.map((r, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 text-xs text-slate-400">#{r.row}</td>
                      <td className="px-3 py-2 text-sm font-medium text-slate-700">{r.name || '—'}</td>
                      <td className="px-3 py-2 text-sm font-mono text-slate-600">{r.phone || '—'}</td>
                      <td className="px-3 py-2">
                        {r.status === 'new' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200"><CheckCircle2 size={10} /> New</span>}
                        {r.status === 'updated' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">✏️ Updated</span>}
                        {r.status === 'skipped' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">— Skipped</span>}
                        {r.status === 'error' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200"><AlertCircle size={10} /> Error</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {r.detail || r.reason || '—'}
                        {r.skipped && <span className="ml-2 text-slate-400">({r.skipped})</span>}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {r.warnings && r.warnings.length > 0
                          ? <span className="text-amber-600">⚠️ {r.warnings.join(' | ')}</span>
                          : <span className="text-green-500">✓</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {errors.length > 0 && (
            <div className="card border-red-200 bg-red-50">
              <h3 className="text-red-700 mb-2 flex items-center gap-2"><AlertCircle size={14} /> Errors ({errors.length})</h3>
              {errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
            </div>
          )}
        </div>
      )}
    </Layout>
  )
}