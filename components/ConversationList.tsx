'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, MessageSquare, User, Phone, Search, Eye, UserCheck, ExternalLink, CreditCard } from 'lucide-react'
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
  cardsSentCount?: number
  connectedCount?: number
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
  onViewCards?: (gigId: string) => void
}

export default function ConversationList({ type, onClose, onSelectConversation, onSelectUser, onViewCards }: ConversationListProps) {
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedStage, setSelectedStage] = useState('')
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({})
  const [selectedFilter, setSelectedFilter] = useState('')
  const [filterCounts, setFilterCounts] = useState<Record<string, number>>({})
  const [selectedStatus, setSelectedStatus] = useState('')
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})

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
      if (selectedStage) params.set('stage', selectedStage)
      if (selectedFilter) params.set('filter', selectedFilter)
      if (selectedStatus) params.set('status', selectedStatus)
      const res = await fetch(`/api/conversations?${params}`)
      const data = await res.json()
      setConversations(data.items || [])
      setTotalPages(data.totalPages || 0)
      setTotalItems(data.totalItems || 0)
      if (data.stageCounts) setStageCounts(data.stageCounts)
      if (data.filterCounts) setFilterCounts(data.filterCounts)
      if (data.statusCounts) setStatusCounts(data.statusCounts)
    } catch (error) {
      console.error('Failed to fetch conversations:', error)
    } finally {
      setLoading(false)
    }
  }, [type, page, startDate, endDate, debouncedSearch, selectedStage, selectedFilter, selectedStatus])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // Reset page when filters change
  const handleStartDate = (d: string) => { setStartDate(d); setPage(1) }
  const handleEndDate = (d: string) => { setEndDate(d); setPage(1) }
  const handleClearDates = () => { setStartDate(''); setEndDate(''); setPage(1) }
  const handleStageChange = (stage: string) => { setSelectedStage(prev => prev === stage ? '' : stage); setPage(1) }
  const handleFilterChange = (f: string) => { setSelectedFilter(prev => prev === f ? '' : f); setPage(1) }
  const handleStatusChange = (s: string) => { setSelectedStatus(prev => prev === s ? '' : s); setPage(1) }

  const POSTING_STAGES = [
    { value: 'collecting_requirements', label: 'Collecting Requirements', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
    { value: 'matching', label: 'Matching', color: 'bg-blue-100 text-blue-800 border-blue-300' },
    { value: 'active', label: 'Active', color: 'bg-green-100 text-green-800 border-green-300' },
  ]

  const POSTING_FILTERS = [
    { value: 'card_sent', label: 'Card Sent', color: 'bg-orange-100 text-orange-800 border-orange-300' },
    { value: 'connected', label: 'Connected', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  ]

  const REACHOUT_STATUSES = [
    { value: 'identified', label: 'Identified', color: 'bg-gray-100 text-gray-700 border-gray-300' },
    { value: 'outreach_sent', label: 'Outreach Sent', color: 'bg-blue-100 text-blue-800 border-blue-300' },
    { value: 'candidate_interested', label: 'Interested', color: 'bg-green-100 text-green-800 border-green-300' },
    { value: 'negotiating', label: 'Negotiating', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
    { value: 'connected', label: 'Connected', color: 'bg-purple-100 text-purple-800 border-purple-300' },
    { value: 'candidate_declined', label: 'Declined', color: 'bg-orange-100 text-orange-800 border-orange-300' },
    { value: 'passed', label: 'Passed', color: 'bg-red-100 text-red-700 border-red-300' },
  ]

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

        {/* Stage Filter Chips (postings only) */}
        {type === 'posting' && (
          <div className="px-6 pt-3 pb-2 border-b border-gray-100 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-gray-500 mr-1">Stage:</span>
            {POSTING_STAGES.map(s => (
              <button
                key={s.value}
                onClick={() => handleStageChange(s.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  selectedStage === s.value
                    ? `${s.color} ring-2 ring-offset-1 ring-current`
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {s.label}
                {stageCounts[s.value] != null && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                    selectedStage === s.value ? 'bg-white/50' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {stageCounts[s.value]}
                  </span>
                )}
              </button>
            ))}
            {selectedStage && (
              <button
                onClick={() => { setSelectedStage(''); setPage(1) }}
                className="px-2 py-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Reachout Filter Chips (postings only) */}
        {type === 'posting' && (
          <div className="px-6 pt-2 pb-2 border-b border-gray-100 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-gray-500 mr-1">Reachout:</span>
            {POSTING_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => handleFilterChange(f.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  selectedFilter === f.value
                    ? `${f.color} ring-2 ring-offset-1 ring-current`
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {f.label}
                {filterCounts[f.value] != null && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                    selectedFilter === f.value ? 'bg-white/50' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {filterCounts[f.value]}
                  </span>
                )}
              </button>
            ))}
            {selectedFilter && (
              <button
                onClick={() => { setSelectedFilter(''); setPage(1) }}
                className="px-2 py-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Reachout Status Filter Chips (reachout view) */}
        {type === 'reachout' && (
          <div className="px-6 pt-3 pb-2 border-b border-gray-100 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-gray-500 mr-1">Status:</span>
            {REACHOUT_STATUSES.map(s => (
              <button
                key={s.value}
                onClick={() => handleStatusChange(s.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  selectedStatus === s.value
                    ? `${s.color} ring-2 ring-offset-1 ring-current`
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {s.label}
                {statusCounts[s.value] != null && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                    selectedStatus === s.value ? 'bg-white/50' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {statusCounts[s.value]}
                  </span>
                )}
              </button>
            ))}
            {selectedStatus && (
              <button
                onClick={() => { setSelectedStatus(''); setPage(1) }}
                className="px-2 py-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Clear
              </button>
            )}
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
                      <div className="flex items-center gap-4 mb-2 text-xs text-gray-500">
                        {conv.conversationMessageCount != null && conv.conversationMessageCount > 0 && (
                          <div className="flex items-center gap-1.5">
                            <MessageSquare className="w-3 h-3" />
                            <span>{conv.conversationMessageCount} messages in conversation</span>
                          </div>
                        )}
                        {(conv.cardsSentCount || 0) > 0 && (
                          <div className="flex items-center gap-1.5 text-orange-600 font-medium">
                            <CreditCard className="w-3 h-3" />
                            <span>{conv.cardsSentCount} cards sent</span>
                          </div>
                        )}
                        {(conv.connectedCount || 0) > 0 && (
                          <div className="flex items-center gap-1.5 text-green-600 font-medium">
                            <UserCheck className="w-3 h-3" />
                            <span>{conv.connectedCount} connected</span>
                          </div>
                        )}
                      </div>
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
                        {(conv.cardsSentCount || 0) > 0 && onViewCards && (
                          <button
                            onClick={() => onViewCards(conv.id)}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-orange-500 text-white hover:bg-orange-600 shadow-sm"
                          >
                            <CreditCard className="w-4 h-4" />
                            View Cards ({conv.cardsSentCount})
                          </button>
                        )}
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
