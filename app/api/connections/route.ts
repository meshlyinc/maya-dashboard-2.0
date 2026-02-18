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
    // Fetch connections (matches where connected_at is not null)
    let query = supabase
      .from('matches')
      .select('*, candidate_profiles(user_id, headline), gig_postings(title, hirer_id)', { count: 'exact' })
      .not('connected_at', 'is', null)
      .order('connected_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

    const { data: matches, error, count: totalCount } = await query
    if (error) throw error

    if (!matches || matches.length === 0) {
      return NextResponse.json({ items: [], page: 1, totalPages: 0, totalItems: 0 })
    }

    // Collect all user IDs (candidates + hirers)
    const candidateUserIds = matches.map((m: any) => m.candidate_profiles?.user_id).filter(Boolean)
    const hirerIds = matches.map((m: any) => m.gig_postings?.hirer_id).filter(Boolean)
    const allUserIds = [...new Set([...candidateUserIds, ...hirerIds])]

    // Fetch user details
    const userMap: Record<string, { full_name: string; phone: string | null; email: string | null }> = {}
    if (allUserIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, full_name, phone, email')
        .in('id', allUserIds)
      users?.forEach((u: any) => {
        userMap[u.id] = { full_name: u.full_name, phone: u.phone, email: u.email }
      })
    }

    const items = matches.map((match: any) => {
      const candidateUserId = match.candidate_profiles?.user_id
      const hirerUserId = match.gig_postings?.hirer_id
      const candidate = candidateUserId ? userMap[candidateUserId] : null
      const hirer = hirerUserId ? userMap[hirerUserId] : null

      return {
        id: match.id,
        gigTitle: match.gig_postings?.title || 'Unknown Posting',
        candidateName: candidate?.full_name || match.candidate_profiles?.headline || 'Unknown Candidate',
        candidateHeadline: match.candidate_profiles?.headline || null,
        candidatePhone: candidate?.phone || null,
        candidateEmail: candidate?.email || null,
        candidateUserId: candidateUserId || null,
        hirerName: hirer?.full_name || 'Unknown Hirer',
        hirerPhone: hirer?.phone || null,
        hirerUserId: hirerUserId || null,
        matchScore: match.match_score,
        status: match.status,
        connectedAt: match.connected_at,
        createdAt: match.created_at,
      }
    })

    // Filter by search (client-side since we need to match across gig title, candidate name, hirer name)
    const filtered = search
      ? items.filter((item: any) => {
          const q = search.toLowerCase()
          return (
            item.gigTitle.toLowerCase().includes(q) ||
            item.candidateName.toLowerCase().includes(q) ||
            item.hirerName.toLowerCase().includes(q)
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
    console.error('Connections error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch connections' },
      { status: 500 }
    )
  }
}
