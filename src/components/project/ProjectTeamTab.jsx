// src/components/project/ProjectTeamTab.jsx
import React, { useState, useEffect, useRef } from 'react'
import {
  FiUsers,
  FiUserPlus,
  FiMail,
  FiX,
  FiCheck,
  FiMoreVertical,
  FiSearch,
  FiShield,
  FiUser,
  FiEye,
  FiTrash2,
  FiEdit2,
  FiChevronDown,
  FiClock,
  FiAlertCircle,
  FiUserCheck,
  FiSend,
} from 'react-icons/fi'
import { useAuth } from '../../contexts/AuthContext'
import { useWorkspace, ROLES } from '../../contexts/WorkspaceContext'

// Custom Role Dropdown for Project Team
const ProjectRoleDropdown = ({ value, onChange, disabled }) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const roleOptions = [
    {
      value: ROLES.PROJECT_ADMIN,
      label: 'Admin',
      icon: FiShield,
      description: 'Can manage members and settings',
    },
    {
      value: ROLES.PROJECT_EDITOR,
      label: 'Editor',
      icon: FiEdit2,
      description: 'Can create and edit designs',
    },
    { value: ROLES.PROJECT_VIEWER, label: 'Viewer', icon: FiEye, description: 'Read-only access' },
  ]

  const selectedOption = roleOptions.find((opt) => opt.value === value)

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-[#0A2F44]'
        } border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white`}
      >
        {selectedOption?.icon && <selectedOption.icon className="text-sm" />}
        <span>{selectedOption?.label}</span>
        {!disabled && (
          <FiChevronDown className={`text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-20 mt-1 w-48 bg-white dark:bg-[#1f2937] border border-[#e5e7eb] dark:border-[#374151] rounded-lg shadow-xl overflow-hidden">
          {roleOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value)
                setIsOpen(false)
              }}
              className={`w-full px-4 py-2 text-left flex items-center space-x-3 hover:bg-[#f3f4f6] dark:hover:bg-[#374151] transition-colors ${
                value === option.value ? 'bg-[#e6f0f5] dark:bg-[#1e3a4a]' : ''
              }`}
            >
              <option.icon className="text-[#0A2F44]" />
              <div>
                <p className="text-sm font-medium text-[#02090d] dark:text-white">{option.label}</p>
                <p className="text-xs text-[#6b7280]">{option.description}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const ProjectTeamTab = ({ projectId }) => {
  const { user } = useAuth()
  const { members: orgMembers, currentProject } = useWorkspace()
  const [projectMembers, setProjectMembers] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState(ROLES.PROJECT_EDITOR)
  const [isInviting, setIsInviting] = useState(false)
  const [showActionMenu, setShowActionMenu] = useState(null)
  const [pendingInvites, setPendingInvites] = useState([])

  // Get current user's project role from currentProject
  const currentUserRole = currentProject?.userRole
  const isProjectOwner = currentUserRole === ROLES.PROJECT_OWNER
  const isProjectAdmin = currentUserRole === ROLES.PROJECT_ADMIN
  const canManageMembers = isProjectOwner || isProjectAdmin

  // Build project members from organization members
  useEffect(() => {
    if (orgMembers.length > 0) {
      // Map organization members to project members
      // For now, all org members are project members (you can filter later)
      const mappedMembers = orgMembers.map((m) => ({
        id: m.id,
        user_id: m.user_id,
        name: m.name,
        email: m.email,
        // For project role, use the user's org role as base, but project owner overrides
        role:
          m.user_id === currentProject?.user_id
            ? ROLES.PROJECT_OWNER
            : m.role === ROLES.ORG_ADMIN
              ? ROLES.PROJECT_ADMIN
              : m.role === ROLES.ORG_EDITOR
                ? ROLES.PROJECT_EDITOR
                : ROLES.PROJECT_VIEWER,
        avatar: m.name?.charAt(0) || 'U',
        joined_at: m.joined_at,
        active: m.active !== false,
      }))
      setProjectMembers(mappedMembers)
    }
  }, [orgMembers, currentProject])

  const canChangeRole = (targetRole) => {
    if (isProjectOwner) return targetRole !== ROLES.PROJECT_OWNER
    if (isProjectAdmin)
      return targetRole === ROLES.PROJECT_EDITOR || targetRole === ROLES.PROJECT_VIEWER
    return false
  }

  const canRemoveMember = (targetUserId, targetRole) => {
    if (targetUserId === user?.id) return false
    if (isProjectOwner) return targetRole !== ROLES.PROJECT_OWNER
    if (isProjectAdmin)
      return targetRole === ROLES.PROJECT_EDITOR || targetRole === ROLES.PROJECT_VIEWER
    return false
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      alert('Please enter an email address')
      return
    }
    setIsInviting(true)
    setTimeout(() => {
      const newInvite = {
        id: `invite-${Date.now()}`,
        email: inviteEmail,
        role: inviteRole,
        invited_by: user?.name,
        invited_at: new Date().toISOString(),
      }
      setPendingInvites([...pendingInvites, newInvite])
      setShowInviteModal(false)
      setInviteEmail('')
      setInviteRole(ROLES.PROJECT_EDITOR)
      alert('Invitation sent!')
      setIsInviting(false)
    }, 1000)
  }

  const handleChangeRole = (memberId, newRole) => {
    setProjectMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)))
    setShowActionMenu(null)
  }

  const handleRemoveMember = (memberId, memberName) => {
    if (window.confirm(`Remove ${memberName} from this project?`)) {
      setProjectMembers((prev) => prev.filter((m) => m.id !== memberId))
      setShowActionMenu(null)
    }
  }

  const cancelInvite = (inviteId) => {
    setPendingInvites((prev) => prev.filter((i) => i.id !== inviteId))
  }

  const filteredMembers = projectMembers.filter(
    (member) =>
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getRoleIcon = (role) => {
    switch (role) {
      case ROLES.PROJECT_OWNER:
        return <FiShield className="text-purple-500" />
      case ROLES.PROJECT_ADMIN:
        return <FiShield className="text-blue-500" />
      case ROLES.PROJECT_EDITOR:
        return <FiEdit2 className="text-green-500" />
      case ROLES.PROJECT_VIEWER:
        return <FiEye className="text-gray-500" />
      default:
        return <FiUser className="text-gray-500" />
    }
  }

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case ROLES.PROJECT_OWNER:
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
      case ROLES.PROJECT_ADMIN:
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
      case ROLES.PROJECT_EDITOR:
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      case ROLES.PROJECT_VIEWER:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
      default:
        return 'bg-gray-100 text-gray-500'
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    return `${diffDays} days ago`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#02090d] dark:text-white">Project Team</h2>
          <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">
            Manage team members and their roles in this project
          </p>
        </div>
        {canManageMembers && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-[#0A2F44] text-white rounded-lg hover:bg-[#082636] transition-colors"
          >
            <FiUserPlus />
            <span>Invite Member</span>
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-lg p-4 border border-[#e5e7eb] dark:border-[#374151]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[#6b7280]">Total Members</p>
              <p className="text-2xl font-bold text-[#02090d] dark:text-white">
                {projectMembers.length}
              </p>
            </div>
            <FiUsers className="text-2xl text-[#0A2F44]" />
          </div>
        </div>
        <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-lg p-4 border border-[#e5e7eb] dark:border-[#374151]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[#6b7280]">Active</p>
              <p className="text-2xl font-bold text-[#02090d] dark:text-white">
                {projectMembers.filter((m) => m.active).length}
              </p>
            </div>
            <FiUserCheck className="text-2xl text-green-500" />
          </div>
        </div>
        <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-lg p-4 border border-[#e5e7eb] dark:border-[#374151]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[#6b7280]">Pending Invites</p>
              <p className="text-2xl font-bold text-[#02090d] dark:text-white">
                {pendingInvites.length}
              </p>
            </div>
            <FiMail className="text-2xl text-yellow-500" />
          </div>
        </div>
        <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-lg p-4 border border-[#e5e7eb] dark:border-[#374151]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[#6b7280]">Your Role</p>
              <p className="text-md font-semibold text-[#02090d] dark:text-white capitalize">
                {currentUserRole?.replace('project_', '') || 'Member'}
              </p>
            </div>
            {getRoleIcon(currentUserRole)}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#9ca3af]" />
        <input
          type="text"
          placeholder="Search members..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-xl border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A2F44]"
        />
      </div>

      {/* Members List */}
      <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-lg border border-[#e5e7eb] dark:border-[#374151] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#f9fafb] dark:bg-[#374151] border-b border-[#e5e7eb] dark:border-[#4b5563]">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-[#6b7280] uppercase">
                  Member
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-[#6b7280] uppercase">
                  Role
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-[#6b7280] uppercase">
                  Joined
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-[#6b7280] uppercase">
                  Status
                </th>
                <th className="text-right px-6 py-3 text-xs font-medium text-[#6b7280] uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e7eb] dark:divide-[#374151]">
              {filteredMembers.map((member) => (
                <tr
                  key={member.id}
                  className="hover:bg-[#f9fafb] dark:hover:bg-[#374151] transition-colors"
                >
                  <td className="px-6 py-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-[#0A2F44] to-[#2E7D32] rounded-full flex items-center justify-center text-white text-sm font-medium">
                        {member.avatar}
                      </div>
                      <div>
                        <p className="font-medium text-[#02090d] dark:text-white">{member.name}</p>
                        <p className="text-xs text-[#6b7280]">{member.email}</p>
                        {member.user_id === user?.id && (
                          <span className="text-xs text-[#0A2F44]">(You)</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center space-x-2">
                      {getRoleIcon(member.role)}
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getRoleBadgeClass(member.role)}`}
                      >
                        {member.role?.replace('project_', '')}
                      </span>
                      {canChangeRole(member.role) && member.user_id !== user?.id && (
                        <ProjectRoleDropdown
                          value={member.role}
                          onChange={(newRole) => handleChangeRole(member.id, newRole)}
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3 text-sm text-[#6b7280]">
                    {formatDate(member.joined_at)}
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center space-x-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      <span className="text-sm text-[#6b7280]">Active</span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right">
                    {canRemoveMember(member.user_id, member.role) && (
                      <div className="relative">
                        <button
                          onClick={() =>
                            setShowActionMenu(showActionMenu === member.id ? null : member.id)
                          }
                          className="p-1 hover:bg-[#f3f4f6] dark:hover:bg-[#374151] rounded transition-colors"
                        >
                          <FiMoreVertical className="text-[#6b7280]" />
                        </button>
                        {showActionMenu === member.id && (
                          <div className="absolute right-0 z-10 mt-1 w-36 bg-white dark:bg-[#1f2937] border border-[#e5e7eb] dark:border-[#374151] rounded-lg shadow-xl overflow-hidden">
                            <button
                              onClick={() => handleRemoveMember(member.id, member.name)}
                              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-2"
                            >
                              <FiTrash2 />
                              <span>Remove</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredMembers.length === 0 && (
            <div className="text-center py-8">
              <FiUsers className="text-4xl text-[#9ca3af] mx-auto mb-2" />
              <p className="text-[#6b7280]">No members found</p>
            </div>
          )}
        </div>
      </div>

      {/* Pending Invites Section */}
      {pendingInvites.length > 0 && canManageMembers && (
        <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-lg border border-[#e5e7eb] dark:border-[#374151] overflow-hidden">
          <div className="p-4 border-b border-[#e5e7eb] dark:border-[#374151]">
            <h3 className="font-semibold text-[#02090d] dark:text-white">Pending Invites</h3>
            <p className="text-xs text-[#6b7280]">Invitations waiting to be accepted</p>
          </div>
          <div className="divide-y divide-[#e5e7eb] dark:divide-[#374151]">
            {pendingInvites.map((invite) => (
              <div key={invite.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
                    <FiMail className="text-yellow-600" />
                  </div>
                  <div>
                    <p className="font-medium text-[#02090d] dark:text-white">{invite.email}</p>
                    <p className="text-xs text-[#6b7280]">
                      Invited as {invite.role?.replace('project_', '')} •{' '}
                      {formatDate(invite.invited_at)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => cancelInvite(invite.id)}
                  className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <FiX />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#02090d] dark:text-white">
                Invite to Project
              </h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-[#6b7280] hover:text-[#0A2F44]"
              >
                <FiX />
              </button>
            </div>
            <div className="space-y-4">
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#9ca3af]" />
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A2F44]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] dark:text-[#d1d5db] mb-2">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A2F44]"
                >
                  <option value={ROLES.PROJECT_ADMIN}>
                    Admin - Can manage members and settings
                  </option>
                  <option value={ROLES.PROJECT_EDITOR}>Editor - Can create and edit designs</option>
                  <option value={ROLES.PROJECT_VIEWER}>Viewer - Read-only access</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 border rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={isInviting}
                className="px-4 py-2 bg-[#0A2F44] text-white rounded-lg hover:bg-[#082636] disabled:opacity-50"
              >
                {isInviting ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProjectTeamTab
