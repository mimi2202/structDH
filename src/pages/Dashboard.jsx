import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  FiGrid,
  FiFolder,
  FiFileText,
  FiSettings,
  FiHelpCircle,
  FiSun,
  FiMoon,
  FiUser,
  FiLogOut,
  FiMenu,
  FiChevronLeft,
  FiX,
  FiPlus,
  FiUsers,
  FiClock,
  FiEdit3,
  FiCalendar,
  FiActivity,
  FiTrendingUp,
  FiCheckCircle,
  FiCircle,
  FiShield,
  FiSave,
  FiUpload,
} from 'react-icons/fi'
import { useAuth } from '../contexts/AuthContext'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { useTheme } from '../contexts/ThemeContext'
import DesignStreak from '../components/ui/DesignStreak'
import NotificationBell from '../components/notifications/NotificationBell'
import { NotificationProvider } from '../contexts/NotificationContext'

// Mock projects data (shared with Projects page)
export const mockProjects = [
  {
    id: 'proj-1',
    workspace_id: 'ws-1',
    name: 'London Office Tower',
    description:
      '25-storey commercial office building in Canary Wharf with retail space on ground floor',
    project_type: 'commercial',
    location: 'London, UK',
    design_standard: 'Eurocode',
    status: 'active',
    updated_at: '2026-02-18T14:30:00Z',
  },
  {
    id: 'proj-2',
    workspace_id: 'ws-1',
    name: 'Riverside Apartments',
    description: 'Residential complex with 120 units, underground parking, and communal gardens',
    project_type: 'residential',

    location: 'Manchester, UK',
    design_standard: 'Eurocode',
    status: 'active',
    updated_at: '2026-02-17T16:20:00Z',
  },
  {
    id: 'proj-3',
    workspace_id: 'ws-1',
    name: 'Industrial Warehouse',
    description: 'Logistics center with 5000m² floor space and 15m clear height',
    project_type: 'industrial',
    location: 'Birmingham, UK',
    design_standard: 'Eurocode',
    status: 'active',
    updated_at: '2026-02-16T11:10:00Z',
  },
  {
    id: 'proj-4',
    workspace_id: 'ws-2',
    name: 'Retail Shopping Centre',
    description: 'Three-storey retail complex with 50+ units and underground parking',
    project_type: 'commercial',
    location: 'Leeds, UK',
    design_standard: 'Eurocode',
    status: 'active',
    updated_at: '2026-02-15T09:45:00Z',
  },
]

