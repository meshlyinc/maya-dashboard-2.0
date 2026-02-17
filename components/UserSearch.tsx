'use client'

import { useState, useEffect } from 'react'
import { Search, User, X } from 'lucide-react'
import { useDebounce } from '@/lib/hooks'

interface SearchResult {
  id: string
  full_name: string
  email: string
  phone: string
  user_type: string
  headline?: string
  specialty?: string
  created_at: string
}

interface UserSearchProps {
  onSelectUser: (userId: string) => void
}

export default function UserSearch({ onSelectUser }: UserSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      searchUsers(debouncedQuery)
    } else {
      setResults([])
      setShowResults(false)
    }
  }, [debouncedQuery])

  const searchUsers = async (searchQuery: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`)
      const data = await res.json()
      setResults(data)
      setShowResults(true)
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectUser = (userId: string) => {
    onSelectUser(userId)
    setQuery('')
    setShowResults(false)
  }

  const clearSearch = () => {
    setQuery('')
    setResults([])
    setShowResults(false)
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email, or phone..."
          className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white placeholder:text-gray-400"
        />
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {showResults && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500">Searching...</div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No users found</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {results.map((user) => (
                <div
                  key={user.id}
                  onClick={() => handleSelectUser(user.id)}
                  className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900">
                        {user.full_name || 'Unnamed User'}
                      </h4>
                      {user.headline && (
                        <p className="text-sm text-gray-600 truncate">{user.headline}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        {user.email && <span>{user.email}</span>}
                        {user.phone && (
                          <>
                            <span>•</span>
                            <span>{user.phone}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="flex-shrink-0 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                      {user.user_type || 'User'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
