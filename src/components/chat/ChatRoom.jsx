import React, { useState, useRef, useEffect } from 'react'
import {
  FiMessageSquare,
  FiUsers,
  FiPhone,
  FiVideo,
  FiPaperclip,
  FiSend,
  FiX,
  FiMinimize2,
  FiMaximize2,
  FiUser,
  FiCheck,
  FiCheckCircle,
  FiMoreVertical,
  FiImage,
  FiFile,
} from 'react-icons/fi'
import { useChat } from '../../contexts/ChatContext'
import { useAuth } from '../../contexts/AuthContext'

const ChatRoom = ({ workspaceId, projectId, projectName }) => {
  const { user } = useAuth()
  const { messages, onlineUsers, sendMessage, sendFile, startCall, isCallActive } = useChat()

  const [messageInput, setMessageInput] = useState('')
  const [isExpanded, setIsExpanded] = useState(true)
  const [showUsers, setShowUsers] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const [isTyping, setIsTyping] = useState(false)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = () => {
    if (messageInput.trim()) {
      sendMessage(messageInput)
      setMessageInput('')
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB')
        return
      }
      sendFile(file)
    }
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now - date

    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`
    if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return date.toLocaleDateString()
  }

  const getFileIcon = (fileType) => {
    if (fileType?.startsWith('image/')) return <FiImage className="text-blue-500" />
    return <FiFile className="text-gray-500" />
  }

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-[#0A2F44] text-white rounded-full shadow-lg hover:bg-[#082636] transition-all flex items-center justify-center z-40 cursor-pointer group"
      >
        <FiMessageSquare className="text-2xl" />
        {messages.filter((m) => !m.read && m.sender.id !== user?.id).length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center animate-pulse">
            {messages.filter((m) => !m.read && m.sender.id !== user?.id).length}
          </span>
        )}
        <span className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          Open Chat
        </span>
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 w-[420px] h-[580px] bg-white dark:bg-[#1f2937] rounded-xl shadow-2xl border border-[#e5e7eb] dark:border-[#374151] flex flex-col z-50 overflow-hidden animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#0A2F44] text-white">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <FiMessageSquare className="text-lg" />
            {onlineUsers.length > 0 && (
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full"></div>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-sm">Project Chat</h3>
            <p className="text-xs text-white/70">{onlineUsers.length} online</p>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={() => {
              const otherUser = onlineUsers.find((u) => u.id !== user?.id)
              if (otherUser) startCall(otherUser, 'voice')
              else alert('No other users online')
            }}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
            title="Voice Call"
          >
            <FiPhone className="text-sm" />
          </button>
          <button
            onClick={() => {
              const otherUser = onlineUsers.find((u) => u.id !== user?.id)
              if (otherUser) startCall(otherUser, 'video')
              else alert('No other users online')
            }}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
            title="Video Call"
          >
            <FiVideo className="text-sm" />
          </button>
          <button
            onClick={() => setShowUsers(!showUsers)}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors cursor-pointer relative"
            title="Online Users"
          >
            <FiUsers className="text-sm" />
            {showUsers && <div className="absolute inset-0 bg-white/10 rounded-lg"></div>}
          </button>
          <button
            onClick={() => setIsExpanded(false)}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
            title="Minimize"
          >
            <FiMinimize2 className="text-sm" />
          </button>
        </div>
      </div>

      {/* Online Users Panel */}
      {showUsers && (
        <div className="absolute right-12 top-12 w-56 bg-white dark:bg-[#1f2937] border border-[#e5e7eb] dark:border-[#374151] rounded-lg shadow-xl z-10 overflow-hidden">
          <div className="p-2 border-b border-[#e5e7eb] dark:border-[#374151]">
            <h4 className="text-xs font-semibold text-[#6b7280] dark:text-[#9ca3af]">
              Online Members
            </h4>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {onlineUsers.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between px-3 py-2 hover:bg-[#f3f4f6] dark:hover:bg-[#374151]"
              >
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <div className="w-6 h-6 bg-[#e6f0f5] dark:bg-[#1e3a4a] rounded-full flex items-center justify-center text-[10px] font-medium text-[#0A2F44]">
                      {u.avatar || u.name.charAt(0)}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-white dark:border-gray-700"></div>
                  </div>
                  <span className="text-sm text-[#02090d] dark:text-white">{u.name}</span>
                </div>
                {u.role === 'admin' && <span className="text-xs text-[#0A2F44]">Admin</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f9fafb] dark:bg-[#111827]">
        {messages.map((msg, idx) => {
          const isCurrentUser = msg.sender.id === user?.id || msg.sender.name === 'You'

          return (
            <div
              key={msg.id}
              className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} animate-fade-in`}
            >
              <div className={`max-w-[75%] ${isCurrentUser ? 'order-2' : 'order-1'}`}>
                {!isCurrentUser && (
                  <div className="flex items-center space-x-2 mb-1">
                    <div className="w-5 h-5 bg-[#e6f0f5] dark:bg-[#1e3a4a] rounded-full flex items-center justify-center text-[8px] font-medium text-[#0A2F44]">
                      {msg.sender.avatar || msg.sender.name.charAt(0)}
                    </div>
                    <p className="text-xs font-medium text-[#6b7280] dark:text-[#9ca3af]">
                      {msg.sender.name}
                    </p>
                  </div>
                )}

                <div
                  className={`rounded-lg p-3 ${
                    isCurrentUser
                      ? 'bg-[#0A2F44] text-white'
                      : 'bg-white dark:bg-[#1f2937] text-[#02090d] dark:text-white border border-[#e5e7eb] dark:border-[#374151]'
                  }`}
                >
                  {msg.type === 'text' && <p className="text-sm break-words">{msg.content}</p>}
                  {msg.type === 'file' && (
                    <div className="flex items-center space-x-2">
                      {getFileIcon(msg.fileType)}
                      <div>
                        <p className="text-sm font-medium">{msg.fileName}</p>
                        <p className="text-xs opacity-70">{Math.round(msg.fileSize / 1024)} KB</p>
                      </div>
                    </div>
                  )}
                  <div
                    className={`flex items-center justify-end space-x-1 mt-1 ${
                      isCurrentUser ? 'text-white/50' : 'text-[#9ca3af]'
                    }`}
                  >
                    <p className="text-[10px]">{formatTime(msg.timestamp)}</p>
                    {isCurrentUser &&
                      (msg.read ? (
                        <FiCheckCircle className="text-[10px]" />
                      ) : (
                        <FiCheck className="text-[10px]" />
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-[#1f2937] rounded-lg p-2 border border-[#e5e7eb] dark:border-[#374151]">
              <div className="flex space-x-1">
                <div
                  className="w-2 h-2 bg-[#0A2F44] rounded-full animate-bounce"
                  style={{ animationDelay: '0ms' }}
                ></div>
                <div
                  className="w-2 h-2 bg-[#0A2F44] rounded-full animate-bounce"
                  style={{ animationDelay: '150ms' }}
                ></div>
                <div
                  className="w-2 h-2 bg-[#0A2F44] rounded-full animate-bounce"
                  style={{ animationDelay: '300ms' }}
                ></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#1f2937]">
        <div className="flex items-end space-x-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-[#6b7280] hover:text-[#0A2F44] dark:hover:text-[#66a4c2] transition-colors cursor-pointer rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#374151]"
            title="Attach file"
          >
            <FiPaperclip className="text-lg" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
          />

          <textarea
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            rows="1"
            className="flex-1 px-3 py-2 rounded-lg border border-[#e5e7eb] dark:border-[#374151] bg-[#f9fafb] dark:bg-[#374151] text-[#02090d] dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-[#0A2F44] text-sm"
          />

          <button
            onClick={handleSendMessage}
            disabled={!messageInput.trim()}
            className="p-2 bg-[#0A2F44] text-white rounded-lg hover:bg-[#082636] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <FiSend className="text-lg" />
          </button>
        </div>

        <p className="text-xs text-[#9ca3af] mt-2 text-center">
          Files up to 10MB • End-to-end encrypted
        </p>
      </div>

      {/* Call Status Bar (if call is active) */}
      {isCallActive && (
        <div className="absolute bottom-16 left-0 right-0 mx-4 p-2 bg-green-500 text-white rounded-lg text-center text-sm animate-pulse">
          Call in progress...
        </div>
      )}
    </div>
  )
}

export default ChatRoom
