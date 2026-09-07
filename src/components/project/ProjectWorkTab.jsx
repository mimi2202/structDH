import React, { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  FiGrid,
  FiBarChart2,
  FiColumns,
  FiSquare,
  FiTriangle,
  FiEdit2,
  FiTrash2,
  FiEye,
  FiLock,
  FiUser,
  FiClock,
  FiChevronRight,
  FiMoreVertical,
  FiCopy,
  FiDownload,
} from 'react-icons/fi'
import { useAuth } from '../../contexts/AuthContext'
import { useWorkspace, ROLES } from '../../contexts/WorkspaceContext'

const ProjectWorkTab = ({ projectId, refreshTrigger }) => {
  const { workspaceId } = useParams()
  const { user } = useAuth()
  const { currentProject } = useWorkspace()
  const [works, setWorks] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedWork, setSelectedWork] = useState(null)
  const [showActionMenu, setShowActionMenu] = useState(null)

  // Mock designs data - replace with API call
  const mockWorks = [
    {
      id: 'work-1',
      name: 'Ground Floor Slab',
      type: 'slab',
      owner_id: 'user-1',
      owner_name: 'John Engineer',
      owner_avatar: 'JE',
      created_at: '2026-06-01T10:00:00Z',
      updated_at: '2026-06-05T14:30:00Z',
      status: 'completed',
      thumbnail: null,
      parameters: { thickness: 200, span: 6.0 },
    },
    {
      id: 'work-2',
      name: 'First Floor Beam',
      type: 'beam',
      owner_id: 'user-2',
      owner_name: 'Sarah Designer',
      owner_avatar: 'SD',
      created_at: '2026-06-02T09:00:00Z',
      updated_at: '2026-06-04T11:20:00Z',
      status: 'in-progress',
      thumbnail: null,
      parameters: { width: 300, depth: 500, span: 5.5 },
    },
    {
      id: 'work-3',
      name: 'Column Design - Ground Floor',
      type: 'column',
      owner_id: 'user-1',
      owner_name: 'John Engineer',
      owner_avatar: 'JE',
      created_at: '2026-06-03T14:00:00Z',
      updated_at: '2026-06-06T09:15:00Z',
      status: 'draft',
      thumbnail: null,
      parameters: { width: 400, depth: 400, height: 3.5 },
    },
    {
      id: 'work-4',
      name: 'Foundation Pad',
      type: 'foundation',
      owner_id: 'user-3',
      owner_name: 'Mike Analyst',
      owner_avatar: 'MA',
      created_at: '2026-06-04T11:00:00Z',
      updated_at: '2026-06-04T16:45:00Z',
      status: 'review',
      thumbnail: null,
      parameters: { width: 1200, depth: 1200, thickness: 300 },
    },
  ]

  const getTypeIcon = (type) => {
    switch (type) {
      case 'slab':
        return <FiGrid className="text-blue-500" />
      case 'beam':
        return <FiBarChart2 className="text-green-500" />
      case 'column':
        return <FiColumns className="text-purple-500" />
      case 'foundation':
        return <FiSquare className="text-orange-500" />
      default:
        return <FiTriangle className="text-gray-500" />
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return (
          <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
            Completed
          </span>
        )
      case 'in-progress':
        return (
          <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
            In Progress
          </span>
        )
      case 'review':
        return (
          <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700">
            Under Review
          </span>
        )
      case 'draft':
        return (
          <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">Draft</span>
        )
      default:
        return (
          <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
            Unknown
          </span>
        )
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  const canEditWork = (workOwnerId) => {
    const isOwner = workOwnerId === user?.id
    const isProjectOwner = currentProject?.userRole === ROLES.PROJECT_OWNER
    const isProjectAdmin = currentProject?.userRole === ROLES.PROJECT_ADMIN
    return isOwner
  }

  const canDeleteWork = (workOwnerId) => {
    const isOwner = workOwnerId === user?.id
    const isProjectOwner = currentProject?.userRole === ROLES.PROJECT_OWNER
    // According to PDF: Only work owner can delete
    return isOwner
  }

  const handleOpenWork = (work) => {
    // Navigate to work detail page
    console.log('Open work:', work)
  }

  const handleEditWork = (work) => {
    console.log('Edit work:', work)
    setShowActionMenu(null)
  }

  const handleDeleteWork = (work) => {
    if (window.confirm(`Delete "${work.name}"? This action cannot be undone.`)) {
      console.log('Delete work:', work)
      setShowActionMenu(null)
    }
  }

  const handleDuplicateWork = (work) => {
    console.log('Duplicate work:', work)
    setShowActionMenu(null)
  }

  useEffect(() => {
    setLoading(true)
    // Simulate API call
    setTimeout(() => {
      setWorks(mockWorks)
      setLoading(false)
    }, 500)
  }, [refreshTrigger])

  // Group works by owner
  const groupedByOwner = works.reduce((groups, work) => {
    const ownerKey = work.owner_id
    if (!groups[ownerKey]) {
      groups[ownerKey] = {
        owner_id: work.owner_id,
        owner_name: work.owner_name,
        owner_avatar: work.owner_avatar,
        works: [],
      }
    }
    groups[ownerKey].works.push(work)
    return groups
  }, {})

  const owners = Object.values(groupedByOwner)

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-2 border-[#0A2F44] border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#02090d] dark:text-white">Design Works</h2>
          <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">
            All structural designs for this project
          </p>
        </div>
        <div className="flex space-x-3">
          <Link
            to={`/workspace/${workspaceId}/projects/${projectId}/slab`}
            className="px-4 py-2 bg-[#0A2F44] text-white rounded-lg hover:bg-[#082636] transition-colors text-sm"
          >
            + New Design
          </Link>
        </div>
      </div>

      {works.length === 0 ? (
        <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-lg p-12 text-center border border-[#e5e7eb] dark:border-[#374151]">
          <FiGrid className="text-5xl text-[#9ca3af] mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[#02090d] dark:text-white mb-2">
            No designs yet
          </h3>
          <p className="text-[#6b7280] dark:text-[#9ca3af] mb-6">
            Create your first structural design for this project
          </p>
          <Link
            to={`/workspace/${workspaceId}/projects/${projectId}/slab`}
            className="inline-block px-4 py-2 bg-[#0A2F44] text-white rounded-lg hover:bg-[#082636]"
          >
            Create Design
          </Link>
        </div>
      ) : (
        // Display works grouped by owner
        owners.map((owner) => (
          <div
            key={owner.owner_id}
            className="bg-white dark:bg-[#1f2937] rounded-xl shadow-lg border border-[#e5e7eb] dark:border-[#374151] overflow-hidden"
          >
            {/* Owner Header */}
            <div className="p-4 border-b border-[#e5e7eb] dark:border-[#374151] bg-[#f9fafb] dark:bg-[#374151]">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-[#0A2F44] to-[#2E7D32] rounded-full flex items-center justify-center text-white text-sm font-medium">
                    {owner.owner_avatar}
                  </div>
                  <div>
                    <p className="font-medium text-[#02090d] dark:text-white">{owner.owner_name}</p>
                    <p className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
                      {owner.works.length} design{owner.works.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                {owner.owner_id === user?.id && (
                  <span className="text-xs text-[#0A2F44] dark:text-[#66a4c2] bg-[#e6f0f5] dark:bg-[#1e3a4a] px-2 py-0.5 rounded-full">
                    Your designs
                  </span>
                )}
              </div>
            </div>

            {/* Works List */}
            <div className="divide-y divide-[#e5e7eb] dark:divide-[#374151]">
              {owner.works.map((work) => (
                <div
                  key={work.id}
                  className="p-4 hover:bg-[#f9fafb] dark:hover:bg-[#374151] transition-colors group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className="w-10 h-10 bg-[#e6f0f5] dark:bg-[#1e3a4a] rounded-lg flex items-center justify-center">
                        {getTypeIcon(work.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="font-semibold text-[#02090d] dark:text-white">
                            {work.name}
                          </h3>
                          {getStatusBadge(work.status)}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#6b7280] dark:text-[#9ca3af]">
                          <span className="flex items-center">
                            <FiClock className="mr-1 text-xs" />
                            Updated {formatDate(work.updated_at)}
                          </span>
                          {work.parameters?.thickness && (
                            <span>{work.parameters.thickness}mm thickness</span>
                          )}
                          {work.parameters?.span && <span>{work.parameters.span}m span</span>}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons - Only visible to work owner */}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleOpenWork(work)}
                        className="p-2 text-[#0A2F44] hover:bg-[#e6f0f5] rounded-lg transition-colors cursor-pointer"
                        title="Open Design"
                      >
                        <FiEye />
                      </button>

                      {canEditWork(work.owner_id) && (
                        <>
                          <button
                            onClick={() => handleEditWork(work)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Design"
                          >
                            <FiEdit2 />
                          </button>
                          <div className="relative">
                            <button
                              onClick={() =>
                                setShowActionMenu(showActionMenu === work.id ? null : work.id)
                              }
                              className="p-2 text-[#6b7280] hover:bg-[#f3f4f6] rounded-lg transition-colors cursor-pointer"
                            >
                              <FiMoreVertical />
                            </button>

                            {showActionMenu === work.id && (
                              <div className="absolute right-0 z-10 mt-1 w-36 bg-white dark:bg-[#1f2937] border border-[#e5e7eb] dark:border-[#374151] rounded-lg shadow-xl overflow-hidden">
                                <button
                                  onClick={() => handleDuplicateWork(work)}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-[#f3f4f6] dark:hover:bg-[#374151] flex items-center space-x-2"
                                >
                                  <FiCopy />
                                  <span>Duplicate</span>
                                </button>
                                {canDeleteWork(work.owner_id) && (
                                  <button
                                    onClick={() => handleDeleteWork(work)}
                                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-2"
                                  >
                                    <FiTrash2 />
                                    <span>Delete</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </>
                      )}

                      {/* Read-only indicator for non-owners */}
                      {!canEditWork(work.owner_id) && (
                        <div className="flex items-center space-x-1 text-xs text-[#9ca3af]">
                          <FiLock className="text-xs" />
                          <span>Read-only</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Work Access Rules Info */}
      <div className="bg-[#e6f0f5] dark:bg-[#1e3a4a] rounded-xl p-4">
        <div className="flex items-start space-x-3">
          <FiLock className="text-[#0A2F44] dark:text-[#66a4c2] mt-0.5" />
          <div>
            <p className="text-sm font-medium text-[#02090d] dark:text-white">Work Access Rules</p>
            <p className="text-xs text-[#0A2F44] dark:text-[#cce1eb] mt-1">
              Only the owner of a design can edit or delete it. Other team members can view but
              cannot modify. Project owners and admins have full access to all works.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProjectWorkTab
