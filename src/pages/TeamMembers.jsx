import React, { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  FiUsers,
  FiPlus,
  FiMail,
  FiUserPlus,
  FiShield,
  FiTrash2,
  FiEdit2,
  FiMoreVertical,
} from 'react-icons/fi'
import { useWorkspace } from '../contexts/WorkspaceContext'

const TeamMembers = () => {
  const { workspaceId } = useParams()
  const { members, loading, loadMembers, inviteMember, removeMember, updateMemberRole } =
    useWorkspace()
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    loadMembers(workspaceId)
  }, [workspaceId])

  const handleInvite = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    await inviteMember(workspaceId, inviteEmail, inviteRole)
    setShowInviteModal(false)
    setInviteEmail('')
    setInviteRole('member')
    setIsSubmitting(false)
  }

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-100 text-purple-700'
      case 'admin':
        return 'bg-blue-100 text-blue-700'
      case 'member':
        return 'bg-green-100 text-green-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#0A2F44] rounded-lg flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-white text-2xl font-bold">SA</span>
          </div>
          <p className="text-[#6b7280]">Loading team members...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] dark:bg-[#111827]">
      {/* Header */}
      <div className="bg-white dark:bg-[#1f2937] border-b border-[#e5e7eb] dark:border-[#374151]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#02090d] dark:text-white">Team Members</h1>
              <p className="text-sm text-[#6b7280] dark:text-[#9ca3af] mt-1">
                Manage who has access to this workspace
              </p>
            </div>
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center space-x-2 bg-[#0A2F44] text-white px-4 py-2 rounded-lg hover:bg-[#082636] transition-colors"
            >
              <FiUserPlus />
              <span>Invite Member</span>
            </button>
          </div>
        </div>
      </div>

      {/* Members List */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-lg border border-[#e5e7eb] dark:border-[#374151] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#f9fafb] dark:bg-[#374151] border-b border-[#e5e7eb] dark:border-[#4b5563]">
                <tr>
                  <th className="text-left px-6 py-4 text-xs font-medium text-[#6b7280] dark:text-[#9ca3af] uppercase tracking-wider">
                    Member
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-[#6b7280] dark:text-[#9ca3af] uppercase tracking-wider">
                    Role
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-[#6b7280] dark:text-[#9ca3af] uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-[#6b7280] dark:text-[#9ca3af] uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right px-6 py-4 text-xs font-medium text-[#6b7280] dark:text-[#9ca3af] uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e7eb] dark:divide-[#374151]">
                {members.map((member) => (
                  <tr
                    key={member.id}
                    className="hover:bg-[#f9fafb] dark:hover:bg-[#374151] transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-[#e6f0f5] dark:bg-[#1e3a4a] rounded-full flex items-center justify-center">
                          <span className="text-[#0A2F44] dark:text-[#cce1eb] font-semibold">
                            {member.name?.charAt(0) || 'U'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-[#02090d] dark:text-white">
                            {member.name}
                          </p>
                          <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">
                            {member.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(member.role)}`}
                      >
                        {member.role === 'owner' && <FiShield className="mr-1" />}
                        {member.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#6b7280] dark:text-[#9ca3af]">
                      {new Date(member.joined_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center">
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                        <span className="text-sm text-[#6b7280]">Active</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {member.role !== 'owner' && (
                        <div className="flex items-center justify-end space-x-2">
                          <button className="p-1 hover:bg-[#f3f4f6] dark:hover:bg-[#374151] rounded transition-colors">
                            <FiEdit2 className="text-[#6b7280]" />
                          </button>
                          <button className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
                            <FiTrash2 className="text-red-500" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Invite Link Section */}
        <div className="mt-8 bg-white dark:bg-[#1f2937] rounded-xl shadow-lg p-6 border border-[#e5e7eb] dark:border-[#374151]">
          <h3 className="text-lg font-semibold text-[#02090d] dark:text-white mb-4">
            Share Invite Link
          </h3>
          <p className="text-sm text-[#6b7280] dark:text-[#9ca3af] mb-4">
            Anyone with this link can join this workspace
          </p>
          <div className="flex space-x-2">
            <input
              type="text"
              value={`https://structai.com/join/${workspaceId}`}
              readOnly
              className="flex-1 px-4 py-2 rounded-lg border border-[#e5e7eb] dark:border-[#374151] bg-[#f9fafb] dark:bg-[#374151] text-[#02090d] dark:text-white"
            />
            <button className="px-4 py-2 bg-[#0A2F44] text-white rounded-lg hover:bg-[#082636] transition-colors">
              Copy Link
            </button>
          </div>
        </div>
      </div>

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-[#02090d] dark:text-white mb-4">
              Invite Team Member
            </h3>
            <form onSubmit={handleInvite}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#374151] dark:text-[#d1d5db] mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@company.com"
                    className="w-full px-4 py-2 rounded-lg border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#374151] dark:text-[#d1d5db] mb-2">
                    Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 border border-[#e5e7eb] dark:border-[#374151] rounded-lg text-[#6b7280] hover:bg-[#f3f4f6] dark:hover:bg-[#374151] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#0A2F44] text-white rounded-lg hover:bg-[#082636] transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Sending...' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default TeamMembers
