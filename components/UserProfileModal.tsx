'use client'

import { useEffect, useState, useMemo } from 'react'
import { X, User, Mail, Phone, Briefcase, MessageSquare, UserCheck, Calendar, Clock, DollarSign, Zap } from 'lucide-react'
import { format } from 'date-fns'
import { Pagination, DateRangeFilter } from './ListControls'

interface Activity {
  id: string
  type: 'reachout' | 'query' | 'posting'
  title: string
  status: string
  stage: string
  messageCount: number
  lastMessageAt: string
  createdAt: string
  hasResponse?: boolean
  candidatesMatched?: number
  candidatesReached?: number
  conversationType?: string
  category?: string
  gigId?: string
  matchScore?: number
}

interface UserData {
  user: {
    id: string
    full_name: string
    email: string
    phone: string
    user_type: string
    created_at: string
    last_login_at: string
    role?: string
    profile?: {
      id: string
      headline: string
      bio: string
      specialty: string
      skills: string[]
      experience_years: number
      current_title: string
      rate_type: string
      rate_min: number
      rate_max: number
      rate_currency: string
      availability: string
      hours_per_week: number
      preferred_work_type: string
      status: string
      portfolio_url: string
      portfolio_links: string[]
      strengths: string[]
      keywords: string[]
      maya_notes: string
      source: string
    }
  }
  activities: {
    reachouts: Activity[]
    queries: Activity[]
    postings: Activity[]
  }
  summary: {
    totalReachouts: number
    totalQueries: number
    totalPostings: number
    totalConversations: number
  }
}

interface UserProfileModalProps {
  userId: string
  onClose: () => void
  onSelectConversation: (id: string, type: 'reachout' | 'query' | 'posting') => void
}

export default function UserProfileModal({ userId, onClose, onSelectConversation }: UserProfileModalProps) {
  const [userData, setUserData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'reachouts' | 'queries' | 'postings'>('reachouts')
  const [activityPage, setActivityPage] = useState(1)
  const [activityStartDate, setActivityStartDate] = useState('')
  const [activityEndDate, setActivityEndDate] = useState('')
  const ACTIVITY_PAGE_SIZE = 10

  useEffect(() => {
    fetchUserData()
  }, [userId])

  const fetchUserData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/users/${userId}`)
      const data = await res.json()
      setUserData(data)

      // Set default tab to first non-empty category
      if (data.activities.reachouts.length > 0) setActiveTab('reachouts')
      else if (data.activities.queries.length > 0) setActiveTab('queries')
      else if (data.activities.postings.length > 0) setActiveTab('postings')
    } catch (error) {
      console.error('Failed to fetch user data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'reachout':
        return <UserCheck className="w-4 h-4 text-green-600" />
      case 'query':
        return <MessageSquare className="w-4 h-4 text-blue-600" />
      case 'posting':
        return <Briefcase className="w-4 h-4 text-purple-600" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    const lowerStatus = status?.toLowerCase() || ''
    if (lowerStatus.includes('active') || lowerStatus.includes('sent') || lowerStatus.includes('interested')) return 'bg-green-100 text-green-700'
    if (lowerStatus.includes('pending') || lowerStatus.includes('matching')) return 'bg-yellow-100 text-yellow-700'
    if (lowerStatus.includes('completed') || lowerStatus.includes('filled') || lowerStatus.includes('hired')) return 'bg-blue-100 text-blue-700'
    if (lowerStatus.includes('paused') || lowerStatus.includes('archived')) return 'bg-orange-100 text-orange-700'
    if (lowerStatus.includes('draft')) return 'bg-gray-100 text-gray-700'
    return 'bg-gray-100 text-gray-700'
  }

  const getConvTypeLabel = (convType: string) => {
    const labels: Record<string, string> = {
      hirer_intake: 'Hirer Intake',
      candidate_onboarding: 'Onboarding',
      matching: 'Matching',
      outreach: 'Outreach',
      negotiation: 'Negotiation',
      insights: 'Insights',
      general: 'General',
    }
    return labels[convType] || convType?.replace(/_/g, ' ') || ''
  }

  const safeFormatDate = (dateStr: string | null | undefined, fmt: string) => {
    if (!dateStr) return 'N/A'
    try {
      return format(new Date(dateStr), fmt)
    } catch {
      return 'N/A'
    }
  }

  if (loading || !userData) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="text-gray-500">Loading user profile...</div>
        </div>
      </div>
    )
  }

  const filteredActivities = useMemo(() => {
    const all = userData.activities[activeTab] || []
    return all.filter((a) => {
      const date = a.createdAt
      if (activityStartDate && date < activityStartDate) return false
      if (activityEndDate && date > `${activityEndDate}T23:59:59.999Z`) return false
      return true
    })
  }, [userData, activeTab, activityStartDate, activityEndDate])

  const activityTotalPages = Math.ceil(filteredActivities.length / ACTIVITY_PAGE_SIZE)
  const currentActivities = filteredActivities.slice(
    (activityPage - 1) * ACTIVITY_PAGE_SIZE,
    activityPage * ACTIVITY_PAGE_SIZE
  )

  const handleTabChange = (tab: 'reachouts' | 'queries' | 'postings') => {
    setActiveTab(tab)
    setActivityPage(1)
  }
  const handleActivityStartDate = (d: string) => { setActivityStartDate(d); setActivityPage(1) }
  const handleActivityEndDate = (d: string) => { setActivityEndDate(d); setActivityPage(1) }
  const handleClearActivityDates = () => { setActivityStartDate(''); setActivityEndDate(''); setActivityPage(1) }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] flex flex-col">
        {/* Close button row - stays fixed */}
        <div className="flex justify-end p-3 pb-0 flex-shrink-0">
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pb-6 border-b border-gray-200">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-semibold text-gray-900">
                  {userData.user.full_name || 'Unnamed User'}
                </h2>
                <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                  {userData.user.user_type || 'user'}
                </span>
                {userData.user.role && userData.user.role !== 'candidate' && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded">
                    {userData.user.role}
                  </span>
                )}
              </div>
              {userData.user.profile?.headline && (
                <p className="text-gray-600 mt-1">{userData.user.profile.headline}</p>
              )}
              <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500">
                {userData.user.email && (
                  <div className="flex items-center gap-1">
                    <Mail className="w-4 h-4" />
                    <span>{userData.user.email}</span>
                  </div>
                )}
                {userData.user.phone && (
                  <div className="flex items-center gap-1">
                    <Phone className="w-4 h-4" />
                    <span>{userData.user.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>Joined {safeFormatDate(userData.user.created_at, 'MMM d, yyyy')}</span>
                </div>
                {userData.user.last_login_at && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>Last seen {safeFormatDate(userData.user.last_login_at, 'MMM d, h:mm a')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Profile Details */}
        {userData.user.profile && (
          <div className="px-6 py-4 border-b border-gray-200 bg-white space-y-3">
            {userData.user.profile.bio && (
              <p className="text-sm text-gray-600">{userData.user.profile.bio}</p>
            )}
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {userData.user.profile.experience_years != null && (
                <div className="flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-gray-700">{userData.user.profile.experience_years} yrs experience</span>
                </div>
              )}
              {userData.user.profile.rate_min != null && (
                <div className="flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-gray-700">
                    {userData.user.profile.rate_currency || '$'}{userData.user.profile.rate_min}
                    {userData.user.profile.rate_max ? ` - ${userData.user.profile.rate_currency || '$'}${userData.user.profile.rate_max}` : ''}
                    {userData.user.profile.rate_type ? ` / ${userData.user.profile.rate_type}` : ''}
                  </span>
                </div>
              )}
              {userData.user.profile.availability && (
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-gray-700">{userData.user.profile.availability.replace(/_/g, ' ')}</span>
                </div>
              )}
              {userData.user.profile.specialty && (
                <span className="text-gray-500">Specialty: {userData.user.profile.specialty}</span>
              )}
            </div>
            {userData.user.profile.skills && userData.user.profile.skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {userData.user.profile.skills.map((skill: string, i: number) => (
                  <span key={i} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">
                    {skill}
                  </span>
                ))}
              </div>
            )}
            {userData.user.profile.strengths && userData.user.profile.strengths.length > 0 && (
              <div className="text-sm">
                <span className="font-medium text-gray-700">Strengths: </span>
                <span className="text-gray-600">{userData.user.profile.strengths.join(', ')}</span>
              </div>
            )}
            {userData.user.profile.maya_notes && (
              <div className="text-sm bg-blue-50 p-2 rounded">
                <span className="font-medium text-blue-700">Maya Notes: </span>
                <span className="text-blue-600">{userData.user.profile.maya_notes}</span>
              </div>
            )}
            {userData.user.profile.portfolio_url && (
              <div className="text-sm">
                <span className="font-medium text-gray-700">Portfolio: </span>
                <a href={userData.user.profile.portfolio_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  {userData.user.profile.portfolio_url}
                </a>
              </div>
            )}
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 border-b border-gray-200">
          <div className="text-center">
            <div className="text-2xl font-semibold text-gray-900">{userData.summary.totalReachouts}</div>
            <div className="text-sm text-gray-600">Reachouts</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-gray-900">{userData.summary.totalQueries}</div>
            <div className="text-sm text-gray-600">Conversations</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-gray-900">{userData.summary.totalPostings}</div>
            <div className="text-sm text-gray-600">Postings</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6">
          <button
            onClick={() => handleTabChange('reachouts')}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'reachouts'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Reachouts ({userData.summary.totalReachouts})
          </button>
          <button
            onClick={() => handleTabChange('queries')}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'queries'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Conversations ({userData.summary.totalQueries})
          </button>
          <button
            onClick={() => handleTabChange('postings')}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'postings'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Postings ({userData.summary.totalPostings})
          </button>
        </div>

        {/* Date Filter for activities */}
        <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
          <DateRangeFilter
            startDate={activityStartDate}
            endDate={activityEndDate}
            onStartDateChange={handleActivityStartDate}
            onEndDateChange={handleActivityEndDate}
            onClear={handleClearActivityDates}
          />
        </div>

        {/* Activities List */}
        <div className="p-6">
          {currentActivities.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No {activeTab} found{(activityStartDate || activityEndDate) ? ' for this date range' : ' for this user'}
            </div>
          ) : (
            <div className="space-y-3">
              {currentActivities.map((activity) => (
                <div
                  key={activity.id}
                  onClick={() => onSelectConversation(activity.id, activity.type)}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:shadow-sm cursor-pointer transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getActivityIcon(activity.type)}
                        <h3 className="font-medium text-gray-900">{activity.title}</h3>
                        {activity.conversationType && (
                          <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-500 rounded">
                            {getConvTypeLabel(activity.conversationType)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-500 flex-wrap">
                        <span>{activity.messageCount} messages</span>
                        <span>•</span>
                        <span>{safeFormatDate(activity.createdAt, 'MMM d, yyyy')}</span>
                        {activity.lastMessageAt && (
                          <>
                            <span>•</span>
                            <span>Last: {safeFormatDate(activity.lastMessageAt, 'MMM d')}</span>
                          </>
                        )}
                        {activity.hasResponse && (
                          <>
                            <span>•</span>
                            <span className="text-green-600 font-medium">Responded</span>
                          </>
                        )}
                        {activity.matchScore != null && (
                          <>
                            <span>•</span>
                            <span className="text-blue-600">Score: {Math.round(activity.matchScore * 100)}%</span>
                          </>
                        )}
                      </div>
                      {activity.type === 'posting' && activity.candidatesMatched !== undefined && (
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span>{activity.candidatesMatched} matched</span>
                          <span>•</span>
                          <span>{activity.candidatesReached} reached</span>
                        </div>
                      )}
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(activity.status)}`}>
                      {activity.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {activityTotalPages > 1 && (
            <Pagination
              page={activityPage}
              totalPages={activityTotalPages}
              totalItems={filteredActivities.length}
              onPageChange={setActivityPage}
            />
          )}
        </div>
        </div>{/* end scrollable content */}
      </div>
    </div>
  )
}
