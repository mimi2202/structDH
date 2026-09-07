// src/components/notifications/NotificationBell.jsx
import React, { useState, useRef, useEffect } from 'react'
import {
  FiBell,
  FiX,
  FiCheck,
  FiTrash2,
  FiMail,
  FiUserPlus,
  FiShield,
  FiFolder,
} from 'react-icons/fi'
import { useNotifications } from '../../contexts/NotificationContext'
import { useNavigate } from 'react-router-dom'

const NotificationBell = () => {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    acceptInvite,
    rejectInvite,
    acceptTransfer,
    deleteNotification,
  } = useNotifications()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'invite':
        return <FiUserPlus className="text-blue-500" />
      case 'transfer':
        return <FiShield className="text-purple-500" />
      case 'member_joined':
        return <FiUserPlus className="text-green-500" />
      default:
        return <FiMail className="text-gray-500" />
    }
  }

  const formatTime = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  }

  const handleNotificationClick = (notification) => {
    markAsRead(notification.id)

    if (notification.type === 'invite') {
      // Show modal or handle inline
      if (
        window.confirm(
          `Accept invitation to ${notification.workspace_name || notification.project_name} as ${notification.role}?`
        )
      ) {
        acceptInvite(notification)
      } else {
        rejectInvite(notification)
      }
    } else if (notification.type === 'transfer') {
      if (window.confirm(`Accept ownership transfer of "${notification.workspace_name}"?`)) {
        acceptTransfer(notification)
      }
    } else {
      // Navigate to relevant page
      if (notification.workspace_id) {
        navigate(`/workspace/${notification.workspace_id}`)
      }
    }
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#374151] transition-colors cursor-pointer"
      >
        <FiBell className="text-xl text-[#6b7280] dark:text-[#9ca3af]" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-[#1f2937] border border-[#e5e7eb] dark:border-[#374151] rounded-xl shadow-2xl overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#e5e7eb] dark:border-[#374151]">
            <h3 className="font-semibold text-[#02090d] dark:text-white">Notifications</h3>
            {notifications.length > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-[#0A2F44] dark:text-[#66a4c2] hover:underline cursor-pointer"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <FiBell className="text-4xl text-[#9ca3af] dark:text-[#6b7280] mx-auto mb-2" />
                <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">No notifications</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border-b border-[#e5e7eb] dark:border-[#374151] hover:bg-[#f9fafb] dark:hover:bg-[#374151] transition-colors cursor-pointer ${
                    !notification.read ? 'bg-[#e6f0f5] dark:bg-[#1e3a4a]/30' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 bg-[#e6f0f5] dark:bg-[#1e3a4a] rounded-full flex items-center justify-center flex-shrink-0">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#02090d] dark:text-white">
                        {notification.title}
                      </p>
                      <p className="text-xs text-[#6b7280] dark:text-[#9ca3af] mt-0.5">
                        {notification.message}
                      </p>
                      <p className="text-xs text-[#9ca3af] dark:text-[#6b7280] mt-1">
                        {formatTime(notification.created_at)}
                      </p>

                      {/* Action buttons for pending invites */}
                      {notification.status === 'pending' && (
                        <div className="flex space-x-2 mt-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              acceptInvite(notification)
                            }}
                            className="px-3 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700"
                          >
                            Accept
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              rejectInvite(notification)
                            }}
                            className="px-3 py-1 text-xs border border-red-500 text-red-500 rounded-lg hover:bg-red-50"
                          >
                            Decline
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteNotification(notification.id)
                      }}
                      className="text-[#9ca3af] hover:text-red-500 transition-colors"
                    >
                      <FiTrash2 className="text-sm" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationBell
