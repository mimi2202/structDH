import React, { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  FiArrowLeft,
  FiEdit2,
  FiTrash2,
  FiCopy,
  FiArchive,
  FiDownload,
  FiShare2,
  FiSettings,
  FiFileText,
  FiBarChart2,
  FiUsers,
  FiClock,
  FiSave,
  FiAlertCircle,
  FiUpload,
  FiCheckCircle,
  FiMessageSquare,
  FiMove,
} from 'react-icons/fi'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { useAuth } from '../contexts/AuthContext'
import ChatRoom from '../components/chat/ChatRoom'
import { ChatProvider } from '../contexts/ChatContext'
import ProjectWorkTab from '../components/project/ProjectWorkTab'
import CommentSection from '../components/comments/CommentSection'
import ProjectTeamTab from '../components/project/ProjectTeamTab'

const ProjectDetail = () => {
  const { workspaceId, projectId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    projects,
    loading,
    loadProjects,
    updateProject,
    deleteProject,
    setCurrentProjectByProjectId,
    currentProject,
  } = useWorkspace()
  const [project, setProject] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isMoving, setIsMoving] = useState(false)
  const [selectedTargetOrg, setSelectedTargetOrg] = useState('')
  const [userOrganizations, setUserOrganizations] = useState([])
  const [externalWorks, setExternalWorks] = useState([])
  const [refreshWorks, setRefreshWorks] = useState(0)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    project_type: '',
    design_standard: '',
    location: '',
  })

  // Set current project in context when component mounts
  useEffect(() => {
    if (projectId) {
      setCurrentProjectByProjectId(projectId)
    }
  }, [projectId])

  useEffect(() => {
    loadProjects(workspaceId)
    loadExternalWorks()
    loadUserOrganizations()
  }, [workspaceId])

  const loadExternalWorks = () => {
    const saved = localStorage.getItem('external_works')
    if (saved) {
      const allWorks = JSON.parse(saved)
      const projectWorks = allWorks.filter((w) => w.projectId === projectId)
      setExternalWorks(projectWorks)
    }
  }

  const loadUserOrganizations = () => {
    const savedOrgs = localStorage.getItem('mock_workspaces')
    if (savedOrgs) {
      const allOrgs = JSON.parse(savedOrgs)
      const otherOrgs = allOrgs.filter((org) => org.id !== workspaceId)
      setUserOrganizations(otherOrgs)
    }
  }

  useEffect(() => {
    if (projects.length > 0) {
      const found = projects.find((p) => p.id === projectId)
      if (found) {
        setProject(found)
        setFormData({
          name: found.name || '',
          description: found.description || '',
          project_type: found.project_type || 'commercial',
          design_standard: found.design_standard || 'Eurocode',
          location: found.location || '',
        })
      }
    }
  }, [projects, projectId])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSaveSettings = async (customData = null) => {
    setIsSaving(true)
    const dataToSave = customData || formData
    const result = await updateProject(projectId, dataToSave)
    if (result.success) {
      setProject((prev) => ({ ...prev, ...dataToSave, updated_at: new Date().toISOString() }))
      if (!customData) {
        alert('Project settings saved successfully!')
      }
    } else {
      alert('Failed to save: ' + result.error)
    }
    setIsSaving(false)
  }

  const handleDelete = async () => {
    const result = await deleteProject(projectId)
    if (result.success) {
      setShowDeleteModal(false)
      navigate(`/workspace/${workspaceId}/projects`)
    } else {
      alert('Failed to delete project')
    }
  }

  const handleMoveProject = () => {
    setSelectedTargetOrg('')
    setShowMoveModal(true)
  }

  const confirmMoveProject = async () => {
    if (!selectedTargetOrg) {
      alert('Please select an organization')
      return
    }

    setIsMoving(true)

    setTimeout(() => {
      const savedProjects = localStorage.getItem('mock_projects')
      if (savedProjects) {
        let allProjects = JSON.parse(savedProjects)
        allProjects = allProjects.map((p) =>
          p.id === projectId
            ? { ...p, workspace_id: selectedTargetOrg, updated_at: new Date().toISOString() }
            : p
        )
        localStorage.setItem('mock_projects', JSON.stringify(allProjects))
      }

      setShowMoveModal(false)
      setIsMoving(false)
      alert('Project moved successfully!')
      navigate(`/workspace/${selectedTargetOrg}/projects`)
    }, 1500)
  }

  if (loading || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#0A2F44] rounded-lg flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-white text-2xl font-bold">SA</span>
          </div>
          <p className="text-[#6b7280]">Loading project...</p>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: FiFileText },
    { id: 'design-work', label: 'Design Work', icon: FiBarChart2 },
    { id: 'team', label: 'Team', icon: FiUsers },
    { id: 'comments', label: 'Comments', icon: FiMessageSquare },
    { id: 'settings', label: 'Settings', icon: FiSettings },
  ]

  const isProjectOwner = currentProject?.userRole === 'project_owner'

  return (
    <ChatProvider workspaceId={workspaceId} projectId={projectId} user={user}>
      <div className="relative min-h-screen bg-[#f3f4f6] dark:bg-[#111827]">
        {/* Header */}
        <div className="bg-white dark:bg-[#1f2937] border-b border-[#e5e7eb] dark:border-[#374151] sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            {/* Breadcrumb */}
            <div className="flex items-center space-x-2 text-sm mb-2">
              <Link
                to={`/workspace/${workspaceId}`}
                className="text-[#6b7280] hover:text-[#0A2F44]"
              >
                Workspace
              </Link>
              <span className="text-[#9ca3af]">/</span>
              <Link
                to={`/workspace/${workspaceId}/projects`}
                className="text-[#6b7280] hover:text-[#0A2F44]"
              >
                Projects
              </Link>
              <span className="text-[#9ca3af]">/</span>
              <span className="text-[#02090d] dark:text-white font-medium">{project.name}</span>
            </div>

            {/* Title and Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Link
                  to={`/workspace/${workspaceId}/projects`}
                  className="p-2 hover:bg-[#f3f4f6] dark:hover:bg-[#374151] rounded-lg transition-colors"
                >
                  <FiArrowLeft className="text-xl text-[#6b7280]" />
                </Link>
                <div>
                  <h1 className="text-2xl font-bold text-[#02090d] dark:text-white">
                    {project.name}
                  </h1>
                  <div className="flex items-center space-x-4 mt-1">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        project.project_type === 'residential'
                          ? 'bg-green-100 text-green-700'
                          : project.project_type === 'commercial'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-purple-100 text-purple-700'
                      }`}
                    >
                      {project.project_type}
                    </span>
                    <span className="text-sm text-[#6b7280] flex items-center">
                      <FiClock className="mr-1" />
                      Updated {new Date(project.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                <Link
                  to={`/workspace/${workspaceId}/projects/${projectId}/slab`}
                  className="px-4 py-2 bg-[#0A2F44] text-white rounded-lg hover:bg-[#082636] transition-colors"
                >
                  Add Design
                </Link>

                <button
                  onClick={() => {
                    const newName = prompt('Enter new project name:', project.name)
                    if (newName && newName.trim()) {
                      handleSaveSettings({ ...formData, name: newName })
                    }
                  }}
                  className="p-2 hover:bg-[#f3f4f6] dark:hover:bg-[#374151] rounded-lg transition-colors"
                  title="Edit project name"
                >
                  <FiEdit2 className="text-[#6b7280]" />
                </button>

                <button
                  onClick={() => {
                    const newName = prompt(
                      'Enter name for duplicated project:',
                      `${project.name} (Copy)`
                    )
                    if (newName && newName.trim()) {
                      const savedProjects = localStorage.getItem('mock_projects')
                      if (savedProjects) {
                        let allProjects = JSON.parse(savedProjects)
                        const newProject = {
                          ...project,
                          id: `proj-${Date.now()}`,
                          name: newName,
                          created_at: new Date().toISOString(),
                          updated_at: new Date().toISOString(),
                        }
                        newProject.userRole = 'project_owner'
                        allProjects.push(newProject)
                        localStorage.setItem('mock_projects', JSON.stringify(allProjects))
                        alert('Project duplicated!')
                        navigate(`/workspace/${workspaceId}/projects/${newProject.id}`)
                      }
                    }
                  }}
                  className="p-2 hover:bg-[#f3f4f6] dark:hover:bg-[#374151] rounded-lg transition-colors"
                  title="Duplicate project"
                >
                  <FiCopy className="text-[#6b7280]" />
                </button>

                <button
                  onClick={() => {
                    if (window.confirm(`Archive "${project.name}"?`)) {
                      const savedProjects = localStorage.getItem('mock_projects')
                      if (savedProjects) {
                        let allProjects = JSON.parse(savedProjects)
                        allProjects = allProjects.map((p) =>
                          p.id === projectId
                            ? { ...p, status: 'archived', updated_at: new Date().toISOString() }
                            : p
                        )
                        localStorage.setItem('mock_projects', JSON.stringify(allProjects))
                        alert('Project archived!')
                        navigate(`/workspace/${workspaceId}/projects`)
                      }
                    }
                  }}
                  className="p-2 hover:bg-[#f3f4f6] dark:hover:bg-[#374151] rounded-lg transition-colors"
                  title="Archive project"
                >
                  <FiArchive className="text-[#6b7280]" />
                </button>

                <button
                  onClick={() => {
                    const shareUrl = window.location.href
                    navigator.clipboard.writeText(shareUrl)
                    alert('Project link copied to clipboard!')
                  }}
                  className="p-2 hover:bg-[#f3f4f6] dark:hover:bg-[#374151] rounded-lg transition-colors"
                  title="Share project"
                >
                  <FiShare2 className="text-[#6b7280]" />
                </button>

                <button
                  onClick={() => {
                    const projectData = {
                      project: project,
                      settings: formData,
                      exportedAt: new Date().toISOString(),
                    }
                    const dataStr = JSON.stringify(projectData, null, 2)
                    const blob = new Blob([dataStr], { type: 'application/json' })
                    const url = URL.createObjectURL(blob)
                    const link = document.createElement('a')
                    link.href = url
                    link.download = `${project.name.replace(/\s/g, '_')}_export.json`
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)
                    URL.revokeObjectURL(url)
                    alert('Project data exported!')
                  }}
                  className="p-2 hover:bg-[#f3f4f6] dark:hover:bg-[#374151] rounded-lg transition-colors"
                  title="Download project data"
                >
                  <FiDownload className="text-[#6b7280]" />
                </button>

                {isProjectOwner && (
                  <button
                    onClick={handleMoveProject}
                    className="p-2 hover:bg-[#f3f4f6] dark:hover:bg-[#374151] rounded-lg transition-colors"
                    title="Move to another organization"
                  >
                    <FiMove className="text-[#6b7280]" />
                  </button>
                )}

                {isProjectOwner && (
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <FiTrash2 className="text-red-500" />
                  </button>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex space-x-1 mt-4">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-[#0A2F44] text-white'
                      : 'text-[#6b7280] hover:text-[#0A2F44] hover:bg-[#f3f4f6] dark:hover:bg-[#374151]'
                  }`}
                >
                  <tab.icon className="text-lg" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Project Info Card */}
              <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-lg p-6 border border-[#e5e7eb] dark:border-[#374151]">
                <h2 className="text-lg font-semibold text-[#02090d] dark:text-white mb-4">
                  Project Information
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-[#6b7280] mb-1">Project Name</p>
                    <p className="text-[#02090d] dark:text-white font-medium">{project.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-[#6b7280] mb-1">Project Type</p>
                    <p className="text-[#02090d] dark:text-white font-medium capitalize">
                      {project.project_type}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-[#6b7280] mb-1">Location</p>
                    <p className="text-[#02090d] dark:text-white font-medium">
                      {project.location || 'Not specified'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-[#6b7280] mb-1">Design Standard</p>
                    <p className="text-[#02090d] dark:text-white font-medium">
                      {project.design_standard || 'Eurocode'}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-sm text-[#6b7280] mb-1">Description</p>
                    <p className="text-[#02090d] dark:text-white">
                      {project.description || 'No description provided'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-lg p-6 border border-[#e5e7eb] dark:border-[#374151]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-[#6b7280]">Structural Elements</span>
                    <FiFileText className="text-[#0A2F44]" />
                  </div>
                  <p className="text-2xl font-bold text-[#02090d] dark:text-white">12</p>
                  <p className="text-xs text-[#9ca3af] mt-1">Beams, Columns, Slabs</p>
                </div>

                <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-lg p-6 border border-[#e5e7eb] dark:border-[#374151]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-[#6b7280]">Optimization Runs</span>
                    <FiBarChart2 className="text-[#0A2F44]" />
                  </div>
                  <p className="text-2xl font-bold text-[#02090d] dark:text-white">8</p>
                  <p className="text-xs text-[#9ca3af] mt-1">Last run 2 days ago</p>
                </div>

                <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-lg p-6 border border-[#e5e7eb] dark:border-[#374151]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-[#6b7280]">Team Members</span>
                    <FiUsers className="text-[#0A2F44]" />
                  </div>
                  <p className="text-2xl font-bold text-[#02090d] dark:text-white">3</p>
                  <p className="text-xs text-[#9ca3af] mt-1">2 active this week</p>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-lg p-6 border border-[#e5e7eb] dark:border-[#374151]">
                <h2 className="text-lg font-semibold text-[#02090d] dark:text-white mb-4">
                  Recent Activity
                </h2>
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex items-start space-x-3 pb-4 border-b border-[#e5e7eb] dark:border-[#374151] last:border-0"
                    >
                      <div className="w-8 h-8 bg-[#e6f0f5] dark:bg-[#1e3a4a] rounded-full flex items-center justify-center">
                        <FiFileText className="text-sm text-[#0A2F44]" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-[#02090d] dark:text-white">
                          <span className="font-medium">John Doe</span> updated beam calculations
                        </p>
                        <p className="text-xs text-[#9ca3af] mt-1">2 hours ago</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'design-work' && (
            <ProjectWorkTab projectId={projectId} refreshTrigger={refreshWorks} />
          )}

          {activeTab === 'team' && <ProjectTeamTab projectId={projectId} />}

          {activeTab === 'comments' && (
            <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-lg p-6 border border-[#e5e7eb] dark:border-[#374151]">
              <h2 className="text-lg font-semibold text-[#02090d] dark:text-white mb-4">
                Project Comments
              </h2>
              <p className="text-sm text-[#6b7280] dark:text-[#9ca3af] mb-6">
                Discuss project-related topics with your team
              </p>
              <CommentSection
                workId={projectId}
                workOwnerId={isProjectOwner ? user?.id : null}
                projectId={projectId}
              />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-lg border border-[#e5e7eb] dark:border-[#374151] overflow-visible">
              <div className="p-6 border-b border-[#e5e7eb] dark:border-[#374151]">
                <h2 className="text-lg font-semibold text-[#02090d] dark:text-white">
                  Project Settings
                </h2>
                <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">
                  Manage project configuration and preferences
                </p>
              </div>

              <div className="p-6 space-y-6 overflow-visible">
                <div>
                  <label className="block text-sm font-medium text-[#374151] dark:text-[#d1d5db] mb-2">
                    Project Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full max-w-md px-4 py-2 rounded-lg border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A2F44]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#374151] dark:text-[#d1d5db] mb-2">
                    Description
                  </label>
                  <textarea
                    name="description"
                    rows="3"
                    value={formData.description}
                    onChange={handleInputChange}
                    className="w-full max-w-2xl px-4 py-2 rounded-lg border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A2F44]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#374151] dark:text-[#d1d5db] mb-2">
                    Project Type
                  </label>
                  <select
                    name="project_type"
                    value={formData.project_type}
                    onChange={handleInputChange}
                    className="px-4 py-2 rounded-lg border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A2F44]"
                  >
                    <option value="residential">Residential</option>
                    <option value="commercial">Commercial</option>
                    <option value="industrial">Industrial</option>
                    <option value="infrastructure">Infrastructure</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#374151] dark:text-[#d1d5db] mb-2">
                    Design Standard
                  </label>
                  <select
                    name="design_standard"
                    value={formData.design_standard}
                    onChange={handleInputChange}
                    className="px-4 py-2 rounded-lg border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A2F44]"
                  >
                    <option value="Eurocode">Eurocode</option>
                    <option value="BS">British Standards</option>
                    <option value="ACI">ACI</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#374151] dark:text-[#d1d5db] mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    placeholder="e.g., London, UK"
                    className="w-full max-w-md px-4 py-2 rounded-lg border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A2F44]"
                  />
                </div>

                <div className="pt-4">
                  <button
                    onClick={() => handleSaveSettings()}
                    disabled={isSaving}
                    className="flex items-center space-x-2 px-6 py-2 bg-[#0A2F44] text-white rounded-lg hover:bg-[#082636] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <FiSave />
                    <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </div>
              </div>

              {isProjectOwner && (
                <div className="p-6 border-t border-[#e5e7eb] dark:border-[#374151] bg-red-50 dark:bg-red-900/20">
                  <div className="flex items-start space-x-4">
                    <FiAlertCircle className="text-red-500 text-2xl flex-shrink-0" />
                    <div>
                      <h3 className="text-lg font-semibold text-red-700 dark:text-red-400">
                        Danger Zone
                      </h3>
                      <p className="text-sm text-red-600 dark:text-red-300 mb-4">
                        Once you delete this project, there is no going back. All data will be
                        permanently removed.
                      </p>
                      <button
                        onClick={() => setShowDeleteModal(true)}
                        className="flex items-center space-x-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors cursor-pointer"
                      >
                        <FiTrash2 />
                        <span>Delete Project</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Move Project Modal */}
        {showMoveModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl max-w-md w-full mx-4 p-6">
              <div className="flex items-center space-x-3 mb-4">
                <FiMove className="text-blue-500 text-2xl" />
                <h3 className="text-lg font-semibold text-[#02090d] dark:text-white">
                  Move Project
                </h3>
              </div>

              <p className="text-[#6b7280] dark:text-[#9ca3af] mb-4">
                Move "{project.name}" to another organization. You must have Owner or Admin access
                in the target organization.
              </p>

              <div className="mb-6">
                <label className="block text-sm font-medium text-[#374151] dark:text-[#d1d5db] mb-2">
                  Select Organization
                </label>
                <select
                  value={selectedTargetOrg}
                  onChange={(e) => setSelectedTargetOrg(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A2F44]"
                >
                  <option value="">Select an organization...</option>
                  {userOrganizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name} ({org.type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 mb-6">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  ⚠️ Team members from the current organization will lose access unless they are
                  also members of the target organization.
                </p>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowMoveModal(false)}
                  className="px-4 py-2 border border-[#e5e7eb] dark:border-[#374151] rounded-lg text-[#6b7280] hover:bg-[#f3f4f6] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmMoveProject}
                  disabled={isMoving || !selectedTargetOrg}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isMoving ? 'Moving...' : 'Move Project'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
              <h3 className="text-lg font-semibold text-[#02090d] dark:text-white mb-2">
                Delete Project
              </h3>
              <p className="text-[#6b7280] mb-6">
                Are you sure you want to delete "{project.name}"? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 border border-[#e5e7eb] dark:border-[#374151] rounded-lg text-[#6b7280] hover:bg-[#f3f4f6] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  Delete Project
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Chat Room */}
        <ChatRoom workspaceId={workspaceId} projectId={projectId} projectName={project?.name} />
      </div>
    </ChatProvider>
  )
}

export default ProjectDetail
