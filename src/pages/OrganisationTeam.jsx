import React, { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import ReactDOM from 'react-dom'
import {
  FiArrowLeft,
  FiUsers,
  FiUserPlus,
  FiMail,
  FiX,
  FiCheck,
  FiMoreVertical,
  FiSearch,
  FiFilter,
  FiShield,
  FiUser,
  FiEye,
  FiClock,
  FiAlertCircle,
  FiTrash2,
  FiEdit2,
  FiChevronDown,
  FiSend,
  FiUserCheck,
  FiUserX,
  FiSun,
  FiMoon,
  FiXCircle,
} from 'react-icons/fi'
import { useWorkspace, ROLES } from '../contexts/WorkspaceContext'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'

// Role Dropdown Component with Smart Positioning
const RoleDropdownMenu = ({ isOpen, onClose, onSelect, currentRole, buttonRect }) => {
  const [position, setPosition] = useState({ top: 0, left: 0 })

  const roleOptions = [
    {
      value: ROLES.ORG_ADMIN,
      label: 'Admin',
      icon: FiShield,
      description: 'Can manage members and settings',
    },
    {
      value: ROLES.ORG_EDITOR,
      label: 'Editor',
      icon: FiEdit2,
      description: 'Can create and edit designs',
    },
    {
      value: ROLES.ORG_MEMBER,
      label: 'Member',
      icon: FiUser,
      description: 'Can view and create designs',
    },
    { value: ROLES.PROJECT_VIEWER, label: 'Viewer', icon: FiEye, description: 'Read-only access' },
  ]

  useEffect(() => {
    if (isOpen && buttonRect) {
      const dropdownHeight = 280
      const spaceBelow = window.innerHeight - buttonRect.bottom
      const spaceAbove = buttonRect.top

      let topPosition

      if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
        topPosition = buttonRect.top + window.scrollY - dropdownHeight - 4
      } else {
        topPosition = buttonRect.bottom + window.scrollY + 4
      }

      setPosition({
        top: topPosition,
        left: buttonRect.left + window.scrollX,
      })
    }
  }, [isOpen, buttonRect])

  if (!isOpen) return null

  return ReactDOM.createPortal(
    <div
      className="fixed bg-white dark:bg-[#1f2937] border border-[#e5e7eb] dark:border-[#374151] rounded-xl shadow-2xl overflow-hidden animate-fade-in z-[9999]"
      style={{
        top: position.top,
        left: position.left,
        minWidth: '260px',
        maxWidth: '300px',
      }}
    >
      {roleOptions.map((option) => (
        <button
          key={option.value}
          onClick={() => {
            onSelect(option.value)
            onClose()
          }}
          className="w-full px-4 py-3 text-left hover:bg-[#f3f4f6] dark:hover:bg-[#374151] transition-colors cursor-pointer flex items-center space-x-3"
        >
          <option.icon className="text-[#0A2F44] dark:text-[#66a4c2] text-lg flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-[#02090d] dark:text-white">{option.label}</p>
            <p className="text-xs text-[#6b7280] dark:text-[#9ca3af]">{option.description}</p>
          </div>
          {currentRole === option.value && (
            <FiCheck className="text-[#0A2F44] dark:text-[#66a4c2] flex-shrink-0" />
          )}
        </button>
      ))}
    </div>,
    document.body
  )
}

// Action Menu Dropdown with Smart Positioning
const ActionMenu = ({ isOpen, onClose, onRemove, buttonRect }) => {
  const [position, setPosition] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (isOpen && buttonRect) {
      const menuHeight = 60
      const spaceBelow = window.innerHeight - buttonRect.bottom
      const spaceAbove = buttonRect.top

      let topPosition

      if (spaceBelow < menuHeight && spaceAbove > menuHeight) {
        topPosition = buttonRect.top + window.scrollY - menuHeight - 4
      } else {
        topPosition = buttonRect.bottom + window.scrollY + 4
      }

      setPosition({
        top: topPosition,
        left: buttonRect.right + window.scrollX - 150,
      })
    }
  }, [isOpen, buttonRect])

  if (!isOpen) return null

  return ReactDOM.createPortal(
    <div
      className="fixed bg-white dark:bg-[#1f2937] border border-[#e5e7eb] dark:border-[#374151] rounded-xl shadow-2xl overflow-hidden animate-fade-in z-[9999]"
      style={{
        top: position.top,
        left: position.left,
        minWidth: '150px',
      }}
    >
      <button
        onClick={() => {
          onRemove()
          onClose()
        }}
        className="w-full px-4 py-3 text-left hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer flex items-center space-x-3 text-red-600 dark:text-red-400"
      >
        <FiTrash2 />
        <span>Remove Member</span>
      </button>
    </div>,
    document.body
  )
}

