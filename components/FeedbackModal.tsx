'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, MessageSquareText, User, ExternalLink, Phone, Mail, Clock, Reply, Send, CheckCircle } from 'lucide-react'
import { format } from 'date-fns'
import { Pagination } from './ListControls'

interface FeedbackItem {
  id: string
  feedbackText: string
  pageUrl: string | null
  createdAt: string
  userId: string
  conversationId: string | null
  userName: string
  userPhone: string | null
  userEmail: string | null
  adminReply: string | null
  repliedAt: string | null
}

interface FeedbackModalProps {
  onClose: () => void
  onSelectUser: (userId: string) => void
}

const QUICK_REPLIES = [
  { label: 'Loop/Repeat Fix', text: 'Thanks for flagging this! We\'re aware that Maya sometimes repeats questions and we\'re actively improving her memory. A fix is rolling out soon — sorry for the frustration.' },
  { label: 'Bug Noted', text: 'Thank you for reporting this! Our engineering team has been notified and is working on a fix. We apologize for the inconvenience.' },
  { label: 'No Leads Yet', text: 'We understand your frustration. Our team is continuously expanding the client base and improving matching. We\'ll work on connecting you with relevant opportunities soon.' },
  { label: 'Thank You!', text: 'Thank you for the kind words! We\'re glad Maya is helping. We\'re constantly improving and your support means a lot!' },
  { label: 'Feature Noted', text: 'Great suggestion! We\'ve noted this for upcoming updates. Thanks for helping us improve!' },
  { label: 'Notifications Soon', text: 'WhatsApp notifications are being worked on and will be available soon. Thanks for the suggestion!' },
  { label: 'Duplicate Opps Fix', text: 'We\'ve identified the duplicate opportunity issue and our team is working on deduplication. Thanks for reporting!' },
  { label: 'Login Fix', text: 'We\'re working on adding a proper login system so you can access your account on any device without re-onboarding. Stay tuned!' },
]

export default function FeedbackModal({ onClose, onSelectUser }: FeedbackModalProps) {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)

  const fetchFeedback = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/feedback?page=${page}`)
      const data = await res.json()
      setFeedback(data.items || [])
      setTotalPages(data.totalPages || 0)
      setTotalItems(data.totalItems || 0)
    } catch (error) {
      console.error('Failed to fetch feedback:', error)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    fetchFeedback()
  }, [fetchFeedback])

  const handleReply = async (feedbackId: string) => {
    if (!replyText.trim() || sending) return
    setSending(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedbackId, reply: replyText.trim() }),
      })
      if (res.ok) {
        setFeedback(prev => prev.map(f =>
          f.id === feedbackId
            ? { ...f, adminReply: replyText.trim(), repliedAt: new Date().toISOString() }
            : f
        ))
        setReplyingTo(null)
        setReplyText('')
      }
    } catch (error) {
      console.error('Failed to send reply:', error)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-3 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">User Feedback</h2>
            <p className="text-xs text-gray-500">
              {totalItems} total {totalItems === 1 ? 'feedback' : 'feedbacks'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading feedback...</div>
          ) : feedback.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No feedback yet</div>
          ) : (
            <div className="space-y-3">
              {feedback.map(item => (
                <div
                  key={item.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-amber-300 transition-all"
                >
                  {/* User info + View Profile */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.userName}</p>
                        <div className="flex items-center gap-3">
                          {item.userPhone && (
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-gray-400" />
                              <span className="text-xs text-gray-500">{item.userPhone}</span>
                            </div>
                          )}
                          {item.userEmail && (
                            <div className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-gray-400" />
                              <span className="text-xs text-gray-500">{item.userEmail}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => onSelectUser(item.userId)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <User className="w-3 h-3" />
                      View Profile
                    </button>
                  </div>

                  {/* Feedback text */}
                  <div className="bg-gray-50 rounded-lg p-3 mb-2">
                    <div className="flex items-start gap-2">
                      <MessageSquareText className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{item.feedbackText}</p>
                    </div>
                  </div>

                  {/* Admin reply (if exists) */}
                  {item.adminReply && (
                    <div className="bg-blue-50 rounded-lg p-3 mb-2 border border-blue-100">
                      <div className="flex items-start gap-2">
                        <Reply className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-blue-700">Admin Reply</span>
                            {item.repliedAt && (
                              <span className="text-xs text-blue-400">
                                {format(new Date(item.repliedAt), 'MMM d, h:mm a')}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-blue-900 whitespace-pre-wrap">{item.adminReply}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Reply input (when replying) */}
                  {replyingTo === item.id && (
                    <div className="mb-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleReply(item.id) }}
                          placeholder="Type your reply..."
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          autoFocus
                          disabled={sending}
                        />
                        <button
                          onClick={() => handleReply(item.id)}
                          disabled={!replyText.trim() || sending}
                          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5" />
                          {sending ? 'Sending...' : 'Send'}
                        </button>
                        <button
                          onClick={() => { setReplyingTo(null); setReplyText('') }}
                          className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                      {/* Quick reply bubbles */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {QUICK_REPLIES.map((qr) => (
                          <button
                            key={qr.label}
                            onClick={() => setReplyText(qr.text)}
                            className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors ${
                              replyText === qr.text
                                ? 'bg-blue-100 text-blue-700 border-blue-300'
                                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'
                            }`}
                          >
                            {qr.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Footer: timestamp + page URL + reply button */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{format(new Date(item.createdAt), 'MMM d, yyyy h:mm a')}</span>
                      </div>
                      {item.pageUrl && (
                        <div className="flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" />
                          <span className="truncate max-w-[200px]">{item.pageUrl}</span>
                        </div>
                      )}
                    </div>
                    {replyingTo !== item.id && (
                      <button
                        onClick={() => { setReplyingTo(item.id); setReplyText(item.adminReply || '') }}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      >
                        {item.adminReply ? (
                          <>
                            <CheckCircle className="w-3 h-3 text-green-500" />
                            Edit Reply
                          </>
                        ) : (
                          <>
                            <Reply className="w-3 h-3" />
                            Reply
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 pb-4">
            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={totalItems}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  )
}
