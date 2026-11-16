// Audit Log tab (Owner and Admin): every organisation change, newest first.
import React, { useState } from 'react'
import { FiDownload } from 'react-icons/fi'
import Dropdown from '../../components/Dropdown'
import { getAudit } from '../../utils/orgStore'
import { orgCode } from '../../utils/orgRbac'
import { fmtTs } from './orgFormat'
import { Panel, Btn, Th, Empty } from './orgUi'

const KINDS = [
  { value: 'all', label: 'All events' },
  { value: 'org.', label: 'Organisation' },
  { value: 'member.', label: 'Membership' },
]

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

export default function OrgAudit({ org }) {
  const [kind, setKind] = useState('all')
  const all = getAudit(org.id)
  const rows = kind === 'all' ? all : all.filter((a) => a.action.startsWith(kind))

  const exportCsv = () => {
    const lines = [['timestamp', 'actor', 'action', 'target', 'detail'].join(',')]
      .concat(rows.map((a) => [a.at, a.actor_name, a.action, a.target, a.detail].map(csvCell).join(',')))
    const url = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv' }))
    const el = document.createElement('a')
    el.href = url
    el.download = `${orgCode(org.id)}-audit.csv`
    document.body.appendChild(el); el.click(); el.remove(); URL.revokeObjectURL(url)
  }

  return (
    <Panel index="01" title={`Audit log · ${rows.length} events`} bodyClass=""
      actions={<>
        <div className="w-44"><Dropdown value={kind} onChange={setKind} options={KINDS} className="!py-1 !text-xs" /></div>
        <Btn size="sm" onClick={exportCsv} disabled={!rows.length}><FiDownload /> CSV</Btn>
      </>}>
      {rows.length === 0 ? <Empty>No events</Empty> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="border-b border-[#e2e8f0] dark:border-[#334155] bg-[#f8fafc] dark:bg-[#172030]">
              <tr><Th>Timestamp</Th><Th>Actor</Th><Th>Event</Th><Th>Target</Th><Th>Detail</Th></tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#334155]">
              {rows.map((a, i) => (
                <tr key={i} className="align-top hover:bg-[#f8fafc] dark:hover:bg-[#172030]">
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-[#64748b] dark:text-[#94a3b8] tabular-nums">{fmtTs(a.at)}</td>
                  <td className="px-4 py-2 text-sm text-[#0F172A] dark:text-white">{a.actor_name}</td>
                  <td className="px-4 py-2"><span className="rounded bg-[#f1f5f9] dark:bg-[#0f172a] px-1.5 py-0.5 font-mono text-[11px] text-[#0A2F44] dark:text-[#66a4c2]">{a.action}</span></td>
                  <td className="px-4 py-2 font-mono text-xs text-[#475569] dark:text-[#cbd5e1]">{a.target || '-'}</td>
                  <td className="px-4 py-2 text-sm text-[#475569] dark:text-[#cbd5e1]">{a.detail || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}
