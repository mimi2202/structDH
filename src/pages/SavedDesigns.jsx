import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  FiArrowLeft,
  FiTrash2,
  FiDownload,
  FiFolder,
  FiCalendar,
  FiGrid,
  FiEye,
  FiSun,
  FiMoon,
} from 'react-icons/fi'
import { useTheme } from '../contexts/ThemeContext'
import { SavedDesignRows } from '../components/results/DesignTopBar'
import { listAllDesigns, deleteDesign, designRoute, designState } from '../utils/savedDesigns'

const SavedDesigns = () => {
  const navigate = useNavigate()
  const { isDarkMode, toggleDarkMode } = useTheme()
  const [savedDesigns, setSavedDesigns] = useState(() => {
    try { return JSON.parse(localStorage.getItem('quick_designs') || '[]') } catch { return [] }
  })
  // designs saved from the results pages (slab, beam, column, foundation, staircase)
  const [elementDesigns, setElementDesigns] = useState(() => listAllDesigns())

  const openElementDesign = (d) => navigate(designRoute(d, d.element), { state: designState(d) })
  const deleteElementDesign = (d) => {
    if (window.confirm(`Delete "${d.name}"?`)) {
      deleteDesign(d.element, d.id)
      setElementDesigns(listAllDesigns())
    }
  }

  const handleDelete = (id) => {
    if (window.confirm('Delete this saved design?')) {
      const updated = savedDesigns.filter((d) => d.id !== id)
      localStorage.setItem('quick_designs', JSON.stringify(updated))
      setSavedDesigns(updated)
    }
  }

  const handleLoad = (design) => {
    // Store in sessionStorage to load in Quick Design
    sessionStorage.setItem('load_quick_design', JSON.stringify(design))
    navigate('/quick-design')
  }

  const handleExport = (design) => {
    const dataStr = JSON.stringify(design, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${design.name || 'design'}_${design.id}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] dark:bg-[#111827]">
      {/* Header */}
      <div className="bg-white dark:bg-[#1f2937] border-b border-[#e5e7eb] dark:border-[#374151] sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#374151]"
              >
                <FiArrowLeft className="text-xl text-[#6b7280]" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-[#02090d] dark:text-white">Saved Designs</h1>
                <p className="text-sm text-[#6b7280]">Designs saved in this browser. Click one to open its results.</p>
              </div>
            </div>
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#374151]"
            >
              {isDarkMode ? (
                <FiSun className="text-yellow-500" />
              ) : (
                <FiMoon className="text-[#0A2F44]" />
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {elementDesigns.length > 0 && (
          <div className="mb-8 overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-lg dark:border-[#374151] dark:bg-[#0f172a]">
            <h2 className="border-b border-[#e5e7eb] px-4 py-3 text-sm font-bold uppercase tracking-wide text-[#0A2F44] dark:border-[#374151] dark:text-[#66a4c2]">
              Element designs ({elementDesigns.length})
            </h2>
            <SavedDesignRows designs={elementDesigns} showElement onOpen={openElementDesign} onDelete={deleteElementDesign} />
          </div>
        )}
        {savedDesigns.length > 0 && elementDesigns.length > 0 && (
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[#0A2F44] dark:text-[#66a4c2]">Quick designs</h2>
        )}
        {savedDesigns.length === 0 ? (
          elementDesigns.length > 0 ? null :
          <div className="text-center py-12 bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl">
            <FiFolder className="text-5xl text-[#9ca3af] mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[#02090d] dark:text-white mb-2">
              No saved designs
            </h3>
            <p className="text-[#6b7280] mb-4">Run a design and press Save on its results page to see it here</p>
            <Link
              to="/new-design"
              className="inline-block px-4 py-2 bg-[#0A2F44] text-white rounded-lg hover:bg-[#082636]"
            >
              Create New Design
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {savedDesigns.map((design) => (
              <div
                key={design.id}
                className="bg-white dark:bg-[#1f2937] rounded-xl shadow-lg border border-[#e5e7eb] dark:border-[#374151] p-4 hover:shadow-xl transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-[#e6f0f5] dark:bg-[#1e3a4a] rounded-xl flex items-center justify-center">
                      <FiGrid className="text-2xl text-[#0A2F44]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#02090d] dark:text-white">
                        {design.name || 'Untitled Design'}
                      </h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                        <span className="text-xs text-[#6b7280] capitalize">
                          {design.element} Design
                        </span>
                        <span className="text-xs text-[#6b7280]">{design.inputs?.spanX}m span</span>
                        <span className="text-xs text-[#6b7280] flex items-center">
                          <FiCalendar className="mr-1 text-xs" />
                          {new Date(design.savedAt).toLocaleDateString()}
                        </span>
                      </div>
                      {design.results?.options?.[0] && (
                        <div className="flex gap-3 mt-2 text-xs">
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded">
                            Best: {design.results.options[0].thickness}mm
                          </span>
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                            €{design.results.options[0].cost}/m²
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleLoad(design)}
                      className="p-2 text-[#0A2F44] hover:bg-[#e6f0f5] rounded-lg transition-colors"
                      title="Load Design"
                    >
                      <FiEye />
                    </button>
                    <button
                      onClick={() => handleExport(design)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Export"
                    >
                      <FiDownload />
                    </button>
                    <button
                      onClick={() => handleDelete(design.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default SavedDesigns
