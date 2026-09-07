import React, { useState, useEffect, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  FiArrowLeft,
  FiSave,
  FiTrash2,
  FiAlertCircle,
  FiImage,
  FiGlobe,
  FiBell,
  FiShield,
  FiUsers,
  FiSettings,
  FiBarChart2,
  FiActivity,
  FiLock,
  FiMail,
  FiUserPlus,
  FiMoreVertical,
  FiEdit2,
  FiCheckCircle,
  FiX,
  FiChevronDown,
  FiSearch,
  FiFilter,
  FiDownload,
  FiShare2,
  FiClock,
  FiCalendar,
  FiTrendingUp,
  FiDollarSign,
  FiPackage,
  FiLink,
  FiSun,
  FiMoon,
  FiEye,
  FiBriefcase,
  FiArrowRight,
  FiUser,
} from 'react-icons/fi'
import { useTheme } from '../contexts/ThemeContext'
import { useWorkspace, ROLES } from '../contexts/WorkspaceContext'
import { useAuth } from '../contexts/AuthContext'

// Custom Dropdown Component
const CustomDropdown = ({ label, name, value, options, onChange, icon: Icon }) => {
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

  return (
    <div className="relative" ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-[#374151] dark:text-[#d1d5db] mb-2">
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 rounded-xl border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white flex items-center justify-between hover:border-[#0A2F44] transition-colors focus:outline-none focus:ring-2 focus:ring-[#0A2F44] cursor-pointer"
      >
        <div className="flex items-center space-x-3">
          {Icon && <Icon className="text-[#0A2F44] dark:text-[#66a4c2]" />}
          <span>{options.find((opt) => opt.value === value)?.label || value}</span>
        </div>
        <FiChevronDown
          className={`text-[#6b7280] dark:text-[#9ca3af] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-[9999] w-full mt-1 bg-white dark:bg-[#1f2937] border border-[#e5e7eb] dark:border-[#374151] rounded-xl shadow-xl overflow-hidden">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange({ target: { name, value: option.value } })
                setIsOpen(false)
              }}
              className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-[#f3f4f6] dark:hover:bg-[#374151] transition-colors cursor-pointer ${
                value === option.value
                  ? 'bg-[#e6f0f5] dark:bg-[#1e3a4a] text-[#0A2F44]'
                  : 'text-[#02090d] dark:text-white'
              }`}
            >
              <div className="flex items-center space-x-3">
                {option.icon && <option.icon className="text-[#0A2F44] dark:text-[#66a4c2]" />}
                <div>
                  <div className="text-sm font-medium">{option.label}</div>
                  {option.description && (
                    <div className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
                      {option.description}
                    </div>
                  )}
                </div>
              </div>
              {value === option.value && (
                <FiCheckCircle className="text-[#0A2F44] dark:text-[#66a4c2]" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Role Dropdown Component for Member Management
const RoleDropdown = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false)

  const roleOptions = [
    { value: 'member', label: 'Member', icon: FiUsers, description: 'Can view and create designs' },
    {
      value: 'admin',
      label: 'Admin',
      icon: FiShield,
      description: 'Can manage members and settings',
    },
    { value: 'viewer', label: 'Viewer', icon: FiEye, description: 'Read-only access' },
  ]

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 rounded-xl border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white flex items-center justify-between hover:border-[#0A2F44] transition-colors focus:outline-none focus:ring-2 focus:ring-[#0A2F44] cursor-pointer"
      >
        <div className="flex items-center space-x-2">
          {value === 'member' && <FiUsers className="text-[#0A2F44]" />}
          {value === 'admin' && <FiShield className="text-[#0A2F44]" />}
          {value === 'viewer' && <FiEye className="text-[#0A2F44]" />}
          <span>{value === 'member' ? 'Member' : value === 'admin' ? 'Admin' : 'Viewer'}</span>
        </div>
        <FiChevronDown
          className={`text-[#6b7280] dark:text-[#9ca3af] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-20 w-full mt-1 bg-white dark:bg-[#1f2937] border border-[#e5e7eb] dark:border-[#374151] rounded-xl shadow-xl overflow-hidden animate-fade-in">
          {roleOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value)
                setIsOpen(false)
              }}
              className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-[#f3f4f6] dark:hover:bg-[#374151] transition-colors cursor-pointer ${
                value === option.value ? 'bg-[#e6f0f5] dark:bg-[#1e3a4a]' : ''
              }`}
            >
              <div className="flex items-center space-x-3">
                <option.icon className="text-[#0A2F44]" />
                <div>
                  <div className="text-sm font-medium text-[#02090d] dark:text-white">
                    {option.label}
                  </div>
                  <div className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
                    {option.description}
                  </div>
                </div>
              </div>
              {value === option.value && <FiCheckCircle className="text-[#0A2F44]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const WorkspaceSettings = () => {
  const { workspaceId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    currentWorkspace,
    updateWorkspace,
    deleteOrganization, // Changed from deleteWorkspace
    members,
    loadMembers,
    inviteMember,
    transferOwnership,
    projects, // Add projects to check count
  } = useWorkspace()
  const { isDarkMode, toggleDarkMode } = useTheme()

  const userRole = currentWorkspace?.userRole
  const isOwner = userRole === ROLES.ORG_OWNER
  const isAdmin = userRole === ROLES.ORG_ADMIN

  const [activeTab, setActiveTab] = useState('general')
  const [isSaving, setIsSaving] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [isInviting, setIsInviting] = useState(false)
  const [isTransferring, setIsTransferring] = useState(false)
  const [selectedNewOwner, setSelectedNewOwner] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [isRoleFilterOpen, setIsRoleFilterOpen] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    website: '',
    industry: 'engineering',
    size: '1-10',
    logo: null,
    logoPreview: null,
    defaultProjectType: 'commercial',
    defaultDesignStandard: 'Eurocode',
  })

  const projectTypeOptions = [
    {
      value: 'commercial',
      label: 'Commercial',
      description: 'Office buildings, retail spaces, shopping centres',
    },
    {
      value: 'residential',
      label: 'Residential',
      description: 'Houses, apartments, housing developments',
    },
    {
      value: 'industrial',
      label: 'Industrial',
      description: 'Warehouses, factories, logistics centres',
    },
    {
      value: 'infrastructure',
      label: 'Infrastructure',
      description: 'Bridges, roads, public works',
    },
  ]

  const designStandardOptions = [
    { value: 'Eurocode', label: 'Eurocode', description: 'European design standards' },
    { value: 'BS', label: 'British Standards', description: 'UK design standards' },
    { value: 'ACI', label: 'ACI', description: 'American Concrete Institute' },
    { value: 'AS', label: 'Australian Standards', description: 'Australian design standards' },
  ]

  const industryOptions = [
    {
      value: 'engineering',
      label: 'Engineering & Construction',
      description: 'Structural and civil engineering firms',
    },
    {
      value: 'architecture',
      label: 'Architecture & Design',
      description: 'Architectural and design practices',
    },
    { value: 'consulting', label: 'Consulting', description: 'Engineering consulting firms' },
    {
      value: 'education',
      label: 'Education',
      description: 'Universities and educational institutions',
    },
    { value: 'other', label: 'Other', description: 'Other industries' },
  ]

  const roleFilterOptions = [
    { value: 'all', label: 'All Roles', description: 'Show all members' },
    { value: 'owner', label: 'Owner', description: 'Workspace owners' },
    { value: 'admin', label: 'Admin', description: 'Administrators' },
    { value: 'member', label: 'Member', description: 'Regular members' },
    { value: 'viewer', label: 'Viewer', description: 'Read-only members' },
  ]

  const analytics = {
    totalProjects: 24,
    activeMembers: members.filter((m) => m.active).length || 8,
    storageUsed: '2.4 GB',
    lastActive: '2 hours ago',
    monthlyActivity: [12, 19, 15, 22, 18, 25, 21],
    topContributors: [
      { name: 'John Engineer', contributions: 47, avatar: 'JE', role: 'Lead Engineer' },
      { name: 'Sarah Designer', contributions: 32, avatar: 'SD', role: 'Structural Designer' },
      { name: 'Mike Analyst', contributions: 28, avatar: 'MA', role: 'Project Analyst' },
    ],
  }

  useEffect(() => {
    if (currentWorkspace) {
      setFormData((prev) => ({
        ...prev,
        name: currentWorkspace.name || '',
        description: currentWorkspace.description || '',
        website: currentWorkspace.website || '',
        industry: currentWorkspace.industry || 'engineering',
        size: currentWorkspace.size || '1-10',
        logoPreview: currentWorkspace.logo_url,
      }))
    }
    loadMembers(workspaceId)
  }, [currentWorkspace])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleLogoChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setFormData((prev) => ({ ...prev, logo: file, logoPreview: URL.createObjectURL(file) }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    const formDataToSend = new FormData()
    Object.keys(formData).forEach((key) => {
      if (key !== 'logo' && key !== 'logoPreview') {
        formDataToSend.append(key, JSON.stringify(formData[key]))
      }
    })
    if (formData.logo) {
      formDataToSend.append('logo', formData.logo)
    }
    await updateWorkspace(workspaceId, formDataToSend)
    setIsSaving(false)
  }

  const confirmDeleteOrganization = async () => {
    if (projects.length > 0) {
      alert(`Cannot delete workspace. Please delete or move ${projects.length} project(s) first.`)
      return
    }

    setIsDeleting(true)
    const result = await deleteOrganization(workspaceId)
    setIsDeleting(false)

    if (result.success) {
      setShowDeleteModal(false)
      navigate('/dashboard')
    } else {
      alert(result.error || 'Failed to delete workspace')
    }
  }

  const handleTransferOwnership = () => {
    setSelectedNewOwner('')
    setShowTransferModal(true)
  }

  const confirmTransferOwnership = async () => {
    if (!selectedNewOwner) {
      alert('Please select a member to transfer ownership to')
      return
    }

    setIsTransferring(true)
    const result = await transferOwnership(workspaceId, selectedNewOwner)

    if (result.success) {
      setShowTransferModal(false)
      window.location.reload()
    } else {
      alert(result.error || 'Failed to transfer ownership')
    }
    setIsTransferring(false)
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      alert('Please enter an email address')
      return
    }
    setIsInviting(true)
    const result = await inviteMember(workspaceId, inviteEmail, inviteRole)
    if (result.success) {
      setShowInviteModal(false)
      setInviteEmail('')
      setInviteRole('member')
      loadMembers(workspaceId)
    } else {
      alert(result.error || 'Failed to send invite')
    }
    setIsInviting(false)
  }

  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      member.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = roleFilter === 'all' || member.role === roleFilter
    return matchesSearch && matchesRole
  })

  const tabs = [
    { id: 'general', label: 'General', icon: FiSettings },
    { id: 'members', label: 'Members', icon: FiUsers, badge: members.length },
    { id: 'analytics', label: 'Analytics', icon: FiBarChart2 },
    { id: 'integrations', label: 'Integrations', icon: FiLink },
    { id: 'security', label: 'Security', icon: FiLock },
    { id: 'billing', label: 'Billing', icon: FiDollarSign },
  ]

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
                <FiArrowLeft className="text-xl text-[#6b7280]" />
              </button>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[#0A2F44] to-[#2E7D32] rounded-xl flex items-center justify-center shadow-lg">
                  <FiSettings className="text-white text-xl" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-[#02090d] dark:text-white">
                    Workspace Settings
                  </h1>
                  <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">
                    Manage your workspace configuration
                  </p>
                </div>
              </div>
            </div>
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
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-1 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-[#0A2F44] text-white shadow-md'
                    : 'text-[#6b7280] hover:text-[#0A2F44] hover:bg-[#f3f4f6] dark:hover:bg-[#374151]'
                }`}
              >
                <tab.icon className="text-lg" />
                <span className="text-sm font-medium">{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`px-1.5 py-0.5 text-xs rounded-full ${
                      activeTab === tab.id
                        ? 'bg-white/20 text-white'
                        : 'bg-[#e5e7eb] dark:bg-[#374151] text-[#6b7280]'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 p-4 bg-[#e6f0f5] dark:bg-[#1e3a4a] rounded-2xl border border-[#cce1eb] dark:border-[#2a5a6a]">
          <h3 className="font-semibold mb-3 text-[#02090d] dark:text-white">Workspace Actions</h3>
          <div className="flex flex-wrap gap-3">
            {isOwner && (
              <>
                <button
                  onClick={handleTransferOwnership}
                  className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors cursor-pointer"
                >
                  Transfer Ownership
                </button>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors cursor-pointer"
                >
                  Delete Workspace
                </button>
              </>
            )}

            {(isOwner || isAdmin) && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors cursor-pointer"
              >
                Invite Members
              </button>
            )}

            {!isOwner && (
              <button
                onClick={() => alert('Leave workspace feature coming soon')}
                className="px-4 py-2 bg-gray-600 text-white rounded-xl hover:bg-gray-700 transition-colors cursor-pointer"
              >
                Leave Workspace
              </button>
            )}
          </div>
          <p className="text-xs text-[#0A2F44] dark:text-[#cce1eb] mt-3">
            Your role: <span className="font-semibold capitalize">{userRole || 'member'}</span>
          </p>
        </div>

        {/* General Settings Tab */}
        {activeTab === 'general' && (
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Workspace Identity Card */}
            <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl border border-[#e5e7eb] dark:border-[#374151] overflow-hidden">
              <div className="p-6 border-b border-[#e5e7eb] dark:border-[#374151] bg-gradient-to-r from-[#0A2F44]/5 to-transparent">
                <h2 className="text-lg font-semibold text-[#02090d] dark:text-white">
                  Workspace Identity
                </h2>
                <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">
                  Customize how your workspace appears to members
                </p>
              </div>

              <div className="p-6 space-y-6">
                {/* Logo Upload */}
                <div className="flex items-start space-x-6">
                  <div className="relative group">
                    <div className="w-24 h-24 bg-[#e6f0f5] dark:bg-[#1e3a4a] rounded-2xl flex items-center justify-center overflow-hidden shadow-lg transition-all group-hover:shadow-xl">
                      {formData.logoPreview ? (
                        <img
                          src={formData.logoPreview}
                          alt="Logo"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FiImage className="text-3xl text-[#0A2F44]" />
                      )}
                    </div>
                    <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <span className="text-white text-sm font-medium">Change</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-[#6b7280] dark:text-[#9ca3af] mb-2">
                      Recommended: Square image, 256x256px, max 2MB
                    </p>
                    <div className="flex space-x-3">
                      <button
                        type="button"
                        className="text-sm text-[#0A2F44] hover:underline cursor-pointer"
                      >
                        Upload new
                      </button>
                      {formData.logoPreview && (
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({ ...prev, logoPreview: null, logo: null }))
                          }
                          className="text-sm text-red-500 hover:underline cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Workspace Name */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-[#374151] dark:text-[#d1d5db] mb-2">
                      Workspace Name
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-xl border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A2F44] transition-all"
                    />
                  </div>
                  <div>
                    <CustomDropdown
                      label="Industry"
                      name="industry"
                      value={formData.industry}
                      options={industryOptions}
                      onChange={handleChange}
                      icon={FiBriefcase}
                    />
                  </div>
                </div>

                {/* Description & Website */}
                <div>
                  <label className="block text-sm font-medium text-[#374151] dark:text-[#d1d5db] mb-2">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows="3"
                    className="w-full px-4 py-3 rounded-xl border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A2F44]"
                    placeholder="Tell your team what this workspace is for..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#374151] dark:text-[#d1d5db] mb-2">
                    Website
                  </label>
                  <div className="relative">
                    <FiGlobe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#9ca3af]" />
                    <input
                      type="url"
                      name="website"
                      value={formData.website}
                      onChange={handleChange}
                      placeholder="https://yourcompany.com"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A2F44]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Project Defaults Card */}
            <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl border border-[#e5e7eb] dark:border-[#374151] overflow-visible">
              <div className="p-6 border-b border-[#e5e7eb] dark:border-[#374151]">
                <h2 className="text-lg font-semibold text-[#02090d] dark:text-white">
                  Project Defaults
                </h2>
                <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">
                  Default settings for new projects
                </p>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-visible">
                <CustomDropdown
                  label="Default Project Type"
                  name="defaultProjectType"
                  value={formData.defaultProjectType}
                  options={projectTypeOptions}
                  onChange={handleChange}
                />
                <CustomDropdown
                  label="Design Standard"
                  name="defaultDesignStandard"
                  value={formData.defaultDesignStandard}
                  options={designStandardOptions}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end sticky bottom-4">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center space-x-2 px-6 py-3 bg-[#0A2F44] text-white rounded-xl hover:bg-[#082636] transition-all shadow-lg disabled:opacity-50 cursor-pointer"
              >
                <FiSave />
                <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Members Tab */}
        {activeTab === 'members' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl p-6 border border-[#e5e7eb] dark:border-[#374151]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[#6b7280]">Total Members</p>
                    <p className="text-3xl font-bold text-[#02090d] dark:text-white">
                      {members.length}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-[#e6f0f5] dark:bg-[#1e3a4a] rounded-xl flex items-center justify-center">
                    <FiUsers className="text-xl text-[#0A2F44]" />
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl p-6 border border-[#e5e7eb] dark:border-[#374151]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[#6b7280]">Active This Week</p>
                    <p className="text-3xl font-bold text-[#02090d] dark:text-white">
                      {members.filter((m) => m.active).length || 6}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-[#e6f0f5] dark:bg-[#1e3a4a] rounded-xl flex items-center justify-center">
                    <FiActivity className="text-xl text-[#0A2F44]" />
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl p-6 border border-[#e5e7eb] dark:border-[#374151]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[#6b7280]">Invite Pending</p>
                    <p className="text-3xl font-bold text-[#02090d] dark:text-white">2</p>
                  </div>
                  <div className="w-12 h-12 bg-[#e6f0f5] dark:bg-[#1e3a4a] rounded-xl flex items-center justify-center">
                    <FiMail className="text-xl text-[#0A2F44]" />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Link
                to={`/workspace/${workspaceId}/team`}
                className="text-sm text-[#0A2F44] dark:text-[#66a4c2] hover:underline flex items-center space-x-1"
              >
                <span>Manage all members</span>
                <FiArrowRight className="text-sm" />
              </Link>
            </div>

            {/* Search and Filter Bar */}
            <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl border border-[#e5e7eb] dark:border-[#374151] p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#9ca3af]" />
                  <input
                    type="text"
                    placeholder="Search members..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A2F44]"
                  />
                </div>

                {/* Role Filter Dropdown */}
                <div className="relative w-40">
                  <button
                    type="button"
                    onClick={() => setIsRoleFilterOpen(!isRoleFilterOpen)}
                    className="w-full px-4 py-2 rounded-xl border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white flex items-center justify-between hover:border-[#0A2F44] transition-colors cursor-pointer"
                  >
                    <span>
                      {roleFilterOptions.find((opt) => opt.value === roleFilter)?.label ||
                        'All Roles'}
                    </span>
                    <FiChevronDown
                      className={`text-[#6b7280] transition-transform duration-200 ${isRoleFilterOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {isRoleFilterOpen && (
                    <div className="absolute z-20 w-full mt-1 bg-white dark:bg-[#1f2937] border border-[#e5e7eb] dark:border-[#374151] rounded-xl shadow-xl overflow-hidden">
                      {roleFilterOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setRoleFilter(option.value)
                            setIsRoleFilterOpen(false)
                          }}
                          className={`w-full px-4 py-2 text-left hover:bg-[#f3f4f6] dark:hover:bg-[#374151] transition-colors cursor-pointer ${
                            roleFilter === option.value
                              ? 'bg-[#e6f0f5] dark:bg-[#1e3a4a] text-[#0A2F44]'
                              : 'text-[#02090d] dark:text-white'
                          }`}
                        >
                          <div>
                            <div className="text-sm font-medium">{option.label}</div>
                            <div className="text-xs text-[#6b7280]">{option.description}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {(isOwner || isAdmin) && (
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

            {/* Members List */}
            <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl border border-[#e5e7eb] dark:border-[#374151] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#f9fafb] dark:bg-[#374151] border-b border-[#e5e7eb] dark:border-[#4b5563]">
                    <tr>
                      <th className="text-left px-6 py-4 text-xs font-medium text-[#6b7280] uppercase">
                        Member
                      </th>
                      <th className="text-left px-6 py-4 text-xs font-medium text-[#6b7280] uppercase">
                        Role
                      </th>
                      <th className="text-left px-6 py-4 text-xs font-medium text-[#6b7280] uppercase">
                        Joined
                      </th>
                      <th className="text-left px-6 py-4 text-xs font-medium text-[#6b7280] uppercase">
                        Activity
                      </th>
                      <th className="text-right px-6 py-4 text-xs font-medium text-[#6b7280] uppercase"></th>
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
                            <div className="w-10 h-10 bg-[#0A2F44] rounded-full flex items-center justify-center text-white font-medium">
                              {member.name?.charAt(0) || member.email?.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium text-[#02090d] dark:text-white">
                                {member.name || 'User'}
                              </p>
                              <p className="text-sm text-[#6b7280]">{member.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                              member.role === 'owner'
                                ? 'bg-purple-100 text-purple-700'
                                : member.role === 'admin'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-green-100 text-green-700'
                            }`}
                          >
                            {member.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-[#6b7280]">
                          {new Date(member.joined_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-1">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            <span className="text-sm text-[#6b7280]">Active</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {member.role !== 'owner' &&
                            (isOwner || (isAdmin && member.role !== 'admin')) && (
                              <button className="p-2 hover:bg-[#f3f4f6] dark:hover:bg-[#374151] rounded-lg transition-colors cursor-pointer">
                                <FiMoreVertical className="text-[#6b7280]" />
                              </button>
                            )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl border border-[#e5e7eb] dark:border-[#374151] p-6">
            <div className="text-center py-12">
              <FiBarChart2 className="text-5xl text-[#0A2F44] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-[#02090d] dark:text-white mb-2">
                Analytics Dashboard
              </h3>
              <p className="text-[#6b7280] dark:text-[#9ca3af]">
                View workspace analytics and insights
              </p>
            </div>
          </div>
        )}

        {/* Integrations Tab */}
        {activeTab === 'integrations' && (
          <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl border border-[#e5e7eb] dark:border-[#374151] p-6">
            <div className="text-center py-12">
              <FiLink className="text-5xl text-[#0A2F44] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-[#02090d] dark:text-white mb-2">
                Integrations Coming Soon
              </h3>
              <p className="text-[#6b7280] dark:text-[#9ca3af]">
                Connect StructAI with your favorite tools
              </p>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl border border-[#e5e7eb] dark:border-[#374151] p-6">
            <div className="text-center py-12">
              <FiLock className="text-5xl text-[#0A2F44] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-[#02090d] dark:text-white mb-2">
                Security Settings Coming Soon
              </h3>
              <p className="text-[#6b7280] dark:text-[#9ca3af]">
                Manage workspace security preferences
              </p>
            </div>
          </div>
        )}

        {/* Billing Tab */}
        {activeTab === 'billing' && (
          <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl border border-[#e5e7eb] dark:border-[#374151] p-6">
            <div className="text-center py-12">
              <FiDollarSign className="text-5xl text-[#0A2F44] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-[#02090d] dark:text-white mb-2">
                Billing Coming Soon
              </h3>
              <p className="text-[#6b7280] dark:text-[#9ca3af]">
                Manage subscriptions and payment methods
              </p>
            </div>
          </div>
        )}

        {/* Danger Zone - Only Owner sees this */}
        {isOwner && (
          <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-800 p-6 mt-8">
            <div className="flex items-start space-x-4">
              <FiAlertCircle className="text-red-500 text-2xl flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-700 dark:text-red-400">
                  Danger Zone
                </h3>
                <p className="text-sm text-red-600 dark:text-red-300 mb-4">
                  Once you delete your workspace, there is no going back. All projects and data will
                  be permanently removed.
                </p>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors cursor-pointer"
                >
                  <FiTrash2 />
                  <span>Delete Workspace</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal - Updated with project check */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <FiAlertCircle className="text-red-500 text-2xl" />
              <h3 className="text-lg font-semibold text-[#02090d] dark:text-white">
                Delete Workspace
              </h3>
            </div>

            {/* Show warning if projects exist */}
            {projects.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 mb-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  ⚠️ This workspace has {projects.length} project(s). You must delete or move all
                  projects before deleting the workspace.
                </p>
                <ul className="text-xs text-yellow-700 dark:text-yellow-300 mt-2 list-disc list-inside">
                  {projects.slice(0, 3).map((p) => (
                    <li key={p.id}>{p.name}</li>
                  ))}
                  {projects.length > 3 && <li>...and {projects.length - 3} more</li>}
                </ul>
              </div>
            )}

            <p className="text-[#6b7280] dark:text-[#9ca3af] mb-6">
              Are you sure you want to delete "{currentWorkspace?.name}"? This action cannot be
              undone. All projects and data will be permanently removed.
            </p>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border border-[#e5e7eb] dark:border-[#374151] rounded-lg text-[#6b7280] hover:bg-[#f3f4f6] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteOrganization}
                disabled={projects.length > 0 || isDeleting}
                className={`px-4 py-2 rounded-lg transition-colors cursor-pointer ${
                  projects.length > 0
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-red-500 text-white hover:bg-red-600'
                }`}
              >
                {isDeleting ? 'Deleting...' : 'Delete Workspace'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Ownership Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <FiShield className="text-green-500 text-2xl" />
              <h3 className="text-lg font-semibold text-[#02090d] dark:text-white">
                Transfer Ownership
              </h3>
            </div>

            <p className="text-[#6b7280] dark:text-[#9ca3af] mb-4">
              Transfer workspace ownership to another member. You will become a regular member after
              transfer.
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-[#374151] dark:text-[#d1d5db] mb-2">
                Select New Owner
              </label>
              <select
                value={selectedNewOwner}
                onChange={(e) => setSelectedNewOwner(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A2F44]"
              >
                <option value="">Select a member...</option>
                {members && members.length > 0 ? (
                  members
                    .filter((m) => {
                      const isCurrentOwner = m.role === 'owner' || m.role === ROLES.ORG_OWNER
                      return !isCurrentOwner
                    })
                    .map((member) => (
                      <option key={member.id} value={member.user_id}>
                        {member.name} ({member.email}) - Current: {member.role}
                      </option>
                    ))
                ) : (
                  <option disabled>Loading members...</option>
                )}
              </select>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 mb-6">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ⚠️ This action cannot be undone. You will lose owner privileges and cannot restore
                them unless the new owner transfers back.
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowTransferModal(false)}
                className="px-4 py-2 border border-[#e5e7eb] dark:border-[#374151] rounded-lg text-[#6b7280] hover:bg-[#f3f4f6] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmTransferOwnership}
                disabled={isTransferring || !selectedNewOwner}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isTransferring ? 'Transferring...' : 'Confirm Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#02090d] dark:text-white">
                Invite Team Member
              </h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-[#6b7280] hover:text-[#0A2F44] cursor-pointer"
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
              <RoleDropdown value={inviteRole} onChange={setInviteRole} />
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 border border-[#e5e7eb] rounded-lg text-[#6b7280] hover:bg-[#f3f4f6] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={isInviting}
                className="px-4 py-2 bg-[#0A2F44] text-white rounded-lg hover:bg-[#082636] transition-colors cursor-pointer disabled:opacity-50"
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

export default WorkspaceSettings
