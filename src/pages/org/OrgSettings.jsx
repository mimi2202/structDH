// Settings tab: organisation details (Owner/Admin), transfer ownership and
// delete (Owner), leave (everyone but the Owner).
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiSave, FiRepeat, FiLogOut, FiTrash2 } from 'react-icons/fi'
import Dropdown from '../../components/Dropdown'
import * as store from '../../utils/orgStore'
import { can, roleLabel } from '../../utils/orgRbac'
import { INDUSTRIES } from './orgFormat'
import { Panel, Btn, Field, TextInput, TextArea, Notice, Modal, ConfirmLabel } from './orgUi'

const pick = (o) => ({ name: o.name || '', industry: o.industry || '', country: o.country || '', website: o.website || '', description: o.description || '' })

export default function OrgSettings({ org, role, members, projects, user, onChange }) {
  const navigate = useNavigate()
  const editable = can(role, 'org.edit')
  const [form, setForm] = useState(() => pick(org))
  const [msg, setMsg] = useState(null)
  const [dialog, setDialog] = useState(null) // 'transfer' | 'leave' | 'delete'
  const dirty = JSON.stringify(form) !== JSON.stringify(pick(org))
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }))

  const save = (e) => {
    e.preventDefault()
    const res = store.updateOrg(user, org.id, form)
    setMsg(res.success ? { tone: 'ok', text: 'Organisation details saved.' } : { tone: 'error', text: res.error })
    if (res.success) onChange()
  }

  const candidates = members.filter((m) => m.status === 'active' && m.user_id && m.user_id !== user?.id)

  return (
    <div className="space-y-6">
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      <Panel index="01" title="Organisation details" actions={!editable && <span className="font-mono text-[11px] uppercase tracking-wider text-[#94a3b8]">Owner / Admin only</span>}>
        <form onSubmit={save} className="grid grid-cols-1 gap-4 md:grid-cols-2" noValidate>
          <Field label="Name"><TextInput value={form.name} onChange={set('name')} disabled={!editable} /></Field>
          <Field label="Industry">
            <Dropdown value={form.industry} onChange={set('industry')} disabled={!editable} placeholder="Select industry"
              options={INDUSTRIES.map((i) => ({ value: i, label: i }))} />
          </Field>
          <Field label="Country"><TextInput value={form.country} onChange={set('country')} disabled={!editable} placeholder="e.g. United Kingdom" /></Field>
          <Field label="Website"><TextInput value={form.website} onChange={set('website')} disabled={!editable} mono placeholder="company.com" /></Field>
          <div className="md:col-span-2">
            <Field label="Description"><TextArea rows={3} value={form.description} onChange={set('description')} disabled={!editable} maxLength={400} /></Field>
          </div>
          {editable && (
            <div className="flex justify-end gap-2 md:col-span-2">
              <Btn disabled={!dirty} onClick={() => setForm(pick(org))}>Discard</Btn>
              <Btn type="submit" variant="primary" disabled={!dirty}><FiSave /> Save details</Btn>
            </div>
          )}
        </form>
      </Panel>

      <Panel index="02" title="Ownership and membership" bodyClass="divide-y divide-[#e2e8f0] dark:divide-[#334155]">
        {role === 'owner' ? (
          <Row title="Transfer ownership"
            text={candidates.length
              ? 'Hand the organisation to another active member. You become an Admin.'
              : 'There is no other active member to transfer to. Invite someone first; they must accept before they can own it.'}
            action={<Btn onClick={() => setDialog('transfer')} disabled={!candidates.length}><FiRepeat /> Transfer</Btn>} />
        ) : (
          <Row title="Leave organisation" text={`You are ${roleLabel(role)}. Leaving removes your access to this organisation and its projects.`}
            action={<Btn variant="dangerOutline" onClick={() => setDialog('leave')}><FiLogOut /> Leave</Btn>} />
        )}
        {role === 'owner' && (
          <Row title="Leave organisation" text="The Owner cannot leave. Transfer ownership first, or delete the organisation." action={<Btn disabled><FiLogOut /> Leave</Btn>} />
        )}
      </Panel>

      {can(role, 'org.delete') && (
        <section className="rounded-md border border-red-300 dark:border-red-500/40 bg-white dark:bg-[#1f2937]">
          <header className="border-b border-red-200 dark:border-red-500/30 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-red-700 dark:text-red-400">
            <span className="font-mono">03</span> Danger zone
          </header>
          <Row title="Delete organisation"
            text={`Removes the organisation, its ${members.length} membership(s)/invitation(s) and its audit log. ${projects.length} project(s) are kept and become personal projects of whoever created them.`}
            action={<Btn variant="danger" onClick={() => setDialog('delete')}><FiTrash2 /> Delete</Btn>} />
        </section>
      )}

      {dialog === 'transfer' && <TransferDialog org={org} user={user} candidates={candidates} onClose={() => setDialog(null)}
        onDone={(name) => { setDialog(null); setMsg({ tone: 'ok', text: `Ownership transferred to ${name}. You are now an Admin.` }); onChange() }} />}

      {dialog === 'leave' && (
        <Modal title="Leave organisation" onClose={() => setDialog(null)}
          footer={<><Btn onClick={() => setDialog(null)}>Cancel</Btn>
            <Btn variant="danger" onClick={() => {
              const res = store.leaveOrg(user, org.id)
              if (res.success) { onChange(); navigate('/organisations') } else { setDialog(null); setMsg({ tone: 'error', text: res.error }) }
            }}>Leave</Btn></>}>
          <p>Leave <strong>{org.name}</strong>? You will need a new invitation to come back.</p>
        </Modal>
      )}

      {dialog === 'delete' && <DeleteDialog org={org} projects={projects} onClose={() => setDialog(null)}
        onConfirm={() => {
          const res = store.deleteOrg(user, org.id)
          if (res.success) { onChange(); navigate('/organisations', { state: { notice: `${org.name} deleted. ${res.movedProjects} project(s) moved to personal.` } }) }
          else { setDialog(null); setMsg({ tone: 'error', text: res.error }) }
        }} />}
    </div>
  )
}

