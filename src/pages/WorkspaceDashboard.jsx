import React, { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FiFolder, FiUsers, FiSettings, FiPlus, FiGrid, FiClock } from 'react-icons/fi'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { useTheme } from '../contexts/ThemeContext'

const WorkspaceDashboard = () => {
  const { workspaceId } = useParams()
  const { currentWorkspace, projects, members, loading, switchWorkspace } = useWorkspace()
  const { isDarkMode } = useTheme()

  useEffect(() => {
    if (workspaceId && (!currentWorkspace || currentWorkspace.id !== workspaceId)) {
      // Fetch workspace data
      switchWorkspace({ id: workspaceId })
    }
  }, [workspaceId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#0A2F44] rounded-lg flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-white text-2xl font-bold">SA</span>
          </div>
          <p className="text-[#6b7280]">Loading workspace...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] dark:bg-[#111827]">
      {/* Top Bar */}
      <div className="bg-white dark:bg-[#1f2937] border-b border-[#e5e7eb] dark:border-[#374151]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#02090d] dark:text-white">
                {currentWorkspace?.name}
              </h1>
              <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">
                Manage your projects and team members
              </p>
            </div>
            <Link
              to={`/workspace/${workspaceId}/settings`}
              className="p-2 rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#374151] transition-colors"
            >
              <FiSettings className="text-xl text-[#6b7280] dark:text-[#9ca3af]" />
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-lg p-6 border border-[#e5e7eb] dark:border-[#374151]">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-[#e6f0f5] dark:bg-[#1e3a4a] rounded-lg flex items-center justify-center">
                <FiFolder className="text-xl text-[#0A2F44] dark:text-[#cce1eb]" />
              </div>
              <span className="text-2xl font-bold text-[#02090d] dark:text-white">
                {projects.length}
              </span>
            </div>
            <p className="text-[#6b7280] dark:text-[#9ca3af]">Total Projects</p>
          </div>

          <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-lg p-6 border border-[#e5e7eb] dark:border-[#374151]">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-[#e6f0f5] dark:bg-[#1e3a4a] rounded-lg flex items-center justify-center">
                <FiUsers className="text-xl text-[#0A2F44] dark:text-[#cce1eb]" />
              </div>
              <span className="text-2xl font-bold text-[#02090d] dark:text-white">
                {members.length}
              </span>
            </div>
            <p className="text-[#6b7280] dark:text-[#9ca3af]">Team Members</p>
          </div>

          <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-lg p-6 border border-[#e5e7eb] dark:border-[#374151]">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-[#e6f0f5] dark:bg-[#1e3a4a] rounded-lg flex items-center justify-center">
                <FiClock className="text-xl text-[#0A2F44] dark:text-[#cce1eb]" />
              </div>
              <span className="text-2xl font-bold text-[#02090d] dark:text-white">
                {projects.filter((p) => p.updated_at).length}
              </span>
            </div>
            <p className="text-[#6b7280] dark:text-[#9ca3af]">Active This Month</p>
          </div>
        </div>

        {/* Recent Projects */}
        <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-lg border border-[#e5e7eb] dark:border-[#374151] p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-[#02090d] dark:text-white">Recent Projects</h2>
            <Link
              to={`/workspace/${workspaceId}/projects`}
              className="text-sm text-[#0A2F44] dark:text-[#cce1eb] hover:underline"
            >
              View all
            </Link>
          </div>

          {projects.length === 0 ? (
            <div className="text-center py-12">
              <FiFolder className="text-4xl text-[#d1d5db] dark:text-[#4b5563] mx-auto mb-3" />
              <p className="text-[#6b7280] dark:text-[#9ca3af] font-medium">No projects yet</p>
              <p className="text-sm text-[#9ca3af] dark:text-[#6b7280] mt-1">
                Create your first project to get started
              </p>
              <Link
                to={`/workspace/${workspaceId}/projects/new`}
                className="inline-flex items-center mt-4 bg-[#0A2F44] text-white px-4 py-2 rounded-lg hover:bg-[#082636] transition-colors"
              >
                <FiPlus className="mr-2" /> New Project
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.slice(0, 6).map((project) => (
                <Link
                  key={project.id}
                  to={`/workspace/${workspaceId}/projects/${project.id}`}
                  className="block p-4 border border-[#e5e7eb] dark:border-[#374151] rounded-lg hover:shadow-md transition-all"
                >
                  <h3 className="font-semibold text-[#02090d] dark:text-white mb-1">
                    {project.name}
                  </h3>
                  <p className="text-sm text-[#6b7280] dark:text-[#9ca3af] mb-2">
                    {project.project_type || 'Uncategorized'}
                  </p>
                  <div className="flex items-center text-xs text-[#9ca3af] dark:text-[#6b7280]">
                    <FiClock className="mr-1" />
                    {new Date(project.created_at).toLocaleDateString()}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            to={`/workspace/${workspaceId}/projects/new`}
            className="bg-white dark:bg-[#1f2937] rounded-xl shadow-lg border border-[#e5e7eb] dark:border-[#374151] p-6 hover:shadow-xl transition-all group"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-[#0A2F44] rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <FiPlus className="text-xl text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-[#02090d] dark:text-white">New Project</h3>
                <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">
                  Start a new structural design project
                </p>
              </div>
            </div>
          </Link>

          <Link
            to={`/workspace/${workspaceId}/members`}
            className="bg-white dark:bg-[#1f2937] rounded-xl shadow-lg border border-[#e5e7eb] dark:border-[#374151] p-6 hover:shadow-xl transition-all group"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-[#0A2F44] rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <FiUsers className="text-xl text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-[#02090d] dark:text-white">Invite Team</h3>
                <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">
                  Add members to your workspace
                </p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default WorkspaceDashboard
