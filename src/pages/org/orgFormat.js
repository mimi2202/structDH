// Formatting helpers for the organisation pages.
const pad = (n) => String(n).padStart(2, '0')

// 2026-11-16 (local date)
export const fmtDate = (iso) => {
  if (!iso) return '-'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '-' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// 2026-11-16 11:32 (local time)
export const fmtTs = (iso) => {
  if (!iso) return '-'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '-' : `${fmtDate(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// The signed-up account behind a member row, for the photo and name.
export const accountFor = (member) => {
  try {
    const users = JSON.parse(localStorage.getItem('local_users')) || []
    return users.find((u) => (member.user_id && u.id === member.user_id)
      || (u.email && member.email && u.email.toLowerCase() === member.email.toLowerCase())) || null
  } catch {
    return null
  }
}

export const INDUSTRIES = [
  'Structural engineering consultancy',
  'Civil engineering consultancy',
  'Multidisciplinary engineering',
  'Architecture',
  'Contractor / construction',
  'Developer / client',
  'Precast / fabrication',
  'Education / research',
  'Public sector',
  'Other',
]
