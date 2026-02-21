import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { subHours, subMinutes, subDays, subMonths, format } from 'date-fns'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const timeFilter = searchParams.get('timeFilter') || '24h'

  // Calculate date range based on filter
  const now = new Date()
  let startDate: Date

  switch (timeFilter) {
    case '1h':
      startDate = subHours(now, 1)
      break
    case '24h':
      startDate = subHours(now, 24)
      break
    case '7d':
      startDate = subDays(now, 7)
      break
    case '30d':
      startDate = subDays(now, 30)
      break
    case '3m':
      startDate = subMonths(now, 3)
      break
    case 'all':
      startDate = new Date('2020-01-01')
      break
    default:
      startDate = subHours(now, 24)
  }

  try {
    // Fetch all metrics in parallel
    const [
      usersResult,
      messagesResult,
      conversationsResult,
      postingsResult,
      reachoutsResult,
      portfoliosResult,
      connectionsResult,
      groupConvsResult,
      recentUsersResult
    ] = await Promise.all([
      // Placeholder for users count (computed separately below)
      Promise.resolve({ count: 0 }),

      // Total messages (only from non-archived conversations)
      supabase
        .from('messages')
        .select('id, conversations!inner(id)', { count: 'exact', head: true })
        .neq('conversations.status', 'archived')
        .gte('created_at', startDate.toISOString()),

      // Total conversations (only non-archived)
      supabase
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .neq('status', 'archived')
        .gte('created_at', startDate.toISOString()),

      // Postings (gig_postings table)
      supabase
        .from('gig_postings')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startDate.toISOString()),

      // Reachouts (matches that have an outreach message)
      supabase
        .from('matches')
        .select('id', { count: 'exact', head: true })
        .not('outreach_message', 'is', null)
        .gte('created_at', startDate.toISOString()),

      // Freelancer portfolios (candidate_profiles, exclude migrated)
      supabase
        .from('candidate_profiles')
        .select('id', { count: 'exact', head: true })
        .neq('source', 'whatsapp_migration')
        .gte('created_at', startDate.toISOString()),

      // Connections (matches where connected_at is not null)
      supabase
        .from('matches')
        .select('id', { count: 'exact', head: true })
        .not('connected_at', 'is', null)
        .gte('connected_at', startDate.toISOString()),

      // Group conversations (introduction type)
      supabase
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_type', 'introduction'),

      // Recent users for activity chart (uses main timeFilter initially, will be re-fetched for chart)
      supabase
        .from('users')
        .select('created_at')
        .gte('created_at', subHours(now, 24).toISOString())
        .order('created_at', { ascending: true }),
    ])

    // Chart time filter (can be different from metrics time filter)
    const chartTimeFilter = searchParams.get('chartTimeFilter') || '1d'
    let chartStartDate: Date
    switch (chartTimeFilter) {
      case '1h': chartStartDate = subHours(now, 1); break
      case '3h': chartStartDate = subHours(now, 3); break
      case '6h': chartStartDate = subHours(now, 6); break
      case '1d': chartStartDate = subHours(now, 24); break
      case '7d': chartStartDate = subDays(now, 7); break
      case '30d': chartStartDate = subDays(now, 30); break
      case 'all': chartStartDate = new Date('2020-01-01'); break
      default: chartStartDate = subHours(now, 24)
    }

    // Fetch additional chart data in parallel
    const [
      recentMessagesResult,
      recentConvsResult,
      recentReachoutsResult,
      recentConnectionsResult
    ] = await Promise.all([
      supabase
        .from('messages')
        .select('created_at')
        .gte('created_at', chartStartDate.toISOString())
        .order('created_at', { ascending: true }),
      supabase
        .from('conversations')
        .select('created_at')
        .gte('created_at', chartStartDate.toISOString())
        .order('created_at', { ascending: true }),
      supabase
        .from('matches')
        .select('created_at')
        .not('outreach_message', 'is', null)
        .gte('created_at', chartStartDate.toISOString())
        .order('created_at', { ascending: true }),
      supabase
        .from('matches')
        .select('connected_at')
        .not('connected_at', 'is', null)
        .gte('connected_at', chartStartDate.toISOString())
        .order('connected_at', { ascending: true }),
    ])

    // Calculate users per minute (last 5 min, only users with non-archived convos)
    const fiveMinAgo = subMinutes(now, 5)
    const { data: recentConvUsers } = await supabase
      .from('conversations')
      .select('user_id')
      .neq('status', 'archived')
      .gte('created_at', fiveMinAgo.toISOString())
    const usersLast5Min = new Set((recentConvUsers || []).map((c: any) => c.user_id).filter(Boolean)).size

    const usersPerMinute = usersLast5Min ? (usersLast5Min / 5).toFixed(2) : '0.00'

    // Fetch chart users with chart time filter
    const chartUsersResult = await supabase
      .from('users')
      .select('created_at')
      .gte('created_at', chartStartDate.toISOString())
      .order('created_at', { ascending: true })

    // Process activity data for chart (all metrics)
    const activityData = processActivityData(
      chartUsersResult.data || [],
      recentMessagesResult.data || [],
      recentConvsResult.data || [],
      recentReachoutsResult.data || [],
      (recentConnectionsResult.data || []).map((c: any) => ({ created_at: c.connected_at })),
      chartTimeFilter
    )

    // Count distinct users with at least one non-archived conversation (paginated to avoid 1000-row limit)
    const activeUserIds = new Set<string>()
    let userOffset = 0
    const BATCH = 1000
    while (true) {
      const { data: batch } = await supabase
        .from('conversations')
        .select('user_id')
        .neq('status', 'archived')
        .gte('created_at', startDate.toISOString())
        .order('id', { ascending: true })
        .range(userOffset, userOffset + BATCH - 1)
      if (!batch || batch.length === 0) break
      batch.forEach((c: any) => { if (c.user_id) activeUserIds.add(c.user_id) })
      if (batch.length < BATCH) break
      userOffset += BATCH
    }

    const metrics = {
      totalUsers: activeUserIds.size,
      totalMessages: messagesResult.count || 0,
      totalConversations: conversationsResult.count || 0,
      usersPerMinute: parseFloat(usersPerMinute),
      totalPostings: postingsResult.count || 0,
      totalReachouts: reachoutsResult.count || 0,
      totalConnections: connectionsResult.count || 0,
      totalGroupConversations: groupConvsResult.count || 0,
      totalFreelancerPortfolios: portfoliosResult.count || 0,
      recentActivity: activityData,
      timeFilter
    }

    return NextResponse.json(metrics)
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}

function processActivityData(
  users: any[],
  messages: any[],
  conversations: any[],
  reachouts: any[],
  connections: any[],
  chartTimeFilter: string
): any[] {
  const now = new Date()
  const buckets: { key: string; label: string }[] = []

  // Convert UTC date to IST (UTC+5:30) for display
  const toIST = (date: Date): Date => new Date(date.getTime() + 5.5 * 60 * 60 * 1000)

  // Generate buckets based on time filter (all keys/labels in IST)
  // 1h → 5-min intervals, 3h → 15-min, 6h → 30-min, 1d → 1-hour, 7d/30d → 1-day, all → 1-month
  const getBucketKey = (date: Date): string => {
    const d = toIST(new Date(date))
    switch (chartTimeFilter) {
      case '1h': {
        // 5-minute buckets
        const mins = Math.floor(d.getUTCMinutes() / 5) * 5
        return `${d.toISOString().slice(0, 13)}:${String(mins).padStart(2, '0')}`
      }
      case '3h': {
        // 15-minute buckets
        const mins = Math.floor(d.getUTCMinutes() / 15) * 15
        return `${d.toISOString().slice(0, 13)}:${String(mins).padStart(2, '0')}`
      }
      case '6h': {
        // 30-minute buckets
        const mins = Math.floor(d.getUTCMinutes() / 30) * 30
        return `${d.toISOString().slice(0, 13)}:${String(mins).padStart(2, '0')}`
      }
      case '1d': {
        // 1-hour buckets
        return d.toISOString().slice(0, 13)
      }
      case '7d':
      case '30d': {
        // 1-day buckets
        return d.toISOString().slice(0, 10)
      }
      case 'all': {
        // 1-month buckets
        return d.toISOString().slice(0, 7)
      }
      default:
        return d.toISOString().slice(0, 13)
    }
  }

  const getLabel = (key: string): string => {
    switch (chartTimeFilter) {
      case '1h':
      case '3h':
      case '6h':
        return key.slice(11) // HH:MM (IST)
      case '1d':
        return key.slice(11) + ':00' // HH:00 (IST)
      case '7d':
      case '30d':
        return format(new Date(key + 'T00:00:00Z'), 'MMM dd')
      case 'all':
        return format(new Date(key + '-01T00:00:00Z'), 'MMM yyyy')
      default:
        return key.slice(11) + ':00'
    }
  }

  // Generate all bucket keys for the time range
  switch (chartTimeFilter) {
    case '1h':
      for (let i = 12; i >= 0; i--) {
        const t = new Date(now.getTime() - i * 5 * 60 * 1000)
        const key = getBucketKey(t)
        if (!buckets.find(b => b.key === key)) buckets.push({ key, label: getLabel(key) })
      }
      break
    case '3h':
      for (let i = 12; i >= 0; i--) {
        const t = new Date(now.getTime() - i * 15 * 60 * 1000)
        const key = getBucketKey(t)
        if (!buckets.find(b => b.key === key)) buckets.push({ key, label: getLabel(key) })
      }
      break
    case '6h':
      for (let i = 12; i >= 0; i--) {
        const t = new Date(now.getTime() - i * 30 * 60 * 1000)
        const key = getBucketKey(t)
        if (!buckets.find(b => b.key === key)) buckets.push({ key, label: getLabel(key) })
      }
      break
    case '1d':
      for (let i = 23; i >= 0; i--) {
        const t = subHours(now, i)
        const key = getBucketKey(t)
        buckets.push({ key, label: getLabel(key) })
      }
      break
    case '7d':
      for (let i = 6; i >= 0; i--) {
        const t = subDays(now, i)
        const key = getBucketKey(t)
        buckets.push({ key, label: getLabel(key) })
      }
      break
    case '30d':
      for (let i = 29; i >= 0; i--) {
        const t = subDays(now, i)
        const key = getBucketKey(t)
        buckets.push({ key, label: getLabel(key) })
      }
      break
    case 'all':
      // Generate monthly buckets from earliest data to now
      const earliest = new Date('2020-01-01')
      const current = new Date(earliest)
      while (current <= now) {
        const key = getBucketKey(current)
        buckets.push({ key, label: getLabel(key) })
        current.setMonth(current.getMonth() + 1)
      }
      break
  }

  const countByBucket = (items: any[]) => {
    const counts: Record<string, number> = {}
    buckets.forEach(b => { counts[b.key] = 0 })
    items.forEach(item => {
      const key = getBucketKey(new Date(item.created_at))
      if (counts[key] !== undefined) counts[key]++
    })
    return counts
  }

  const userCounts = countByBucket(users)
  const msgCounts = countByBucket(messages)
  const convCounts = countByBucket(conversations)
  const reachoutCounts = countByBucket(reachouts)
  const connectionCounts = countByBucket(connections)

  return buckets.map(b => ({
    timestamp: b.key,
    label: b.label,
    userCount: userCounts[b.key],
    messageCount: msgCounts[b.key],
    conversationCount: convCounts[b.key],
    reachoutCount: reachoutCounts[b.key],
    connectionCount: connectionCounts[b.key],
  }))
}
