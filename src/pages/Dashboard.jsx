import React, { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { FiFolder, FiPlus, FiActivity } from 'react-icons/fi'
import { useAuth } from '../contexts/AuthContext'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { PERSONAL_WS, ALL_WS, projectWsId } from '../utils/projects'
import AccountLayout from '../components/layout/AccountLayout'
import DesignStreak from '../components/ui/DesignStreak'
import ActivityHeatmap from '../components/ui/ActivityHeatmap'
import { getActivity, onActivityChange } from '../utils/activity'

const Dashboard = () => {
  const { user } = useAuth()
  const { refreshWorkspaces, listUserProjects } = useWorkspace()
  const location = useLocation()
  const [showLoading, setShowLoading] = useState(false)

  // Design calculations per day for this user (utils/activity.js).
  const [activityTick, setActivityTick] = useState(0)
  useEffect(() => onActivityChange(() => setActivityTick((t) => t + 1)), [])
  // eslint-disable-next-line react-hooks/exhaustive-deps -- re-read when the log changes
  const days = useMemo(() => getActivity(user?.id), [user?.id, activityTick])

  // The user's projects: personal ones and those in their organisations,
  // most recently updated first (re-read every render: a localStorage read).
  const allProjects = listUserProjects(ALL_WS)
    .filter((p) => p.status !== 'archived')
    .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))

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

  // Calculate stats from actual projects
  const totalProjects = allProjects.length
  const activeThisMonth = allProjects.filter((p) => {
    const updated = new Date(p.updated_at)
    const now = new Date()
    return updated.getMonth() === now.getMonth() && updated.getFullYear() === now.getFullYear()
  }).length

  // Show loading only when navigating between pages
  if (showLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f3f4f6] dark:bg-[#111827]">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#0A2F44] rounded-lg flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-white text-2xl font-bold">SDH</span>
          </div>
          <p className="text-[#6b7280] dark:text-[#9ca3af]">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <AccountLayout
      title={`Welcome${user?.name ? `, ${user.name.split(' ')[0]}` : ''}!`}
      subtitle="Manage your projects and team members"
    >
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

            <DesignStreak days={days} />
          </div>

          {/* GitHub-style Activity Heatmap */}
          <ActivityHeatmap days={days} />

          {/* Recent Projects Section - Shows ONLY 2 projects */}
          <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-lg border border-[#e5e7eb] dark:border-[#374151] p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-[#02090d] dark:text-white">
                Recent Projects
              </h3>
              <div className="flex items-center gap-4">
                <Link
                  to={`/workspace/${PERSONAL_WS}/projects/new`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-[#0A2F44] dark:text-[#cce1eb] hover:underline"
                >
                  <FiPlus /> New project
                </Link>
                {allProjects.length > 0 && (
                  <Link
                    to={`/workspace/${ALL_WS}/projects`}
                    className="text-sm text-[#0A2F44] dark:text-[#cce1eb] hover:underline"
                  >
                    View all
                  </Link>
                )}
              </div>
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
                  Create your first project. It stays personal until you move it into an organisation.
                </p>
                <Link
                  to={`/workspace/${PERSONAL_WS}/projects/new`}
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
                    to={`/workspace/${projectWsId(project)}/projects/${project.id}/design`}
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
                        {project.organisation_name || 'Personal'}
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
    </AccountLayout>
  )
}

export default Dashboard
