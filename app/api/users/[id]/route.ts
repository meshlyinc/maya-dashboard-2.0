import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params

  try {
    // Fetch user details
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (userError) throw userError

    // Fetch candidate profile if exists
    const { data: profile } = await supabase
      .from('candidate_profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    // Fetch conversations for this user (exclude outreach-linked ones, those show in Reachouts tab)
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id, gig_id, match_id, conversation_type, category, status, stage, title, message_count, last_message_at, created_at')
      .eq('user_id', userId)
      .is('match_id', null)
      .order('created_at', { ascending: false })

    // Fetch matches (reachouts) - only if candidate profile exists
    let matches: any[] = []
    if (profile?.id) {
      const { data: matchData } = await supabase
        .from('matches')
        .select('*, gig_postings(title, status)')
        .eq('candidate_id', profile.id)
        .order('created_at', { ascending: false })

      matches = matchData || []
    }

    // Fetch gig postings if user is a hirer
    const { data: gigPostings } = await supabase
      .from('gig_postings')
      .select('*')
      .eq('hirer_id', userId)
      .order('created_at', { ascending: false })

    // For hirers, also fetch conversations linked to their gig postings
    let gigConversations: any[] = []
    if (gigPostings && gigPostings.length > 0) {
      const gigIds = gigPostings.map((g: any) => g.id)
      const { data: gigConvs } = await supabase
        .from('conversations')
        .select('id, gig_id, match_id, conversation_type, category, status, stage, title, message_count, last_message_at, created_at')
        .in('gig_id', gigIds)
        .is('match_id', null)
        .order('created_at', { ascending: false })

      gigConversations = gigConvs || []
    }

    // Merge direct user conversations with gig-linked conversations, dedup by id
    const directConvIds = new Set(conversations?.map((c: any) => c.id) || [])
    const additionalGigConvs = gigConversations.filter((c: any) => !directConvIds.has(c.id))
    const allConversations = [...(conversations || []), ...additionalGigConvs]

    // Categorize: reachouts from matches
    const reachouts = matches.map((match: any) => ({
      id: match.id,
      type: 'reachout' as const,
      title: `Reachout: ${match.gig_postings?.title || 'Unknown Gig'}`,
      status: match.status,
      stage: match.status,
      messageCount: match.outreach_message ? 1 : 0,
      lastMessageAt: match.outreach_sent_at || match.updated_at,
      createdAt: match.created_at,
      hasResponse: !!match.candidate_response,
      matchScore: match.match_score,
    }))

    // Categorize: ALL conversations as queries (not just candidate_onboarding)
    const queries = allConversations.map((conv: any) => ({
      id: conv.id,
      type: 'query' as const,
      title: conv.title || `${(conv.conversation_type || 'conversation').replace(/_/g, ' ')} ${conv.id.slice(0, 8)}`,
      status: conv.status,
      stage: conv.stage,
      messageCount: conv.message_count || 0,
      lastMessageAt: conv.last_message_at,
      createdAt: conv.created_at,
      conversationType: conv.conversation_type,
      category: conv.category,
      gigId: conv.gig_id
    }))

    // Categorize: gig postings
    const postings = gigPostings?.map((gig: any) => ({
      id: gig.id,
      type: 'posting' as const,
      title: gig.title,
      status: gig.status,
      stage: gig.status,
      messageCount: 0,
      lastMessageAt: gig.updated_at,
      createdAt: gig.created_at,
      candidatesMatched: gig.candidates_matched || 0,
      candidatesReached: gig.candidates_reached || 0
    })) || []

    // Get conversation counts for gig postings
    if (postings.length > 0) {
      const gigIds = postings.map((p: any) => p.id)
      const { data: gigConvs } = await supabase
        .from('conversations')
        .select('gig_id')
        .in('gig_id', gigIds)

      const convCounts: { [key: string]: number } = {}
      gigConvs?.forEach((conv: any) => {
        if (conv.gig_id) {
          convCounts[conv.gig_id] = (convCounts[conv.gig_id] || 0) + 1
        }
      })

      postings.forEach((posting: any) => {
        posting.messageCount = convCounts[posting.id] || 0
      })
    }

    const response = {
      user: {
        ...user,
        profile: profile ? {
          id: profile.id,
          headline: profile.headline,
          bio: profile.bio,
          specialty: profile.specialty,
          skills: profile.skills,
          experience_years: profile.experience_years,
          current_title: profile.current_title,
          rate_type: profile.rate_type,
          rate_min: profile.rate_min,
          rate_max: profile.rate_max,
          rate_currency: profile.rate_currency,
          availability: profile.availability,
          hours_per_week: profile.hours_per_week,
          preferred_work_type: profile.preferred_work_type,
          status: profile.status,
          portfolio_url: profile.portfolio_url,
          portfolio_links: profile.portfolio_links,
          strengths: profile.strengths,
          keywords: profile.keywords,
          maya_notes: profile.maya_notes,
          source: profile.source,
        } : null
      },
      activities: {
        reachouts,
        queries,
        postings
      },
      summary: {
        totalReachouts: reachouts.length,
        totalQueries: queries.length,
        totalPostings: postings.length,
        totalConversations: allConversations.length
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('User details error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user details' },
      { status: 500 }
    )
  }
}
