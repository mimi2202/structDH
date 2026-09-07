import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FiArrowLeft,
  FiSun,
  FiMoon,
  FiGrid,
  FiBarChart2,
  FiColumns,
  FiSquare,
  FiTriangle,
  FiSave,
  FiFolder,
  FiPlus,
  FiX,
  FiCheck,
  FiCpu,
} from 'react-icons/fi'
import { useTheme } from '../contexts/ThemeContext'

const NewDesign = () => {
  const navigate = useNavigate()
  const { isDarkMode, toggleDarkMode } = useTheme()
  const [selectedElement, setSelectedElement] = useState('slab')
  const [designName, setDesignName] = useState('')
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [conversionName, setConversionName] = useState('')

  const elements = [
    {
      id: 'slab',
      name: 'Slab',
      icon: FiGrid,
      color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600',
    },
    {
      id: 'beam',
      name: 'Beam',
      icon: FiBarChart2,
      color: 'bg-green-100 dark:bg-green-900/30 text-green-600',
    },
    {
      id: 'column',
      name: 'Column',
      icon: FiColumns,
      color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600',
    },
    {
      id: 'foundation',
      name: 'Foundation',
      icon: FiSquare,
      color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600',
    },
    {
      id: 'staircase',
      name: 'Staircase',
      icon: FiTriangle,
      color: 'bg-red-100 dark:bg-red-900/30 text-red-600',
    },
  ]

  const handleElementSelect = (id) => {
    setSelectedElement(id)
  }

  const handleStartDesign = () => {
    if (selectedElement === 'slab') {
      navigate('/new-design/slab')
    } else {
      alert(
        `${selectedElement.charAt(0).toUpperCase() + selectedElement.slice(1)} design coming soon in Phase 3`
      )
    }
  }

  const handleSaveToProject = () => {
    setShowSaveModal(true)
  }

  const handleOpenConvertModal = () => {
    setShowConvertModal(true)
  }

  const handleSaveDesign = () => {
    if (!designName.trim()) {
      alert('Please enter a design name')
      return
    }
    const savedDesigns = JSON.parse(localStorage.getItem('quickDesigns') || '[]')
    const newDesign = {
      id: Date.now(),
      name: designName,
      element: selectedElement,
      createdAt: new Date().toISOString(),
      data: {},
    }
    savedDesigns.push(newDesign)
    localStorage.setItem('quickDesigns', JSON.stringify(savedDesigns))
    setShowSaveModal(false)
    setDesignName('')
    alert('Design saved! You can access it from "My Designs"')
  }

  const handleConvertToProject = () => {
    if (!conversionName.trim()) {
      alert('Please enter a project name')
      return
    }
    navigate(
      `/workspace/create?fromDesign=true&name=${encodeURIComponent(conversionName)}&element=${selectedElement}`
    )
    setShowConvertModal(false)
    setConversionName('')
  }

  const getUserInitials = () => 'JD'

  return (
    <div className="min-h-screen bg-[#f3f4f6] dark:bg-[#111827] flex transition-colors duration-300">
      {/* Save Design Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#02090d] dark:text-white">Save Design</h3>
              <button
                onClick={() => setShowSaveModal(false)}
                className="text-[#6b7280] hover:text-[#0A2F44] cursor-pointer"
              >
                <FiX />
              </button>
            </div>
            <p className="text-sm text-[#6b7280] dark:text-[#9ca3af] mb-4">
              Save this design to access it later from "My Designs"
            </p>
            <input
              type="text"
              value={designName}
              onChange={(e) => setDesignName(e.target.value)}
              placeholder="e.g., Office Building Slab"
              className="w-full px-4 py-2 rounded-lg border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white mb-4 focus:outline-none focus:ring-2 focus:ring-[#0A2F44]"
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 border rounded-lg text-[#6b7280] hover:bg-[#f3f4f6]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDesign}
                className="px-4 py-2 bg-[#0A2F44] text-white rounded-lg hover:bg-[#082636]"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert to Project Modal */}
      {showConvertModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#02090d] dark:text-white">
                Convert to Project
              </h3>
              <button
                onClick={() => setShowConvertModal(false)}
                className="text-[#6b7280] hover:text-[#0A2F44] cursor-pointer"
              >
                <FiX />
              </button>
            </div>
            <p className="text-sm text-[#6b7280] dark:text-[#9ca3af] mb-4">
              Convert this design to a full project to add more elements and collaborate with team
              members.
            </p>
            <input
              type="text"
              value={conversionName}
              onChange={(e) => setConversionName(e.target.value)}
              placeholder="Project name"
              className="w-full px-4 py-2 rounded-lg border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white mb-4 focus:outline-none focus:ring-2 focus:ring-[#0A2F44]"
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowConvertModal(false)}
                className="px-4 py-2 border rounded-lg text-[#6b7280] hover:bg-[#f3f4f6]"
              >
                Cancel
              </button>
              <button
                onClick={handleConvertToProject}
                className="px-4 py-2 bg-[#0A2F44] text-white rounded-lg hover:bg-[#082636]"
              >
                Convert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="bg-white dark:bg-[#1f2937] border-b border-[#e5e7eb] dark:border-[#374151] p-4 sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center space-x-2 text-[#6b7280] dark:text-[#9ca3af] hover:text-[#0A2F44] dark:hover:text-[#66a4c2] transition-colors cursor-pointer"
              >
                <FiArrowLeft className="text-lg" />
                <span className="text-sm">Back to Dashboard</span>
              </button>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#374151] transition-colors cursor-pointer"
              >
                {isDarkMode ? (
                  <FiSun className="text-xl text-yellow-500" />
                ) : (
                  <FiMoon className="text-xl text-[#0A2F44]" />
                )}
              </button>
              <div className="w-8 h-8 bg-[#0A2F44] rounded-full flex items-center justify-center text-white text-sm font-medium">
                {getUserInitials()}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-[#e6f0f5] dark:bg-[#1e3a4a] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FiCpu className="text-3xl text-[#0A2F44] dark:text-[#66a4c2]" />
            </div>
            <h1 className="text-3xl font-bold text-[#02090d] dark:text-white mb-2">New Design</h1>
            <p className="text-[#6b7280] dark:text-[#9ca3af] max-w-lg mx-auto">
              Create a quick single design without setting up a full project. Convert to a project
              later if it grows complex.
            </p>
          </div>

          {/* Element Selection Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            {elements.map((element) => (
              <button
                key={element.id}
                onClick={() => handleElementSelect(element.id)}
                className={`p-6 rounded-xl border-2 transition-all cursor-pointer ${
                  selectedElement === element.id
                    ? 'border-[#0A2F44] bg-[#e6f0f5] dark:bg-[#1e3a4a] shadow-lg scale-105'
                    : 'border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#1f2937] hover:border-[#99c2d6] hover:scale-105'
                }`}
              >
                <element.icon
                  className={`text-3xl mx-auto mb-2 ${
                    selectedElement === element.id
                      ? 'text-[#0A2F44] dark:text-[#66a4c2]'
                      : 'text-[#6b7280] dark:text-[#9ca3af]'
                  }`}
                />
                <p
                  className={`text-sm font-medium ${
                    selectedElement === element.id
                      ? 'text-[#02090d] dark:text-white'
                      : 'text-[#6b7280] dark:text-[#9ca3af]'
                  }`}
                >
                  {element.name}
                </p>
              </button>
            ))}
          </div>

          {/* Design Card */}
          <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-lg border border-[#e5e7eb] dark:border-[#374151] p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-[#02090d] dark:text-white flex items-center">
                <span className="w-2 h-2 bg-[#0A2F44] rounded-full mr-2"></span>
                Quick Design Session
              </h2>
              <div className="flex space-x-2">
                <button
                  onClick={handleSaveToProject}
                  className="px-3 py-1.5 text-sm border border-[#e5e7eb] dark:border-[#374151] rounded-lg text-[#6b7280] dark:text-[#9ca3af] hover:bg-[#f3f4f6] dark:hover:bg-[#374151] transition-colors flex items-center cursor-pointer"
                >
                  <FiSave className="mr-1 text-sm" /> Save
                </button>
                <button
                  onClick={handleOpenConvertModal}
                  className="px-3 py-1.5 text-sm border border-[#0A2F44] text-[#0A2F44] dark:text-[#66a4c2] rounded-lg hover:bg-[#e6f0f5] dark:hover:bg-[#1e3a4a] transition-colors flex items-center cursor-pointer"
                >
                  <FiFolder className="mr-1 text-sm" /> Convert to Project
                </button>
              </div>
            </div>

            {/* Quick Info */}
            <div className="bg-[#f9fafb] dark:bg-[#374151] rounded-lg p-4 mb-6">
              <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">
                <span className="font-semibold text-[#0A2F44] dark:text-[#66a4c2]">
                  Quick Design Mode
                </span>{' '}
                — No workspace needed. Design, save, or convert to a full project later.
              </p>
            </div>

            {/* Start Design Button */}
            <button
              onClick={handleStartDesign}
              className="w-full py-4 bg-[#0A2F44] text-white rounded-xl font-semibold hover:bg-[#082636] transition-colors flex items-center justify-center space-x-2 cursor-pointer"
            >
              <FiPlus />
              <span>Start {elements.find((e) => e.id === selectedElement)?.name} Design</span>
            </button>
          </div>

          {/* Recent Designs Section */}
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-[#6b7280] dark:text-[#9ca3af] uppercase tracking-wider mb-4">
              Recent Designs
            </h3>
            <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-lg border border-[#e5e7eb] dark:border-[#374151] p-6">
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-[#f3f4f6] dark:bg-[#374151] rounded-full flex items-center justify-center mx-auto mb-3">
                  <FiSave className="text-2xl text-[#9ca3af]" />
                </div>
                <p className="text-[#6b7280] dark:text-[#9ca3af]">No saved designs yet</p>
                <p className="text-sm text-[#9ca3af] dark:text-[#6b7280] mt-1">
                  Designs you save will appear here
                </p>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="mt-6 text-center">
            <p className="text-xs text-[#9ca3af] dark:text-[#6b7280]">
              💡 Tip: Start with a quick design, then convert to a project when you need to add more
              elements or collaborate.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NewDesign
