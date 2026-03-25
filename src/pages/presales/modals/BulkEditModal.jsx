import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import {
  NOT_CONNECTED_DISPOSITIONS, CONNECTED_DISPOSITIONS,
  PRESALES_STAGES, TIME_SLOTS,
} from '../config/constants'

export default function BulkEditModal({ open, onClose, selectedIds, onDone }) {
  const [agents, setAgents] = useState([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm())

  useEffect(() => {
    if (open) {
      supabase.from('users').select('id, name')
        .eq('role', 'presales_agent').eq('is_active', true).order('name')
        .then(({ data }) => setAgents(data ?? []))
      setForm(emptyForm())
    }
  }, [open])

  function set(f, v) { setForm(p => ({ ...p, [f]: v })) }

  async function handleSave() {
    setSaving(true)

    const updates = {}
    if (form.presales_agent_id) {
      updates.presales_agent_id = form.presales_agent_id
      updates.assigned_to = form.presales_agent_id
    }
    if (form.calling_date) updates.calling_date = form.calling_date
    if (form.callback_date) updates.callback_date = form.callback_date
    if (form.callback_slot) updates.callback_slot = form.callback_slot
    if (form.disposition) updates.disposition = form.disposition
    if (form.stage) updates.stage = form.stage

    if (Object.keys(updates).length === 0) {
      alert('Koi bhi field fill nahi ki!')
      setSaving(false)
      return
    }

    // Snapshot for history
    const { data: oldLeads } = await supabase
      .from('leads')
      .select('id, name, phone, presales_agent_id, assigned_to, calling_date, callback_date, callback_slot, disposition, stage')
      .in('id', selectedIds)

    const { error } = await supabase
      .from('leads')
      .update(updates)
      .in('id', selectedIds)

    if (error) {
      alert('Error: ' + error.message)
      setSaving(false)
      return
    }

    // Save bulk history
    const batchId = `bulk_${Date.now()}`
    const historyRows = (oldLeads ?? []).map(old => ({
      lead_id: old.id,
      action: 'Bulk edit',
      field: Object.keys(updates).join(', '),
      old_val: JSON.stringify(Object.keys(updates).reduce((acc, k) => ({ ...acc, [k]: old[k] ?? null }), {})),
      new_val: JSON.stringify(updates),
      changed_by: null,
      changed_by_name: 'Manager (Bulk)',
      batch_id: batchId,
      created_at: new Date().toISOString(),
    }))

    if (historyRows.length > 0) {
      await supabase.from('lead_history').insert(historyRows)
    }

    onDone()
    setSaving(false)
  }

  return (
    <Modal open={open} onClose={onClose} title={`Bulk edit — ${selectedIds.length} leads`} width={500}>
      <p className="text-xs text-slate-500 mb-4">
        Sirf jo fields fill karoge wahi update hongi. Baaki fields unchanged rahenge.
      </p>
      <div className="flex flex-col gap-4">

        <div>
          <label className="label">Presales agent change karo</label>
          <select className="select" value={form.presales_agent_id} onChange={e => set('presales_agent_id', e.target.value)}>
            <option value="">— No change —</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Calling date</label>
            <input type="date" className="input"
              value={form.calling_date} onChange={e => set('calling_date', e.target.value)} />
          </div>
          <div>
            <label className="label">Callback date</label>
            <input type="date" className="input"
              value={form.callback_date} onChange={e => set('callback_date', e.target.value)} />
          </div>
          <div>
            <label className="label">Callback slot</label>
            <select className="select" value={form.callback_slot} onChange={e => set('callback_slot', e.target.value)}>
              <option value="">— No change —</option>
              {TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Stage</label>
            <select className="select" value={form.stage} onChange={e => set('stage', e.target.value)}>
              <option value="">— No change —</option>
              {PRESALES_STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Disposition</label>
          <select className="select" value={form.disposition} onChange={e => set('disposition', e.target.value)}>
            <option value="">— No change —</option>
            <optgroup label="Not Connected">
              {NOT_CONNECTED_DISPOSITIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </optgroup>
            <optgroup label="Connected">
              {CONNECTED_DISPOSITIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </optgroup>
          </select>
        </div>

      </div>

      <div className="flex gap-2 mt-5 pt-4 border-t border-slate-100">
        <button onClick={onClose} className="btn flex-1 justify-center">Cancel</button>
        <button onClick={handleSave} disabled={saving}
          className="btn-primary flex-1 justify-center disabled:opacity-50">
          {saving ? 'Saving...' : `Update ${selectedIds.length} leads`}
        </button>
      </div>
    </Modal>
  )
}

function emptyForm() {
  return {
    presales_agent_id: '',
    calling_date: '',
    callback_date: '',
    callback_slot: '',
    disposition: '',
    stage: '',
  }
}
