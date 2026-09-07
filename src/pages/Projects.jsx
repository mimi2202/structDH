import React, { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  FiFolder,
  FiPlus,
  FiSearch,
  FiFilter,
  FiGrid,
  FiList,
  FiChevronDown,
  FiCheck,
} from 'react-icons/fi'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { mockProjects } from './Dashboard'

const Projects = () => {
  const { workspaceId } = useParams()
  const { workspaces, loadWorkspaces } = useWorkspace()
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('all')
  const [viewMode, setViewMode] = useState('grid')
  const [allProjects, setAllProjects] = useState([])
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  // Use the same mock data as dashboard
  useEffect(() => {
    setAllProjects(mockProjects)
    loadWorkspaces()
  }, [])

  const projectTypes = [
    { value: 'all', label: 'All Types', icon: null, description: 'Show all project types' },
    {
      value: 'commercial',
      label: 'Commercial',
      icon: '🏢',
      description: 'Office buildings, retail spaces, shopping centres',
    },
    {
      value: 'residential',
      label: 'Residential',
      icon: '🏠',
      description: 'Houses, apartments, housing developments',
    },
    {
      value: 'industrial',
      label: 'Industrial',
      icon: '🏭',
      description: 'Warehouses, factories, logistics centres',
    },
  ]

  const getTypeIcon = (type) => {
    switch (type) {
      case 'commercial':
        return '🏢'
      case 'residential':
        return '🏠'
      case 'industrial':
        return '🏭'
      default:
        return '📁'
    }
  }

  const filteredProjects = allProjects.filter((project) => {
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filter === 'all' || project.project_type === filter
    return matchesSearch && matchesFilter
  })

  return (
    <div className="min-h-screen bg-[#f3f4f6] dark:bg-[#111827]">
      {/* Header */}
      <div className="bg-white dark:bg-[#1f2937] border-b border-[#e5e7eb] dark:border-[#374151] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[#02090d] dark:text-white">Projects</h1>
              <p className="text-sm text-[#6b7280] dark:text-[#9ca3af] mt-1">
                Manage and organize your structural design projects
              </p>
            </div>
            <Link
              to="/workspace/create"
              className="flex items-center justify-center space-x-2 bg-[#0A2F44] text-white px-4 py-2 rounded-lg hover:bg-[#082636] transition-colors"
            >
              <FiPlus />
              <span>New Project</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-lg p-4 border border-[#e5e7eb] dark:border-[#374151]">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search Bar */}
            <div className="flex-1 relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#9ca3af]" />
              <input
                type="text"
                placeholder="Search projects by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#1f2937] text-[#02090d] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A2F44] transition-all"
              />
            </div>

            {/* Custom Filter Dropdown - Aesthetic */}
            <div className="relative">
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="flex items-center justify-between space-x-2 px-4 py-2 rounded-lg border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#1f2937] text-[#02090d] dark:text-white hover:border-[#0A2F44] transition-colors min-w-[140px]"
              >
                <div className="flex items-center space-x-2">
                  {filter !== 'all' && <span className="text-lg">{getTypeIcon(filter)}</span>}
                  <span className="text-sm font-medium">
                    {projectTypes.find((t) => t.value === filter)?.label || 'Filter'}
                  </span>
                </div>
                <FiChevronDown
                  className={`text-[#6b7280] transition-transform duration-200 ${isFilterOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isFilterOpen && (
                <div className="absolute z-20 top-full left-0 mt-1 w-64 bg-white dark:bg-[#1f2937] border border-[#e5e7eb] dark:border-[#374151] rounded-lg shadow-xl overflow-hidden animate-fade-in">
                  {projectTypes.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => {
                        setFilter(type.value)
                        setIsFilterOpen(false)
                      }}
                      className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-[#f3f4f6] dark:hover:bg-[#374151] transition-colors ${
                        filter === type.value ? 'bg-[#e6f0f5] dark:bg-[#1e3a4a]' : ''
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        {type.icon && <span className="text-lg">{type.icon}</span>}
                        <div>
                          <div className="text-sm font-medium text-[#02090d] dark:text-white">
                            {type.label}
                          </div>
                          <div className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
                            {type.description}
                          </div>
                        </div>
                      </div>
                      {filter === type.value && (
                        <FiCheck className="text-[#0A2F44] dark:text-[#66a4c2]" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* View Toggle */}
            <div className="flex items-center border-l border-[#e5e7eb] dark:border-[#374151] pl-4">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-l-lg transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-[#0A2F44] text-white'
                    : 'bg-[#f3f4f6] dark:bg-[#374151] text-[#6b7280] dark:text-[#9ca3af] hover:bg-[#e5e7eb] dark:hover:bg-[#4b5563]'
                }`}
              >
                <FiGrid />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-r-lg transition-colors ${
                  viewMode === 'list'
                    ? 'bg-[#0A2F44] text-white'
                    : 'bg-[#f3f4f6] dark:bg-[#374151] text-[#6b7280] dark:text-[#9ca3af] hover:bg-[#e5e7eb] dark:hover:bg-[#4b5563]'
                }`}
              >
                <FiList />
              </button>
            </div>
          </div>

          {/* Results Count */}
          <div className="mt-4 text-sm text-[#6b7280] dark:text-[#9ca3af]">
            Showing {filteredProjects.length} of {allProjects.length} projects
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {filteredProjects.length === 0 ? (
          <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-lg p-12 text-center border border-[#e5e7eb] dark:border-[#374151]">
            <div className="w-20 h-20 bg-[#e6f0f5] dark:bg-[#1e3a4a] rounded-full flex items-center justify-center mx-auto mb-4">
              <FiFolder className="text-3xl text-[#0A2F44] dark:text-[#cce1eb]" />
            </div>
            <h3 className="text-lg font-semibold text-[#02090d] dark:text-white mb-2">
              No projects found
            </h3>
            <p className="text-[#6b7280] dark:text-[#9ca3af] mb-6">
              {searchTerm || filter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Get started by creating your first project'}
            </p>
            {!searchTerm && filter === 'all' && (
              <Link
                to="/workspace/create"
                className="inline-flex items-center space-x-2 bg-[#0A2F44] text-white px-6 py-3 rounded-lg hover:bg-[#082636] transition-colors"
              >
                <FiPlus />
                <span>Create New Project</span>
              </Link>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <Link
                key={project.id}
                to={`/workspace/${project.workspace_id}/projects/${project.id}`}
                className="bg-white dark:bg-[#1f2937] rounded-xl shadow-lg border border-[#e5e7eb] dark:border-[#374151] p-6 hover:shadow-xl transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-[#e6f0f5] dark:bg-[#1e3a4a] rounded-lg flex items-center justify-center">
                    <span className="text-2xl">{getTypeIcon(project.project_type)}</span>
                  </div>
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

                <h3 className="text-lg font-semibold text-[#02090d] dark:text-white mb-2">
                  {project.name}
                </h3>

                {project.description && (
                  <p className="text-sm text-[#6b7280] dark:text-[#9ca3af] mb-4 line-clamp-2">
                    {project.description}
                  </p>
                )}

                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#0A2F44] dark:text-[#cce1eb] font-medium">
                    {project.design_standard || 'Eurocode'}
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
        ) : (
          <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-lg border border-[#e5e7eb] dark:border-[#374151] overflow-hidden">
            <table className="w-full">
              <thead className="bg-[#f9fafb] dark:bg-[#374151] border-b border-[#e5e7eb] dark:border-[#4b5563]">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-[#6b7280] dark:text-[#9ca3af] uppercase tracking-wider">
                    Project
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-[#6b7280] dark:text-[#9ca3af] uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-[#6b7280] dark:text-[#9ca3af] uppercase tracking-wider">
                    Location
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-[#6b7280] dark:text-[#9ca3af] uppercase tracking-wider">
                    Last Updated
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e7eb] dark:divide-[#374151]">
                {filteredProjects.map((project) => (
                  <tr
                    key={project.id}
                    onClick={() =>
                      (window.location.href = `/workspace/${project.workspace_id}/projects/${project.id}`)
                    }
                    className="hover:bg-[#f9fafb] dark:hover:bg-[#374151] cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-[#02090d] dark:text-white">
                        {project.name}
                      </div>
                      {project.description && (
                        <div className="text-sm text-[#6b7280] dark:text-[#9ca3af]">
                          {project.description.substring(0, 50)}...
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
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
                    </td>
                    <td className="px-6 py-4 text-sm text-[#6b7280] dark:text-[#9ca3af]">
                      {project.location || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-[#6b7280] dark:text-[#9ca3af]">
                      {new Date(project.updated_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default Projects
