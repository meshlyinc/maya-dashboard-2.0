import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

const PAGE_SIZE = 20

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const search = searchParams.get('search')?.trim() || ''

  try {
    // Group conversations are identified by conversation_type = 'introduction'
    // They have: participants array, gig_id, match_id, context.is_group = true, stage = 'group_intro'

    // Count total
    const { count: totalCount } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_type', 'introduction')

    // Fetch page
    const { data: groupConvs, error } = await supabase
      .from('conversations')
      .select('id, user_id, gig_id, match_id, conversation_type, status, stage, title, context, message_count, last_message_at, created_at, participants')
      .eq('conversation_type', 'introduction')
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

    if (error) throw error

    if (!groupConvs || groupConvs.length === 0) {
      return NextResponse.json({ items: [], page: 1, totalPages: 0, totalItems: 0 })
    }

    // Collect all referenced IDs
    const gigIds = [...new Set(groupConvs.map((c: any) => c.gig_id).filter(Boolean))]
    const matchIds = [...new Set(groupConvs.map((c: any) => c.match_id).filter(Boolean))]
    const allParticipantIds = [...new Set(groupConvs.flatMap((c: any) => c.participants || []))]
    const userIdFromConv = groupConvs.map((c: any) => c.user_id).filter(Boolean)
    const allUserIds = [...new Set([...allParticipantIds, ...userIdFromConv])]

    // Fetch user details for all participants
    const userMap: Record<string, { full_name: string; phone: string | null }> = {}
    if (allUserIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, full_name, phone')
        .in('id', allUserIds)
      users?.forEach((u: any) => {
        userMap[u.id] = { full_name: u.full_name || u.phone || 'Unknown', phone: u.phone }
      })
    }

    // Fetch gig posting details
    const gigMap: Record<string, any> = {}
    if (gigIds.length > 0) {
      const { data: gigs } = await supabase
        .from('gig_postings')
        .select('id, title, hirer_id')
        .in('id', gigIds)
      gigs?.forEach((g: any) => {
        gigMap[g.id] = g
      })
    }

    // Fetch match details (to get candidate info)
    const matchMap: Record<string, any> = {}
    if (matchIds.length > 0) {
      const { data: matches } = await supabase
        .from('matches')
        .select('id, gig_id, status, match_score, connected_at, candidate_profiles(user_id, headline)')
        .in('id', matchIds)
      matches?.forEach((m: any) => {
        matchMap[m.id] = m
      })
    }

    // For each group conv, also find the related posting convo (hirer_intake) and reachout convo (outreach)
    const hirerConvMap: Record<string, any> = {}
    const hirerIdsFromGigs = [...new Set(Object.values(gigMap).map((g: any) => g.hirer_id).filter(Boolean))]
    if (gigIds.length > 0 && hirerIdsFromGigs.length > 0) {
      const { data: hirerConvs } = await supabase
        .from('conversations')
        .select('id, user_id, gig_id, conversation_type, message_count, title')
        .in('gig_id', gigIds)
        .in('user_id', hirerIdsFromGigs)
        .eq('conversation_type', 'hirer_intake')
      hirerConvs?.forEach((conv: any) => {
        if (conv.gig_id) {
          if (!hirerConvMap[conv.gig_id] || (conv.message_count || 0) > (hirerConvMap[conv.gig_id].message_count || 0)) {
            hirerConvMap[conv.gig_id] = conv
          }
        }
      })
    }

    // Find outreach conversations linked to these matches
    const outreachConvMap: Record<string, any> = {}
    if (matchIds.length > 0) {
      const { data: outreachConvs } = await supabase
        .from('conversations')
        .select('id, match_id, conversation_type, message_count, title')
        .in('match_id', matchIds)
        .eq('conversation_type', 'outreach')
      outreachConvs?.forEach((conv: any) => {
        if (conv.match_id) {
          if (!outreachConvMap[conv.match_id] || (conv.message_count || 0) > (outreachConvMap[conv.match_id].message_count || 0)) {
            outreachConvMap[conv.match_id] = conv
          }
        }
      })
    }

    // Build response items
    const items = groupConvs.map((conv: any) => {
      const gig = conv.gig_id ? gigMap[conv.gig_id] : null
      const match = conv.match_id ? matchMap[conv.match_id] : null
      const hirerUserId = gig?.hirer_id || null
      const candidateUserId = match?.candidate_profiles?.user_id || null
      const participants = (conv.participants || []) as string[]

      // Get participant names
      const participantNames = participants.map((pid: string) => ({
        userId: pid,
        name: userMap[pid]?.full_name || 'Unknown',
        phone: userMap[pid]?.phone || null,
      }))

      // Determine hirer and candidate from participants
      const hirer = hirerUserId ? userMap[hirerUserId] : null
      const candidate = candidateUserId ? userMap[candidateUserId] : null

      // Linked conversations
      const postingConv = conv.gig_id ? hirerConvMap[conv.gig_id] : null
      const outreachConv = conv.match_id ? outreachConvMap[conv.match_id] : null

      return {
        id: conv.id,
        gigId: conv.gig_id,
        gigTitle: gig?.title || conv.context?.gig_title || 'Unknown Posting',
        matchId: conv.match_id,
        matchScore: match?.match_score || null,
        status: conv.status,
        stage: conv.stage,
        connectedAt: match?.connected_at || conv.created_at,
        createdAt: conv.created_at,
        title: conv.title,
        messageCount: conv.message_count || 0,
        lastMessageAt: conv.last_message_at,
        isGroup: conv.context?.is_group || false,
        // Hirer info
        hirerName: hirer?.full_name || 'Unknown Hirer',
        hirerPhone: hirer?.phone || null,
        hirerUserId,
        // Candidate info
        candidateName: candidate?.full_name || match?.candidate_profiles?.headline || 'Unknown Candidate',
        candidateHeadline: match?.candidate_profiles?.headline || null,
        candidatePhone: candidate?.phone || null,
        candidateUserId,
        // Participants
        participants: participantNames,
        // Linked posting conversation (hirer ↔ Maya)
        postingConversation: postingConv ? {
          id: postingConv.id,
          title: postingConv.title,
          messageCount: postingConv.message_count || 0,
        } : null,
        // Linked outreach conversation (candidate ↔ Maya)
        outreachConversation: outreachConv ? {
          id: outreachConv.id,
          title: outreachConv.title,
          messageCount: outreachConv.message_count || 0,
        } : null,
      }
    })

    // Apply search filter
    const filtered = search
      ? items.filter((item: any) => {
          const q = search.toLowerCase()
          return (
            item.gigTitle.toLowerCase().includes(q) ||
            item.candidateName.toLowerCase().includes(q) ||
            item.hirerName.toLowerCase().includes(q) ||
            (item.title || '').toLowerCase().includes(q)
          )
        })
      : items

    return NextResponse.json({
      items: filtered,
      page,
      totalPages: Math.ceil((totalCount || 0) / PAGE_SIZE),
      totalItems: totalCount || 0,
    })
  } catch (error) {
    console.error('Group conversations error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch group conversations' },
      { status: 500 }
    )
  }
}
