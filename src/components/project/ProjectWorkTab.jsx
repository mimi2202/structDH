import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
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
import { listForProject, assignToProject, deleteDesign, designRoute, designState, ELEMENTS } from '../../utils/savedDesigns'

const ProjectWorkTab = ({ projectId, refreshTrigger }) => {
  const { user } = useAuth()
  const { workspaceId } = useParams()
  const [works, setWorks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showActionMenu, setShowActionMenu] = useState(null)

  const navigate = useNavigate()

  // Designs attached to this project (quick designs added from /quick-design),
  // shaped for the list below. status: PASS -> completed, FAIL -> review.
  const loadWorks = () => listForProject(projectId).map((d) => ({
    id: d.id,
    element: d.element,
    name: d.name || 'Untitled design',
    type: d.element === 'continuous-slab' ? 'slab' : d.element === 'continuous-beam' ? 'beam' : d.element,
    element_label: ELEMENTS[d.element]?.label || d.element,
    subtitle: d.subtitle,
    owner_id: d.owner_id || 'unknown',
    owner_name: d.owner_name || 'Unknown',
    owner_avatar: String(d.owner_name || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
    created_at: d.saved_at,
    updated_at: d.assigned_at || d.saved_at,
    status: d.status === 'PASS' ? 'completed' : d.status === 'FAIL' ? 'review' : 'draft',
    raw: d,
  }))

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

  // Only the person who saved a design changes it (designs saved before
  // owners were recorded are open to everyone in the project).
  const canEditWork = (workOwnerId) => workOwnerId === 'unknown' || workOwnerId === user?.id
  const canDeleteWork = canEditWork

  const handleOpenWork = (work) => {
    navigate(designRoute(work.raw, work.element), { state: designState(work.raw) })
  }

  const handleEditWork = (work) => {
    setShowActionMenu(null)
    handleOpenWork(work)
  }

  const handleDeleteWork = (work) => {
    if (window.confirm(`Delete "${work.name}"? The saved result and report are removed.`)) {
      deleteDesign(work.element, work.id)
      setShowActionMenu(null)
      setWorks(loadWorks())
    }
  }

  // "Remove from project": the design goes back to the quick designs list.
  const handleDuplicateWork = (work) => {
    assignToProject(work.element, work.id, null)
    setShowActionMenu(null)
    setWorks(loadWorks())
  }

  useEffect(() => {
    setWorks(loadWorks())
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger, projectId])

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
            to={`/workspace/${workspaceId}/projects/${projectId}/design`}
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
            Open the project’s design hub, run a design and save it; or add a quick design to this project
          </p>
          <Link
            to={`/workspace/${workspaceId}/projects/${projectId}/design`}
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
                          <span className="font-mono uppercase">{work.element_label}</span>
                          {work.subtitle && <span>{work.subtitle}</span>}
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
                                  <span>Remove from project</span>
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
              Anyone with access to the project can open its designs. Only the person who saved a
              design can remove it from the project or delete it.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProjectWorkTab
