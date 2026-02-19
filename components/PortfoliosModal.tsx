'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, Search, User, Phone, ExternalLink, Clock, DollarSign, Award } from 'lucide-react'
import { format } from 'date-fns'
import { Pagination } from './ListControls'

interface PortfolioItem {
  id: string
  userId: string | null
  userName: string | null
  userPhone: string | null
  headline: string | null
  bio: string | null
  specialty: string | null
  broadCategory: string
  skills: string[]
  experienceYears: number | null
  currentTitle: string | null
  rateType: string | null
  rateMin: number | null
  rateMax: number | null
  rateCurrency: string | null
  availability: string | null
  portfolioUrl: string | null
  portfolioLinks: string[]
  createdAt: string
}

interface PortfoliosModalProps {
  onClose: () => void
  onSelectUser?: (userId: string) => void
}

const CATEGORY_COLORS: Record<string, string> = {
  'Web Dev': 'bg-blue-100 text-blue-800 border-blue-300',
  'Mobile Dev': 'bg-green-100 text-green-800 border-green-300',
  'UI/UX Design': 'bg-pink-100 text-pink-800 border-pink-300',
  'Graphic Design': 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300',
  'Video & Content': 'bg-amber-100 text-amber-800 border-amber-300',
  'Data & AI': 'bg-cyan-100 text-cyan-800 border-cyan-300',
  'DevOps & Cloud': 'bg-orange-100 text-orange-800 border-orange-300',
  'Marketing': 'bg-purple-100 text-purple-800 border-purple-300',
  'SWE': 'bg-indigo-100 text-indigo-800 border-indigo-300',
  'Other': 'bg-gray-100 text-gray-700 border-gray-300',
}

const AVAILABILITY_LABELS: Record<string, string> = {
  immediate: 'Immediate',
  part_time: 'Part Time',
  project_based: 'Project Based',
  full_time: 'Full Time',
}

const EXPERIENCE_OPTIONS = ['0-1', '1-3', '4-6', '7-10', '10+']
const EXPERIENCE_LABELS: Record<string, string> = {
  '0-1': '0-1 yrs',
  '1-3': '1-3 yrs',
  '4-6': '4-6 yrs',
  '7-10': '7-10 yrs',
  '10+': '10+ yrs',
}

const RATE_TYPE_LABELS: Record<string, string> = {
  project: 'Project',
  hourly: 'Hourly',
  monthly: 'Monthly',
  daily: 'Daily',
  weekly: 'Weekly',
}

export default function PortfoliosModal({ onClose, onSelectUser }: PortfoliosModalProps) {
  const [portfolios, setPortfolios] = useState<PortfolioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedAvailability, setSelectedAvailability] = useState('')
  const [selectedExperience, setSelectedExperience] = useState('')
  const [budgetMin, setBudgetMin] = useState('')
  const [budgetMax, setBudgetMax] = useState('')
  const [debouncedBudgetMin, setDebouncedBudgetMin] = useState('')
  const [debouncedBudgetMax, setDebouncedBudgetMax] = useState('')
  const [selectedRateType, setSelectedRateType] = useState('')
  const [availabilityCounts, setAvailabilityCounts] = useState<Record<string, number>>({})
  const [experienceCounts, setExperienceCounts] = useState<Record<string, number>>({})
  const [budgetRange, setBudgetRange] = useState<{ min: number | null; max: number | null; count: number }>({ min: null, max: null, count: 0 })
  const [rateTypeCounts, setRateTypeCounts] = useState<Record<string, number>>({})

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Debounce budget range
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedBudgetMin(budgetMin)
      setDebouncedBudgetMax(budgetMax)
      setPage(1)
    }, 500)
    return () => clearTimeout(timer)
  }, [budgetMin, budgetMax])

  const fetchPortfolios = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (selectedCategory) params.set('category', selectedCategory)
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (selectedAvailability) params.set('availability', selectedAvailability)
      if (selectedExperience) params.set('experience', selectedExperience)
      if (debouncedBudgetMin) params.set('budgetMin', debouncedBudgetMin)
      if (debouncedBudgetMax) params.set('budgetMax', debouncedBudgetMax)
      if (selectedRateType) params.set('rateType', selectedRateType)
      const res = await fetch(`/api/portfolios?${params}`)
      const data = await res.json()
      setPortfolios(data.items || [])
      setTotalPages(data.totalPages || 0)
      setTotalItems(data.totalItems || 0)
      if (data.categoryCounts) setCategoryCounts(data.categoryCounts)
      if (data.availabilityCounts) setAvailabilityCounts(data.availabilityCounts)
      if (data.experienceCounts) setExperienceCounts(data.experienceCounts)
      if (data.budgetRange) setBudgetRange(data.budgetRange)
      if (data.rateTypeCounts) setRateTypeCounts(data.rateTypeCounts)
    } catch (error) {
      console.error('Failed to fetch portfolios:', error)
    } finally {
      setLoading(false)
    }
  }, [page, selectedCategory, debouncedSearch, selectedAvailability, selectedExperience, debouncedBudgetMin, debouncedBudgetMax, selectedRateType])

  useEffect(() => {
    fetchPortfolios()
  }, [fetchPortfolios])

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(prev => prev === cat ? '' : cat)
    setPage(1)
  }

  const toggleFilter = (
    current: string,
    value: string,
    setter: (v: string) => void
  ) => {
    setter(current === value ? '' : value)
    setPage(1)
  }

  const hasActiveFilters = selectedAvailability || selectedExperience || budgetMin || budgetMax || selectedRateType

  const clearAllFilters = () => {
    setSelectedAvailability('')
    setSelectedExperience('')
    setBudgetMin('')
    setBudgetMax('')
    setSelectedRateType('')
    setPage(1)
  }

  // Sort categories by count desc, "Other" last
  const sortedCategories = Object.entries(categoryCounts)
    .filter(([, count]) => count > 0)
    .sort(([a, countA], [b, countB]) => {
      if (a === 'Other') return 1
      if (b === 'Other') return -1
      return countB - countA
    })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-3 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Freelancer Portfolios</h2>
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

        {/* Search */}
        <div className="px-6 pt-3 pb-2 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by headline or title..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Category Filter Chips */}
        {sortedCategories.length > 0 && (
          <div className="px-6 pt-3 pb-2 border-b border-gray-100 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-gray-500 mr-1">Category:</span>
            {sortedCategories.map(([cat, count]) => {
              const color = CATEGORY_COLORS[cat] || CATEGORY_COLORS['Other']
              return (
                <button
                  key={cat}
                  onClick={() => handleCategoryChange(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                    selectedCategory === cat
                      ? `${color} ring-2 ring-offset-1 ring-current`
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {cat}
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                    selectedCategory === cat ? 'bg-white/50' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {count}
                  </span>
                </button>
              )
            })}
            {selectedCategory && (
              <button
                onClick={() => { setSelectedCategory(''); setPage(1) }}
                className="px-2 py-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="px-6 pt-2 pb-2 border-b border-gray-100 space-y-2">
          {/* Availability */}
          {Object.keys(availabilityCounts).length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-gray-500 mr-1 w-16 flex-shrink-0">Availability:</span>
              {Object.entries(availabilityCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([val, count]) => (
                  <button
                    key={val}
                    onClick={() => toggleFilter(selectedAvailability, val, setSelectedAvailability)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                      selectedAvailability === val
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300 ring-2 ring-offset-1 ring-emerald-400'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {AVAILABILITY_LABELS[val] || val.replace(/_/g, ' ')}
                    <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                      selectedAvailability === val ? 'bg-white/50' : 'bg-gray-200 text-gray-600'
                    }`}>{count}</span>
                  </button>
                ))}
            </div>
          )}

          {/* Experience */}
          {Object.keys(experienceCounts).length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-gray-500 mr-1 w-16 flex-shrink-0">Experience:</span>
              {EXPERIENCE_OPTIONS
                .filter(opt => experienceCounts[opt])
                .map(opt => (
                  <button
                    key={opt}
                    onClick={() => toggleFilter(selectedExperience, opt, setSelectedExperience)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                      selectedExperience === opt
                        ? 'bg-blue-100 text-blue-800 border-blue-300 ring-2 ring-offset-1 ring-blue-400'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {EXPERIENCE_LABELS[opt]}
                    <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                      selectedExperience === opt ? 'bg-white/50' : 'bg-gray-200 text-gray-600'
                    }`}>{experienceCounts[opt]}</span>
                  </button>
                ))}
            </div>
          )}

          {/* Budget Range */}
          {budgetRange.count > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-gray-500 mr-1 w-16 flex-shrink-0">Budget:</span>
              <span className="text-[10px] text-gray-400">₹</span>
              <input
                type="number"
                value={budgetMin}
                onChange={(e) => setBudgetMin(e.target.value)}
                placeholder={budgetRange.min != null ? String(budgetRange.min) : 'Min'}
                className="w-24 px-2 py-1 text-xs border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
              />
              <span className="text-xs text-gray-400">to ₹</span>
              <input
                type="number"
                value={budgetMax}
                onChange={(e) => setBudgetMax(e.target.value)}
                placeholder={budgetRange.max != null ? String(budgetRange.max) : 'Max'}
                className="w-24 px-2 py-1 text-xs border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
              />
              {(budgetMin || budgetMax) && (
                <button
                  onClick={() => { setBudgetMin(''); setBudgetMax('') }}
                  className="px-1.5 py-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  Clear
                </button>
              )}
              <span className="text-[10px] text-gray-400 ml-1">
                Range: ₹{budgetRange.min?.toLocaleString()} – ₹{budgetRange.max?.toLocaleString()} ({budgetRange.count} profiles)
              </span>
            </div>
          )}

          {/* Rate Type */}
          {Object.keys(rateTypeCounts).length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-gray-500 mr-1 w-16 flex-shrink-0">Rate Type:</span>
              {Object.entries(rateTypeCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([val, count]) => (
                  <button
                    key={val}
                    onClick={() => toggleFilter(selectedRateType, val, setSelectedRateType)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                      selectedRateType === val
                        ? 'bg-violet-100 text-violet-800 border-violet-300 ring-2 ring-offset-1 ring-violet-400'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {RATE_TYPE_LABELS[val] || val}
                    <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                      selectedRateType === val ? 'bg-white/50' : 'bg-gray-200 text-gray-600'
                    }`}>{count}</span>
                  </button>
                ))}
            </div>
          )}

          {/* Clear all filters */}
          {hasActiveFilters && (
            <div className="flex justify-end">
              <button
                onClick={clearAllFilters}
                className="px-2 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading portfolios...</div>
          ) : portfolios.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No portfolios found</div>
          ) : (
            <div className="space-y-3">
              {portfolios.map(profile => (
                <div
                  key={profile.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-purple-400 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {/* Name and title */}
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-medium text-gray-900">
                          {profile.userName || profile.headline || 'Unknown'}
                        </h3>
                        {profile.currentTitle && (
                          <span className="text-sm text-gray-500">{profile.currentTitle}</span>
                        )}
                      </div>

                      {/* Headline */}
                      {profile.headline && profile.headline !== profile.userName && (
                        <p className="text-sm text-gray-600 mb-2">{profile.headline}</p>
                      )}

                      {/* Contact info */}
                      {(profile.userName || profile.userPhone) && (
                        <div className="flex items-center gap-3 mb-2">
                          {profile.userName && (
                            <div className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-gray-400" />
                              <span className="text-xs text-gray-600">{profile.userName}</span>
                            </div>
                          )}
                          {profile.userPhone && (
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-gray-400" />
                              <span className="text-xs text-gray-500">{profile.userPhone}</span>
                            </div>
                          )}
                          {profile.userId && onSelectUser && (
                            <button
                              onClick={() => onSelectUser(profile.userId!)}
                              className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-md transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" />
                              View Profile
                            </button>
                          )}
                        </div>
                      )}

                      {/* Skills */}
                      {profile.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {profile.skills.slice(0, 8).map((skill, i) => (
                            <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                              {skill}
                            </span>
                          ))}
                          {profile.skills.length > 8 && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                              +{profile.skills.length - 8} more
                            </span>
                          )}
                        </div>
                      )}

                      {/* Meta row */}
                      <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                        {profile.experienceYears != null && (
                          <span className="flex items-center gap-1">
                            <Award className="w-3 h-3" />
                            {profile.experienceYears} yrs exp
                          </span>
                        )}
                        {profile.rateMin != null && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            {profile.rateCurrency || '$'}{profile.rateMin.toLocaleString()}
                            {profile.rateMax != null && profile.rateMax !== profile.rateMin && ` - ${profile.rateCurrency || '$'}${profile.rateMax.toLocaleString()}`}
                            {profile.rateType && ` /${profile.rateType}`}
                          </span>
                        )}
                        {profile.availability && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {profile.availability.replace(/_/g, ' ')}
                          </span>
                        )}
                        {profile.portfolioUrl && (
                          <a
                            href={profile.portfolioUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="w-3 h-3" />
                            Portfolio
                          </a>
                        )}
                        <span>&middot;</span>
                        <span>{format(new Date(profile.createdAt), 'MMM d, yyyy')}</span>
                      </div>
                    </div>

                    {/* Broad category badge */}
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border flex-shrink-0 ml-3 ${
                      CATEGORY_COLORS[profile.broadCategory] || CATEGORY_COLORS['Other']
                    }`}>
                      {profile.broadCategory}
                    </span>
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
