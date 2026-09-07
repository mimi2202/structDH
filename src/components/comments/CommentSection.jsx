import React, { useState, useEffect, useRef } from 'react'
import {
  FiMessageSquare,
  FiSend,
  FiTrash2,
  FiEdit2,
  FiUser,
  FiClock,
  FiMoreVertical,
  FiX,
  FiCheckCircle,
  FiAlertCircle,
} from 'react-icons/fi'
import { useAuth } from '../../contexts/AuthContext'
import { useWorkspace, ROLES } from '../../contexts/WorkspaceContext'

const CommentSection = ({ workId, workOwnerId, projectId, onCommentCountChange }) => {
  const { user } = useAuth()
  const { currentProject } = useWorkspace()
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [editingCommentId, setEditingCommentId] = useState(null)
  const [editingContent, setEditingContent] = useState('')
  const [showActionMenu, setShowActionMenu] = useState(null)
  const textareaRef = useRef(null)
  const editTextareaRef = useRef(null)

  // Mock comments data
  const mockComments = [
    {
      id: 'comment-1',
      work_id: workId,
      author_id: 'user-1',
      author_name: 'John Engineer',
      author_avatar: 'JE',
      content: 'The reinforcement spacing looks good. Consider increasing cover for durability.',
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date(Date.now() - 86400000).toISOString(),
      edited: false,
    },
    {
      id: 'comment-2',
      work_id: workId,
      author_id: 'user-2',
      author_name: 'Sarah Designer',
      author_avatar: 'SD',
      content: 'I agree with John. Also check the deflection calculations.',
      created_at: new Date(Date.now() - 43200000).toISOString(),
      updated_at: new Date(Date.now() - 43200000).toISOString(),
      edited: false,
    },
    {
      id: 'comment-3',
      work_id: workId,
      author_id: 'user-1',
      author_name: 'John Engineer',
      author_avatar: 'JE',
      content: 'Updated the calculations based on feedback.',
      created_at: new Date(Date.now() - 7200000).toISOString(),
      updated_at: new Date(Date.now() - 3600000).toISOString(),
      edited: true,
    },
  ]

  useEffect(() => {
    loadComments()
  }, [workId])

  useEffect(() => {
    if (editTextareaRef.current && editingCommentId) {
      editTextareaRef.current.focus()
    }
  }, [editingCommentId])

  const loadComments = () => {
    setIsLoading(true)
    setTimeout(() => {
      const workComments = mockComments.filter((c) => c.work_id === workId)
      setComments(workComments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
      onCommentCountChange?.(workComments.length)
      setIsLoading(false)
    }, 300)
  }

  const addComment = () => {
    if (!newComment.trim()) return

    const newCommentObj = {
      id: `comment-${Date.now()}`,
      work_id: workId,
      author_id: user?.id || 'current-user',
      author_name: user?.name || 'You',
      author_avatar: user?.name?.charAt(0) || 'U',
      content: newComment,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      edited: false,
    }

    setComments([newCommentObj, ...comments])
    setNewComment('')
    onCommentCountChange?.(comments.length + 1)
  }

  const updateComment = () => {
    if (!editingContent.trim()) return

    setComments(
      comments.map((c) =>
        c.id === editingCommentId
          ? { ...c, content: editingContent, updated_at: new Date().toISOString(), edited: true }
          : c
      )
    )
    setEditingCommentId(null)
    setEditingContent('')
  }

  const deleteComment = (commentId) => {
    if (window.confirm('Delete this comment? This action cannot be undone.')) {
      setComments(comments.filter((c) => c.id !== commentId))
      onCommentCountChange?.(comments.length - 1)
      setShowActionMenu(null)
    }
  }

  const canDeleteComment = (comment) => {
    const isProjectOwner = currentProject?.userRole === ROLES.PROJECT_OWNER
    const isCommentOwner = comment.author_id === user?.id
    return isProjectOwner || isCommentOwner
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

  return (
    <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-lg border border-[#e5e7eb] dark:border-[#374151] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[#e5e7eb] dark:border-[#374151] bg-gradient-to-r from-[#0A2F44]/5 to-transparent">
        <div className="flex items-center space-x-2">
          <FiMessageSquare className="text-[#0A2F44] dark:text-[#66a4c2]" />
          <h3 className="font-semibold text-[#02090d] dark:text-white">Comments</h3>
          <span className="text-xs text-[#6b7280] dark:text-[#9ca3af]">({comments.length})</span>
        </div>
      </div>

      {/* Comment Input */}
      <div className="p-4 border-b border-[#e5e7eb] dark:border-[#374151]">
        <div className="flex items-start space-x-3">
          <div className="w-8 h-8 bg-[#0A2F44] rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              rows="2"
              className="w-full px-4 py-2 rounded-lg border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A2F44] resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  addComment()
                }
              }}
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={addComment}
                disabled={!newComment.trim()}
                className="flex items-center space-x-2 px-4 py-1.5 bg-[#0A2F44] text-white rounded-lg hover:bg-[#082636] transition-colors disabled:opacity-50 text-sm"
              >
                <FiSend />
                <span>Comment</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Comments List */}
      <div className="divide-y divide-[#e5e7eb] dark:divide-[#374151] max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-2 border-[#0A2F44] border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm text-[#6b7280] mt-2">Loading comments...</p>
          </div>
        ) : comments.length === 0 ? (
          <div className="p-8 text-center">
            <FiMessageSquare className="text-4xl text-[#9ca3af] mx-auto mb-2" />
            <p className="text-sm text-[#6b7280]">No comments yet</p>
            <p className="text-xs text-[#9ca3af]">Be the first to leave feedback</p>
          </div>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className="p-4 hover:bg-[#f9fafb] dark:hover:bg-[#374151] transition-colors group"
            >
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-[#0A2F44] to-[#2E7D32] rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                  {comment.author_avatar}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-[#02090d] dark:text-white text-sm">
                        {comment.author_name}
                      </span>
                      <span className="text-xs text-[#6b7280] dark:text-[#9ca3af] flex items-center">
                        <FiClock className="mr-1 text-xs" />
                        {formatTime(comment.created_at)}
                      </span>
                      {comment.edited && (
                        <span className="text-xs text-[#9ca3af] italic">(edited)</span>
                      )}
                    </div>

                    {canDeleteComment(comment) && (
                      <div className="relative">
                        <button
                          onClick={() =>
                            setShowActionMenu(showActionMenu === comment.id ? null : comment.id)
                          }
                          className="p-1 opacity-0 group-hover:opacity-100 transition-opacity rounded hover:bg-[#f3f4f6] dark:hover:bg-[#374151]"
                        >
                          <FiMoreVertical className="text-sm text-[#6b7280]" />
                        </button>

                        {showActionMenu === comment.id && (
                          <div className="absolute right-0 z-10 mt-1 w-36 bg-white dark:bg-[#1f2937] border border-[#e5e7eb] dark:border-[#374151] rounded-lg shadow-xl overflow-hidden">
                            {comment.author_id === user?.id && (
                              <button
                                onClick={() => {
                                  setEditingCommentId(comment.id)
                                  setEditingContent(comment.content)
                                  setShowActionMenu(null)
                                }}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-[#f3f4f6] dark:hover:bg-[#374151] flex items-center space-x-2"
                              >
                                <FiEdit2 className="text-sm" />
                                <span>Edit</span>
                              </button>
                            )}
                            <button
                              onClick={() => deleteComment(comment.id)}
                              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-2"
                            >
                              <FiTrash2 className="text-sm" />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {editingCommentId === comment.id ? (
                    <div className="mt-2">
                      <textarea
                        ref={editTextareaRef}
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        rows="3"
                        className="w-full px-4 py-2 rounded-lg border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A2F44]"
                      />
                      <div className="flex justify-end space-x-2 mt-2">
                        <button
                          onClick={() => {
                            setEditingCommentId(null)
                            setEditingContent('')
                          }}
                          className="px-3 py-1 text-sm border rounded-lg hover:bg-[#f3f4f6]"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={updateComment}
                          className="px-3 py-1 text-sm bg-[#0A2F44] text-white rounded-lg hover:bg-[#082636]"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-[#02090d] dark:text-white mt-1 whitespace-pre-wrap">
                      {comment.content}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default CommentSection
