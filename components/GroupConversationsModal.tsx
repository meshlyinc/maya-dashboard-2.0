'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, Users, User, Phone, Search, Briefcase, MessageSquare, Eye, UserCheck, ArrowRight } from 'lucide-react'
import { format } from 'date-fns'
import { Pagination } from './ListControls'

interface Participant {
  userId: string
  name: string
  phone: string | null
}

interface GroupConvItem {
  id: string
  gigId: string | null
  gigTitle: string
  matchId: string | null
  matchScore: number | null
  status: string
  stage: string | null
  connectedAt: string
  createdAt: string
  title: string | null
  messageCount: number
  lastMessageAt: string | null
  isGroup: boolean
  hirerName: string
  hirerPhone: string | null
  hirerUserId: string | null
  candidateName: string
  candidateHeadline: string | null
  candidatePhone: string | null
  candidateUserId: string | null
  participants: Participant[]
  postingConversation: {
    id: string
    title: string | null
    messageCount: number
  } | null
  outreachConversation: {
    id: string
    title: string | null
    messageCount: number
  } | null
}

interface GroupConversationsModalProps {
  onClose: () => void
  onSelectConversation: (id: string) => void
  onSelectUser: (userId: string) => void
}

export default function GroupConversationsModal({ onClose, onSelectConversation, onSelectUser }: GroupConversationsModalProps) {
  const [items, setItems] = useState<GroupConvItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (debouncedSearch) params.set('search', debouncedSearch)
      const res = await fetch(`/api/group-conversations?${params}`)
      const data = await res.json()
      setItems(data.items || [])
      setTotalPages(data.totalPages || 0)
      setTotalItems(data.totalItems || 0)
    } catch (error) {
      console.error('Failed to fetch group conversations:', error)
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-3 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-500" />
              <h2 className="text-xl font-semibold text-gray-900">Group Conversations</h2>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {totalItems} total — Introduction conversations between hirers & candidates
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 pt-3 pb-2 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by job title, candidate, or hirer..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading group conversations...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {debouncedSearch ? 'No results match your search' : 'No group conversations found'}
            </div>
          ) : (
            <div className="space-y-4">
              {items.map(item => (
                <div
                  key={item.id}
                  className="border border-gray-200 rounded-xl p-4 hover:border-indigo-300 transition-all"
                >
                  {/* Title + message count */}
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-indigo-500" />
                    <h3 className="font-medium text-gray-900 flex-1">{item.title || item.gigTitle}</h3>
                    <span className="text-xs text-gray-400">{item.messageCount} msgs</span>
                  </div>

                  {/* Posting title */}
                  <div className="flex items-center gap-2 mb-3">
                    <Briefcase className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-sm text-gray-600">{item.gigTitle}</span>
                    {item.matchScore != null && (
                      <span className="ml-auto px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-600 rounded">
                        {Math.round(item.matchScore * 100)}% match
                      </span>
                    )}
                  </div>

                  {/* Hirer → Candidate row */}
                  <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 mb-3">
                    {/* Hirer */}
                    <div
                      className={`flex-1 ${item.hirerUserId ? 'cursor-pointer hover:bg-gray-100 rounded-lg p-1 -m-1' : ''}`}
                      onClick={() => item.hirerUserId && onSelectUser(item.hirerUserId)}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{item.hirerName}</p>
                          <p className="text-xs text-purple-600">Hirer</p>
                        </div>
                      </div>
                      {item.hirerPhone && (
                        <div className="flex items-center gap-1 mt-1 ml-10">
                          <Phone className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-500">{item.hirerPhone}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center">
                        <ArrowRight className="w-4 h-4 text-pink-500" />
                      </div>
                    </div>

                    {/* Candidate */}
                    <div
                      className={`flex-1 ${item.candidateUserId ? 'cursor-pointer hover:bg-gray-100 rounded-lg p-1 -m-1' : ''}`}
                      onClick={() => item.candidateUserId && onSelectUser(item.candidateUserId)}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{item.candidateName}</p>
                          <p className="text-xs text-green-600">Candidate</p>
                          {item.candidateHeadline && (
                            <p className="text-xs text-gray-500">{item.candidateHeadline}</p>
                          )}
                        </div>
                      </div>
                      {item.candidatePhone && (
                        <div className="flex items-center gap-1 mt-1 ml-10">
                          <Phone className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-500">{item.candidatePhone}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Timestamps + status */}
                  <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <UserCheck className="w-3 h-3 text-green-500" />
                      <span>Created {format(new Date(item.createdAt), 'MMM d, yyyy h:mm a')}</span>
                    </div>
                    {item.lastMessageAt && (
                      <span>Last msg {format(new Date(item.lastMessageAt), 'MMM d, h:mm a')}</span>
                    )}
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      item.status === 'active' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {item.status}
                    </span>
                    {item.stage && (
                      <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-600">
                        {item.stage.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-3 flex-wrap pt-3 border-t border-gray-100">
                    {/* View Group Chat (this conversation itself) */}
                    <button
                      onClick={() => onSelectConversation(item.id)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                    >
                      <Users className="w-4 h-4" />
                      Group Chat
                      {item.messageCount > 0 && (
                        <span className="px-1.5 py-0.5 bg-indigo-500 rounded text-[10px]">
                          {item.messageCount}
                        </span>
                      )}
                    </button>

                    {/* Posting Convo (Hirer ↔ Maya) */}
                    {item.postingConversation && (
                      <button
                        onClick={() => onSelectConversation(item.postingConversation!.id)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                      >
                        <Eye className="w-4 h-4" />
                        Posting Convo
                        {item.postingConversation.messageCount > 0 && (
                          <span className="px-1.5 py-0.5 bg-blue-500 rounded text-[10px]">
                            {item.postingConversation.messageCount}
                          </span>
                        )}
                      </button>
                    )}

                    {/* Outreach Convo (Candidate ↔ Maya) */}
                    {item.outreachConversation && (
                      <button
                        onClick={() => onSelectConversation(item.outreachConversation!.id)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-green-600 text-white hover:bg-green-700 shadow-sm"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Reachout Convo
                        {item.outreachConversation.messageCount > 0 && (
                          <span className="px-1.5 py-0.5 bg-green-500 rounded text-[10px]">
                            {item.outreachConversation.messageCount}
                          </span>
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
        {totalPages >= 1 && (
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
