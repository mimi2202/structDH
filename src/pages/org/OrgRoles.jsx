// Roles & Permissions tab: the four roles and the full permission matrix.
import React from 'react'
import { FiCheck, FiMinus } from 'react-icons/fi'
import { PERMISSIONS, ROLE_DEFS, ROLE_ORDER, roleLabel } from '../../utils/orgRbac'
import { Panel, RoleBadge, Th } from './orgUi'

const RULES = [
  'The person who creates an organisation becomes its Owner. There is exactly one Owner.',
  'Ownership moves only by transfer (Settings). The previous Owner becomes an Admin.',
  'The Owner cannot leave: transfer ownership first, or delete the organisation.',
  'Admins manage Editors and Members only; Admins and the Owner are managed by the Owner.',
  'Nobody can change their own role or remove themselves (use Leave organisation).',
  'Deleting an organisation keeps its projects: each becomes a personal project of the person who created it.',
]

export default function OrgRoles({ role, members }) {
  const active = members.filter((m) => m.status === 'active')
  const groups = [...new Set(Object.values(PERMISSIONS).map((p) => p.group))]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ROLE_ORDER.map((r) => (
          <div key={r} className={`rounded-md border bg-white dark:bg-[#1f2937] p-4 ${r === role ? 'border-[#0A2F44] ring-1 ring-[#0A2F44] dark:border-[#66a4c2] dark:ring-[#66a4c2]' : 'border-[#e2e8f0] dark:border-[#334155]'}`}>
            <div className="flex items-center justify-between">
              <RoleBadge role={r} />
              <span className="font-mono text-xs text-[#64748b] dark:text-[#94a3b8] tabular-nums">{active.filter((m) => m.role === r).length} assigned</span>
            </div>
            <p className="mt-3 text-sm text-[#334155] dark:text-[#cbd5e1]">{ROLE_DEFS[r].summary}</p>
            {r === role && <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-[#0A2F44] dark:text-[#66a4c2]">Your role</p>}
          </div>
        ))}
      </div>

      <Panel index="01" title="Permission matrix" bodyClass="">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="border-b border-[#e2e8f0] dark:border-[#334155] bg-[#f8fafc] dark:bg-[#172030]">
              <tr>
                <Th>Permission</Th>
                {ROLE_ORDER.map((r) => (
                  <Th key={r} className={`text-center ${r === role ? 'bg-[#e6f0f5] dark:bg-[#1e3a4a]' : ''}`}>{roleLabel(r)}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <React.Fragment key={g}>
                  <tr className="border-b border-[#e2e8f0] dark:border-[#334155] bg-[#fbfcfd] dark:bg-[#1b2433]">
                    <td colSpan={ROLE_ORDER.length + 1} className="px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[#0A2F44] dark:text-[#66a4c2]">{g}</td>
                  </tr>
                  {Object.entries(PERMISSIONS).filter(([, p]) => p.group === g).map(([key, p]) => (
                    <tr key={key} className="border-b border-[#eef2f6] dark:border-[#2b3647]">
                      <td className="px-4 py-2 text-sm text-[#0F172A] dark:text-white">
                        {p.label}
                        <span className="ml-2 font-mono text-[10px] text-[#94a3b8]">{key}</span>
                      </td>
                      {ROLE_ORDER.map((r) => (
                        <td key={r} className={`px-4 py-2 text-center ${r === role ? 'bg-[#f0f7fb] dark:bg-[#172f3d]' : ''}`}>
                          {p.roles.includes(r)
                            ? <FiCheck className="mx-auto text-[#0A2F44] dark:text-[#66a4c2]" aria-label="allowed" />
                            : <FiMinus className="mx-auto text-[#cbd5e1] dark:text-[#475569]" aria-label="not allowed" />}
                        </td>
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel index="02" title="Rules">
        <ol className="space-y-2 text-sm text-[#334155] dark:text-[#cbd5e1]">
          {RULES.map((r, i) => (
            <li key={i} className="flex gap-3">
              <span className="font-mono text-xs text-[#0A2F44] dark:text-[#66a4c2]">R{String(i + 1).padStart(2, '0')}</span>
              <span>{r}</span>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  )
}
