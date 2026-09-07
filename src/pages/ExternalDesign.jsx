import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  FiArrowLeft,
  FiDownload,
  FiRefreshCw,
  FiCheckCircle,
  FiAlertCircle,
  FiClock,
  FiSun,
  FiMoon,
  FiUpload,
  FiPlay,
  FiStopCircle,
  FiEye,
  FiLock,
  FiUsers,
  FiSave,
} from 'react-icons/fi'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { useWorkspace, ROLES } from '../contexts/WorkspaceContext'

const ExternalDesign = () => {
  const navigate = useNavigate()
  const { workspaceId, projectId, workId } = useParams()
  const { isDarkMode, toggleDarkMode } = useTheme()
  const { user } = useAuth()
  const { currentWorkspace, currentProject } = useWorkspace()

  const [step, setStep] = useState(1)
  const [selectedTool, setSelectedTool] = useState(null)
  const [fileName, setFileName] = useState('')
  const [isAgentInstalled, setIsAgentInstalled] = useState(null)
  const [isPolling, setIsPolling] = useState(false)
  const [sessionStatus, setSessionStatus] = useState(null)
  const [pollingProgress, setPollingProgress] = useState(0)
  const [sessionId, setSessionId] = useState(null)
  const [pollingInterval, setPollingInterval] = useState(null)
  const [updateLog, setUpdateLog] = useState([])

  // Check if user has edit permission
  const userRole = currentProject?.userRole
  const canEdit =
    userRole === ROLES.PROJECT_OWNER ||
    userRole === ROLES.PROJECT_ADMIN ||
    userRole === ROLES.PROJECT_EDITOR

  const externalTools = [
    {
      id: 'tekla',
      name: 'Tekla Structures',
      icon: '🏗️',
      description: 'Structural BIM software',
      version: '2023-2024',
    },
    {
      id: 'revit',
      name: 'Autodesk Revit',
      icon: '🏛️',
      description: 'BIM for architecture and structure',
      version: '2024',
    },
    {
      id: 'etabs',
      name: 'ETABS',
      icon: '📊',
      description: 'Building analysis and design',
      version: '20',
    },
    {
      id: 'sap2000',
      name: 'SAP2000',
      icon: '📐',
      description: 'General purpose structural analysis',
      version: '25',
    },
  ]

  // Check if SDH Agent is installed
  const checkAgentInstallation = () => {
    // Simulate checking for desktop agent
    setIsAgentInstalled(false)
  }

  // Add to update log
  const addToLog = (message, type = 'info') => {
    setUpdateLog((prev) =>
      [
        {
          id: Date.now(),
          message,
          type,
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ].slice(0, 20)
    )
  }

  // Start session
  const startSession = async () => {
    if (!fileName.trim()) {
      alert('Please enter a file name')
      return
    }

    setIsPolling(true)
    addToLog(`Starting external session for "${fileName}"...`, 'info')

    // Simulate session creation
    setTimeout(() => {
      const newSessionId = `session_${Date.now()}`
      setSessionId(newSessionId)
      addToLog(`Session created: ${newSessionId}`, 'success')
      startPolling()
    }, 1500)
  }

  // Start polling simulation
  const startPolling = () => {
    let progress = 0
    const interval = setInterval(() => {
      progress += Math.random() * 15 + 5
      if (progress >= 100) {
        clearInterval(interval)
        setPollingProgress(100)
        setSessionStatus('active')
        setIsPolling(false)
        addToLog('External tool connected successfully!', 'success')
        addToLog('You can now work in your external software', 'info')
      } else {
        setPollingProgress(Math.min(progress, 99))
        if (Math.random() > 0.7) {
          addToLog('Polling for updates...', 'info')
        }
      }
    }, 2000)
    setPollingInterval(interval)
  }

  // Manual poll for updates
  const pollForUpdates = () => {
    addToLog('Checking for updates from external tool...', 'info')
    setTimeout(() => {
      const hasUpdates = Math.random() > 0.5
      if (hasUpdates) {
        addToLog('New updates found! Pulling changes...', 'success')
        setTimeout(() => {
          addToLog('Updates synced successfully', 'success')
        }, 1000)
      } else {
        addToLog('No new updates found', 'info')
      }
    }, 1500)
  }

  // Push updates to external tool
  const pushUpdates = () => {
    if (!canEdit) {
      alert(
        'You do not have permission to push updates. Only project owners, admins, and editors can modify designs.'
      )
      return
    }

    addToLog('Pushing changes to external tool...', 'info')
    setTimeout(() => {
      addToLog('Changes pushed successfully!', 'success')
      addToLog('External tool has been updated', 'info')
    }, 2000)
  }

  // End session
  const endSession = () => {
    if (window.confirm('End this design session? Your work will be saved.')) {
      if (pollingInterval) clearInterval(pollingInterval)
      addToLog('Session ended', 'warning')
      setSessionStatus('ended')
      setStep(2)
      setSessionId(null)
      setPollingProgress(0)
      setUpdateLog([])
    }
  }

  // Save work
  const saveWork = () => {
    addToLog('Saving work to StructAI...', 'info')
    setTimeout(() => {
      addToLog('Work saved successfully!', 'success')
      // Save to localStorage for demo
      const savedWork = {
        id: Date.now(),
        name: fileName,
        tool: selectedTool?.name,
        sessionId: sessionId,
        projectId: projectId,
        workspaceId: workspaceId,
        savedAt: new Date().toISOString(),
      }
      const existing = JSON.parse(localStorage.getItem('external_works') || '[]')
      localStorage.setItem('external_works', JSON.stringify([savedWork, ...existing]))
    }, 1000)
  }

  // Download SDH Agent
  const downloadAgent = () => {
    window.open('https://sdh-agent.structai.com/download', '_blank')
    alert('Download started. After installation, refresh and click "Check Status"')
  }

  // Load existing work if editing
  useEffect(() => {
    if (workId) {
      const savedWorks = JSON.parse(localStorage.getItem('external_works') || '[]')
      const work = savedWorks.find((w) => w.id === parseInt(workId))
      if (work) {
        setFileName(work.name)
        setSelectedTool(externalTools.find((t) => t.name === work.tool))
        setStep(2)
      }
    }
  }, [workId])

  return (
    <div className="min-h-screen bg-[#f3f4f6] dark:bg-[#111827]">
      {/* Header */}
      <div className="bg-white dark:bg-[#1f2937] border-b border-[#e5e7eb] dark:border-[#374151] sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() =>
                  navigate(
                    projectId ? `/workspace/${workspaceId}/projects/${projectId}` : '/dashboard'
                  )
                }
                className="p-2 rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#374151] transition-colors"
              >
                <FiArrowLeft className="text-xl text-[#6b7280]" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-[#02090d] dark:text-white">
                  External Design
                </h1>
                <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">
                  Work with external structural design tools via SDH Agent
                </p>
              </div>
            </div>
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#374151] transition-colors"
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

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Step 1: Select External Tool */}
        {step === 1 && (
          <div>
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-[#02090d] dark:text-white mb-2">
                Select External Tool
              </h2>
              <p className="text-sm text-[#6b7280]">
                Choose the software you want to use for your design
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {externalTools.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => {
                    setSelectedTool(tool)
                    setStep(2)
                  }}
                  className="p-5 bg-white dark:bg-[#1f2937] rounded-2xl border-2 border-[#e5e7eb] dark:border-[#374151] text-left hover:border-[#0A2F44] transition-all cursor-pointer group"
                >
                  <div className="text-3xl mb-2">{tool.icon}</div>
                  <h3 className="font-semibold text-[#02090d] dark:text-white group-hover:text-[#0A2F44] transition-colors">
                    {tool.name}
                  </h3>
                  <p className="text-xs text-[#6b7280] mt-1">{tool.description}</p>
                  <p className="text-xs text-[#9ca3af] mt-2">Version {tool.version}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Session Setup */}
        {step === 2 && selectedTool && (
          <div>
            <button
              onClick={() => setStep(1)}
              className="text-sm text-[#0A2F44] dark:text-[#66a4c2] hover:underline mb-6 flex items-center"
            >
              ← Back to tools
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Panel - Setup */}
              <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl border border-[#e5e7eb] dark:border-[#374151] p-6">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="text-3xl">{selectedTool.icon}</div>
                  <div>
                    <h2 className="text-lg font-semibold text-[#02090d] dark:text-white">
                      {selectedTool.name}
                    </h2>
                    <p className="text-sm text-[#6b7280]">External design session</p>
                  </div>
                </div>

                {/* SDH Agent Status */}
                <div className="mb-6 p-4 bg-[#f9fafb] dark:bg-[#374151] rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-[#02090d] dark:text-white">
                      SDH Agent Status
                    </span>
                    {isAgentInstalled === true && (
                      <span className="flex items-center text-green-600 text-sm">
                        <FiCheckCircle className="mr-1" /> Connected
                      </span>
                    )}
                    {isAgentInstalled === false && (
                      <span className="flex items-center text-red-500 text-sm">
                        <FiAlertCircle className="mr-1" /> Not Found
                      </span>
                    )}
                    {isAgentInstalled === null && (
                      <button
                        onClick={checkAgentInstallation}
                        className="text-sm text-[#0A2F44] hover:underline"
                      >
                        Check Status
                      </button>
                    )}
                  </div>

                  {isAgentInstalled === false && (
                    <div className="space-y-3">
                      <p className="text-sm text-[#6b7280]">
                        SDH Agent is required to work with external tools.
                      </p>
                      <button
                        onClick={downloadAgent}
                        className="flex items-center space-x-2 px-4 py-2 bg-[#0A2F44] text-white rounded-lg hover:bg-[#082636]"
                      >
                        <FiDownload /> <span>Download SDH Agent</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* File Name */}
                {isAgentInstalled === true && (
                  <>
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-[#374151] dark:text-[#d1d5db] mb-2">
                        Design Name
                      </label>
                      <input
                        type="text"
                        value={fileName}
                        onChange={(e) => setFileName(e.target.value)}
                        placeholder="e.g., Office Building Slab Design"
                        className="w-full px-4 py-3 rounded-xl border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A2F44]"
                      />
                    </div>

                    {/* Permission Info */}
                    <div
                      className={`mb-6 p-3 rounded-lg ${canEdit ? 'bg-green-50 dark:bg-green-900/20' : 'bg-yellow-50 dark:bg-yellow-900/20'}`}
                    >
                      <div className="flex items-start space-x-2">
                        {canEdit ? (
                          <FiCheckCircle className="text-green-500 mt-0.5" />
                        ) : (
                          <FiEye className="text-yellow-500 mt-0.5" />
                        )}
                        <div>
                          <p className="text-sm font-medium">
                            {canEdit ? 'You can edit this design' : 'View-only access'}
                          </p>
                          <p className="text-xs text-[#6b7280] mt-1">
                            {canEdit
                              ? 'You can push updates and save changes to this design.'
                              : 'Only project owners, admins, and editors can modify this design.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Start Button */}
                    <button
                      onClick={startSession}
                      disabled={!fileName.trim() || isPolling}
                      className="w-full py-3 bg-[#0A2F44] text-white rounded-xl hover:bg-[#082636] transition-colors disabled:opacity-50 font-medium flex items-center justify-center space-x-2"
                    >
                      {isPolling ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Connecting to {selectedTool.name}...</span>
                        </>
                      ) : (
                        <>
                          <FiPlay />
                          <span>Start External Session</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>

              {/* Right Panel - Recent Works */}
              <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl border border-[#e5e7eb] dark:border-[#374151] p-6">
                <h3 className="font-semibold text-[#02090d] dark:text-white mb-4">
                  Recent External Works
                </h3>
                <div className="space-y-3">
                  {JSON.parse(localStorage.getItem('external_works') || '[]')
                    .slice(0, 5)
                    .map((work) => (
                      <button
                        key={work.id}
                        onClick={() => {
                          setFileName(work.name)
                          setSelectedTool(externalTools.find((t) => t.name === work.tool))
                        }}
                        className="w-full p-3 text-left hover:bg-[#f9fafb] dark:hover:bg-[#374151] rounded-xl transition-colors border border-[#e5e7eb] dark:border-[#374151]"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-[#02090d] dark:text-white">
                              {work.name}
                            </p>
                            <p className="text-xs text-[#6b7280]">
                              {work.tool} • {new Date(work.savedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <FiSave className="text-[#0A2F44]" />
                        </div>
                      </button>
                    ))}
                  {JSON.parse(localStorage.getItem('external_works') || '[]').length === 0 && (
                    <p className="text-sm text-[#6b7280] text-center py-8">
                      No saved external works yet
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Active Session */}
        {step === 3 && sessionId && selectedTool && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Session Panel */}
            <div className="lg:col-span-2 bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl border border-[#e5e7eb] dark:border-[#374151] overflow-hidden">
              <div className="p-6 border-b border-[#e5e7eb] dark:border-[#374151] bg-gradient-to-r from-[#0A2F44]/10 to-transparent">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="text-3xl">{selectedTool.icon}</div>
                    <div>
                      <h2 className="font-semibold text-[#02090d] dark:text-white">{fileName}</h2>
                      <p className="text-xs text-[#6b7280]">Session: {sessionId}</p>
                    </div>
                  </div>
                  <span className="flex items-center text-green-600 text-sm">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                    Connected
                  </span>
                </div>
              </div>

              <div className="p-6">
                {/* Progress */}
                <div className="mb-6">
                  <div className="flex justify-between text-sm mb-2">
                    <span>Session Progress</span>
                    <span>{Math.round(pollingProgress)}%</span>
                  </div>
                  <div className="w-full h-2 bg-[#e5e7eb] dark:bg-[#374151] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#0A2F44] rounded-full transition-all duration-300"
                      style={{ width: `${pollingProgress}%` }}
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <button
                    onClick={pollForUpdates}
                    className="flex items-center justify-center space-x-2 px-3 py-2 border border-[#e5e7eb] dark:border-[#374151] rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#374151] transition-colors text-sm"
                  >
                    <FiRefreshCw />
                    <span>Poll</span>
                  </button>
                  {canEdit && (
                    <button
                      onClick={pushUpdates}
                      className="flex items-center justify-center space-x-2 px-3 py-2 bg-[#0A2F44] text-white rounded-lg hover:bg-[#082636] transition-colors text-sm"
                    >
                      <FiUpload />
                      <span>Push</span>
                    </button>
                  )}
                  <button
                    onClick={saveWork}
                    className="flex items-center justify-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                  >
                    <FiSave />
                    <span>Save</span>
                  </button>
                </div>

                {/* End Session */}
                <button
                  onClick={endSession}
                  className="w-full py-2 text-red-500 border border-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm"
                >
                  End Session
                </button>
              </div>
            </div>

            {/* Update Log Panel */}
            <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl border border-[#e5e7eb] dark:border-[#374151] p-6">
              <h3 className="font-semibold text-[#02090d] dark:text-white mb-4 flex items-center">
                <FiClock className="mr-2" /> Activity Log
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {updateLog.map((log) => (
                  <div
                    key={log.id}
                    className="text-xs p-2 bg-[#f9fafb] dark:bg-[#374151] rounded-lg"
                  >
                    <div className="flex items-center space-x-2">
                      {log.type === 'success' && <FiCheckCircle className="text-green-500" />}
                      {log.type === 'warning' && <FiAlertCircle className="text-yellow-500" />}
                      {log.type === 'info' && <FiClock className="text-blue-500" />}
                      <span className="text-[#02090d] dark:text-white">{log.message}</span>
                    </div>
                    <p className="text-[10px] text-[#6b7280] mt-1">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                ))}
                {updateLog.length === 0 && (
                  <p className="text-sm text-[#6b7280] text-center py-8">
                    Waiting for session to start...
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ExternalDesign
