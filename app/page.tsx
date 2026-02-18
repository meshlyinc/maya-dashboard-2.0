'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Users, MessageSquare, MessageCircle, TrendingUp, Briefcase, UserCheck, FolderKanban, AlertTriangle, LogOut, RefreshCw, Link2 } from 'lucide-react'
import { AnalyticsMetrics, ConversationDetail } from '@/lib/types'
import MetricCard from '@/components/MetricCard'
import ActivityChart from '@/components/ActivityChart'
import ConversationList from '@/components/ConversationList'
import ConversationModal from '@/components/ConversationModal'
import TimeFilterSelector from '@/components/TimeFilterSelector'
import UserSearch from '@/components/UserSearch'
import UserProfileModal from '@/components/UserProfileModal'
import UnansweredModal from '@/components/UnansweredModal'
import ConnectionsModal from '@/components/ConnectionsModal'

export default function Dashboard() {
  const router = useRouter()
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null)
  const [timeFilter, setTimeFilter] = useState('24h')
  const [loading, setLoading] = useState(true)
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<'posting' | 'reachout' | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [detailConversationId, setDetailConversationId] = useState<string | null>(null)
  const [showUnanswered, setShowUnanswered] = useState(false)
  const [showConnections, setShowConnections] = useState(false)
  const [unansweredCount, setUnansweredCount] = useState<number | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const AUTO_REFRESH_MS = 5 * 60 * 1000 // 5 minutes

  const fetchAllData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)
    else if (!metrics) setLoading(true)

    try {
      const [analyticsRes, unansweredRes] = await Promise.all([
        fetch(`/api/analytics?timeFilter=${timeFilter}`),
        fetch('/api/unanswered'),
      ])
      const [analyticsData, unansweredData] = await Promise.all([
        analyticsRes.json(),
        unansweredRes.json(),
      ])
      setMetrics(analyticsData)
      setUnansweredCount(unansweredData.count ?? 0)
      setLastRefreshed(new Date())
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [timeFilter, metrics])

  // Fetch on mount and when time filter changes
  useEffect(() => {
    setLoading(true)
    fetchAllData()
  }, [timeFilter])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    intervalRef.current = setInterval(() => fetchAllData(), AUTO_REFRESH_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchAllData])

  const handleRefresh = () => {
    // Reset the auto-refresh timer on manual refresh
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => fetchAllData(), AUTO_REFRESH_MS)
    fetchAllData(true)
  }

  const openConversations = (type: 'posting' | 'reachout') => {
    setSelectedType(type)
  }

  const closeConversationList = () => {
    setSelectedType(null)
  }

  const openConversation = (id: string) => {
    setSelectedConversation(id)
  }

  const closeConversation = () => {
    setSelectedConversation(null)
  }

  const openUserProfile = (userId: string) => {
    setSelectedUserId(userId)
  }

  const closeUserProfile = () => {
    setSelectedUserId(null)
  }

  const handleSelectConversation = (id: string, type: 'reachout' | 'query' | 'posting') => {
    setSelectedConversation(id)
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  if (loading || !metrics) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading analytics...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Maya Analytics</h1>
              <p className="text-sm text-gray-500 mt-1">Real-time insights and metrics</p>
            </div>
            <div className="flex items-center gap-3">
              {lastRefreshed && (
                <span className="text-xs text-gray-400">
                  Updated {lastRefreshed.toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                title="Refresh data"
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
              <TimeFilterSelector value={timeFilter} onChange={setTimeFilter} />
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>

          {/* User Search */}
          <div className="max-w-2xl">
            <UserSearch onSelectUser={openUserProfile} />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Total Users"
            value={metrics.totalUsers.toLocaleString()}
            icon={Users}
            trend="+12.5%"
          />
          <MetricCard
            title="Messages"
            value={metrics.totalMessages.toLocaleString()}
            icon={MessageSquare}
            trend="+8.2%"
          />
          <MetricCard
            title="Conversations"
            value={metrics.totalConversations.toLocaleString()}
            icon={MessageCircle}
            trend="+15.3%"
          />
          <MetricCard
            title="Users/Minute"
            value={metrics.usersPerMinute.toFixed(2)}
            icon={TrendingUp}
            suffix="/min"
          />
        </div>

        {/* Additional Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
          <div
            className="bg-white rounded-lg p-6 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => openConversations('posting')}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Postings / Queries</h3>
              <Briefcase className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-3xl font-semibold text-gray-900">{metrics.totalPostings}</p>
            <p className="text-xs text-gray-500 mt-2">Click to view conversations</p>
          </div>

          <div
            className="bg-white rounded-lg p-6 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => openConversations('reachout')}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Reachouts</h3>
              <UserCheck className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-3xl font-semibold text-gray-900">{metrics.totalReachouts}</p>
            <p className="text-xs text-gray-500 mt-2">Click to view conversations</p>
          </div>

          <div
            className="bg-white rounded-lg p-6 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setShowConnections(true)}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Connections</h3>
              <Link2 className="w-5 h-5 text-pink-500" />
            </div>
            <p className="text-3xl font-semibold text-gray-900">{metrics.totalConnections}</p>
            <p className="text-xs text-gray-500 mt-2">Click to view connections</p>
          </div>

          <div className="bg-white rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Freelancer Portfolios</h3>
              <FolderKanban className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-3xl font-semibold text-gray-900">{metrics.totalFreelancerPortfolios}</p>
            <p className="text-xs text-gray-500 mt-2">Total candidate profiles</p>
          </div>

          <div
            className="bg-white rounded-lg p-6 cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-red-400"
            onClick={() => setShowUnanswered(true)}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-red-600">Errors (Unanswered)</h3>
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <p className="text-3xl font-semibold text-gray-900">{unansweredCount ?? '...'}</p>
            <p className="text-xs text-gray-500 mt-2">Maya didn&apos;t reply - click to view</p>
          </div>
        </div>

        {/* Activity Chart */}
        <div className="bg-white rounded-lg p-6 mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Activity Overview</h2>
          <ActivityChart data={metrics.recentActivity} metricsTimeFilter={timeFilter} />
        </div>
      </div>

      {/* Conversation List Modal */}
      {selectedType && (
        <ConversationList
          type={selectedType}
          onClose={closeConversationList}
          onSelectConversation={openConversation}
        />
      )}

      {/* Conversation Detail Modal */}
      {selectedConversation && (
        <ConversationModal
          conversationId={selectedConversation}
          onClose={closeConversation}
          onSelectMatch={(matchId) => setDetailConversationId(matchId)}
        />
      )}

      {/* Stacked Detail Modal - for viewing a specific reachout's full conversation */}
      {detailConversationId && (
        <ConversationModal
          conversationId={detailConversationId}
          onClose={() => setDetailConversationId(null)}
        />
      )}

      {/* Unanswered / Errors Modal */}
      {showUnanswered && (
        <UnansweredModal
          onClose={() => setShowUnanswered(false)}
          onSelectConversation={(id) => { setSelectedConversation(id) }}
          onSelectUser={(userId) => { setSelectedUserId(userId) }}
        />
      )}

      {/* Connections Modal */}
      {showConnections && (
        <ConnectionsModal
          onClose={() => setShowConnections(false)}
          onSelectUser={(userId) => { setSelectedUserId(userId) }}
        />
      )}

      {/* User Profile Modal */}
      {selectedUserId && (
        <UserProfileModal
          userId={selectedUserId}
          onClose={closeUserProfile}
          onSelectConversation={handleSelectConversation}
        />
      )}
    </div>
  )
}
