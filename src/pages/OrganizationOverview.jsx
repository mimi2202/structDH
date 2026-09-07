// src/pages/OrganizationOverview.jsx
import React, { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  FiArrowLeft,
  FiUsers,
  FiFolder,
  FiActivity,
  FiClock,
  FiMoreVertical,
  FiTrash2,
  FiMove,
  FiEdit2,
  FiEye,
  FiCalendar,
  FiTrendingUp,
  FiShield,
  FiUser,
  FiMail,
  FiSun,
  FiMoon,
  FiInfo,
  FiCheckCircle,
  FiAlertCircle,
  FiArrowRight,
} from 'react-icons/fi'
import { useWorkspace, ROLES } from '../contexts/WorkspaceContext'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'

const OrganizationOverview = () => {
  const { workspaceId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    currentWorkspace,
    projects,
    members,
    loading,
    loadProjects,
    loadMembers,
    deleteProject,
    updateProject,
  } = useWorkspace()
  const { isDarkMode, toggleDarkMode } = useTheme()

  const [activeProjectMenu, setActiveProjectMenu] = useState(null)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedProject, setSelectedProject] = useState(null)
  const [selectedMoveOrg, setSelectedMoveOrg] = useState('')
  const [userOrgs, setUserOrgs] = useState([])
  const [ownedProjects, setOwnedProjects] = useState([])
  const [memberProjects, setMemberProjects] = useState([])

  // Get user's role
  const userRole = currentWorkspace?.userRole
  const isOwner = userRole === ROLES.ORG_OWNER
  const isAdmin = userRole === ROLES.ORG_ADMIN

  // Load user's other organizations for moving projects
  useEffect(() => {
    const savedOrgs = localStorage.getItem('mock_workspaces')
    if (savedOrgs) {
      const allOrgs = JSON.parse(savedOrgs)
      const otherOrgs = allOrgs.filter((org) => org.id !== workspaceId)
      setUserOrgs(otherOrgs)
    }
  }, [workspaceId])

  useEffect(() => {
    if (workspaceId) {
      loadProjects(workspaceId)
      loadMembers(workspaceId)
    }
  }, [workspaceId])

  // Split projects into owned and member projects
  useEffect(() => {
    const owned = projects.filter((p) => p.userRole === ROLES.PROJECT_OWNER)
    const member = projects.filter((p) => p.userRole !== ROLES.PROJECT_OWNER)
    setOwnedProjects(owned)
    setMemberProjects(member)
  }, [projects])

  // Activity feed (mock data for now)
  const activities = [
    {
      id: 1,
      user: 'John Engineer',
      action: 'created project',
      target: 'London Office Tower',
      time: '2 hours ago',
      type: 'project',
    },
    {
      id: 2,
      user: 'Sarah Designer',
      action: 'joined workspace',
      target: '',
      time: '1 day ago',
      type: 'member',
    },
    {
      id: 3,
      user: 'Mike Analyst',
      action: 'updated design',
      target: 'Slab Calculation',
      time: '2 days ago',
      type: 'design',
    },
    {
      id: 4,
      user: 'Emma Reviewer',
      action: 'commented on',
      target: 'Beam Design',
      time: '3 days ago',
      type: 'comment',
    },
  ]

  const getActivityIcon = (type) => {
    switch (type) {
      case 'project':
        return <FiFolder className="text-blue-500" />
      case 'member':
        return <FiUser className="text-green-500" />
      case 'design':
        return <FiActivity className="text-purple-500" />
      case 'comment':
        return <FiMail className="text-yellow-500" />
      default:
        return <FiClock className="text-gray-500" />
    }
  }

  const handleDeleteProject = async (project) => {
    setSelectedProject(project)
    setShowDeleteConfirm(true)
    setActiveProjectMenu(null)
  }

  const confirmDeleteProject = async () => {
    if (selectedProject) {
      const result = await deleteProject(selectedProject.id)
      if (result.success) {
        setOwnedProjects((prev) => prev.filter((p) => p.id !== selectedProject.id))
        setShowDeleteConfirm(false)
        setSelectedProject(null)
        alert('Project deleted successfully!')
      } else {
        alert('Failed to delete project')
      }
    }
  }

  const handleMoveProject = (project) => {
    setSelectedProject(project)
    setSelectedMoveOrg('')
    setShowMoveModal(true)
    setActiveProjectMenu(null)
  }

  const confirmMoveProject = () => {
    if (!selectedMoveOrg) {
      alert('Please select an organization')
      return
    }

    // Update project's workspace_id
    const savedProjects = localStorage.getItem('mock_projects')
    if (savedProjects) {
      let allProjects = JSON.parse(savedProjects)
      allProjects = allProjects.map((p) =>
        p.id === selectedProject.id
          ? { ...p, workspace_id: selectedMoveOrg, updated_at: new Date().toISOString() }
          : p
      )
      localStorage.setItem('mock_projects', JSON.stringify(allProjects))

      // Update local state
      setOwnedProjects((prev) => prev.filter((p) => p.id !== selectedProject.id))
      setShowMoveModal(false)
      setSelectedProject(null)
      alert('Project moved successfully!')
    }
  }

  if (loading || !currentWorkspace) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f3f4f6] dark:bg-[#111827]">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#0A2F44] rounded-lg flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-white text-2xl font-bold">SA</span>
          </div>
          <p className="text-[#6b7280] dark:text-[#9ca3af]">Loading organization...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] dark:bg-[#111827]">
      {/* Header */}
      <div className="bg-white dark:bg-[#1f2937] border-b border-[#e5e7eb] dark:border-[#374151] sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#374151] transition-colors cursor-pointer"
              >
                <FiArrowLeft className="text-xl text-[#6b7280] dark:text-[#9ca3af]" />
              </button>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[#0A2F44] to-[#2E7D32] rounded-xl flex items-center justify-center shadow-lg">
                  <FiShield className="text-white text-xl" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-[#02090d] dark:text-white">
                    {currentWorkspace.name}
                  </h1>
                  <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">
                    {currentWorkspace.type === 'team' ? 'Team Workspace' : 'Personal Workspace'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#374151] transition-colors cursor-pointer"
              >
                {isDarkMode ? (
                  <FiSun className="text-yellow-500" />
                ) : (
                  <FiMoon className="text-[#0A2F44]" />
                )}
              </button>
              <Link
                to={`/workspace/${workspaceId}/settings`}
                className="px-4 py-2 bg-[#0A2F44] text-white rounded-xl hover:bg-[#082636] transition-colors cursor-pointer"
              >
                Settings
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Organization Info Card */}
        <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl border border-[#e5e7eb] dark:border-[#374151] p-6 mb-8">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-[#02090d] dark:text-white mb-2">
                Organization Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">Workspace Name</p>
                  <p className="font-medium text-[#02090d] dark:text-white">
                    {currentWorkspace.name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">Industry</p>
                  <p className="font-medium text-[#02090d] dark:text-white capitalize">
                    {currentWorkspace.industry || 'Engineering'}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">Description</p>
                  <p className="text-[#02090d] dark:text-white">
                    {currentWorkspace.description || 'No description provided'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">Website</p>
                  {currentWorkspace.website ? (
                    <a
                      href={currentWorkspace.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#0A2F44] dark:text-[#66a4c2] hover:underline"
                    >
                      {currentWorkspace.website}
                    </a>
                  ) : (
                    <p className="text-[#9ca3af]">Not specified</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">Your Role</p>
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                      isOwner
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                        : isAdmin
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    }`}
                  >
                    {userRole || 'member'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl p-6 border border-[#e5e7eb] dark:border-[#374151]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">Total Projects</p>
                <p className="text-3xl font-bold text-[#02090d] dark:text-white">
                  {projects.length}
                </p>
              </div>
              <div className="w-12 h-12 bg-[#e6f0f5] dark:bg-[#1e3a4a] rounded-xl flex items-center justify-center">
                <FiFolder className="text-xl text-[#0A2F44] dark:text-[#66a4c2]" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl p-6 border border-[#e5e7eb] dark:border-[#374151]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">Team Members</p>
                <p className="text-3xl font-bold text-[#02090d] dark:text-white">
                  {members.length}
                </p>
              </div>
              <div className="w-12 h-12 bg-[#e6f0f5] dark:bg-[#1e3a4a] rounded-xl flex items-center justify-center">
                <FiUsers className="text-xl text-[#0A2F44] dark:text-[#66a4c2]" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl p-6 border border-[#e5e7eb] dark:border-[#374151]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">Active Projects</p>
                <p className="text-3xl font-bold text-[#02090d] dark:text-white">
                  {projects.filter((p) => p.status === 'active').length}
                </p>
              </div>
              <div className="w-12 h-12 bg-[#e6f0f5] dark:bg-[#1e3a4a] rounded-xl flex items-center justify-center">
                <FiTrendingUp className="text-xl text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl p-6 border border-[#e5e7eb] dark:border-[#374151]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">Created</p>
                <p className="text-2xl font-bold text-[#02090d] dark:text-white">
                  {new Date(currentWorkspace.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-[#e6f0f5] dark:bg-[#1e3a4a] rounded-xl flex items-center justify-center">
                <FiCalendar className="text-xl text-[#0A2F44] dark:text-[#66a4c2]" />
              </div>
            </div>
          </div>
        </div>

        {/* Owned Projects Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#02090d] dark:text-white">Owned Projects</h2>
            <Link
              to={`/workspace/${workspaceId}/projects/new`}
              className="text-sm text-[#0A2F44] dark:text-[#66a4c2] hover:underline"
            >
              + New Project
            </Link>
          </div>

          {ownedProjects.length === 0 ? (
            <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl border border-[#e5e7eb] dark:border-[#374151] p-8 text-center">
              <FiFolder className="text-5xl text-[#9ca3af] dark:text-[#6b7280] mx-auto mb-4" />
              <p className="text-[#6b7280] dark:text-[#9ca3af]">No owned projects yet</p>
              <Link
                to={`/workspace/${workspaceId}/projects/new`}
                className="inline-block mt-4 px-4 py-2 bg-[#0A2F44] text-white rounded-lg hover:bg-[#082636] transition-colors"
              >
                Create your first project
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {ownedProjects.map((project) => (
                <div
                  key={project.id}
                  className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl border border-[#e5e7eb] dark:border-[#374151] overflow-hidden hover:shadow-lg transition-all"
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-10 h-10 bg-[#e6f0f5] dark:bg-[#1e3a4a] rounded-xl flex items-center justify-center">
                          <FiFolder className="text-[#0A2F44] dark:text-[#66a4c2]" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-[#02090d] dark:text-white">
                            {project.name}
                          </h3>
                          <p className="text-xs text-[#6b7280] dark:text-[#9ca3af] capitalize">
                            {project.project_type}
                          </p>
                        </div>
                      </div>

                      {/* Only Owner can see project actions */}
                      {isOwner && (
                        <div className="relative">
                          <button
                            onClick={() =>
                              setActiveProjectMenu(
                                activeProjectMenu === project.id ? null : project.id
                              )
                            }
                            className="p-1 hover:bg-[#f3f4f6] dark:hover:bg-[#374151] rounded-lg transition-colors"
                          >
                            <FiMoreVertical className="text-[#6b7280] dark:text-[#9ca3af]" />
                          </button>

                          {activeProjectMenu === project.id && (
                            <div className="absolute right-0 z-10 mt-1 w-40 bg-white dark:bg-[#1f2937] border border-[#e5e7eb] dark:border-[#374151] rounded-lg shadow-xl overflow-hidden">
                              <button
                                onClick={() => handleMoveProject(project)}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-[#f3f4f6] dark:hover:bg-[#374151] flex items-center space-x-2"
                              >
                                <FiMove className="text-[#0A2F44]" />
                                <span>Move to...</span>
                              </button>
                              <button
                                onClick={() => handleDeleteProject(project)}
                                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-2"
                              >
                                <FiTrash2 />
                                <span>Delete</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <p className="text-sm text-[#6b7280] dark:text-[#9ca3af] mb-3 line-clamp-2">
                      {project.description || 'No description'}
                    </p>

                    <div className="flex items-center justify-between text-xs text-[#6b7280] dark:text-[#9ca3af]">
                      <span>{project.location || 'Location not set'}</span>
                      <span>Updated {new Date(project.updated_at).toLocaleDateString()}</span>
                    </div>

                    <Link
                      to={`/workspace/${workspaceId}/projects/${project.id}`}
                      className="mt-4 block text-center px-4 py-2 bg-[#0A2F44] text-white rounded-lg hover:bg-[#082636] transition-colors text-sm"
                    >
                      Open Project
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Member Projects Section */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-[#02090d] dark:text-white mb-4">
            Member Projects
          </h2>

          {memberProjects.length === 0 ? (
            <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl border border-[#e5e7eb] dark:border-[#374151] p-8 text-center">
              <FiFolder className="text-5xl text-[#9ca3af] dark:text-[#6b7280] mx-auto mb-4" />
              <p className="text-[#6b7280] dark:text-[#9ca3af]">No member projects yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {memberProjects.map((project) => (
                <div
                  key={project.id}
                  className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl border border-[#e5e7eb] dark:border-[#374151] overflow-hidden hover:shadow-lg transition-all"
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-10 h-10 bg-[#e6f0f5] dark:bg-[#1e3a4a] rounded-xl flex items-center justify-center">
                          <FiFolder className="text-[#0A2F44] dark:text-[#66a4c2]" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-[#02090d] dark:text-white">
                            {project.name}
                          </h3>
                          <p className="text-xs text-[#6b7280] dark:text-[#9ca3af] capitalize">
                            {project.project_type}
                          </p>
                        </div>
                      </div>
                    </div>

                    <p className="text-sm text-[#6b7280] dark:text-[#9ca3af] mb-3 line-clamp-2">
                      {project.description || 'No description'}
                    </p>

                    <div className="flex items-center justify-between text-xs text-[#6b7280] dark:text-[#9ca3af]">
                      <span>{project.location || 'Location not set'}</span>
                      <span>Updated {new Date(project.updated_at).toLocaleDateString()}</span>
                    </div>

                    <Link
                      to={`/workspace/${workspaceId}/projects/${project.id}`}
                      className="mt-4 block text-center px-4 py-2 bg-[#0A2F44] text-white rounded-lg hover:bg-[#082636] transition-colors text-sm"
                    >
                      Open Project
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl border border-[#e5e7eb] dark:border-[#374151] overflow-hidden">
          <div className="p-6 border-b border-[#e5e7eb] dark:border-[#374151]">
            <h2 className="text-lg font-semibold text-[#02090d] dark:text-white">
              Recent Activity
            </h2>
            <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">
              Latest events in your workspace
            </p>
          </div>

          <div className="divide-y divide-[#e5e7eb] dark:divide-[#374151]">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="p-4 flex items-start space-x-3 hover:bg-[#f9fafb] dark:hover:bg-[#374151] transition-colors"
              >
                <div className="w-10 h-10 bg-[#e6f0f5] dark:bg-[#1e3a4a] rounded-full flex items-center justify-center flex-shrink-0">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-[#02090d] dark:text-white">
                    <span className="font-semibold">{activity.user}</span>
                    <span className="text-[#6b7280] dark:text-[#9ca3af]"> {activity.action} </span>
                    {activity.target && (
                      <span className="font-medium text-[#0A2F44] dark:text-[#66a4c2]">
                        {activity.target}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-[#6b7280] dark:text-[#9ca3af] mt-1 flex items-center">
                    <FiClock className="mr-1 text-xs" /> {activity.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Move Project Modal */}
      {showMoveModal && selectedProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <FiMove className="text-blue-500 text-2xl" />
              <h3 className="text-lg font-semibold text-[#02090d] dark:text-white">Move Project</h3>
            </div>

            <p className="text-[#6b7280] dark:text-[#9ca3af] mb-4">
              Move "{selectedProject.name}" to another organization
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-[#374151] dark:text-[#d1d5db] mb-2">
                Select Organization
              </label>
              <select
                value={selectedMoveOrg}
                onChange={(e) => setSelectedMoveOrg(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A2F44]"
              >
                <option value="">Select an organization...</option>
                {userOrgs.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name} ({org.type})
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 mb-6">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ⚠️ Team members from the current organization will lose access unless they are also
                members of the target organization.
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowMoveModal(false)
                  setSelectedProject(null)
                  setSelectedMoveOrg('')
                }}
                className="px-4 py-2 border border-[#e5e7eb] dark:border-[#374151] rounded-lg text-[#6b7280] hover:bg-[#f3f4f6] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmMoveProject}
                disabled={!selectedMoveOrg}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                Move Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <FiAlertCircle className="text-red-500 text-2xl" />
              <h3 className="text-lg font-semibold text-[#02090d] dark:text-white">
                Delete Project
              </h3>
            </div>

            <p className="text-[#6b7280] dark:text-[#9ca3af] mb-4">
              Are you sure you want to delete "{selectedProject.name}"? This action cannot be
              undone.
            </p>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setSelectedProject(null)
                }}
                className="px-4 py-2 border border-[#e5e7eb] dark:border-[#374151] rounded-lg text-[#6b7280] hover:bg-[#f3f4f6] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteProject}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors cursor-pointer"
              >
                Delete Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default OrganizationOverview
