// Project chat room: a "General" channel per project and a review thread per
// saved design (resolve / reopen), @mentions of the project's team, unread
// counts and live updates. All data goes through services/chatService.js
// (a browser-only DEMO adapter for now: swap that module for the backend).
//
// <ProjectChat project user members designs initialDesign compact />
// <ChatBubble  project user members designs />   floating button + panel
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiHash, FiFileText, FiCheckCircle, FiRotateCcw, FiSend, FiMessageSquare, FiX, FiInfo, FiExternalLink } from 'react-icons/fi'
import * as chat from '../../services/chatService'
import { Avatar } from '../ui/UserMenu'
import Dropdown from '../Dropdown'
import { designRoute, designState, ELEMENTS } from '../../utils/savedDesigns'

const pad = (n) => String(n).padStart(2, '0')
const time = (iso) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}` }
const dayLabel = (iso) => {
  const d = new Date(iso)
  const today = new Date()
  const y = new Date(); y.setDate(y.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === y.toDateString()) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

// "@Ada Obi" -> highlighted when Ada is a member.
function Body({ text, members }) {
  const names = members.map((m) => m.name).filter(Boolean).sort((a, b) => b.length - a.length)
  if (!names.length) return <>{text}</>
  const re = new RegExp(`@(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g')
  const parts = []
  let last = 0
  let m
  while ((m = re.exec(text))) {
    parts.push(text.slice(last, m.index))
    parts.push(<span key={m.index} className="rounded bg-[#e6f0f5] px-0.5 font-semibold text-[#0A2F44] dark:bg-[#1e3a4a] dark:text-[#66a4c2]">{m[0]}</span>)
    last = m.index + m[0].length
  }
  parts.push(text.slice(last))
  return <>{parts}</>
}

