import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

const PAGE_SIZE = 20

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))

  try {
    // Get total count
    const { count: totalItems } = await supabase
      .from('user_feedback')
      .select('id', { count: 'exact', head: true })

    const total = totalItems || 0
    const totalPages = Math.ceil(total / PAGE_SIZE)
    const from = (page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    // Fetch feedback with user info
    const { data: feedbackRows, error } = await supabase
      .from('user_feedback')
      .select('id, user_id, conversation_id, feedback_text, page_url, created_at, admin_reply, admin_replied_at')
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw error

    // Collect unique user IDs and fetch user details
    const userIds = [...new Set((feedbackRows || []).map(f => f.user_id).filter(Boolean))]
    let usersMap: Record<string, { full_name: string; phone: string | null; email: string | null }> = {}

    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, full_name, phone, email')
        .in('id', userIds)

      if (users) {
        usersMap = Object.fromEntries(users.map(u => [u.id, { full_name: u.full_name, phone: u.phone, email: u.email }]))
      }
    }

    const items = (feedbackRows || []).map(f => {
      const user = usersMap[f.user_id] || {}
      return {
        id: f.id,
        feedbackText: f.feedback_text,
        pageUrl: f.page_url,
        createdAt: f.created_at,
        userId: f.user_id,
        conversationId: f.conversation_id,
        userName: (user as any).full_name || 'Unknown User',
        userPhone: (user as any).phone || null,
        userEmail: (user as any).email || null,
        adminReply: f.admin_reply || null,
        repliedAt: f.admin_replied_at || null,
      }
    })

    return NextResponse.json({ items, totalItems: total, totalPages })
  } catch (error) {
    console.error('Feedback fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { feedbackId, reply } = await request.json()

    if (!feedbackId || !reply || typeof reply !== 'string' || !reply.trim()) {
      return NextResponse.json({ error: 'feedbackId and reply are required' }, { status: 400 })
    }

    // Verify feedback exists
    const { data: feedback, error: fetchError } = await supabase
      .from('user_feedback')
      .select('id')
      .eq('id', feedbackId)
      .single()

    if (fetchError || !feedback) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 })
    }

    const { error: updateError } = await supabase
      .from('user_feedback')
      .update({
        admin_reply: reply.trim(),
        admin_replied_at: new Date().toISOString(),
      })
      .eq('id', feedbackId)

    if (updateError) throw updateError

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Feedback reply error:', error)
    return NextResponse.json({ error: 'Failed to save reply' }, { status: 500 })
  }
}
