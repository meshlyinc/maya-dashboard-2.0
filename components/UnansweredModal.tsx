'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, AlertTriangle, Phone, Mail, MessageSquare, Clock, User } from 'lucide-react'
import { format } from 'date-fns'
import { Pagination, DateRangeFilter } from './ListControls'

interface UnansweredItem {
  conversationId: string
  title: string
  conversationType: string
  status: string
  userName: string
  userPhone: string | null
  userEmail: string | null
  userId: string
  lastUserMessage: string | null
  lastMessageAt: string
  createdAt: string
}

interface UnansweredModalProps {
  onClose: () => void
  onSelectConversation: (id: string) => void
  onSelectUser: (userId: string) => void
}

export default function UnansweredModal({ onClose, onSelectConversation, onSelectUser }: UnansweredModalProps) {
  const [items, setItems] = useState<UnansweredItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const fetchUnanswered = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      const res = await fetch(`/api/unanswered?${params}`)
      const data = await res.json()
      setItems(data.unanswered || [])
      setTotalPages(data.totalPages || 0)
      setTotalItems(data.totalItems || 0)
    } catch (error) {
      console.error('Failed to fetch unanswered:', error)
    } finally {
      setLoading(false)
    }
  }, [page, startDate, endDate])

  useEffect(() => {
    fetchUnanswered()
  }, [fetchUnanswered])

  const handleStartDate = (d: string) => { setStartDate(d); setPage(1) }
  const handleEndDate = (d: string) => { setEndDate(d); setPage(1) }
  const handleClearDates = () => { setStartDate(''); setEndDate(''); setPage(1) }

  const safeFormatDate = (dateStr: string | null | undefined, fmt: string) => {
    if (!dateStr) return ''
    try {
      return format(new Date(dateStr), fmt)
    } catch {
      return ''
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-3 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Unanswered Conversations</h2>
              <p className="text-sm text-gray-500">
                {totalItems} conversations where Maya hasn&apos;t responded
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Date Filter */}
        <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={handleStartDate}
            onEndDateChange={handleEndDate}
            onClear={handleClearDates}
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-500">
              <div className="animate-pulse">Loading...</div>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              All conversations are answered - no errors found
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.conversationId}
                  className="border border-gray-200 rounded-lg p-4 hover:border-red-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* User info row */}
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-gray-600" />
                        </div>
                        <div>
                          <button
                            onClick={() => item.userId && onSelectUser(item.userId)}
                            className="font-medium text-gray-900 hover:text-blue-600 hover:underline"
                          >
                            {item.userName}
                          </button>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            {item.userPhone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {item.userPhone}
                              </span>
                            )}
                            {item.userEmail && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {item.userEmail}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Conversation info */}
                      <div
                        onClick={() => onSelectConversation(item.conversationId)}
                        className="ml-11 cursor-pointer hover:bg-gray-50 rounded p-2 -m-2 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-sm font-medium text-gray-700">{item.title}</span>
                          {item.conversationType && (
                            <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-500 rounded">
                              {item.conversationType.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                        {item.lastUserMessage && (
                          <p className="text-sm text-gray-600 line-clamp-2 mb-1">
                            &ldquo;{item.lastUserMessage}&rdquo;
                          </p>
                        )}
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock className="w-3 h-3" />
                          <span>{safeFormatDate(item.lastMessageAt, 'MMM d, yyyy h:mm a')}</span>
                          <span className="ml-2 text-blue-500">View conversation &rarr;</span>
                        </div>
                      </div>
                    </div>

                    <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700 flex-shrink-0">
                      No reply
                    </span>
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
