import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

const PAGE_SIZE = 20

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const countOnly = searchParams.get('countOnly') === 'true'

  try {
    // Find conversations where the last message is from the user (not assistant)
    let convQuery = supabase
      .from('conversations')
      .select('id, user_id, title, conversation_type, status, last_message_at, created_at')
      .eq('status', 'active')
      .order('last_message_at', { ascending: false })
      .limit(500)
    if (startDate) convQuery = convQuery.gte('last_message_at', startDate)
    if (endDate) convQuery = convQuery.lte('last_message_at', `${endDate}T23:59:59.999Z`)

    const { data: conversations } = await convQuery

    if (!conversations || conversations.length === 0) {
      return NextResponse.json({ unanswered: [], count: 0, page: 1, totalPages: 0, totalItems: 0 })
    }

    const convIds = conversations.map((c) => c.id)

    // Get the last message per conversation
    const { data: latestMessages } = await supabase
      .from('messages')
      .select('id, conversation_id, role, content, created_at')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false })
      .limit(2000)

    if (!latestMessages || latestMessages.length === 0) {
      return NextResponse.json({ unanswered: [], count: 0, page: 1, totalPages: 0, totalItems: 0 })
    }

    // Group by conversation and get the last message for each
    const lastMsgByConv: Record<string, typeof latestMessages[0]> = {}
    for (const msg of latestMessages) {
      if (!lastMsgByConv[msg.conversation_id]) {
        lastMsgByConv[msg.conversation_id] = msg
      }
    }

    // Filter - keep only conversations where last message is from user
    // and that message was sent more than 5 minutes ago (to allow Maya time to respond)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const unansweredConvIds = Object.entries(lastMsgByConv)
      .filter(([, msg]) => msg.role === 'user' && msg.created_at < fiveMinutesAgo)
      .map(([convId]) => convId)

    if (unansweredConvIds.length === 0) {
      return NextResponse.json({ unanswered: [], count: 0, page: 1, totalPages: 0, totalItems: 0 })
    }

    const unansweredConvs = conversations.filter((c) => unansweredConvIds.includes(c.id))
    const totalItems = unansweredConvs.length
    const totalPages = Math.ceil(totalItems / PAGE_SIZE)

    // For count-only requests (used by dashboard metric)
    if (countOnly) {
      return NextResponse.json({ count: totalItems })
    }

    // Paginate
    const paginatedConvs = unansweredConvs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

    // Get user details
    const userIds = [...new Set(paginatedConvs.map((c) => c.user_id).filter(Boolean))]
    let userMap: Record<string, { full_name: string; email: string; phone: string }> = {}
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, full_name, email, phone')
        .in('id', userIds)
      users?.forEach((u) => {
        userMap[u.id] = { full_name: u.full_name, email: u.email, phone: u.phone }
      })
    }

    const unanswered = paginatedConvs.map((conv) => {
      const lastMsg = lastMsgByConv[conv.id]
      const user = conv.user_id ? userMap[conv.user_id] : null
      return {
        conversationId: conv.id,
        title: conv.title || `${(conv.conversation_type || 'conversation').replace(/_/g, ' ')}`,
        conversationType: conv.conversation_type,
        status: conv.status,
        userName: user?.full_name || user?.email || 'Unknown',
        userPhone: user?.phone || null,
        userEmail: user?.email || null,
        userId: conv.user_id,
        lastUserMessage: lastMsg?.content
          ? (lastMsg.content.length > 150 ? lastMsg.content.slice(0, 150) + '...' : lastMsg.content)
          : null,
        lastMessageAt: lastMsg?.created_at || conv.last_message_at,
        createdAt: conv.created_at,
      }
    })

    return NextResponse.json({ unanswered, count: totalItems, page, totalPages, totalItems })
  } catch (error) {
    console.error('Unanswered conversations error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch unanswered conversations' },
      { status: 500 }
    )
  }
}