export default function ProjectChat({ project, user, members = [], designs = [], initialDesign = null, compact = false }) {
  const [channels, setChannels] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [unread, setUnread] = useState({})
  const [draft, setDraft] = useState('')
  const [mention, setMention] = useState(null) // { query, start }
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const active = channels.find((c) => c.id === activeId) || null

  const reload = useCallback(async () => {
    const list = await chat.listChannels(project.id)
    setChannels(list)
    setUnread(await chat.unreadCounts(project.id, user.id))
    return list
  }, [project.id, user.id])

  // first load: open the design's thread if asked for, else General
  useEffect(() => {
    let alive = true
    ;(async () => {
      let target = null
      if (initialDesign) target = await chat.openDesignThread(project.id, initialDesign)
      const list = await reload()
      if (alive) setActiveId((target || list[0])?.id || null)
    })()
    return () => { alive = false }
  }, [project.id, initialDesign?.id, reload]) // eslint-disable-line react-hooks/exhaustive-deps

  // messages of the open channel + live updates
  useEffect(() => {
    if (!activeId) return undefined
    let alive = true
    const load = async () => {
      const list = await chat.listMessages(activeId)
      if (!alive) return
      setMessages(list)
      await chat.markRead(activeId, user.id)
    }
    load()
    const off = chat.subscribe((e) => {
      if (e.type === 'message.created' && e.message?.channel_id === activeId) load()
      if (e.type !== 'read') reload()
      if (e.type === 'storage') load()
    })
    return () => { alive = false; off() }
  }, [activeId, user.id, reload])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages.length, activeId])

  const mentionOptions = useMemo(() => (mention
    ? members.filter((m) => m.id !== user.id && m.name.toLowerCase().includes(mention.query.toLowerCase())).slice(0, 6)
    : []), [mention, members, user.id])

  const onDraft = (e) => {
    const v = e.target.value
    setDraft(v)
    const caret = e.target.selectionStart
    const before = v.slice(0, caret)
    const at = before.lastIndexOf('@')
    if (at >= 0 && (at === 0 || /\s/.test(before[at - 1])) && !/\s{2}|\n/.test(before.slice(at + 1)) && before.length - at <= 30) {
      setMention({ query: before.slice(at + 1), start: at })
    } else setMention(null)
  }

  const pickMention = (m) => {
    const caret = inputRef.current?.selectionStart ?? draft.length
    const next = `${draft.slice(0, mention.start)}@${m.name} ${draft.slice(caret)}`
    setDraft(next)
    setMention(null)
    inputRef.current?.focus()
  }

  const send = async () => {
    if (!draft.trim() || !active) return
    const mentions = members.filter((m) => draft.includes(`@${m.name}`)).map((m) => m.id)
    await chat.sendMessage(active.id, user, draft, mentions)
    setDraft('')
    setMention(null)
  }

  const onKey = (e) => {
    if (mention && mentionOptions.length && (e.key === 'Enter' || e.key === 'Tab')) { e.preventDefault(); pickMention(mentionOptions[0]); return }
    if (e.key === 'Escape') setMention(null)
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const startThread = async (key) => {
    const d = designs.find((x) => `${x.element}:${x.id}` === key)
    if (!d) return
    const ch = await chat.openDesignThread(project.id, { element: d.element, id: d.id, name: d.name })
    await reload()
    setActiveId(ch.id)
  }

  const general = channels.filter((c) => c.kind === 'general')
  const threads = channels.filter((c) => c.kind === 'design')
  const threadDesign = active?.design_ref ? designs.find((d) => d.id === active.design_ref.id && d.element === active.design_ref.element) : null
  const noThreadYet = designs.filter((d) => !threads.some((t) => t.design_ref?.id === d.id && t.design_ref?.element === d.element))

  const ChannelButton = ({ c }) => (
    <button type="button" onClick={() => setActiveId(c.id)} data-channel={c.name}
      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${c.id === activeId ? 'bg-[#0A2F44] text-white' : 'text-[#334155] hover:bg-[#f1f5f9] dark:text-[#cbd5e1] dark:hover:bg-[#334155]'}`}>
      {c.kind === 'general' ? <FiHash className="flex-shrink-0" /> : c.resolved ? <FiCheckCircle className="flex-shrink-0 text-emerald-500" /> : <FiFileText className="flex-shrink-0" />}
      <span className={`min-w-0 flex-1 truncate ${c.resolved && c.id !== activeId ? 'line-through opacity-60' : ''}`}>{c.name}</span>
      {unread[c.id] > 0 && c.id !== activeId && <span className="rounded-full bg-red-500 px-1.5 font-mono text-[10px] text-white" data-unread>{unread[c.id]}</span>}
    </button>
  )

  // ---- layout: channel list (or dropdown when compact) + conversation
  const channelList = compact ? (
    <div className="border-b border-[#e2e8f0] p-2 dark:border-[#334155]">
      <Dropdown value={activeId || ''} onChange={setActiveId} className="!py-1.5 !text-xs"
        options={channels.map((c) => ({ value: c.id, label: `${c.kind === 'general' ? '# ' : c.resolved ? '✓ ' : '◇ '}${c.name}${unread[c.id] && c.id !== activeId ? ` (${unread[c.id]})` : ''}` }))} />
    </div>
  ) : (
    <aside className="flex w-60 flex-shrink-0 flex-col border-r border-[#e2e8f0] dark:border-[#334155]">
      <div className="space-y-0.5 p-2">{general.map((c) => <ChannelButton key={c.id} c={c} />)}</div>
      <div className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Design reviews · {threads.length}</div>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-auto p-2">
        {threads.length === 0 && <p className="px-2 text-xs text-[#94a3b8]">No review threads yet.</p>}
        {threads.map((c) => <ChannelButton key={c.id} c={c} />)}
      </div>
      {noThreadYet.length > 0 && (
        <div className="border-t border-[#e2e8f0] p-2 dark:border-[#334155]">
          <Dropdown value="" onChange={startThread} placeholder="+ Discuss a design…" className="!py-1.5 !text-xs"
            options={noThreadYet.map((d) => ({ value: `${d.element}:${d.id}`, label: `${d.name} · ${ELEMENTS[d.element]?.label}` }))} />
        </div>
      )}
    </aside>
  )

  // a day separator before the first message of each day
  const days = messages.map((m) => dayLabel(m.created_at))
  return (
    <div className={`flex h-full min-h-0 flex-col overflow-hidden ${compact ? '' : 'rounded-md border border-[#e2e8f0] dark:border-[#334155]'} bg-white dark:bg-[#1f2937]`} data-project-chat>
      {chat.IS_DEMO && (
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <FiInfo className="flex-shrink-0" /> Demo chat: messages stay in this browser until the chat server is connected.
        </div>
      )}
      <div className={`flex min-h-0 flex-1 ${compact ? 'flex-col' : ''}`}>
        {channelList}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          {active && (
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e2e8f0] px-4 py-2 dark:border-[#334155]">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#0F172A] dark:text-white">
                  {active.kind === 'general' ? <FiHash /> : <FiFileText />}<span className="truncate">{active.name}</span>
                  {active.resolved && <span className="rounded border border-emerald-300 px-1 font-mono text-[10px] uppercase text-emerald-700 dark:border-emerald-500/50 dark:text-emerald-300">Resolved</span>}
                </div>
                <div className="text-[11px] text-[#64748b] dark:text-[#94a3b8]">
                  {active.kind === 'general' ? `Everyone on ${project.name}` : `Review thread · ${ELEMENTS[active.design_ref.element]?.label}`}
                </div>
              </div>
              {active.kind === 'design' && (
                <div className="flex gap-1.5">
                  {threadDesign && (
                    <Link to={designRoute(threadDesign, threadDesign.element)} state={designState(threadDesign)}
                      className="inline-flex items-center gap-1 rounded border border-[#cbd5e1] px-2 py-1 text-xs text-[#0F172A] hover:bg-[#f1f5f9] dark:border-[#475569] dark:text-white dark:hover:bg-[#334155]">
                      <FiExternalLink /> Open design
                    </Link>
                  )}
                  <button type="button" onClick={async () => { await chat.setResolved(active.id, !active.resolved, user); reload() }}
                    className="inline-flex items-center gap-1 rounded border border-[#cbd5e1] px-2 py-1 text-xs text-[#0F172A] hover:bg-[#f1f5f9] dark:border-[#475569] dark:text-white dark:hover:bg-[#334155]">
                    {active.resolved ? <><FiRotateCcw /> Reopen</> : <><FiCheckCircle /> Resolve</>}
                  </button>
                </div>
              )}
            </header>
          )}

          <div ref={listRef} className="min-h-0 flex-1 space-y-1 overflow-auto px-4 py-3" data-messages>
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center text-sm text-[#94a3b8]">
                <FiMessageSquare className="mb-2 text-2xl" />
                {active?.kind === 'design' ? 'Start the review: what needs checking on this design?' : 'No messages yet. Say hello to the team.'}
              </div>
            )}
            {messages.map((m, i) => {
              const day = days[i]
              const showDay = i === 0 || day !== days[i - 1]
              const mine = m.author.id === user.id
              const prev = messages[i - 1]
              const grouped = prev && !prev.system && !m.system && prev.author.id === m.author.id && !showDay
                && new Date(m.created_at) - new Date(prev.created_at) < 5 * 60 * 1000
              return (
                <React.Fragment key={m.id}>
                  {showDay && (
                    <div className="my-3 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94a3b8]">
                      <span className="h-px flex-1 bg-[#e2e8f0] dark:bg-[#334155]" />{day}<span className="h-px flex-1 bg-[#e2e8f0] dark:bg-[#334155]" />
                    </div>
                  )}
                  {m.system ? (
                    <div className="py-1 text-center text-[11px] text-[#64748b]" data-message="system"><b>{m.author.name}</b> {m.body} · {time(m.created_at)}</div>
                  ) : (
                    <div className={`flex gap-2 ${mine ? 'flex-row-reverse' : ''} ${grouped ? '' : 'pt-2'}`} data-message={mine ? 'mine' : 'theirs'}>
                      <div className="w-8 flex-shrink-0">{!grouped && <Avatar user={{ name: m.author.name, email: m.author.email }} size="md" />}</div>
                      <div className={`max-w-[75%] ${mine ? 'items-end text-right' : ''} flex flex-col`}>
                        {!grouped && (
                          <div className={`mb-0.5 flex items-baseline gap-2 text-[11px] ${mine ? 'flex-row-reverse' : ''}`}>
                            <span className="font-semibold text-[#0F172A] dark:text-white">{mine ? 'You' : m.author.name}</span>
                            <span className="font-mono text-[#94a3b8]">{time(m.created_at)}</span>
                          </div>
                        )}
                        <div className={`whitespace-pre-wrap break-words rounded-lg px-3 py-1.5 text-left text-sm ${mine ? 'bg-[#0A2F44] text-white' : 'bg-[#f1f5f9] text-[#0F172A] dark:bg-[#0f172a] dark:text-white'} ${m.mentions?.includes(user.id) ? 'ring-2 ring-amber-400' : ''}`}>
                          <Body text={m.body} members={members} />
                        </div>
                      </div>
                    </div>
                  )}
                </React.Fragment>
              )
            })}
          </div>

          <div className="relative border-t border-[#e2e8f0] p-2 dark:border-[#334155]">
            {mention && mentionOptions.length > 0 && (
              <ul className="absolute bottom-full left-2 mb-1 w-64 overflow-hidden rounded-md border border-[#e2e8f0] bg-white shadow-lg dark:border-[#334155] dark:bg-[#1f2937]" data-mentions>
                {mentionOptions.map((m) => (
                  <li key={m.id}>
                    <button type="button" onMouseDown={(e) => { e.preventDefault(); pickMention(m) }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-[#f1f5f9] dark:hover:bg-[#334155]">
                      <Avatar user={m} size="sm" /><span className="truncate text-[#0F172A] dark:text-white">{m.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-end gap-2">
              <textarea ref={inputRef} rows={1} value={draft} onChange={onDraft} onKeyDown={onKey} disabled={!active}
                placeholder={active ? `Message ${active.kind === 'general' ? '#' : ''}${active.name}${members.length > 1 ? ' · @ to mention' : ''}` : 'Loading…'}
                aria-label="Message"
                className="max-h-32 min-h-[38px] flex-1 resize-none rounded border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#94a3b8] focus:border-[#0A2F44] focus:outline-none dark:border-[#475569] dark:bg-[#0f172a] dark:text-white"
                style={{ height: Math.min(128, 38 + 20 * (draft.split('\n').length - 1)) }} />
              <button type="button" onClick={send} disabled={!draft.trim()} aria-label="Send"
                className="flex h-[38px] w-[38px] items-center justify-center rounded bg-[#0A2F44] text-white hover:bg-[#0d3a54] disabled:opacity-40">
                <FiSend />
              </button>
            </div>
            <p className="mt-1 px-1 text-[10px] text-[#94a3b8]">Enter to send · Shift+Enter for a new line</p>
          </div>
        </section>
      </div>
    </div>
  )
}

// Floating chat button (collapsed by default) with the unread total; opens the
// chat in a panel. For project pages only (never on results / PDF pages).
export function ChatBubble({ project, user, members, designs }) {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    let alive = true
    const count = async () => {
      const u = await chat.unreadCounts(project.id, user.id)
      if (alive) setUnread(Object.values(u).reduce((a, b) => a + b, 0))
    }
    count()
    const off = chat.subscribe(count)
    return () => { alive = false; off() }
  }, [project.id, user.id])

  return (
    <div className="cb-no-print pdf-hide">
      {open && (
        <div className="fixed bottom-20 right-4 z-[60] flex h-[min(560px,calc(100vh-120px))] w-[min(400px,calc(100vw-32px))] flex-col overflow-hidden rounded-xl border border-[#e2e8f0] shadow-2xl dark:border-[#334155]" data-chat-panel>
          <div className="flex items-center justify-between bg-[#0A2F44] px-3 py-2 text-white">
            <span className="flex items-center gap-2 text-sm font-semibold"><FiMessageSquare /> {project.name}</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" className="rounded p-1 hover:bg-white/10"><FiX /></button>
          </div>
          <div className="min-h-0 flex-1"><ProjectChat project={project} user={user} members={members} designs={designs} compact /></div>
        </div>
      )}
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label={`Project chat${unread ? ` (${unread} unread)` : ''}`} data-chat-bubble
        className="fixed bottom-4 right-4 z-[60] flex h-12 w-12 items-center justify-center rounded-full bg-[#0A2F44] text-white shadow-lg hover:bg-[#0d3a54]">
        {open ? <FiX className="text-xl" /> : <FiMessageSquare className="text-xl" />}
        {unread > 0 && !open && <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 font-mono text-[11px] text-white" data-bubble-unread>{unread > 99 ? '99+' : unread}</span>}
      </button>
    </div>
  )
}
