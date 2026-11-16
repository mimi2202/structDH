import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiUser, FiSettings, FiLogOut } from 'react-icons/fi'
import { useAuth } from '../../contexts/AuthContext'

// Up to two initials from the name, else the first letter of the email.
const userInitials = (user) => {
  const parts = String(user?.name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length) return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
  return (user?.email?.[0] || '?').toUpperCase()
}

const SIZES = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-sm',
  xl: 'w-24 h-24 text-3xl',
}

// The user's photo when they have uploaded one, else their initials.
export function Avatar({ user, size = 'md', className = '' }) {
  const cls = `${SIZES[size] || SIZES.md} rounded-full flex-shrink-0 overflow-hidden ${className}`
  if (user?.avatar) {
    return <img src={user.avatar} alt={user?.name || 'Profile photo'} className={`${cls} object-cover`} />
  }
  return (
    <div className={`${cls} bg-[#0A2F44] flex items-center justify-center text-white font-medium`}>
      {userInitials(user)}
    </div>
  )
}

// Avatar button with the account menu: Profile, Settings, Sign out.
export default function UserMenu({ size = 'lg' }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const signOut = async () => {
    setOpen(false)
    await logout()
    navigate('/login')
  }

  const item = 'flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[#374151] dark:text-[#d1d5db] hover:bg-[#f3f4f6] dark:hover:bg-[#374151] transition-colors'

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Account"
        className="flex items-center rounded-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0A2F44] focus-visible:ring-offset-2"
      >
        <Avatar user={user} size={size} className="shadow-md" />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-64 rounded-xl border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#1f2937] shadow-xl z-50 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[#e5e7eb] dark:border-[#374151]">
            <Avatar user={user} size="lg" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#02090d] dark:text-white truncate">{user?.name || 'Your account'}</p>
              {user?.email && <p className="text-xs text-[#6b7280] dark:text-[#9ca3af] truncate">{user.email}</p>}
            </div>
          </div>
          <div className="py-1">
            <Link to="/profile" role="menuitem" className={item} onClick={() => setOpen(false)}>
              <FiUser /> <span>Profile</span>
            </Link>
            <Link to="/settings" role="menuitem" className={item} onClick={() => setOpen(false)}>
              <FiSettings /> <span>Settings</span>
            </Link>
          </div>
          <div className="py-1 border-t border-[#e5e7eb] dark:border-[#374151]">
            <button type="button" role="menuitem" onClick={signOut}
              className={`${item} text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20`}>
              <FiLogOut /> <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