const Dashboard = () => {
  const { user, logout } = useAuth()
  const { workspaces, loading, refreshWorkspaces } = useWorkspace()
  const { isDarkMode, toggleDarkMode } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [selectedWorkspace, setSelectedWorkspace] = useState(null)
  const [allProjects, setAllProjects] = useState([])
  const [showLoading, setShowLoading] = useState(false)

  // Mock activity data (replace with real data from backend)
  const [activityData, setActivityData] = useState({
    lastActive: new Date().toISOString(),
    streak: 5,
    totalHours: 47,
    designsThisWeek: 8,
    contributions: [
      { date: '2026-03-25', count: 2 },
      { date: '2026-03-26', count: 1 },
      { date: '2026-03-27', count: 3 },
      { date: '2026-03-28', count: 0 },
      { date: '2026-03-29', count: 1 },
      { date: '2026-03-30', count: 4 },
      { date: '2026-03-31', count: 2 },
    ],
  })

  // Load mock projects
  useEffect(() => {
    setAllProjects(mockProjects)
  }, [])

  // Only show loading when navigating back to dashboard (not on initial mount)
  useEffect(() => {
    const isNavigating = document.referrer && document.referrer.includes(window.location.origin)

    if (isNavigating) {
      setShowLoading(true)
      const timer = setTimeout(() => {
        setShowLoading(false)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [location.pathname])

  useEffect(() => {
    refreshWorkspaces()
  }, [])

  useEffect(() => {
    if (workspaces.length > 0 && !selectedWorkspace) {
      setSelectedWorkspace(workspaces[0])
    }
  }, [workspaces])

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

  const getWorkspaceId = () => {
    return selectedWorkspace?.id || (workspaces.length > 0 ? workspaces[0].id : 'ws-1')
  }

  const tabs = [
    { name: 'Dashboard', icon: FiGrid, path: '/dashboard', active: true },
    { name: 'Organization', icon: FiShield, path: `/workspace/${getWorkspaceId()}`, active: false },
    { name: 'New Design', icon: FiEdit3, path: '/quick-design', active: false },
    { name: 'New Project', icon: FiPlus, path: '/workspace/create', active: false },
    {
      name: 'Projects',
      icon: FiFolder,
      path: `/workspace/${getWorkspaceId()}/projects`,
      active: false,
    },
    { name: 'Reports', icon: FiFileText, path: '/reports', active: false },
    { name: 'External Design', icon: FiUpload, path: '/external-design', active: false },
    { name: 'Help', icon: FiHelpCircle, path: '/help', active: false },
    { name: 'Saved Designs', icon: FiSave, path: '/saved-designs', active: false },
  ]

  const getUserInitials = () => {
    if (user?.name) {
      return user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    }
    return 'JE'
  }

  // Calculate stats from actual projects
  const totalProjects = allProjects.length
  const activeThisMonth = allProjects.filter((p) => {
    const updated = new Date(p.updated_at)
    const now = new Date()
    return updated.getMonth() === now.getMonth() && updated.getFullYear() === now.getFullYear()
  }).length

  // Calculate activity level for heatmap
  const getActivityLevel = (count) => {
    if (count === 0) return 'bg-[#e5e7eb] dark:bg-[#374151]'
    if (count === 1) return 'bg-[#cce1eb] dark:bg-[#1e3a4a]'
    if (count === 2) return 'bg-[#99c2d6] dark:bg-[#2a4a5a]'
    if (count === 3) return 'bg-[#66a4c2] dark:bg-[#3a6a7a]'
    return 'bg-[#0A2F44] dark:bg-[#66a4c2]'
  }

  // Show loading only when navigating between pages
  if (showLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f3f4f6] dark:bg-[#111827]">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#0A2F44] rounded-lg flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-white text-2xl font-bold">SA</span>
          </div>
          <p className="text-[#6b7280] dark:text-[#9ca3af]">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] dark:bg-[#111827] flex transition-colors duration-300">
      {/* Desktop Sidebar */}
      <div
        className={`hidden md:flex bg-white dark:bg-[#1f2937] border-r border-[#e5e7eb] dark:border-[#374151] flex-col transition-all duration-300 ${
          isSidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-[#e5e7eb] dark:border-[#374151]">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-[#0A2F44] rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">SA</span>
            </div>
            {isSidebarOpen && (
              <span className="font-bold text-[#02090d] dark:text-white">StructuraAI</span>
            )}
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="flex-1 p-4">
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
                  <div className="w-8 h-8 bg-[#0A2F44] rounded-full flex items-center justify-center text-white text-sm font-medium">
                    {getUserInitials()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#02090d] dark:text-white">
                      {user?.name || 'John Engineer'}
                    </p>
                    <p className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
                      {user?.email || 'john@example.com'}
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
              <div className="w-8 h-8 bg-[#0A2F44] rounded-full flex items-center justify-center text-white text-sm font-medium">
                {getUserInitials()}
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
                    <span className="text-white font-bold text-sm">SA</span>
                  </div>
                  <span className="font-bold text-[#02090d] dark:text-white">StructuraAI</span>
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
                    <div className="w-8 h-8 bg-[#0A2F44] rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {getUserInitials()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#02090d] dark:text-white">
                        {user?.name || 'John Engineer'}
                      </p>
                      <p className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
                        {user?.email || 'john@example.com'}
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
                  Welcome, {user?.name?.split(' ')[0] || 'John'}!
                </h1>
                <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">
                  Manage your projects and team members
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <NotificationBell />
              <div className="hidden md:block">
                <div className="w-10 h-10 bg-[#0A2F44] rounded-full flex items-center justify-center text-white font-medium shadow-md">
                  {getUserInitials()}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="p-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-lg p-6 border border-[#e5e7eb] dark:border-[#374151]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[#6b7280] dark:text-[#9ca3af]">Total Projects</span>
                <FiFolder className="text-[#0A2F44] dark:text-[#cce1eb]" />
              </div>
              <p className="text-3xl font-bold text-[#02090d] dark:text-white">{totalProjects}</p>
            </div>

            <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-lg p-6 border border-[#e5e7eb] dark:border-[#374151]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[#6b7280] dark:text-[#9ca3af]">
                  Active This Month
                </span>
                <FiActivity className="text-[#0A2F44] dark:text-[#cce1eb]" />
              </div>
              <p className="text-3xl font-bold text-[#02090d] dark:text-white">{activeThisMonth}</p>
            </div>

            <DesignStreak userId={user?.id} />
          </div>

          {/* GitHub-style Activity Heatmap */}
          <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-lg border border-[#e5e7eb] dark:border-[#374151] p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <FiCalendar className="text-[#0A2F44] dark:text-[#cce1eb]" />
                <h3 className="text-lg font-semibold text-[#02090d] dark:text-white">
                  Activity Overview
                </h3>
              </div>
              <div className="flex items-center space-x-2 text-xs text-[#6b7280] dark:text-[#9ca3af]">
                <span>Less</span>
                <div className="flex space-x-1">
                  <div className="w-3 h-3 bg-[#e5e7eb] dark:bg-[#374151] rounded-sm"></div>
                  <div className="w-3 h-3 bg-[#cce1eb] dark:bg-[#1e3a4a] rounded-sm"></div>
                  <div className="w-3 h-3 bg-[#99c2d6] dark:bg-[#2a4a5a] rounded-sm"></div>
                  <div className="w-3 h-3 bg-[#66a4c2] dark:bg-[#3a6a7a] rounded-sm"></div>
                  <div className="w-3 h-3 bg-[#0A2F44] dark:bg-[#66a4c2] rounded-sm"></div>
                </div>
                <span>More</span>
              </div>
            </div>

            {/* Activity Heatmap Grid */}
            <div className="grid grid-cols-7 gap-1.5">
              {activityData.contributions.map((day, idx) => (
                <div key={idx} className="text-center group relative">
                  <div
                    className={`w-8 h-8 rounded-md ${getActivityLevel(day.count)} transition-all hover:scale-110 cursor-pointer`}
                  ></div>
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                    {new Date(day.date).toLocaleDateString('en-GB', {
                      month: 'short',
                      day: 'numeric',
                    })}
                    : {day.count} design{day.count !== 1 ? 's' : ''}
                  </div>
                </div>
              ))}
            </div>

            {/* Activity Stats */}
            <div className="flex flex-wrap justify-between items-center mt-4 pt-3 border-t border-[#e5e7eb] dark:border-[#374151]">
              <div className="flex items-center space-x-4 text-sm text-[#6b7280] dark:text-[#9ca3af]">
                <div className="flex items-center space-x-1">
                  <FiClock className="text-sm" />
                  <span>Last active: {new Date(activityData.lastActive).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <FiCheckCircle className="text-sm" />
                  <span>{activityData.designsThisWeek} designs this week</span>
                </div>
                <div className="flex items-center space-x-1">
                  <FiTrendingUp className="text-sm" />
                  <span>{activityData.streak} day streak</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Projects Section - Shows ONLY 2 projects */}
          <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-lg border border-[#e5e7eb] dark:border-[#374151] p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-[#02090d] dark:text-white">
                Recent Projects
              </h3>
              <Link
                to={`/workspace/${getWorkspaceId()}/projects`}
                className="text-sm text-[#0A2F44] dark:text-[#cce1eb] hover:underline"
              >
                View all
              </Link>
            </div>

            {allProjects.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-[#e6f0f5] dark:bg-[#1e3a4a] rounded-full flex items-center justify-center mx-auto mb-4">
                  <FiFolder className="text-3xl text-[#0A2F44] dark:text-[#cce1eb]" />
                </div>
                <h4 className="text-lg font-medium text-[#02090d] dark:text-white mb-2">
                  No projects yet
                </h4>
                <p className="text-[#6b7280] dark:text-[#9ca3af] mb-6">
                  Create your first project to get started
                </p>
                <Link
                  to="/workspace/create"
                  className="inline-flex items-center space-x-2 bg-[#0A2F44] text-white px-6 py-3 rounded-lg hover:bg-[#082636] transition-colors"
                >
                  <FiPlus />
                  <span>New Project</span>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Show ONLY FIRST 2 projects on dashboard */}
                {allProjects.slice(0, 2).map((project) => (
                  <Link
                    key={project.id}
                    to={`/workspace/${project.workspace_id}/projects/${project.id}`}
                    className="block p-6 border border-[#e5e7eb] dark:border-[#374151] rounded-lg hover:shadow-lg transition-all group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            project.project_type === 'residential'
                              ? 'bg-green-100 text-green-700'
                              : project.project_type === 'commercial'
                                ? 'bg-blue-100 text-blue-700'
                                : project.project_type === 'industrial'
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-purple-100 text-purple-700'
                          }`}
                        >
                          {project.project_type}
                        </span>
                      </div>
                      <div className="w-8 h-8 bg-[#e6f0f5] dark:bg-[#1e3a4a] rounded-lg flex items-center justify-center">
                        <FiFolder className="text-[#0A2F44] dark:text-[#cce1eb]" />
                      </div>
                    </div>

                    <h4 className="text-lg font-semibold text-[#02090d] dark:text-white mb-2">
                      {project.name}
                    </h4>

                    <p className="text-sm text-[#6b7280] dark:text-[#9ca3af] mb-4 line-clamp-2">
                      {project.description || 'No description available'}
                    </p>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#0A2F44] dark:text-[#cce1eb] font-medium">
                        {project.design_standard || 'Eurocode'}
                      </span>
                      <span className="text-xs text-[#9ca3af]">
                        {new Date(project.updated_at).toLocaleDateString()}
                      </span>
                    </div>

                    {project.location && (
                      <div className="mt-3 text-xs text-[#9ca3af]">📍 {project.location}</div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
