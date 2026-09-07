import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FiArrowLeft,
  FiGrid,
  FiBarChart2,
  FiColumns,
  FiSquare,
  FiSun,
  FiMoon,
  FiSave,
  FiDownload,
  FiFileText,
  FiFile,
  FiCheckCircle,
  FiAlertCircle,
  FiTrendingUp,
  FiDollarSign,
  FiPackage,
  FiClock,
  FiEye,
} from 'react-icons/fi'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'

const QuickDesign = () => {
  const navigate = useNavigate()
  const { isDarkMode, toggleDarkMode } = useTheme()
  const { user } = useAuth()

  const [step, setStep] = useState(1) // 1: select type, 2: input, 3: results
  const [selectedElement, setSelectedElement] = useState(null)
  const [isOptimising, setIsOptimising] = useState(false)
  const [results, setResults] = useState(null)
  const [savedDesigns, setSavedDesigns] = useState([])
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [designName, setDesignName] = useState('')

  // Form state for slab
  const [formData, setFormData] = useState({
    slabType: 'one-way',
    spanX: '5.0',
    spanY: '4.0',
    thickness: '175',
    concreteGrade: 'C30/37',
    steelGrade: 'B500',
    liveLoad: '3.0',
    deadLoad: '1.5',
  })

  const designElements = [
    { id: 'slab', name: 'Slab', icon: FiGrid, description: 'Floor slab design' },
    { id: 'beam', name: 'Beam', icon: FiBarChart2, description: 'Beam design (Coming Soon)' },
    { id: 'column', name: 'Column', icon: FiColumns, description: 'Column design (Coming Soon)' },
    {
      id: 'foundation',
      name: 'Foundation',
      icon: FiSquare,
      description: 'Foundation design (Coming Soon)',
    },
  ]

  // Generate options based on inputs
  const generateOptions = () => {
    const span = parseFloat(formData.spanX)
    if (isNaN(span) || span <= 0) return []

    const thicknesses = [150, 175, 200, 225]
    const barDiameters = [10, 12, 16]
    const spacings = [150, 175, 200, 225, 250]

    const options = []
    let id = 1

    for (const thickness of thicknesses) {
      for (const barDiameter of barDiameters) {
        for (const spacing of spacings) {
          const selfWeight = (25 * thickness) / 1000
          const gkTotal = selfWeight + (parseFloat(formData.deadLoad) || 1.5)
          const qkLead = parseFloat(formData.liveLoad) || 3.0

          const wEd = 1.35 * gkTotal + 1.5 * qkLead
          const mEd = (wEd * Math.pow(span, 2)) / 8

          const cover = 25
          const d = thickness - cover - barDiameter / 2
          if (d <= 0) continue

          const z = 0.9 * d
          const fyd = 434.78

          let asReq = (mEd * 1000000) / (fyd * z)
          if (asReq < 0) asReq = 0

          const fctm = 2.9
          const asMin = Math.max(((0.26 * fctm) / 500) * 1000 * d, 0.0013 * 1000 * d)
          asReq = Math.max(asReq, asMin)

          const barArea = (Math.PI * Math.pow(barDiameter, 2)) / 4
          const asProv = (barArea * 1000) / spacing

          const utilisation = asReq / asProv
          if (utilisation > 1.5) continue

          const concreteCost = (thickness / 1000) * 170
          const steelCost = (asProv / 100) * 7.85 * 1.3
          const formworkCost = 50
          const totalCost = concreteCost + steelCost + formworkCost

          const concreteCarbon = (thickness / 1000) * 240
          const steelCarbon = (asProv / 100) * 7.85 * 1.5
          const totalCarbon = concreteCarbon + steelCarbon

          options.push({
            id: id++,
            rank: 0,
            thickness: Math.round(thickness),
            barDiameter: Math.round(barDiameter),
            spacing: spacing,
            asReq: Math.round(asReq),
            asProv: Math.round(asProv),
            cost: Math.round(totalCost),
            carbon: Math.round(totalCarbon),
            utilisation: utilisation.toFixed(2),
            status: utilisation <= 1.0 ? 'pass' : 'warning',
          })
        }
      }
    }

    const validOptions = options.filter((opt) => opt.status !== 'fail')
    validOptions.sort((a, b) => a.cost - b.cost)
    validOptions.forEach((opt, idx) => {
      opt.rank = idx + 1
    })

    return validOptions.slice(0, 8)
  }

  const handleOptimise = () => {
    setIsOptimising(true)
    setTimeout(() => {
      const options = generateOptions()
      setResults({ options, timestamp: new Date().toISOString() })
      setStep(3)
      setIsOptimising(false)
    }, 1500)
  }

  const handleSaveDesign = () => {
    if (!designName.trim()) {
      alert('Please enter a design name')
      return
    }

    const savedDesign = {
      id: Date.now(),
      name: designName,
      element: selectedElement,
      inputs: formData,
      results: results,
      savedAt: new Date().toISOString(),
    }

    const existing = JSON.parse(localStorage.getItem('quick_designs') || '[]')
    const updated = [savedDesign, ...existing]
    localStorage.setItem('quick_designs', JSON.stringify(updated))
    setSavedDesigns(updated)
    setShowSaveModal(false)
    setDesignName('')
    alert('Design saved locally!')
  }

  const handleExport = (format) => {
    if (!results) return

    const exportData = {
      designName: designName || 'Untitled Design',
      element: selectedElement,
      date: new Date().toISOString(),
      user: user?.name || 'Guest',
      inputs: formData,
      results: results.options,
      summary: {
        bestOption: results.options[0],
        totalOptions: results.options.length,
      },
    }

    if (format === 'json') {
      const dataStr = JSON.stringify(exportData, null, 2)
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr)
      const exportFileDefaultName = `design_${selectedElement}_${Date.now()}.json`
      const linkElement = document.createElement('a')
      linkElement.setAttribute('href', dataUri)
      linkElement.setAttribute('download', exportFileDefaultName)
      linkElement.click()
    } else if (format === 'pdf') {
      alert('PDF export coming soon. For now, use Print > Save as PDF')
      window.print()
    }
  }

  const loadSavedDesign = (design) => {
    setSelectedElement(design.element)
    setFormData(design.inputs)
    setResults(design.results)
    setStep(3)
  }

  // Load saved designs from localStorage on mount
  React.useEffect(() => {
    const saved = localStorage.getItem('quick_designs')
    if (saved) {
      setSavedDesigns(JSON.parse(saved))
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#f3f4f6] dark:bg-[#111827]">
      {/* Header */}
      <div className="bg-white dark:bg-[#1f2937] border-b border-[#e5e7eb] dark:border-[#374151] sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#374151] transition-colors cursor-pointer"
              >
                <FiArrowLeft className="text-xl text-[#6b7280] dark:text-[#9ca3af]" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-[#02090d] dark:text-white">Quick Design</h1>
                <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">
                  Fast structural design without project setup
                </p>
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
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Step 1: Select Design Type */}
        {step === 1 && (
          <div>
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-[#02090d] dark:text-white mb-2">
                Select Design Type
              </h2>
              <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">
                Choose the structural element you want to design
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {designElements.map((element) => (
                <button
                  key={element.id}
                  onClick={() => {
                    if (element.id === 'slab') {
                      setSelectedElement(element.id)
                      setStep(2)
                    } else {
                      alert(`${element.name} design coming soon!`)
                    }
                  }}
                  className={`p-6 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                    selectedElement === element.id
                      ? 'border-[#0A2F44] bg-[#e6f0f5] dark:bg-[#1e3a4a]'
                      : 'border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#1f2937] hover:border-[#99c2d6]'
                  }`}
                >
                  <element.icon
                    className={`text-3xl mb-3 ${
                      selectedElement === element.id
                        ? 'text-[#0A2F44] dark:text-[#66a4c2]'
                        : 'text-[#6b7280] dark:text-[#9ca3af]'
                    }`}
                  />
                  <h3 className="text-lg font-semibold text-[#02090d] dark:text-white">
                    {element.name}
                  </h3>
                  <p className="text-sm text-[#6b7280] dark:text-[#9ca3af] mt-1">
                    {element.description}
                  </p>
                </button>
              ))}
            </div>

            {/* Saved Designs Section */}
            {savedDesigns.length > 0 && (
              <div className="mt-8">
                <h3 className="text-md font-semibold text-[#02090d] dark:text-white mb-4">
                  Previously Saved Designs
                </h3>
                <div className="space-y-2">
                  {savedDesigns.slice(0, 5).map((design) => (
                    <button
                      key={design.id}
                      onClick={() => loadSavedDesign(design)}
                      className="w-full p-3 bg-white dark:bg-[#1f2937] rounded-xl border border-[#e5e7eb] dark:border-[#374151] flex items-center justify-between hover:bg-[#f9fafb] dark:hover:bg-[#374151] transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <FiSave className="text-[#0A2F44]" />
                        <div className="text-left">
                          <p className="font-medium text-[#02090d] dark:text-white">
                            {design.name}
                          </p>
                          <p className="text-xs text-[#6b7280]">
                            {design.element} • {new Date(design.savedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm text-[#0A2F44]">Load →</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Input Form */}
        {step === 2 && selectedElement === 'slab' && (
          <div>
            <div className="mb-8">
              <button
                onClick={() => setStep(1)}
                className="text-sm text-[#0A2F44] dark:text-[#66a4c2] hover:underline mb-4 flex items-center"
              >
                ← Back to design types
              </button>
              <h2 className="text-lg font-semibold text-[#02090d] dark:text-white mb-2">
                Slab Parameters
              </h2>
              <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">
                Enter slab design parameters
              </p>
            </div>

            <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl border border-[#e5e7eb] dark:border-[#374151] p-6 space-y-6">
              {/* Slab Type */}
              <div>
                <label className="block text-sm font-medium text-[#374151] dark:text-[#d1d5db] mb-2">
                  Slab Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, slabType: 'one-way' })}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      formData.slabType === 'one-way'
                        ? 'border-[#0A2F44] bg-[#e6f0f5] dark:bg-[#1e3a4a]'
                        : 'border-[#e5e7eb] dark:border-[#374151]'
                    }`}
                  >
                    <span className="text-sm font-medium">One-way Slab</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, slabType: 'two-way' })}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      formData.slabType === 'two-way'
                        ? 'border-[#0A2F44] bg-[#e6f0f5] dark:bg-[#1e3a4a]'
                        : 'border-[#e5e7eb] dark:border-[#374151]'
                    }`}
                  >
                    <span className="text-sm font-medium">Two-way Slab</span>
                  </button>
                </div>
              </div>

              {/* Span */}
              <div>
                <label className="block text-sm font-medium text-[#374151] dark:text-[#d1d5db] mb-2">
                  Span (m)
                </label>
                <input
                  type="number"
                  value={formData.spanX}
                  onChange={(e) => setFormData({ ...formData, spanX: e.target.value })}
                  step="0.5"
                  className="w-full px-4 py-2 rounded-xl border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A2F44]"
                />
              </div>

              {/* Loads */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#374151] dark:text-[#d1d5db] mb-2">
                    Dead Load (kN/m²)
                  </label>
                  <input
                    type="number"
                    value={formData.deadLoad}
                    onChange={(e) => setFormData({ ...formData, deadLoad: e.target.value })}
                    step="0.5"
                    className="w-full px-4 py-2 rounded-xl border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#374151] dark:text-[#d1d5db] mb-2">
                    Live Load (kN/m²)
                  </label>
                  <input
                    type="number"
                    value={formData.liveLoad}
                    onChange={(e) => setFormData({ ...formData, liveLoad: e.target.value })}
                    step="0.5"
                    className="w-full px-4 py-2 rounded-xl border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white"
                  />
                </div>
              </div>

              {/* Material */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#374151] dark:text-[#d1d5db] mb-2">
                    Concrete Grade
                  </label>
                  <select
                    value={formData.concreteGrade}
                    onChange={(e) => setFormData({ ...formData, concreteGrade: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white"
                  >
                    <option value="C25/30">C25/30</option>
                    <option value="C30/37">C30/37</option>
                    <option value="C35/45">C35/45</option>
                    <option value="C40/50">C40/50</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#374151] dark:text-[#d1d5db] mb-2">
                    Reinforcement
                  </label>
                  <select
                    value={formData.steelGrade}
                    onChange={(e) => setFormData({ ...formData, steelGrade: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white"
                  >
                    <option value="B500">B500 (500 MPa)</option>
                  </select>
                </div>
              </div>

              {/* Optimise Button */}
              <button
                onClick={handleOptimise}
                disabled={isOptimising}
                className="w-full py-3 bg-[#0A2F44] text-white rounded-xl hover:bg-[#082636] transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isOptimising ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Optimising...</span>
                  </div>
                ) : (
                  'Run Optimisation'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Results */}
        {step === 3 && results && (
          <div>
            <div className="mb-8">
              <button
                onClick={() => setStep(2)}
                className="text-sm text-[#0A2F44] dark:text-[#66a4c2] hover:underline mb-4 flex items-center"
              >
                ← Back to inputs
              </button>
              <h2 className="text-lg font-semibold text-[#02090d] dark:text-white mb-2">
                Optimisation Results
              </h2>
              <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">
                Found {results.options.length} design options
              </p>
            </div>

            {/* Export Buttons */}
            <div className="flex justify-end space-x-3 mb-6">
              <button
                onClick={() => setShowSaveModal(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <FiSave />
                <span>Save Design</span>
              </button>
              <button
                onClick={() => handleExport('json')}
                className="flex items-center space-x-2 px-4 py-2 border border-[#e5e7eb] rounded-lg hover:bg-[#f3f4f6] transition-colors"
              >
                <FiDownload />
                <span>Export JSON</span>
              </button>
              <button
                onClick={() => handleExport('pdf')}
                className="flex items-center space-x-2 px-4 py-2 border border-[#e5e7eb] rounded-lg hover:bg-[#f3f4f6] transition-colors"
              >
                <FiFileText />
                <span>Export PDF</span>
              </button>
            </div>

            {/* Results Table */}
            <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl border border-[#e5e7eb] dark:border-[#374151] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#f9fafb] dark:bg-[#374151] border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#6b7280]">
                        Rank
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#6b7280]">
                        Thickness
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#6b7280]">
                        Reinforcement
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#6b7280]">
                        As prov
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#6b7280]">
                        Cost (€/m²)
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#6b7280]">
                        Carbon
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5e7eb] dark:divide-[#374151]">
                    {results.options.map((opt) => (
                      <tr
                        key={opt.id}
                        className="hover:bg-[#f9fafb] dark:hover:bg-[#374151] transition-colors"
                      >
                        <td className="px-4 py-3">
                          {opt.rank === 1 ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                              ★ Best
                            </span>
                          ) : (
                            `#${opt.rank}`
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium">{opt.thickness} mm</td>
                        <td className="px-4 py-3">
                          φ{opt.barDiameter} @ {opt.spacing}mm
                        </td>
                        <td className="px-4 py-3">{opt.asProv} mm²/m</td>
                        <td className="px-4 py-3">€{opt.cost}</td>
                        <td className="px-4 py-3">{opt.carbon} kgCO₂/m²</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-[#02090d] dark:text-white mb-4">
              Save Design
            </h3>
            <input
              type="text"
              value={designName}
              onChange={(e) => setDesignName(e.target.value)}
              placeholder="Enter design name"
              className="w-full px-4 py-3 rounded-xl border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A2F44] mb-4"
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 border border-[#e5e7eb] rounded-lg text-[#6b7280] hover:bg-[#f3f4f6] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDesign}
                className="px-4 py-2 bg-[#0A2F44] text-white rounded-lg hover:bg-[#082636] cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default QuickDesign
