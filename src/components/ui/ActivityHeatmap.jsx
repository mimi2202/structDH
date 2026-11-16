import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FiCalendar, FiClock, FiCheckCircle, FiTrendingUp } from 'react-icons/fi'
import { calendarWeeks, activityLevel, summary, streaks } from '../../utils/activity'

// Five shades, palest = no designs. Same scale in the legend.
const LEVELS = [
  'bg-[#e5e7eb] dark:bg-[#374151]',
  'bg-[#cce1eb] dark:bg-[#1e3a4a]',
  'bg-[#99c2d6] dark:bg-[#2a5a6e]',
  'bg-[#4f8fb0] dark:bg-[#3f86a8]',
  'bg-[#0A2F44] dark:bg-[#8cc4de]',
]
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const GAP = 3 // px between squares
const MIN_CELL = 10 // px; below this the grid scrolls sideways instead of shrinking

const fmt = (d) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

// Tooltip drawn in a portal with fixed position, kept inside the window, so
// the card's scroll area cannot cut it off. Sits above the square, or below
// when there is no room above.
function Tip({ tip }) {
  const ref = useRef(null)
  const [pos, setPos] = useState(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const margin = 8
    const left = Math.min(Math.max(tip.x - width / 2, margin), window.innerWidth - width - margin)
    const above = tip.top - height - 6
    const top = above >= margin ? above : tip.bottom + 6
    setPos({ left, top })
  }, [tip])
  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      className="pointer-events-none fixed z-[200] whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white shadow-lg"
      style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: -9999 }}
    >
      <strong>{tip.day.count} design{tip.day.count === 1 ? '' : 's'}</strong> on {fmt(tip.day.d)}
    </div>,
    document.body,
  )
}

// GitHub-style calendar of designs run over the last 12 months: one square a
// day, columns are weeks, darker = more designs that day. The week columns
// share the card's width, so the squares grow to fill it.
export default function ActivityHeatmap({ days }) {
  const weeks = calendarWeeks(days)
  const { thisWeek, lastYear, lastActive } = summary(days)
  const { current } = streaks(days)
  const scroller = useRef(null)
  const [tip, setTip] = useState(null)

  // Start scrolled to today when the grid is wider than the card (phones).
  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth
  }, [])

  // Hide the tooltip on scroll (its square moves away from it).
  useEffect(() => {
    if (!tip) return undefined
    const hide = () => setTip(null)
    window.addEventListener('scroll', hide, true)
    return () => window.removeEventListener('scroll', hide, true)
  }, [tip])

  // Month label above the first week that starts in that month.
  const monthLabels = weeks.map((col, i) => {
    const first = col.find(Boolean)
    if (!first) return null
    const m = first.d.getMonth()
    const prev = i > 0 ? weeks[i - 1].find(Boolean)?.d.getMonth() : null
    return i === 0 || m !== prev ? MONTHS[m] : null
  })

  const show = (e, day) => {
    const r = e.currentTarget.getBoundingClientRect()
    setTip({ x: r.left + r.width / 2, top: r.top, bottom: r.bottom, day })
  }

  return (
    <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-lg border border-[#e5e7eb] dark:border-[#374151] p-6 mb-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center space-x-2">
          <FiCalendar className="text-[#0A2F44] dark:text-[#cce1eb]" />
          <h3 className="text-lg font-semibold text-[#02090d] dark:text-white">Activity Overview</h3>
          <span className="text-sm text-[#6b7280] dark:text-[#9ca3af]">
            {lastYear} design{lastYear === 1 ? '' : 's'} in the last year
          </span>
        </div>
        <div className="flex items-center space-x-2 text-xs text-[#6b7280] dark:text-[#9ca3af]">
          <span>Less</span>
          <div className="flex space-x-1">
            {LEVELS.map((c) => <div key={c} className={`w-3 h-3 rounded-sm ${c}`} />)}
          </div>
          <span>More</span>
        </div>
      </div>

      <div ref={scroller} className="overflow-x-auto pb-2" onMouseLeave={() => setTip(null)}>
        <div
          data-heatmap-grid
          style={{
            display: 'grid',
            gridTemplateColumns: `auto repeat(${weeks.length}, minmax(${MIN_CELL}px, 1fr))`,
            gap: GAP,
            minWidth: 32 + weeks.length * (MIN_CELL + GAP),
          }}
        >
          {/* month labels (row 1) */}
          <div style={{ gridColumn: 1, gridRow: 1 }} />
          {monthLabels.map((m, w) => m && (
            <div key={`m${w}`} style={{ gridColumn: w + 2, gridRow: 1 }}
              className="whitespace-nowrap text-[10px] leading-4 text-[#6b7280] dark:text-[#9ca3af]">
              {m}
            </div>
          ))}

          {/* weekday labels (column 1); row height follows the squares */}
          {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((d, i) => (
            <div key={`d${i}`} style={{ gridColumn: 1, gridRow: i + 2 }}
              className="flex items-center pr-1 text-[10px] text-[#6b7280] dark:text-[#9ca3af]">
              {d}
            </div>
          ))}

          {weeks.map((col, w) => col.map((day, i) => (day ? (
            <div
              key={day.date}
              data-date={day.date}
              data-count={day.count}
              aria-label={`${fmt(day.d)}: ${day.count} design${day.count === 1 ? '' : 's'}`}
              style={{ gridColumn: w + 2, gridRow: i + 2 }}
              className={`aspect-square w-full rounded-sm ${LEVELS[activityLevel(day.count)]} hover:ring-1 hover:ring-[#0A2F44] dark:hover:ring-white`}
              onMouseEnter={(e) => show(e, day)}
              onMouseLeave={() => setTip(null)}
            />
          ) : null)))}
        </div>
      </div>
      {tip && <Tip tip={tip} />}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 pt-3 border-t border-[#e5e7eb] dark:border-[#374151] text-sm text-[#6b7280] dark:text-[#9ca3af]">
        <div className="flex items-center space-x-1">
          <FiClock className="text-sm" />
          <span>Last active: {lastActive ? new Date(`${lastActive}T12:00:00`).toLocaleDateString() : 'no designs yet'}</span>
        </div>
        <div className="flex items-center space-x-1">
          <FiCheckCircle className="text-sm" />
          <span>{thisWeek} design{thisWeek === 1 ? '' : 's'} this week</span>
        </div>
        <div className="flex items-center space-x-1">
          <FiTrendingUp className="text-sm" />
          <span>{current} day streak</span>
        </div>
      </div>
      <p className="mt-2 text-xs text-[#9ca3af]">Each square counts the design calculations you ran that day (every element).</p>
    </div>
  )
}