function Row({ title, text, action }) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-sm font-semibold text-[#0F172A] dark:text-white">{title}</div>
        <p className="mt-0.5 max-w-2xl text-sm text-[#64748b] dark:text-[#94a3b8]">{text}</p>
      </div>
      <div className="flex-shrink-0">{action}</div>
    </div>
  )
}

function TransferDialog({ org, user, candidates, onClose, onDone }) {
  const [to, setTo] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const target = candidates.find((m) => m.id === to)
  const ok = target && confirm.trim() === org.name
  return (
    <Modal title="Transfer ownership" onClose={onClose}
      footer={<><Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" disabled={!ok} onClick={() => {
          const res = store.transferOwnership(user, org.id, to)
          if (res.success) onDone(target.name); else setError(res.error)
        }}>Transfer ownership</Btn></>}>
      <Field label="New owner">
        <Dropdown value={to} onChange={setTo} placeholder="Select an active member"
          options={candidates.map((m) => ({ value: m.id, label: `${m.name} · ${m.email} (${roleLabel(m.role)})` }))} />
      </Field>
      <Notice tone="warn">You will become an Admin. Only the new Owner can delete the organisation or transfer it again.</Notice>
      <Field label={<ConfirmLabel name={org.name} />} error={error}>
        <TextInput value={confirm} onChange={(e) => setConfirm(e.target.value)} mono />
      </Field>
    </Modal>
  )
}

function DeleteDialog({ org, projects, onClose, onConfirm }) {
  const [confirm, setConfirm] = useState('')
  return (
    <Modal title="Delete organisation" onClose={onClose}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="danger" disabled={confirm.trim() !== org.name} onClick={onConfirm}>Delete organisation</Btn></>}>
      <Notice tone="error">This cannot be undone. All members lose access and the audit log is erased.</Notice>
      {projects.length > 0 && (
        <p>{projects.length} project(s) will be kept as personal projects of the people who created them: <span className="font-mono text-xs">{projects.map((p) => p.name).join(', ')}</span></p>
      )}
      <Field label={<ConfirmLabel name={org.name} />}>
        <TextInput value={confirm} onChange={(e) => setConfirm(e.target.value)} mono autoFocus />
      </Field>
    </Modal>
  )
}
