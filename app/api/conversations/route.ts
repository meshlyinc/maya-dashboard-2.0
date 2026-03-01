import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

const PAGE_SIZE = 20

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const type = searchParams.get('type') // 'posting' or 'reachout'
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const startDate = searchParams.get('startDate') // ISO date string
  const endDate = searchParams.get('endDate') // ISO date string
  const search = searchParams.get('search')?.trim() || ''
  const stage = searchParams.get('stage')?.trim() || ''
  const filter = searchParams.get('filter')?.trim() || '' // 'card_sent' or 'connected'

  try {
    if (type === 'posting') {
      // --- Precompute card-sent gig IDs using inner join (no large IN clauses) ---
      const cardCountByGigIdGlobal: Record<string, number> = {}
      let totalMsgsFetched = 0
      const MSG_BATCH = 1000
      const MAX_MSG_BATCHES = 50
      for (let i = 0; i < MAX_MSG_BATCHES; i++) {
        const { data: msgs, error: msgErr } = await supabase
          .from('messages')
          .select('metadata, conversations!inner(gig_id)')
          .not('conversations.gig_id', 'is', null)
          .not('metadata', 'is', null)
          .order('id', { ascending: true })
          .range(i * MSG_BATCH, (i + 1) * MSG_BATCH - 1)

        if (msgErr) {
          console.error('Card detection error:', msgErr)
          break
        }
        if (!msgs || msgs.length === 0) break
        totalMsgsFetched += msgs.length
        msgs.forEach((m: any) => {
          let meta = m.metadata
          if (typeof meta === 'string') {
            try { meta = JSON.parse(meta) } catch { return }
          }
          if (meta?.component?.type === 'match_card') {
            const gigId = (m.conversations as any)?.gig_id
            if (gigId) cardCountByGigIdGlobal[gigId] = (cardCountByGigIdGlobal[gigId] || 0) + 1
          }
        })
        if (msgs.length < MSG_BATCH) break
      }

      const allCardSentGigIds = Object.keys(cardCountByGigIdGlobal)
      console.log(`[Card Detection] ${totalMsgsFetched} msgs with metadata scanned, ${allCardSentGigIds.length} gigs with cards`)

      // If filter is set, first find gig_ids that match the filter criteria
      let filteredGigIds: string[] | null = null
      if (filter === 'card_sent') {
        filteredGigIds = allCardSentGigIds.length > 0 ? allCardSentGigIds : []
      } else if (filter === 'connected') {
        // Postings where at least one match has connected_at set (hirer-candidate connected)
        const { data: connectedMatches } = await supabase
          .from('matches')
          .select('gig_id')
          .not('connected_at', 'is', null)
        filteredGigIds = [...new Set((connectedMatches || []).map((m: any) => m.gig_id).filter(Boolean))]
      }

      // Count total
      let countQuery = supabase.from('gig_postings').select('*', { count: 'exact', head: true })
      if (startDate) countQuery = countQuery.gte('created_at', startDate)
      if (endDate) countQuery = countQuery.lte('created_at', `${endDate}T23:59:59.999Z`)
      if (search) countQuery = countQuery.ilike('title', `%${search}%`)
      if (stage) countQuery = countQuery.eq('status', stage)
      if (filteredGigIds !== null) countQuery = countQuery.in('id', filteredGigIds.length > 0 ? filteredGigIds : ['__none__'])
      const { count: totalCount } = await countQuery

      // Fetch page
      let query = supabase
        .from('gig_postings')
        .select('*')
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
      if (startDate) query = query.gte('created_at', startDate)
      if (endDate) query = query.lte('created_at', `${endDate}T23:59:59.999Z`)
      if (search) query = query.ilike('title', `%${search}%`)
      if (stage) query = query.eq('status', stage)
      if (filteredGigIds !== null) query = query.in('id', filteredGigIds.length > 0 ? filteredGigIds : ['__none__'])

      const { data: gigPostings, error } = await query
      if (error) throw error

      // Get reachout counts for each gig
      const gigIds = gigPostings.map(gig => gig.id)
      const { data: matchCounts } = await supabase
        .from('matches')
        .select('gig_id')
        .in('gig_id', gigIds.length > 0 ? gigIds : ['__none__'])
        .not('outreach_message', 'is', null)

      // Fetch hirer names and phones
      const hirerIds = [...new Set(gigPostings.map(g => g.hirer_id).filter(Boolean))]
      const userInfoMap: Record<string, { name: string; phone: string | null }> = {}
      if (hirerIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, full_name, phone')
          .in('id', hirerIds)
        users?.forEach((u: any) => {
          userInfoMap[u.id] = {
            name: u.full_name || u.phone || 'Unknown',
            phone: u.phone || null,
          }
        })
      }

      // Count reachouts per gig
      const reachoutCounts: { [key: string]: number } = {}
      matchCounts?.forEach(match => {
        if (match.gig_id) {
          reachoutCounts[match.gig_id] = (reachoutCounts[match.gig_id] || 0) + 1
        }
      })

      // Look up the hirer's conversation for each gig posting
      // Find conversations where user_id = hirer_id AND gig_id = posting id
      const gigConvMap: Record<string, { id: string; messageCount: number }> = {}
      if (gigIds.length > 0 && hirerIds.length > 0) {
        // Query conversations that belong to any hirer AND are linked to any of these gig_ids
        const { data: hirerConvs } = await supabase
          .from('conversations')
          .select('id, gig_id, user_id, message_count')
          .in('gig_id', gigIds)
          .in('user_id', hirerIds)

        hirerConvs?.forEach((conv: any) => {
          if (conv.gig_id) {
            // Prefer conversation with most messages
            if (!gigConvMap[conv.gig_id] || (conv.message_count || 0) > gigConvMap[conv.gig_id].messageCount) {
              gigConvMap[conv.gig_id] = { id: conv.id, messageCount: conv.message_count || 0 }
            }
          }
        })
      }

      // Count connected matches per gig (connected_at is set when hirer-candidate connect)
      const connectedCountByGigId: Record<string, number> = {}
      if (gigIds.length > 0) {
        const { data: connectedMatches } = await supabase
          .from('matches')
          .select('gig_id')
          .in('gig_id', gigIds)
          .not('connected_at', 'is', null)
        connectedMatches?.forEach((m: any) => {
          if (m.gig_id) connectedCountByGigId[m.gig_id] = (connectedCountByGigId[m.gig_id] || 0) + 1
        })
      }

      // Card counts per gig (use precomputed global card counts)
      const cardCountByGigId = cardCountByGigIdGlobal

      const conversations = gigPostings.map(gig => ({
        id: gig.id,
        title: gig.title || `Job Posting ${gig.id.slice(0, 8)}`,
        userName: gig.hirer_id ? (userInfoMap[gig.hirer_id]?.name || null) : null,
        userPhone: gig.hirer_id ? (userInfoMap[gig.hirer_id]?.phone || null) : null,
        status: gig.status,
        stage: gig.status,
        messageCount: reachoutCounts[gig.id] || 0,
        lastMessageAt: gig.updated_at,
        createdAt: gig.created_at,
        type: 'posting' as const,
        userId: gig.hirer_id || null,
        conversationId: gigConvMap[gig.id]?.id || null,
        conversationMessageCount: gigConvMap[gig.id]?.messageCount || 0,
        cardsSentCount: cardCountByGigId[gig.id] || 0,
        connectedCount: connectedCountByGigId[gig.id] || 0,
        metadata: {
          candidatesMatched: gig.candidates_matched || 0,
          candidatesReached: reachoutCounts[gig.id] || 0,
          budgetMin: gig.budget_min || null,
          budgetMax: gig.budget_max || null,
          budgetType: gig.budget_type || null,
          currency: gig.currency || null,
        }
      }))

      // Fetch stage counts (always unfiltered by stage/filter so chips show totals)
      const stageValues = ['collecting_requirements', 'matching', 'active']
      const stageCounts: Record<string, number> = {}

      // Fetch filter counts in parallel with stage counts
      const filterCounts: Record<string, number> = {}
      await Promise.all([
        // Stage counts
        ...stageValues.map(async (s) => {
          let sq = supabase.from('gig_postings').select('*', { count: 'exact', head: true }).eq('status', s)
          if (startDate) sq = sq.gte('created_at', startDate)
          if (endDate) sq = sq.lte('created_at', `${endDate}T23:59:59.999Z`)
          if (search) sq = sq.ilike('title', `%${search}%`)
          const { count } = await sq
          stageCounts[s] = count || 0
        }),
        // Card Sent count (use precomputed allCardSentGigIds, filtered by date/search)
        (async () => {
          if (allCardSentGigIds.length > 0) {
            let sq = supabase.from('gig_postings').select('*', { count: 'exact', head: true }).in('id', allCardSentGigIds)
            if (startDate) sq = sq.gte('created_at', startDate)
            if (endDate) sq = sq.lte('created_at', `${endDate}T23:59:59.999Z`)
            if (search) sq = sq.ilike('title', `%${search}%`)
            const { count } = await sq
            filterCounts['card_sent'] = count || 0
          } else {
            filterCounts['card_sent'] = 0
          }
        })(),
        // Connected count (postings where at least one match has connected_at set)
        (async () => {
          const { data: connMatches } = await supabase
            .from('matches')
            .select('gig_id')
            .not('connected_at', 'is', null)
          const connGigIds = [...new Set((connMatches || []).map((m: any) => m.gig_id).filter(Boolean))]
          if (connGigIds.length > 0) {
            let sq = supabase.from('gig_postings').select('*', { count: 'exact', head: true }).in('id', connGigIds)
            if (startDate) sq = sq.gte('created_at', startDate)
            if (endDate) sq = sq.lte('created_at', `${endDate}T23:59:59.999Z`)
            if (search) sq = sq.ilike('title', `%${search}%`)
            const { count } = await sq
            filterCounts['connected'] = count || 0
          } else {
            filterCounts['connected'] = 0
          }
        })(),
      ])

      return NextResponse.json({
        items: conversations,
        page,
        totalPages: Math.ceil((totalCount || 0) / PAGE_SIZE),
        totalItems: totalCount || 0,
        stageCounts,
        filterCounts,
      })
    } else {
      const status = searchParams.get('status')?.trim() || ''

      // Count total
      let countQuery = supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .not('outreach_message', 'is', null)
      if (startDate) countQuery = countQuery.gte('created_at', startDate)
      if (endDate) countQuery = countQuery.lte('created_at', `${endDate}T23:59:59.999Z`)
      if (status) countQuery = countQuery.eq('status', status)
      const { count: totalCount } = await countQuery

      // Fetch page
      let query = supabase
        .from('matches')
        .select('*, candidate_profiles(user_id, headline), gig_postings(title)')
        .not('outreach_message', 'is', null)
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
      if (startDate) query = query.gte('created_at', startDate)
      if (endDate) query = query.lte('created_at', `${endDate}T23:59:59.999Z`)
      if (status) query = query.eq('status', status)

      const { data: matches, error } = await query
      if (error) throw error

      // Fetch candidate user names and phones
      const candidateUserIds = [...new Set(matches.map((m: any) => m.candidate_profiles?.user_id).filter(Boolean))]
      const userInfoMap: Record<string, { name: string; phone: string | null }> = {}
      if (candidateUserIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, full_name, phone')
          .in('id', candidateUserIds)
        users?.forEach((u: any) => {
          userInfoMap[u.id] = {
            name: u.full_name || u.phone || 'Unknown',
            phone: u.phone || null,
          }
        })
      }

      const conversations = matches.map((match: any) => {
        const candidateUserId = match.candidate_profiles?.user_id
        const info = candidateUserId ? userInfoMap[candidateUserId] : null
        return {
          id: match.id,
          title: `Reachout: ${match.gig_postings?.title || 'Unknown Gig'} - ${match.candidate_profiles?.headline || 'Candidate'}`,
          userName: info?.name || match.candidate_profiles?.headline || null,
          userPhone: info?.phone || null,
          status: match.status,
          stage: match.status,
          messageCount: match.outreach_message ? 1 : 0,
          lastMessageAt: match.outreach_sent_at || match.updated_at,
          createdAt: match.created_at,
          type: 'reachout' as const,
          userId: candidateUserId || null,
        }
      })

      // Compute status counts for filter chips (unfiltered by status so chips show totals)
      const reachoutStatusValues = ['identified', 'outreach_sent', 'candidate_interested', 'negotiating', 'connected', 'candidate_declined', 'passed']
      const statusCounts: Record<string, number> = {}
      await Promise.all(
        reachoutStatusValues.map(async (s) => {
          let sq = supabase.from('matches').select('*', { count: 'exact', head: true })
            .not('outreach_message', 'is', null)
            .eq('status', s)
          if (startDate) sq = sq.gte('created_at', startDate)
          if (endDate) sq = sq.lte('created_at', `${endDate}T23:59:59.999Z`)
          const { count } = await sq
          statusCounts[s] = count || 0
        })
      )

      return NextResponse.json({
        items: conversations,
        page,
        totalPages: Math.ceil((totalCount || 0) / PAGE_SIZE),
        totalItems: totalCount || 0,
        statusCounts,
      })
    }
  } catch (error) {
    console.error('Conversations error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    )
  }
}
