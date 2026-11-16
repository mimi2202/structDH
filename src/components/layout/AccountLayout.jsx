import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  FiGrid,
  FiFolder,
  FiFileText,
  FiHelpCircle,
  FiSun,
  FiMoon,
  FiLogOut,
  FiMenu,
  FiChevronLeft,
  FiX,
  FiPlus,
  FiEdit3,
  FiShield,
  FiSave,
  FiUpload,
} from 'react-icons/fi'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import NotificationBell from '../notifications/NotificationBell'
import UserMenu, { Avatar } from '../ui/UserMenu'
import { PERSONAL_WS, ALL_WS } from '../../utils/projects'
import { endQuickDesign } from '../../utils/designMode'

// The dashboard's shell: account-level sidebar (Dashboard, Organization, New
// Design, New Project, Projects, ...) and the header with notifications and
// the account menu. Used by the dashboard and the account pages (Profile,
// Settings, Help) so they do not show the element sidebar: elements are
// reached through New Design / a project, not from these pages.
const AccountLayout = ({ title, subtitle, children }) => {
  const { user, logout } = useAuth()
  const { isDarkMode, toggleDarkMode } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Leaving for a dashboard-level page ends a quick design (Help, Settings and
  // Profile are side trips and keep it).
  useEffect(() => {
    if (!['/help', '/settings', '/profile'].includes(location.pathname)) endQuickDesign()
  }, [location.pathname])

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const tabs = [
    { name: 'Dashboard', icon: FiGrid, path: '/dashboard' },
    { name: 'Organization', icon: FiShield, path: '/organisations', match: /^\/(organisations|workspace\/(?!personal|all)[^/]+(\/(members|team|settings))?$|workspace\/create)/ },
    { name: 'New Design', icon: FiEdit3, path: '/quick-design' },
    { name: 'New Project', icon: FiPlus, path: `/workspace/${PERSONAL_WS}/projects/new` },
    { name: 'Projects', icon: FiFolder, path: `/workspace/${ALL_WS}/projects` },
    { name: 'Reports', icon: FiFileText, path: '/reports' },
    { name: 'External Design', icon: FiUpload, path: '/external-design' },
    { name: 'Help', icon: FiHelpCircle, path: '/help' },
    { name: 'Saved Designs', icon: FiSave, path: '/saved-designs' },
  ].map((t) => ({ ...t, active: t.match ? t.match.test(location.pathname) : location.pathname === t.path }))

  return (
    <div className="min-h-screen bg-[#f3f4f6] dark:bg-[#111827] flex transition-colors duration-300">
      {/* Desktop Sidebar */}
      <div
        // sticky: stays on screen (logo, menu, account, theme, logout) while the page scrolls
        className={`hidden md:flex sticky top-0 h-screen self-start flex-shrink-0 bg-white dark:bg-[#1f2937] border-r border-[#e5e7eb] dark:border-[#374151] flex-col transition-all duration-300 ${
          isSidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-[#e5e7eb] dark:border-[#374151]">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-[#0A2F44] rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-xs">SDH</span>
            </div>
            {isSidebarOpen && (
              <span className="font-bold text-[#02090d] dark:text-white">Sphere Design Hub</span>
            )}
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="flex-1 min-h-0 overflow-y-auto p-4">
          <ul className="space-y-2">
            {tabs.map((tab) => (
              <li key={tab.name}>
                <Link
                  to={tab.path}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                    tab.active
                      ? 'bg-[#0A2F44] text-white'
                      : 'text-[#6b7280] dark:text-[#9ca3af] hover:bg-[#f3f4f6] dark:hover:bg-[#374151] hover:text-[#0A2F44] dark:hover:text-[#cce1eb]'
                  }`}
                  title={!isSidebarOpen ? tab.name : ''}
                >
                  <tab.icon className="text-lg flex-shrink-0" />
                  {isSidebarOpen && <span className="text-sm font-medium">{tab.name}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Desktop User Section */}
        <div className="p-4 border-t border-[#e5e7eb] dark:border-[#374151] mt-auto">
          {isSidebarOpen ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <Avatar user={user} size="md" />
                  <div>
                    <p className="text-sm font-medium text-[#02090d] dark:text-white">
                      {user?.name || 'Your account'}
                    </p>
                    <p className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
                      {user?.email || ''}
                    </p>
                  </div>
                </div>
                <button
                  onClick={toggleDarkMode}
                  className="p-2 rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#374151] transition-colors cursor-pointer"
                  title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                  {isDarkMode ? (
                    <FiSun className="text-xl text-yellow-500" />
                  ) : (
                    <FiMoon className="text-xl text-[#0A2F44]" />
                  )}
                </button>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <FiLogOut />
                <span>Logout</span>
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center space-y-4">
              <Link to="/profile" title="Profile"><Avatar user={user} size="md" /></Link>
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#374151] transition-colors cursor-pointer"
                title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {isDarkMode ? (
                  <FiSun className="text-xl text-yellow-500" />
                ) : (
                  <FiMoon className="text-xl text-[#0A2F44]" />
                )}
              </button>
              <button
                onClick={handleLogout}
                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                title="Logout"
              >
                <FiLogOut className="text-lg" />
              </button>
            </div>
          )}
        </div>

        {/* Desktop Sidebar Toggle */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="hidden md:flex absolute items-center justify-center w-6 h-6 bg-white dark:bg-[#1f2937] border border-[#e5e7eb] dark:border-[#374151] rounded-full shadow-md hover:shadow-lg transition-all cursor-pointer"
          style={{
            left: isSidebarOpen ? 'calc(16rem - 12px)' : 'calc(5rem - 12px)',
            top: '84px',
          }}
        >
          {isSidebarOpen ? (
            <FiChevronLeft className="text-sm text-[#6b7280]" />
          ) : (
            <FiMenu className="text-sm text-[#6b7280]" />
          )}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="fixed left-0 top-0 h-full w-[75%] bg-white dark:bg-[#1f2937] z-50 md:hidden shadow-2xl animate-slide-right">
            <div className="flex flex-col h-full">
              <div className="p-6 border-b border-[#e5e7eb] dark:border-[#374151] flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-[#0A2F44] rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-xs">SDH</span>
                  </div>
                  <span className="font-bold text-[#02090d] dark:text-white">Sphere Design Hub</span>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 hover:bg-[#f3f4f6] dark:hover:bg-[#374151] rounded-lg transition-colors"
                >
                  <FiX className="text-xl text-[#6b7280]" />
                </button>
              </div>
              <nav className="flex-1 p-4 overflow-y-auto">
                <ul className="space-y-2">
                  {tabs.map((tab) => (
                    <Link
                      key={tab.name}
                      to={tab.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center space-x-3 px-4 py-3 rounded-lg mb-2 transition-colors ${
                        tab.active
                          ? 'bg-[#0A2F44] text-white'
                          : 'text-[#6b7280] dark:text-[#9ca3af] hover:bg-[#f3f4f6] dark:hover:bg-[#374151] hover:text-[#0A2F44] dark:hover:text-[#cce1eb]'
                      }`}
                    >
                      <tab.icon className="text-lg flex-shrink-0" />
                      <span className="text-sm font-medium">{tab.name}</span>
                    </Link>
                  ))}
                </ul>
              </nav>
              <div className="p-4 border-t border-[#e5e7eb] dark:border-[#374151]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <Avatar user={user} size="md" />
                    <div>
                      <p className="text-sm font-medium text-[#02090d] dark:text-white">
                        {user?.name || 'Your account'}
                      </p>
                      <p className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
                        {user?.email || ''}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={toggleDarkMode}
                    className="p-2 rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#374151] transition-colors cursor-pointer"
                  >
                    {isDarkMode ? (
                      <FiSun className="text-xl text-yellow-500" />
                    ) : (
                      <FiMoon className="text-xl text-[#0A2F44]" />
                    )}
                  </button>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <FiLogOut />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="bg-white dark:bg-[#1f2937] border-b border-[#e5e7eb] dark:border-[#374151] p-4 sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden p-2 rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#374151] transition-colors cursor-pointer"
              >
                <FiMenu className="text-xl text-[#6b7280]" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-[#02090d] dark:text-white">
                  {title}
                </h1>
                {subtitle && (
                  <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <NotificationBell />
              <UserMenu size="lg" />
            </div>
          </div>
        </div>

        {children}
      </div>
    </div>
  )
}

export default AccountLayout
