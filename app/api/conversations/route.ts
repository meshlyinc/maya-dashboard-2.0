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

  try {
    if (type === 'posting') {
      // Count total
      let countQuery = supabase.from('gig_postings').select('*', { count: 'exact', head: true })
      if (startDate) countQuery = countQuery.gte('created_at', startDate)
      if (endDate) countQuery = countQuery.lte('created_at', `${endDate}T23:59:59.999Z`)
      if (search) countQuery = countQuery.ilike('title', `%${search}%`)
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
        metadata: {
          candidatesMatched: gig.candidates_matched || 0,
          candidatesReached: reachoutCounts[gig.id] || 0,
          budgetMin: gig.budget_min || null,
          budgetMax: gig.budget_max || null,
          budgetType: gig.budget_type || null,
          currency: gig.currency || null,
        }
      }))

      return NextResponse.json({
        items: conversations,
        page,
        totalPages: Math.ceil((totalCount || 0) / PAGE_SIZE),
        totalItems: totalCount || 0,
      })
    } else {
      // Count total
      let countQuery = supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .not('outreach_message', 'is', null)
      if (startDate) countQuery = countQuery.gte('created_at', startDate)
      if (endDate) countQuery = countQuery.lte('created_at', `${endDate}T23:59:59.999Z`)
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
        }
      })

      return NextResponse.json({
        items: conversations,
        page,
        totalPages: Math.ceil((totalCount || 0) / PAGE_SIZE),
        totalItems: totalCount || 0,
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
