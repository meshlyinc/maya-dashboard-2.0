'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, Link2, User, Briefcase, Search, ArrowRight, Phone, Mail } from 'lucide-react'
import { format } from 'date-fns'
import { Pagination } from './ListControls'

interface ConnectionItem {
  id: string
  gigTitle: string
  candidateName: string
  candidateHeadline: string | null
  candidatePhone: string | null
  candidateEmail: string | null
  candidateUserId: string | null
  hirerName: string
  hirerPhone: string | null
  hirerUserId: string | null
  matchScore: number | null
  status: string
  connectedAt: string
  createdAt: string
}

interface ConnectionsModalProps {
  onClose: () => void
  onSelectUser: (userId: string) => void
}

export default function ConnectionsModal({ onClose, onSelectUser }: ConnectionsModalProps) {
  const [connections, setConnections] = useState<ConnectionItem[]>([])
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

  const fetchConnections = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (debouncedSearch) params.set('search', debouncedSearch)
      const res = await fetch(`/api/connections?${params}`)
      const data = await res.json()
      setConnections(data.items || [])
      setTotalPages(data.totalPages || 0)
      setTotalItems(data.totalItems || 0)
    } catch (error) {
      console.error('Failed to fetch connections:', error)
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch])

  useEffect(() => {
    fetchConnections()
  }, [fetchConnections])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-3 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Connections</h2>
            <p className="text-xs text-gray-500">
              {totalItems} total {totalItems === 1 ? 'connection' : 'connections'}
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
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading connections...</div>
          ) : connections.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {debouncedSearch ? 'No connections match your search' : 'No connections yet'}
            </div>
          ) : (
            <div className="space-y-3">
              {connections.map(conn => (
                <div
                  key={conn.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-pink-300 transition-all"
                >
                  {/* Posting title */}
                  <div className="flex items-center gap-2 mb-3">
                    <Briefcase className="w-4 h-4 text-blue-500" />
                    <h3 className="font-medium text-gray-900">{conn.gigTitle}</h3>
                    {conn.matchScore != null && (
                      <span className="ml-auto px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-600 rounded">
                        {Math.round(conn.matchScore * 100)}% match
                      </span>
                    )}
                  </div>

                  {/* Hirer → Candidate connection */}
                  <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                    {/* Hirer */}
                    <div
                      className={`flex-1 ${conn.hirerUserId ? 'cursor-pointer hover:bg-gray-100 rounded-lg p-1 -m-1' : ''}`}
                      onClick={() => conn.hirerUserId && onSelectUser(conn.hirerUserId)}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{conn.hirerName}</p>
                          <p className="text-xs text-purple-600">Hirer</p>
                        </div>
                      </div>
                      {conn.hirerPhone && (
                        <div className="flex items-center gap-1 mt-1 ml-10">
                          <Phone className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-500">{conn.hirerPhone}</span>
                        </div>
                      )}
                    </div>

                    {/* Arrow */}
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center">
                        <ArrowRight className="w-4 h-4 text-pink-500" />
                      </div>
                    </div>

                    {/* Candidate */}
                    <div
                      className={`flex-1 ${conn.candidateUserId ? 'cursor-pointer hover:bg-gray-100 rounded-lg p-1 -m-1' : ''}`}
                      onClick={() => conn.candidateUserId && onSelectUser(conn.candidateUserId)}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{conn.candidateName}</p>
                          <p className="text-xs text-green-600">Candidate</p>
                          {conn.candidateHeadline && (
                            <p className="text-xs text-gray-500">{conn.candidateHeadline}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-1 ml-10">
                        {conn.candidatePhone && (
                          <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-500">{conn.candidatePhone}</span>
                          </div>
                        )}
                        {conn.candidateEmail && (
                          <div className="flex items-center gap-1">
                            <Mail className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-500">{conn.candidateEmail}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer info */}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Link2 className="w-3 h-3" />
                      <span>Connected {format(new Date(conn.connectedAt), 'MMM d, yyyy h:mm a')}</span>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      conn.status === 'connected' ? 'bg-green-100 text-green-700' :
                      conn.status === 'hired' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {conn.status}
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
