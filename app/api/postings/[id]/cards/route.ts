import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: gigId } = await params

  try {
    // 1. Get the gig posting to find hirer_id
    const { data: gig, error: gigError } = await supabase
      .from('gig_postings')
      .select('id, title, hirer_id')
      .eq('id', gigId)
      .single()

    if (gigError || !gig) {
      return NextResponse.json({ error: 'Posting not found' }, { status: 404 })
    }

    // 2. Find hirer's conversation for this posting
    let convId: string | null = null
    if (gig.hirer_id) {
      const { data: convs } = await supabase
        .from('conversations')
        .select('id, message_count')
        .eq('gig_id', gigId)
        .eq('user_id', gig.hirer_id)
        .order('message_count', { ascending: false })
        .limit(1)

      if (convs && convs.length > 0) {
        convId = convs[0].id
      }
    }

    if (!convId) {
      return NextResponse.json({ cards: [], gigTitle: gig.title })
    }

    // 3. Fetch match_card messages from this conversation
    const { data: cardMessages } = await supabase
      .from('messages')
      .select('id, metadata, created_at')
      .eq('conversation_id', convId)
      .contains('metadata', { component: { type: 'match_card' } })
      .order('created_at', { ascending: false })

    if (!cardMessages || cardMessages.length === 0) {
      return NextResponse.json({ cards: [], gigTitle: gig.title })
    }

    // 4. Extract matchIds from card data to look up candidate user_ids
    const matchIds = cardMessages
      .map((m: any) => m.metadata?.component?.data?.matchId)
      .filter(Boolean)

    const matchUserMap: Record<string, string> = {} // matchId -> candidate user_id
    const matchStatusMap: Record<string, string> = {} // matchId -> status
    const matchConnectedMap: Record<string, string> = {} // matchId -> connected_at
    if (matchIds.length > 0) {
      const { data: matches } = await supabase
        .from('matches')
        .select('id, status, connected_at, candidate_profiles(user_id)')
        .in('id', matchIds)

      matches?.forEach((m: any) => {
        if (m.candidate_profiles?.user_id) {
          matchUserMap[m.id] = m.candidate_profiles.user_id
        }
        if (m.status) {
          matchStatusMap[m.id] = m.status
        }
        if (m.connected_at) {
          matchConnectedMap[m.id] = m.connected_at
        }
      })
    }

    // 5. Build response cards
    const cards = cardMessages.map((msg: any) => {
      const cardData = msg.metadata?.component?.data || {}
      const matchId = cardData.matchId
      return {
        messageId: msg.id,
        createdAt: msg.created_at,
        matchId: matchId || null,
        candidateUserId: matchId ? (matchUserMap[matchId] || null) : null,
        matchStatus: matchId ? (matchStatusMap[matchId] || null) : null,
        connectedAt: matchId ? (matchConnectedMap[matchId] || null) : null,
        cardData,
      }
    })

    // Compute status counts
    const statusCounts: Record<string, number> = {}
    cards.forEach((c: any) => {
      if (c.matchStatus) {
        statusCounts[c.matchStatus] = (statusCounts[c.matchStatus] || 0) + 1
      }
    })

    return NextResponse.json({ cards, gigTitle: gig.title, statusCounts })
  } catch (error) {
    console.error('Posting cards error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch posting cards' },
      { status: 500 }
    )
  }
}
