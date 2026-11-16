// /workspace/create — create an organisation (you become its Owner) and,
// optionally, invite the first members.
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiPlus, FiX, FiArrowRight } from 'react-icons/fi'
import AccountLayout from '../../components/layout/AccountLayout'
import Dropdown from '../../components/Dropdown'
import { useAuth } from '../../contexts/AuthContext'
import { useWorkspace } from '../../contexts/WorkspaceContext'
import * as store from '../../utils/orgStore'
import { assignableRoles, ROLE_DEFS, roleLabel } from '../../utils/orgRbac'
import { INDUSTRIES } from './orgFormat'
import { Panel, RoleBadge, Btn, Field, TextInput, TextArea, Notice } from './orgUi'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function OrgCreate() {
  const { user } = useAuth()
  const { refreshWorkspaces } = useWorkspace()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', industry: INDUSTRIES[0], country: '', website: '', description: '' })
  const [invites, setInvites] = useState([])
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }))
  const roles = assignableRoles('owner')

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Give the organisation a name.'
    const seen = new Set()
    invites.forEach((inv, i) => {
      const em = inv.email.trim().toLowerCase()
      if (!em) return
      if (!EMAIL_RE.test(em)) e[`inv${i}`] = 'Not a valid email.'
      else if (em === (user?.email || '').toLowerCase()) e[`inv${i}`] = 'That is you: you are the Owner.'
      else if (seen.has(em)) e[`inv${i}`] = 'Listed twice.'
      seen.add(em)
    })
    setErrors(e)
    return !Object.keys(e).length
  }

  const submit = (ev) => {
    ev.preventDefault()
    if (!validate()) return
    setBusy(true)
    const res = store.createOrg(user, form)
    if (!res.success) { setErrors({ name: res.error }); setBusy(false); return }
    invites.filter((i) => i.email.trim()).forEach((i) => store.inviteMember(user, res.org.id, i.email, i.role))
    refreshWorkspaces()
    navigate(`/workspace/${res.org.id}${invites.some((i) => i.email.trim()) ? '?tab=members' : ''}`)
  }

  return (
    <AccountLayout title="New organisation" subtitle="You become the Owner of the organisation you create">
      <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-6 p-4 sm:p-8 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Panel index="01" title="Organisation">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Field label="Name" error={errors.name}>
                  <TextInput value={form.name} onChange={set('name')} autoFocus placeholder="e.g. Uloka Structures Ltd" />
                </Field>
              </div>
              <Field label="Industry">
                <Dropdown value={form.industry} onChange={set('industry')} options={INDUSTRIES.map((i) => ({ value: i, label: i }))} />
              </Field>
              <Field label="Country"><TextInput value={form.country} onChange={set('country')} placeholder="e.g. United Kingdom" /></Field>
              <div className="md:col-span-2">
                <Field label="Website (optional)"><TextInput value={form.website} onChange={set('website')} mono placeholder="company.com" /></Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Description (optional)"><TextArea rows={3} value={form.description} onChange={set('description')} maxLength={400} /></Field>
              </div>
            </div>
          </Panel>

          <Panel index="02" title="Invite members (optional)"
            actions={<Btn size="sm" onClick={() => setInvites((l) => [...l, { email: '', role: 'editor' }])}><FiPlus /> Add row</Btn>}>
            {invites.length === 0 ? (
              <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">You can also invite people later from the Members tab.</p>
            ) : (
              <div className="space-y-3">
                {invites.map((inv, i) => (
                  <div key={i} data-invite-row className="grid grid-cols-[1fr_9rem_auto] items-start gap-2">
                    <Field label={i === 0 ? 'Email' : ''} error={errors[`inv${i}`]}>
                      <TextInput mono type="email" value={inv.email} placeholder="name@company.com"
                        onChange={(e) => setInvites((l) => l.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} />
                    </Field>
                    <Field label={i === 0 ? 'Role' : ''}>
                      <Dropdown value={inv.role} onChange={(r) => setInvites((l) => l.map((x, j) => (j === i ? { ...x, role: r } : x)))}
                        options={roles.map((r) => ({ value: r, label: roleLabel(r) }))} />
                    </Field>
                    <button type="button" aria-label="Remove row" onClick={() => setInvites((l) => l.filter((_, j) => j !== i))}
                      className={`rounded p-2 text-[#64748b] hover:bg-[#f1f5f9] dark:hover:bg-[#334155] ${i === 0 ? 'mt-5' : ''}`}><FiX /></button>
                  </div>
                ))}
                <Notice tone="info">No email is sent yet. Each person sees the invitation under Organisations when they sign in with that email.</Notice>
              </div>
            )}
          </Panel>

          <div className="flex justify-end gap-2">
            <Btn onClick={() => navigate(-1)}>Cancel</Btn>
            <Btn type="submit" variant="primary" disabled={busy}>Create organisation <FiArrowRight /></Btn>
          </div>
        </div>

        <div className="space-y-6">
          <Panel title="What happens">
            <ol className="space-y-3 text-sm text-[#334155] dark:text-[#cbd5e1]">
              {[
                'You are recorded as the Owner (one per organisation).',
                'Invited people join with the role you pick once they accept.',
                'Your existing projects stay personal; move any of them in from the project page.',
                'Ownership can be transferred later; the Owner can delete the organisation.',
              ].map((t, i) => (
                <li key={i} className="flex gap-3"><span className="font-mono text-xs text-[#0A2F44] dark:text-[#66a4c2]">{String(i + 1).padStart(2, '0')}</span><span>{t}</span></li>
              ))}
            </ol>
          </Panel>
          <Panel title="Roles">
            <ul className="space-y-3">
              {['owner', ...roles].map((r) => (
                <li key={r} className="text-sm">
                  <RoleBadge role={r} />
                  <p className="mt-1 text-[#475569] dark:text-[#cbd5e1]">{ROLE_DEFS[r].summary}</p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </form>
    </AccountLayout>
  )
}