// Invite Modal Component
const InviteModal = ({ isOpen, onClose, onInvite, isInviting }) => {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false)
  const [roleButtonRect, setRoleButtonRect] = useState(null)
  const roleButtonRef = React.useRef(null)

  useEffect(() => {
    if (isRoleDropdownOpen && roleButtonRef.current) {
      const rect = roleButtonRef.current.getBoundingClientRect()
      const dropdownHeight = 280
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top

      let topPosition
      if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
        topPosition = rect.top + window.scrollY - dropdownHeight - 4
      } else {
        topPosition = rect.bottom + window.scrollY + 4
      }

      setRoleButtonRect({
        top: topPosition,
        left: rect.left + window.scrollX,
      })
    }
  }, [isRoleDropdownOpen])

  if (!isOpen) return null

  const roleOptions = [
    {
      value: 'admin',
      label: 'Admin',
      icon: FiShield,
      description: 'Can manage members and settings',
    },
    { value: 'editor', label: 'Editor', icon: FiEdit2, description: 'Can create and edit designs' },
    { value: 'member', label: 'Member', icon: FiUser, description: 'Can view and create designs' },
    { value: 'viewer', label: 'Viewer', icon: FiEye, description: 'Read-only access' },
  ]

  const handleSubmit = () => {
    if (email.trim()) {
      onInvite(email, role)
      setEmail('')
      setRole('member')
    }
  }

  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]">
      <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#02090d] dark:text-white">
            Invite Team Member
          </h3>
          <button
            onClick={onClose}
            className="text-[#6b7280] dark:text-[#9ca3af] hover:text-[#0A2F44] cursor-pointer"
          >
            <FiX />
          </button>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#9ca3af] dark:text-[#6b7280]" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A2F44]"
            />
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-[#374151] dark:text-[#d1d5db] mb-2">
              Role
            </label>
            <button
              ref={roleButtonRef}
              type="button"
              onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
              className="w-full px-4 py-3 rounded-xl border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white flex items-center justify-between hover:border-[#0A2F44] transition-colors cursor-pointer"
            >
              <div className="flex items-center space-x-2">
                {role === 'admin' && <FiShield className="text-[#0A2F44]" />}
                {role === 'editor' && <FiEdit2 className="text-[#0A2F44]" />}
                {role === 'member' && <FiUser className="text-[#0A2F44]" />}
                {role === 'viewer' && <FiEye className="text-[#0A2F44]" />}
                <span>{roleOptions.find((r) => r.value === role)?.label || 'Member'}</span>
              </div>
              <FiChevronDown
                className={`text-[#6b7280] dark:text-[#9ca3af] transition-transform duration-200 ${isRoleDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isRoleDropdownOpen &&
              roleButtonRect &&
              ReactDOM.createPortal(
                <div
                  className="fixed bg-white dark:bg-[#1f2937] border border-[#e5e7eb] dark:border-[#374151] rounded-xl shadow-2xl overflow-hidden z-[10001]"
                  style={{
                    top: roleButtonRect.top,
                    left: roleButtonRect.left,
                    minWidth: '260px',
                  }}
                >
                  {roleOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setRole(option.value)
                        setIsRoleDropdownOpen(false)
                      }}
                      className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-[#f3f4f6] dark:hover:bg-[#374151] transition-colors cursor-pointer ${
                        role === option.value ? 'bg-[#e6f0f5] dark:bg-[#1e3a4a]' : ''
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <option.icon className="text-[#0A2F44] dark:text-[#66a4c2]" />
                        <div>
                          <div className="text-sm font-medium text-[#02090d] dark:text-white">
                            {option.label}
                          </div>
                          <div className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
                            {option.description}
                          </div>
                        </div>
                      </div>
                      {role === option.value && (
                        <FiCheck className="text-[#0A2F44] dark:text-[#66a4c2]" />
                      )}
                    </button>
                  ))}
                </div>,
                document.body
              )}
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-[#e5e7eb] dark:border-[#374151] rounded-lg text-[#6b7280] dark:text-[#9ca3af] hover:bg-[#f3f4f6] dark:hover:bg-[#374151] cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isInviting}
            className="px-4 py-2 bg-[#0A2F44] text-white rounded-lg hover:bg-[#082636] transition-colors cursor-pointer disabled:opacity-50"
          >
            {isInviting ? 'Sending...' : 'Send Invite'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

const OrganisationTeam = () => {
  const { workspaceId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    currentWorkspace,
    members,
    loadMembers,
    inviteMember,
    removeMember,
    updateMemberRole,
    loading,
  } = useWorkspace()
  const { isDarkMode, toggleDarkMode } = useTheme()

  const userRole = currentWorkspace?.userRole
  const isOwner = userRole === ROLES.ORG_OWNER
  const isAdmin = userRole === ROLES.ORG_ADMIN
  const canManageMembers = isOwner || isAdmin

  const [showInviteModal, setShowInviteModal] = useState(false)
  const [isInviting, setIsInviting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')

  // Dropdown states
  const [openRoleMenu, setOpenRoleMenu] = useState(null)
  const [openActionMenu, setOpenActionMenu] = useState(null)
  const [teamActiveTab, setTeamActiveTab] = useState('members')
  const [pendingInvites, setPendingInvites] = useState([])
  const [failedInvites, setFailedInvites] = useState([])

  // Helper function for date formatting
  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  // Mock data for testing
  useEffect(() => {
    loadMembers(workspaceId)

    // Mock pending invites for testing
    setPendingInvites([
      {
        id: 'invite-1',
        email: 'sarah.pending@example.com',
        role: 'admin',
        invited_by: 'John Engineer',
        invited_at: new Date().toISOString(),
        status: 'pending',
      },
      {
        id: 'invite-2',
        email: 'mike.pending@example.com',
        role: 'editor',
        invited_by: 'John Engineer',
        invited_at: new Date(Date.now() - 86400000).toISOString(),
        status: 'pending',
      },
    ])

    // Mock failed invites for testing
    setFailedInvites([
      {
        id: 'failed-1',
        email: 'invalid@example.com',
        role: 'member',
        invited_by: 'John Engineer',
        invited_at: new Date(Date.now() - 172800000).toISOString(),
        error: 'Email delivery failed',
      },
    ])
  }, [workspaceId])

  const getRoleIcon = (role) => {
    switch (role) {
      case ROLES.ORG_OWNER:
        return <FiShield className="text-purple-500" />
      case ROLES.ORG_ADMIN:
        return <FiShield className="text-blue-500" />
      case ROLES.ORG_EDITOR:
        return <FiEdit2 className="text-green-500" />
      case ROLES.ORG_MEMBER:
        return <FiUser className="text-gray-500" />
      case ROLES.PROJECT_VIEWER:
        return <FiEye className="text-gray-400" />
      default:
        return <FiUser className="text-gray-500" />
    }
  }

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case ROLES.ORG_OWNER:
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
      case ROLES.ORG_ADMIN:
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
      case ROLES.ORG_EDITOR:
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      case ROLES.ORG_MEMBER:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
      case ROLES.PROJECT_VIEWER:
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
      default:
        return 'bg-gray-100 text-gray-500'
    }
  }

  const canChangeRole = (targetRole) => {
    if (isOwner) return targetRole !== ROLES.ORG_OWNER
    if (isAdmin)
      return (
        targetRole === ROLES.ORG_EDITOR ||
        targetRole === ROLES.ORG_MEMBER ||
        targetRole === ROLES.PROJECT_VIEWER
      )
    return false
  }

  const canRemoveMember = (targetRole) => {
    if (isOwner) return targetRole !== ROLES.ORG_OWNER
    if (isAdmin)
      return (
        targetRole === ROLES.ORG_EDITOR ||
        targetRole === ROLES.ORG_MEMBER ||
        targetRole === ROLES.PROJECT_VIEWER
      )
    return false
  }

  const handleInvite = async (email, role) => {
    setIsInviting(true)
    const result = await inviteMember(workspaceId, email, role)
    if (result.success) {
      setShowInviteModal(false)
      loadMembers(workspaceId)
    } else {
      alert(result.error || 'Failed to send invite')
    }
    setIsInviting(false)
  }

  const handleRemoveMember = async (memberId, memberName) => {
    if (window.confirm(`Are you sure you want to remove ${memberName} from this organization?`)) {
      await removeMember(workspaceId, memberId)
      loadMembers(workspaceId)
    }
    setOpenActionMenu(null)
  }

  const handleChangeRole = async (memberId, newRole) => {
    await updateMemberRole(workspaceId, memberId, newRole)
    loadMembers(workspaceId)
    setOpenRoleMenu(null)
  }

  const handleOpenRoleMenu = (memberId, event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setOpenRoleMenu({
      memberId,
      buttonRect: {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
      },
    })
  }

  const handleOpenActionMenu = (memberId, event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setOpenActionMenu({
      memberId,
      buttonRect: {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
      },
    })
  }

  const cancelPendingInvite = (inviteId) => {
    setPendingInvites((prev) => prev.filter((invite) => invite.id !== inviteId))
  }

  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      member.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = roleFilter === 'all' || member.role === roleFilter
    return matchesSearch && matchesRole
  })

  const roleFilterOptions = [
    { value: 'all', label: 'All Roles' },
    { value: ROLES.ORG_OWNER, label: 'Owner' },
    { value: ROLES.ORG_ADMIN, label: 'Admin' },
    { value: ROLES.ORG_EDITOR, label: 'Editor' },
    { value: ROLES.ORG_MEMBER, label: 'Member' },
    { value: ROLES.PROJECT_VIEWER, label: 'Viewer' },
  ]

  return (
    <div className="min-h-screen bg-[#f3f4f6] dark:bg-[#111827]">
      {/* Header */}
      <div className="bg-white dark:bg-[#1f2937] border-b border-[#e5e7eb] dark:border-[#374151] sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(`/workspace/${workspaceId}/settings`)}
                className="p-2 rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#374151] transition-colors cursor-pointer"
              >
                <FiArrowLeft className="text-xl text-[#6b7280] dark:text-[#9ca3af]" />
              </button>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[#0A2F44] to-[#2E7D32] rounded-xl flex items-center justify-center shadow-lg">
                  <FiUsers className="text-white text-xl" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-[#02090d] dark:text-white">Team Members</h1>
                  <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">
                    Manage your organization members and their roles
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
              {canManageMembers && (
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-[#0A2F44] text-white rounded-xl hover:bg-[#082636] transition-colors cursor-pointer"
                >
                  <FiUserPlus />
                  <span>Invite Member</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl p-6 border border-[#e5e7eb] dark:border-[#374151]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">Total Members</p>
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
                <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">Active</p>
                <p className="text-3xl font-bold text-[#02090d] dark:text-white">
                  {members.filter((m) => m.active !== false).length}
                </p>
              </div>
              <div className="w-12 h-12 bg-[#e6f0f5] dark:bg-[#1e3a4a] rounded-xl flex items-center justify-center">
                <FiUserCheck className="text-xl text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl p-6 border border-[#e5e7eb] dark:border-[#374151]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">Pending Invites</p>
                <p className="text-3xl font-bold text-[#02090d] dark:text-white">
                  {pendingInvites.length}
                </p>
              </div>
              <div className="w-12 h-12 bg-[#e6f0f5] dark:bg-[#1e3a4a] rounded-xl flex items-center justify-center">
                <FiMail className="text-xl text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl p-6 border border-[#e5e7eb] dark:border-[#374151]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">Your Role</p>
                <p className="text-2xl font-bold text-[#02090d] dark:text-white capitalize">
                  {userRole || 'member'}
                </p>
              </div>
              <div className="w-12 h-12 bg-[#e6f0f5] dark:bg-[#1e3a4a] rounded-xl flex items-center justify-center">
                {getRoleIcon(userRole)}
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl border border-[#e5e7eb] dark:border-[#374151] p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#9ca3af] dark:text-[#6b7280]" />
              <input
                type="text"
                placeholder="Search members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A2F44]"
              />
            </div>

            <div className="relative">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-4 py-2 rounded-xl border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A2F44] cursor-pointer"
              >
                {roleFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-[#e5e7eb] dark:border-[#374151] mb-6">
          <div className="flex space-x-6">
            <button
              onClick={() => setTeamActiveTab('members')}
              className={`pb-3 px-2 text-sm font-medium transition-colors ${
                teamActiveTab === 'members'
                  ? 'text-[#0A2F44] dark:text-[#66a4c2] border-b-2 border-[#0A2F44] dark:border-[#66a4c2]'
                  : 'text-[#6b7280] dark:text-[#9ca3af] hover:text-[#0A2F44] dark:hover:text-[#66a4c2]'
              }`}
            >
              Members ({members.length})
            </button>
            <button
              onClick={() => setTeamActiveTab('pending')}
              className={`pb-3 px-2 text-sm font-medium transition-colors ${
                teamActiveTab === 'pending'
                  ? 'text-[#0A2F44] dark:text-[#66a4c2] border-b-2 border-[#0A2F44] dark:border-[#66a4c2]'
                  : 'text-[#6b7280] dark:text-[#9ca3af] hover:text-[#0A2F44] dark:hover:text-[#66a4c2]'
              }`}
            >
              Pending Invites ({pendingInvites.length})
            </button>
            <button
              onClick={() => setTeamActiveTab('failed')}
              className={`pb-3 px-2 text-sm font-medium transition-colors ${
                teamActiveTab === 'failed'
                  ? 'text-[#0A2F44] dark:text-[#66a4c2] border-b-2 border-[#0A2F44] dark:border-[#66a4c2]'
                  : 'text-[#6b7280] dark:text-[#9ca3af] hover:text-[#0A2F44] dark:hover:text-[#66a4c2]'
              }`}
            >
              Failed Invites ({failedInvites.length})
            </button>
          </div>
        </div>

        {/* Members Tab Content */}
        {teamActiveTab === 'members' && (
          <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl border border-[#e5e7eb] dark:border-[#374151] overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-[#f9fafb] dark:bg-[#374151] border-b border-[#e5e7eb] dark:border-[#4b5563]">
                <tr>
                  <th className="text-left px-6 py-4 text-xs font-medium text-[#6b7280] dark:text-[#9ca3af] uppercase">
                    Member
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-[#6b7280] dark:text-[#9ca3af] uppercase">
                    Role
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-[#6b7280] dark:text-[#9ca3af] uppercase">
                    Joined
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-[#6b7280] dark:text-[#9ca3af] uppercase">
                    Status
                  </th>
                  <th className="text-right px-6 py-4 text-xs font-medium text-[#6b7280] dark:text-[#9ca3af] uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e7eb] dark:divide-[#374151]">
                {filteredMembers.map((member) => (
                  <tr
                    key={member.id}
                    className="hover:bg-[#f9fafb] dark:hover:bg-[#374151] transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#0A2F44] to-[#2E7D32] rounded-full flex items-center justify-center text-white font-medium shadow-md">
                          {member.name?.charAt(0) || member.email?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-[#02090d] dark:text-white">
                            {member.name || 'User'}
                          </p>
                          <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">
                            {member.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {getRoleIcon(member.role)}
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${getRoleBadgeClass(member.role)}`}
                        >
                          {member.role}
                        </span>
                        {canChangeRole(member.role) && (
                          <button
                            onClick={(e) => handleOpenRoleMenu(member.id, e)}
                            className="p-1 hover:bg-[#f3f4f6] dark:hover:bg-[#374151] rounded transition-colors cursor-pointer"
                          >
                            <FiEdit2 className="text-xs text-[#6b7280] dark:text-[#9ca3af]" />
                          </button>
                        )}
                      </div>

                      <RoleDropdownMenu
                        isOpen={openRoleMenu?.memberId === member.id}
                        onClose={() => setOpenRoleMenu(null)}
                        onSelect={(newRole) => handleChangeRole(member.user_id, newRole)}
                        currentRole={member.role}
                        buttonRect={openRoleMenu?.buttonRect}
                      />
                    </td>
                    <td className="px-6 py-4 text-sm text-[#6b7280] dark:text-[#9ca3af]">
                      {new Date(member.joined_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-1">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        <span className="text-sm text-[#6b7280] dark:text-[#9ca3af]">Active</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {canRemoveMember(member.role) && (
                        <div>
                          <button
                            onClick={(e) => handleOpenActionMenu(member.id, e)}
                            className="p-2 hover:bg-[#f3f4f6] dark:hover:bg-[#374151] rounded-lg transition-colors cursor-pointer"
                          >
                            <FiMoreVertical className="text-[#6b7280] dark:text-[#9ca3af]" />
                          </button>

                          <ActionMenu
                            isOpen={openActionMenu?.memberId === member.id}
                            onClose={() => setOpenActionMenu(null)}
                            onRemove={() => handleRemoveMember(member.user_id, member.name)}
                            buttonRect={openActionMenu?.buttonRect}
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredMembers.length === 0 && (
              <div className="text-center py-12">
                <FiUsers className="text-5xl text-[#9ca3af] dark:text-[#6b7280] mx-auto mb-4" />
                <p className="text-[#6b7280] dark:text-[#9ca3af]">No members found</p>
              </div>
            )}
          </div>
        )}

        {/* Pending Invites Tab Content */}
        {teamActiveTab === 'pending' && (
          <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl border border-[#e5e7eb] dark:border-[#374151] overflow-hidden">
            {pendingInvites.length === 0 ? (
              <div className="text-center py-12">
                <FiMail className="text-5xl text-[#9ca3af] dark:text-[#6b7280] mx-auto mb-4" />
                <p className="text-[#6b7280] dark:text-[#9ca3af]">No pending invites</p>
                <p className="text-sm text-[#9ca3af] dark:text-[#6b7280] mt-1">
                  Invited members will appear here
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#e5e7eb] dark:divide-[#374151]">
                {pendingInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="p-4 flex items-center justify-between hover:bg-[#f9fafb] dark:hover:bg-[#374151] transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
                        <FiClock className="text-yellow-600 dark:text-yellow-400" />
                      </div>
                      <div>
                        <p className="font-medium text-[#02090d] dark:text-white">{invite.email}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                              invite.role === 'admin'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                : invite.role === 'editor'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                            }`}
                          >
                            {invite.role}
                          </span>
                          <span className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
                            Invited by {invite.invited_by} • {formatDate(invite.invited_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          if (window.confirm(`Cancel invite for ${invite.email}?`)) {
                            cancelPendingInvite(invite.id)
                          }
                        }}
                        className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer flex items-center space-x-1"
                      >
                        <FiXCircle />
                        <span>Cancel</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Failed Invites Tab Content */}
        {teamActiveTab === 'failed' && (
          <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl border border-[#e5e7eb] dark:border-[#374151] overflow-hidden">
            {failedInvites.length === 0 ? (
              <div className="text-center py-12">
                <FiAlertCircle className="text-5xl text-[#9ca3af] dark:text-[#6b7280] mx-auto mb-4" />
                <p className="text-[#6b7280] dark:text-[#9ca3af]">No failed invites</p>
              </div>
            ) : (
              <div className="divide-y divide-[#e5e7eb] dark:divide-[#374151]">
                {failedInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="p-4 flex items-center justify-between hover:bg-[#f9fafb] dark:hover:bg-[#374151] transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                        <FiAlertCircle className="text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <p className="font-medium text-[#02090d] dark:text-white">{invite.email}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                              invite.role === 'admin'
                                ? 'bg-blue-100 text-blue-700'
                                : invite.role === 'editor'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {invite.role}
                          </span>
                          <span className="text-xs text-red-600 dark:text-red-400">
                            {invite.error}
                          </span>
                        </div>
                        <p className="text-xs text-[#6b7280] dark:text-[#9ca3af] mt-1">
                          Invited by {invite.invited_by} • {formatDate(invite.invited_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={async () => {
                          await inviteMember(workspaceId, invite.email, invite.role)
                          setFailedInvites((prev) => prev.filter((f) => f.id !== invite.id))
                        }}
                        className="px-3 py-1.5 text-sm bg-[#0A2F44] text-white rounded-lg hover:bg-[#082636] transition-colors cursor-pointer"
                      >
                        Resend Invite
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      <InviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInvite={handleInvite}
        isInviting={isInviting}
      />
    </div>
  )
}

export default OrganisationTeam
