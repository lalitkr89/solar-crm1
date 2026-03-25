import { useNavigate } from 'react-router-dom'
import { DispBadge } from '@/components/ui'
import { maskPhone } from '@/lib/phone'
import { format } from 'date-fns'
import { SALES_OUTCOME_LABELS } from '../config/constants'

function getCardStyles(disposition) {
  const borderColor = disposition?.includes('Meeting') ? '#14532d'
    : disposition?.includes('Not Connected') || disposition?.includes('Invalid') ? '#713f12'
      : disposition?.includes('Call Later') || disposition?.includes('Meet Later') ? '#1e3a8a'
        : disposition?.includes('Not Interested') || disposition?.includes('Non Qualified') || disposition?.includes('Not Serviceable') ? '#7f1d1d'
          : disposition ? '#475569'
            : '#cbd5e1'

  const avatarBg = disposition?.includes('Meeting') ? { bg: '#dcfce7', text: '#14532d' }
    : disposition?.includes('Not Connected') || disposition?.includes('Invalid') ? { bg: '#fef9c3', text: '#713f12' }
      : disposition?.includes('Call Later') || disposition?.includes('Meet Later') ? { bg: '#dbeafe', text: '#1e3a8a' }
        : disposition?.includes('Not Interested') || disposition?.includes('Non Qualified') ? { bg: '#fee2e2', text: '#7f1d1d' }
          : { bg: '#f1f5f9', text: '#64748b' }

  return { borderColor, avatarBg }
}

export default function MobileLeadCard({ lead, today }) {
  const navigate = useNavigate()
  const { borderColor, avatarBg } = getCardStyles(lead.disposition)
  const callbackIsToday = lead.callback_date === today
  const meetingIsToday = lead.meeting_date === today

  return (
    <div
      className="bg-white rounded-xl border border-slate-200 overflow-hidden cursor-pointer"
      onClick={() => navigate(`/leads/${lead.id}`)}>
      <div style={{ borderLeft: `3px solid ${borderColor}`, padding: '11px 13px' }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0"
              style={{ background: avatarBg.bg, color: avatarBg.text }}>
              {lead.name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-800 truncate">{lead.name ?? '—'}</div>
              <div className="text-xs text-slate-400 mt-0.5">
                {maskPhone(lead.phone)} · {lead.city ?? '—'}
              </div>
            </div>
          </div>
          {lead.disposition
            ? <DispBadge value={lead.disposition} />
            : <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 whitespace-nowrap flex-shrink-0">New lead</span>
          }
        </div>

        <div className="flex gap-1.5 mt-2 flex-wrap">
          {lead.assigned_name && (
            <span className="text-xs px-2 py-1 rounded-md bg-slate-50 text-slate-500">
              {lead.assigned_name.split(' ')[0]}{lead.lead_source ? ` · ${lead.lead_source}` : ''}
            </span>
          )}
          {lead.callback_date && (
            <span className={`text-xs px-2 py-1 rounded-md font-medium ${callbackIsToday ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-500'}`}>
              CB: {callbackIsToday ? 'Today' : format(new Date(lead.callback_date), 'd MMM')}
              {lead.callback_slot ? ` · ${lead.callback_slot.split(' ')[0]}` : ''}
            </span>
          )}
          {lead.meeting_date && (
            <span className={`text-xs px-2 py-1 rounded-md font-medium ${meetingIsToday ? 'bg-blue-50 text-blue-700' : 'bg-slate-50 text-slate-500'}`}>
              Mtg: {meetingIsToday ? 'Today' : format(new Date(lead.meeting_date), 'd MMM')}
            </span>
          )}
          {lead.sales_outcome && (
            <span className="text-xs px-2 py-1 rounded-md bg-purple-50 text-purple-700">
              {SALES_OUTCOME_LABELS[lead.sales_outcome] ?? lead.sales_outcome}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}