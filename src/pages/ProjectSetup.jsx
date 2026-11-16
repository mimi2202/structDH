import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  FiArrowLeft,
  FiSun,
  FiMoon,
  FiHome,
  FiBriefcase,
  FiTool,
  FiChevronRight,
  FiChevronLeft,
  FiInfo,
  FiLoader,
  FiMapPin,
} from 'react-icons/fi'
import { useTheme } from '../contexts/ThemeContext'
import { useWorkspace } from '../contexts/WorkspaceContext'
import Dropdown from '../components/Dropdown'
import { PERSONAL_WS, ALL_WS, projectWsId } from '../utils/projects'
import { can } from '../utils/orgRbac'

// Hardcoded UK locations from the document
const ukLocations = [
  // London
  { city: 'Central London', postcode: 'SW1A 1AA', region: 'London' },
  // South East
  { city: 'Reading', postcode: 'RG1 1AA', region: 'South East' },
  { city: 'Brighton', postcode: 'BN1 1AA', region: 'South East' },
  { city: 'Guildford', postcode: 'GU1 1AA', region: 'South East' },
  // South West
  { city: 'Bristol', postcode: 'BS1 1AA', region: 'South West' },
  { city: 'Exeter', postcode: 'EX1 1AA', region: 'South West' },
  { city: 'Plymouth', postcode: 'PL1 1AA', region: 'South West' },
  // East of England
  { city: 'Cambridge', postcode: 'CB1 1AA', region: 'East of England' },
  { city: 'Norwich', postcode: 'NR1 1AA', region: 'East of England' },
  { city: 'Chelmsford', postcode: 'CM1 1AA', region: 'East of England' },
  // West Midlands
  { city: 'Birmingham', postcode: 'B1 1AA', region: 'West Midlands' },
  { city: 'Coventry', postcode: 'CV1 1AA', region: 'West Midlands' },
  { city: 'Wolverhampton', postcode: 'WV1 1AA', region: 'West Midlands' },
  // East Midlands
  { city: 'Nottingham', postcode: 'NG1 1AA', region: 'East Midlands' },
  { city: 'Leicester', postcode: 'LE1 1AA', region: 'East Midlands' },
  { city: 'Derby', postcode: 'DE1 1AA', region: 'East Midlands' },
  // North West
  { city: 'Manchester', postcode: 'M1 1AA', region: 'North West' },
  { city: 'Liverpool', postcode: 'L1 1AA', region: 'North West' },
  { city: 'Preston', postcode: 'PR1 1AA', region: 'North West' },
  // Yorkshire & Humber
  { city: 'Leeds', postcode: 'LS1 1AA', region: 'Yorkshire & Humber' },
  { city: 'Sheffield', postcode: 'S1 1AA', region: 'Yorkshire & Humber' },
  { city: 'York', postcode: 'YO1 1AA', region: 'Yorkshire & Humber' },
  // North East
  { city: 'Newcastle upon Tyne', postcode: 'NE1 1AA', region: 'North East' },
  { city: 'Sunderland', postcode: 'SR1 1AA', region: 'North East' },
  { city: 'Durham', postcode: 'DH1 1AA', region: 'North East' },
  // Scotland
  { city: 'Glasgow', postcode: 'G1 1AA', region: 'Scotland' },
  { city: 'Edinburgh', postcode: 'EH1 1AA', region: 'Scotland' },
  { city: 'Stirling', postcode: 'FK8 1AA', region: 'Scotland' },
  { city: 'Inverness', postcode: 'IV1 1AA', region: 'Scotland' },
  // Wales
  { city: 'Cardiff', postcode: 'CF10 1AA', region: 'Wales' },
  { city: 'Swansea', postcode: 'SA1 1AA', region: 'Wales' },
  { city: 'Newport', postcode: 'NP10 1AA', region: 'Wales' },
  { city: 'Wrexham', postcode: 'LL11 1AA', region: 'Wales' },
  // Northern Ireland
  { city: 'Belfast', postcode: 'BT1 1AA', region: 'Northern Ireland' },
  { city: 'Derry', postcode: 'BT48 6AA', region: 'Northern Ireland' },
  { city: 'Newry', postcode: 'BT34 1AA', region: 'Northern Ireland' },
]

