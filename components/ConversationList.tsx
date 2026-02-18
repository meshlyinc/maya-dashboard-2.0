'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, MessageSquare, User, Phone, Search, Eye, UserCheck, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import { Pagination, DateRangeFilter } from './ListControls'

interface ConversationItem {
  id: string
  title: string
  userName?: string | null
  userPhone?: string | null
  status: string
  stage: string
  messageCount: number
  lastMessageAt: string
  createdAt: string
  type: string
  conversationId?: string | null
  conversationMessageCount?: number
  userId?: string | null
  metadata?: {
    candidatesMatched: number
    candidatesReached: number
    budgetMin?: number | null
    budgetMax?: number | null
    budgetType?: string | null
    currency?: string | null
  }
}

interface ConversationListProps {
  type: 'posting' | 'reachout'
  onClose: () => void
  onSelectConversation: (id: string) => void
  onSelectUser?: (userId: string) => void
}

export default function ConversationList({ type, onClose, onSelectConversation, onSelectUser }: ConversationListProps) {
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const fetchConversations = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ type, page: String(page) })
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      if (debouncedSearch) params.set('search', debouncedSearch)
      const res = await fetch(`/api/conversations?${params}`)
      const data = await res.json()
      setConversations(data.items || [])
      setTotalPages(data.totalPages || 0)
      setTotalItems(data.totalItems || 0)
    } catch (error) {
      console.error('Failed to fetch conversations:', error)
    } finally {
      setLoading(false)
    }
  }, [type, page, startDate, endDate, debouncedSearch])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // Reset page when filters change
  const handleStartDate = (d: string) => { setStartDate(d); setPage(1) }
  const handleEndDate = (d: string) => { setEndDate(d); setPage(1) }
  const handleClearDates = () => { setStartDate(''); setEndDate(''); setPage(1) }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-3 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {type === 'posting' ? 'Job Postings / Queries' : 'Candidate Reachouts'}
            </h2>
            {totalItems > 0 && (
              <span className="text-xs text-gray-500">{totalItems} total</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Search (postings only) */}
        {type === 'posting' && (
          <div className="px-6 pt-3 pb-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by job title..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        )}

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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading conversations...</div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No conversations found</div>
          ) : (
            <div className="space-y-3">
              {conversations.map(conv => (
                <div
                  key={conv.id}
                  onClick={type !== 'posting' ? () => onSelectConversation(conv.id) : undefined}
                  className={`border border-gray-200 rounded-lg p-4 transition-all ${
                    type !== 'posting' ? 'hover:border-blue-500 hover:shadow-sm cursor-pointer' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <MessageSquare className="w-4 h-4 text-gray-400" />
                        <h3 className="font-medium text-gray-900">{conv.title}</h3>
                      </div>
                      {(conv.userName || conv.userPhone) && (
                        <div className="flex items-center gap-3 mb-1">
                          {conv.userName && (
                            <div className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-gray-400" />
                              <span className="text-sm text-gray-600">{conv.userName}</span>
                            </div>
                          )}
                          {conv.userPhone && (
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-gray-400" />
                              <span className="text-sm text-gray-500">{conv.userPhone}</span>
                            </div>
                          )}
                          {conv.userId && onSelectUser && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onSelectUser(conv.userId!) }}
                              className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-md transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" />
                              View Profile
                            </button>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>Stage: {conv.stage || 'N/A'}</span>
                        <span>&middot;</span>
                        <span>{conv.messageCount} reachouts</span>
                        {conv.metadata && (
                          <>
                            <span>&middot;</span>
                            <span className="text-blue-600 font-medium">
                              {conv.metadata.candidatesMatched} matched
                            </span>
                          </>
                        )}
                        {conv.metadata?.budgetMin != null && (
                          <>
                            <span>&middot;</span>
                            <span className="text-green-600 font-medium">
                              {conv.metadata.currency || '$'}{conv.metadata.budgetMin.toLocaleString()}
                              {conv.metadata.budgetMax != null && ` - ${conv.metadata.currency || '$'}${conv.metadata.budgetMax.toLocaleString()}`}
                              {conv.metadata.budgetType && ` /${conv.metadata.budgetType}`}
                            </span>
                          </>
                        )}
                        <span>&middot;</span>
                        <span>
                          {conv.lastMessageAt
                            ? format(new Date(conv.lastMessageAt), 'MMM d, yyyy h:mm a')
                            : format(new Date(conv.createdAt), 'MMM d, yyyy h:mm a')}
                        </span>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      conv.status === 'active' ? 'bg-green-100 text-green-700' :
                      conv.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {conv.status || 'Unknown'}
                    </span>
                  </div>

                  {/* CTAs for posting cards */}
                  {type === 'posting' && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      {conv.conversationMessageCount != null && conv.conversationMessageCount > 0 && (
                        <div className="flex items-center gap-1.5 mb-2 text-xs text-gray-500">
                          <MessageSquare className="w-3 h-3" />
                          <span>{conv.conversationMessageCount} messages in conversation</span>
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => conv.conversationId && onSelectConversation(conv.conversationId)}
                          disabled={!conv.conversationId}
                          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-blue-600 text-white hover:bg-blue-700 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Eye className="w-4 h-4" />
                          View Convo
                        </button>
                        <button
                          onClick={() => onSelectConversation(conv.id)}
                          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-green-600 text-white hover:bg-green-700 shadow-sm"
                        >
                          <UserCheck className="w-4 h-4" />
                          View Reachouts
                        </button>
                      </div>
                    </div>
                  )}
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