const ProjectSetup = () => {
  const { workspaceId } = useParams()
  const navigate = useNavigate()
  const { isDarkMode, toggleDarkMode } = useTheme()
  const { createProject, workspaces } = useWorkspace()
  // Personal unless created from an organisation's page (or chosen below).
  const [orgChoice, setOrgChoice] = useState(
    workspaceId && workspaceId !== ALL_WS ? workspaceId : PERSONAL_WS
  )
  const [nameError, setNameError] = useState('')
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showLoading, setShowLoading] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [locationInput, setLocationInput] = useState('')
  const [locationSuggestions, setLocationSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  // Where the location list opens: below the field, or above it when the
  // window has no room below (it used to run off the bottom of the screen).
  const locationRef = useRef(null)
  const blurTimer = useRef(null) // closes the list after a click on it has landed
  const [suggestPlace, setSuggestPlace] = useState({ up: false, maxHeight: 256 })
  const placeSuggestions = () => {
    const el = locationRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const below = window.innerHeight - r.bottom - 12
    const above = r.top - 12
    const up = below < 220 && above > below
    setSuggestPlace({ up, maxHeight: Math.max(120, Math.min(256, up ? above : below)) })
  }

  // Form state
  const [formData, setFormData] = useState({
    projectName: '',
    buildingType: 'commercial',
    location: 'London, UK',
    length: '25',
    width: '15',
    height: '18',
    designStandard: 'Eurocode',
  })

  // Filter locations based on input
  useEffect(() => {
    if (locationInput.length > 1) {
      const filtered = ukLocations.filter(
        (loc) =>
          loc.city.toLowerCase().includes(locationInput.toLowerCase()) ||
          loc.postcode.toLowerCase().includes(locationInput.toLowerCase()) ||
          loc.region.toLowerCase().includes(locationInput.toLowerCase())
      )
      setLocationSuggestions(filtered.slice(0, 8))
      setShowSuggestions(true)
    } else {
      setLocationSuggestions([])
      setShowSuggestions(false)
    }
  }, [locationInput])

  const handleLocationSelect = (location) => {
    setFormData((prev) => ({ ...prev, location: `${location.city}, ${location.region}` }))
    setLocationInput(`${location.city}, ${location.region}`)
    setShowSuggestions(false)
  }

  const handleLocationChange = (e) => {
    setLocationInput(e.target.value)
    setFormData((prev) => ({ ...prev, location: e.target.value }))
  }

  // Loading animation effect
  useEffect(() => {
    if (showLoading) {
      const interval = setInterval(() => {
        setLoadingProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval)
            return 100
          }
          return prev + 10
        })
      }, 80)
      return () => clearInterval(interval)
    }
  }, [showLoading])

  // Auto-hide loading after 10 seconds and create project
  useEffect(() => {
    if (loadingProgress >= 100) {
      setTimeout(() => {
        setShowLoading(false)
        handleCreateProject()
      }, 500)
    }
  }, [loadingProgress])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleNext = () => {
    if (step === 1) {
      if (!formData.projectName.trim()) {
        setNameError('Give the project a name.')
        return
      }
      setNameError('')
      setStep(2)
    } else if (step === 2) {
      setShowLoading(true)
    }
  }

  const handleBack = () => {
    setStep(step - 1)
  }

  const handleCreateProject = async () => {
    setIsSubmitting(true)

    const projectData = {
      name: formData.projectName.trim(),
      project_type: formData.buildingType,
      location: formData.location,
      description: `${formData.buildingType} building`,
      settings: {
        dimensions: {
          length: formData.length,
          width: formData.width,
          height: formData.height,
        },
        designStandard: formData.designStandard,
      },
    }

    try {
      const result = await createProject(orgChoice, projectData)
      if (result.success) {
        // straight into the project's design hub (no second loading screen)
        navigate(`/workspace/${projectWsId(result.project)}/projects/${result.project.id}/design`)
      } else {
        console.error('Failed to create project:', result.error)
        setIsSubmitting(false)
      }
    } catch (error) {
      console.error('Error creating project:', error)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] dark:bg-[#111827] flex items-center justify-center py-12 px-4 transition-colors duration-300">
      {/* Theme Toggle */}
      <button
        onClick={toggleDarkMode}
        className="absolute top-4 right-4 p-3 rounded-lg bg-white dark:bg-[#1f2937] shadow-lg hover:shadow-xl transition-all z-10 cursor-pointer"
      >
        {isDarkMode ? (
          <FiSun className="text-xl text-yellow-500" />
        ) : (
          <FiMoon className="text-xl text-[#0A2F44]" />
        )}
      </button>

      {/* Main Card */}
      <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-xl max-w-2xl w-full p-8 border border-[#e5e7eb] dark:border-[#374151] relative">
        {/* Logo */}
        <div className="flex items-center justify-center mb-6">
          <div className="w-12 h-12 bg-[#0A2F44] rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">SDH</span>
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#02090d] dark:text-white">
            New Project
          </h1>
          <p className="text-sm text-[#6b7280] dark:text-[#9ca3af] mt-2">
            Personal projects can be moved into an organisation later
          </p>
        </div>

        {/* Progress Steps */}
        {!showLoading && (
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-[#0A2F44] text-white' : 'bg-[#e5e7eb] dark:bg-[#374151] text-[#6b7280]'}`}
              >
                1
              </div>
              <div
                className={`w-16 h-1 mx-2 ${step >= 2 ? 'bg-[#0A2F44]' : 'bg-[#e5e7eb] dark:bg-[#374151]'}`}
              />
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-[#0A2F44] text-white' : 'bg-[#e5e7eb] dark:bg-[#374151] text-[#6b7280]'}`}
              >
                2
              </div>
            </div>
          </div>
        )}

        {/* Loading Splash Screen */}
        {showLoading && (
          <div className="py-12 flex flex-col items-center justify-center min-h-[400px]">
            <div className="relative mb-8">
              <div className="w-24 h-24 bg-[#0A2F44] rounded-2xl flex items-center justify-center animate-pulse">
                <span className="text-white text-4xl font-bold">SDH</span>
              </div>
              <div className="absolute -top-2 -right-2">
                <FiLoader className="text-3xl text-[#0A2F44] animate-spin" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-[#02090d] dark:text-white mb-4">
              Creating Your Workspace
            </h2>
            <p className="text-[#6b7280] dark:text-[#9ca3af] text-center mb-8 max-w-md">
              Setting up your project structure...
            </p>
            <div className="w-64 h-2 bg-[#e5e7eb] dark:bg-[#374151] rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-[#0A2F44] transition-all duration-300 ease-out"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
            <p className="text-sm text-[#0A2F44] dark:text-[#cce1eb] font-medium">
              {loadingProgress}% Complete
            </p>
          </div>
        )}

        {/* Step 1: Basic Information */}
        {!showLoading && step === 1 && (
          <form onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-[#374151] dark:text-[#d1d5db] mb-2">
                  Project Name
                </label>
                <input
                  type="text"
                  name="projectName"
                  value={formData.projectName}
                  onChange={handleChange}
                  placeholder="e.g., Riverside Apartments"
                  className="w-full px-4 py-3 rounded-lg border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A2F44]"
                  required
                />
                {nameError && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{nameError}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-[#374151] dark:text-[#d1d5db] mb-2">
                  Organisation
                </label>
                <Dropdown
                  value={orgChoice}
                  onChange={setOrgChoice}
                  className="py-3"
                  options={[
                    { value: PERSONAL_WS, label: 'Personal (no organisation)' },
                    ...workspaces
                      .filter((w) => can(w.userRole, 'project.create'))
                      .map((w) => ({ value: w.id, label: w.name })),
                  ]}
                />
                {workspaces.length === 0 && (
                  <p className="mt-1 text-xs text-[#6b7280] dark:text-[#9ca3af]">
                    You are not in an organisation yet, so this project will be personal.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-[#374151] dark:text-[#d1d5db] mb-2">
                  Building Type
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { type: 'residential', icon: FiHome, label: 'Residential' },
                    { type: 'commercial', icon: FiBriefcase, label: 'Commercial' },
                    { type: 'industrial', icon: FiTool, label: 'Industrial' },
                  ].map((option) => (
                    <button
                      key={option.type}
                      type="button"
                      onClick={() => setFormData({ ...formData, buildingType: option.type })}
                      className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                        formData.buildingType === option.type
                          ? 'border-[#0A2F44] bg-[#e6f0f5] dark:bg-[#1e3a4a]'
                          : 'border-[#e5e7eb] dark:border-[#374151] hover:border-[#99c2d6]'
                      }`}
                    >
                      <option.icon className="mx-auto text-2xl mb-2 text-[#0A2F44]" />
                      <span className="text-sm font-medium text-[#374151] dark:text-[#d1d5db]">
                        {option.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Location with Autocomplete */}
              <div className="relative">
                <label className="block text-sm font-medium text-[#374151] dark:text-[#d1d5db] mb-2">
                  Location
                </label>
                <div className="relative" ref={locationRef}>
                  <FiMapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#9ca3af]" />
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => { placeSuggestions(); handleLocationChange(e) }}
                    onFocus={() => { clearTimeout(blurTimer.current); placeSuggestions(); if (locationInput.length > 1) setShowSuggestions(true) }}
                    onBlur={() => { blurTimer.current = setTimeout(() => setShowSuggestions(false), 150) }}
                    onKeyDown={(e) => { if (e.key === 'Escape') setShowSuggestions(false) }}
                    placeholder="e.g., London, UK or postcode"
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A2F44]"
                  />

                {/* Suggestions Dropdown (inside the field's box, so it can open up or down) */}
                {showSuggestions && locationSuggestions.length > 0 && (
                  <div data-location-suggestions className={`absolute left-0 z-20 w-full bg-white dark:bg-[#1f2937] border border-[#e5e7eb] dark:border-[#374151] rounded-lg shadow-xl overflow-auto ${suggestPlace.up ? 'bottom-full mb-1' : 'top-full mt-1'}`}
                    style={{ maxHeight: suggestPlace.maxHeight }}>
                    {locationSuggestions.map((loc, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleLocationSelect(loc)}
                        className="w-full px-4 py-3 text-left hover:bg-[#f3f4f6] dark:hover:bg-[#374151] transition-colors flex items-center justify-between cursor-pointer"
                      >
                        <div>
                          <p className="text-sm font-medium text-[#02090d] dark:text-white">
                            {loc.city}
                          </p>
                          <p className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
                            {loc.region} • {loc.postcode}
                          </p>
                        </div>
                        <FiMapPin className="text-[#0A2F44] text-sm" />
                      </button>
                    ))}
                  </div>
                )}
                </div>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-end mt-8 pt-4 border-t border-[#e5e7eb] dark:border-[#374151]">
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center space-x-2 px-6 py-2 bg-[#0A2F44] text-white rounded-lg hover:bg-[#082636] transition-colors cursor-pointer"
              >
                <span>Continue</span> <FiChevronRight />
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Summary & Review */}
        {!showLoading && step === 2 && (
          <form onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-6">
              <div className="bg-[#f3f4f6] dark:bg-[#374151] rounded-lg p-6 space-y-4">
                <h3 className="font-semibold text-[#02090d] dark:text-white">Project Summary</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-[#6b7280] dark:text-[#9ca3af]">Project Name</p>
                    <p className="font-medium text-[#02090d] dark:text-white">
                      {formData.projectName}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#6b7280] dark:text-[#9ca3af]">Building Type</p>
                    <p className="font-medium text-[#02090d] dark:text-white capitalize">
                      {formData.buildingType}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#6b7280] dark:text-[#9ca3af]">Organisation</p>
                    <p className="font-medium text-[#02090d] dark:text-white">
                      {workspaces.find((w) => w.id === orgChoice)?.name || 'Personal'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#6b7280] dark:text-[#9ca3af]">Location</p>
                    <p className="font-medium text-[#02090d] dark:text-white">
                      {formData.location}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-[#e6f0f5] dark:bg-[#1e3a4a] rounded-lg p-4">
                <p className="text-sm text-[#0A2F44] dark:text-[#cce1eb]">
                  You can invite team members after creating your workspace. Team members can be
                  added from the workspace settings.
                </p>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8 pt-4 border-t border-[#e5e7eb] dark:border-[#374151]">
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center space-x-2 px-6 py-2 border border-[#e5e7eb] dark:border-[#374151] rounded-lg text-[#374151] dark:text-[#d1d5db] hover:bg-[#f3f4f6] dark:hover:bg-[#374151] transition-colors cursor-pointer"
              >
                <FiChevronLeft /> <span>Back</span>
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center space-x-2 px-6 py-2 bg-[#0A2F44] text-white rounded-lg hover:bg-[#082636] transition-colors cursor-pointer"
              >
                <span>Create Project</span> <FiChevronRight />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default ProjectSetup
