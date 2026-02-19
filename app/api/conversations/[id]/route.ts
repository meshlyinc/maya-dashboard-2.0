import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: itemId } = await params

  try {
    // Try to fetch as a gig_posting first
    const { data: gigPosting, error: gigError } = await supabase
      .from('gig_postings')
      .select('*')
      .eq('id', itemId)
      .single()

    if (!gigError && gigPosting) {
      // This is a gig posting - fetch matches (reachouts) for this gig
      const { data: matches } = await supabase
        .from('matches')
        .select('*, candidate_profiles(user_id, headline)')
        .eq('gig_id', itemId)
        .not('outreach_message', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50)

      // Look up candidate user names separately (reliable, no nested FK joins)
      const candidateUserIds = matches
        ?.map((m: any) => m.candidate_profiles?.user_id)
        .filter(Boolean) || []

      const userNameMap: Record<string, string> = {}
      if (candidateUserIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, full_name, email')
          .in('id', candidateUserIds)

        users?.forEach((u: any) => {
          userNameMap[u.id] = u.full_name || u.email || 'Candidate'
        })
      }

      // Count linked conversation messages per match (for message count display)
      const matchIds = matches?.map((m: any) => m.id) || []
      let msgCountByMatchId: Record<string, number> = {}

      if (matchIds.length > 0) {
        const { data: linkedConvs } = await supabase
          .from('conversations')
          .select('id, match_id')
          .in('match_id', matchIds)

        if (linkedConvs && linkedConvs.length > 0) {
          const convIds = linkedConvs.map((c: any) => c.id)
          const { data: msgCounts } = await supabase
            .from('messages')
            .select('conversation_id')
            .in('conversation_id', convIds)

          const countByConvId: Record<string, number> = {}
          msgCounts?.forEach((m: any) => {
            countByConvId[m.conversation_id] = (countByConvId[m.conversation_id] || 0) + 1
          })

          linkedConvs.forEach((conv: any) => {
            if (conv.match_id && countByConvId[conv.id]) {
              msgCountByMatchId[conv.match_id] = countByConvId[conv.id]
            }
          })
        }
      }

      // Build reachout summary cards (no full message threads)
      const reachouts = matches?.map((match: any) => {
        const candidateName = (match.candidate_profiles?.user_id && userNameMap[match.candidate_profiles.user_id])
          || match.candidate_profiles?.headline
          || 'Candidate'

        return {
          matchId: match.id,
          candidateName,
          candidateHeadline: match.candidate_profiles?.headline || null,
          status: match.status,
          outreachPreview: match.outreach_message
            ? (match.outreach_message.length > 200 ? match.outreach_message.slice(0, 200) + '...' : match.outreach_message)
            : null,
          hasResponse: !!match.candidate_response,
          messageCount: msgCountByMatchId[match.id] || (match.outreach_message ? 1 : 0) + (match.candidate_response ? 1 : 0),
          outreachSentAt: match.outreach_sent_at || match.created_at,
          respondedAt: match.candidate_responded_at || null,
          matchScore: match.match_score,
          matchReasons: match.match_reasons || [],
          potentialConcerns: match.potential_concerns || [],
          fitSummary: match.fit_summary || null,
        }
      }) || []

      const response = {
        id: gigPosting.id,
        title: gigPosting.title,
        status: gigPosting.status,
        stage: gigPosting.status,
        messageCount: reachouts.length,
        lastMessageAt: gigPosting.updated_at,
        createdAt: gigPosting.created_at,
        type: 'posting',
        messages: [],
        reachouts,
        metadata: {
          candidatesMatched: gigPosting.candidates_matched || 0,
          candidatesReached: gigPosting.candidates_reached || 0,
          totalReachouts: matches?.length || 0,
          connectedCount: matches?.filter((m: any) => m.connected_at != null).length || 0,
        },
        postingDetails: {
          description: gigPosting.description || null,
          jdStructured: gigPosting.jd_structured || null,
          mayaSummary: gigPosting.maya_summary || null,
          idealCandidate: gigPosting.ideal_candidate_description || null,
          skillsRequired: gigPosting.skills_required || [],
          skillsPreferred: gigPosting.skills_preferred || [],
          gigType: gigPosting.gig_type || null,
          workType: gigPosting.work_type || null,
          location: gigPosting.location || null,
          remoteOk: gigPosting.remote_ok,
          budgetMin: gigPosting.budget_min,
          budgetMax: gigPosting.budget_max,
          budgetType: gigPosting.budget_type,
          currency: gigPosting.currency,
          experienceMin: gigPosting.experience_min,
          experienceMax: gigPosting.experience_max,
          seniority: gigPosting.seniority,
          urgency: gigPosting.urgency,
          duration: gigPosting.duration,
        },
      }

      return NextResponse.json(response)
    }

    // Try to fetch as a match (reachout)
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*, candidate_profiles(user_id, headline, bio), gig_postings(title)')
      .eq('id', itemId)
      .single()

    if (!matchError && match) {
      // Look up candidate user name separately
      let candidateName = match.candidate_profiles?.headline || 'Candidate'
      if (match.candidate_profiles?.user_id) {
        const { data: candUser } = await supabase
          .from('users')
          .select('full_name, email')
          .eq('id', match.candidate_profiles.user_id)
          .single()
        if (candUser) {
          candidateName = candUser.full_name || candUser.email || candidateName
        }
      }

      // Find the linked conversation (via match_id) to get the FULL chat thread
      const { data: linkedConvs } = await supabase
        .from('conversations')
        .select('id, user_id, conversation_type, status, stage, title')
        .eq('match_id', match.id)
        .order('created_at', { ascending: false })
        .limit(1)

      let allMessages: any[] = []

      if (linkedConvs && linkedConvs.length > 0) {
        // Full conversation exists - fetch ALL messages from it
        const conv = linkedConvs[0]
        const { data: convMessages } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: true })
          .limit(500)

        // Look up user name from the conversation
        let convUserName = candidateName
        if (conv.user_id) {
          const { data: convUser } = await supabase
            .from('users')
            .select('full_name, email')
            .eq('id', conv.user_id)
            .single()
          if (convUser) {
            convUserName = convUser.full_name || convUser.email || candidateName
          }
        }

        allMessages = convMessages?.map((msg: any) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          createdAt: msg.created_at,
          senderName: msg.role === 'assistant' ? 'Maya (AI)' : msg.role === 'system' ? 'System' : convUserName,
          metadata: msg.metadata,
          attachments: msg.attachments,
          toolCalls: msg.tool_calls
        })) || []
      }

      // If no linked conversation messages found, fall back to match fields
      if (allMessages.length === 0) {
        if (match.outreach_message) {
          allMessages.push({
            id: `${match.id}-outreach`,
            role: 'assistant',
            content: match.outreach_message,
            createdAt: match.outreach_sent_at || match.created_at,
            senderName: 'Maya (AI)'
          })
        }
        if (match.candidate_response) {
          allMessages.push({
            id: `${match.id}-response`,
            role: 'user',
            content: match.candidate_response,
            createdAt: match.candidate_responded_at || match.updated_at,
            senderName: candidateName
          })
        }
      }

      const response = {
        id: match.id,
        title: `Reachout: ${match.gig_postings?.title || 'Unknown Gig'} - ${match.candidate_profiles?.headline || candidateName}`,
        status: match.status,
        stage: match.status,
        messageCount: allMessages.length,
        lastMessageAt: match.candidate_responded_at || match.outreach_sent_at || match.updated_at,
        createdAt: match.created_at,
        type: 'reachout',
        messages: allMessages,
        metadata: {
          matchScore: match.match_score,
          matchReasons: match.match_reasons || [],
          potentialConcerns: match.potential_concerns || [],
          fitSummary: match.fit_summary || null,
        }
      }

      return NextResponse.json(response)
    }

    // Try to fetch as a regular conversation (query)
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', itemId)
      .single()

    if (!convError && conversation) {
      // This is a regular conversation - fetch messages
      const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', itemId)
        .order('created_at', { ascending: true })
        .limit(500)

      // Look up user name for better sender labels
      let userName = 'User'
      if (conversation.user_id) {
        const { data: convUser } = await supabase
          .from('users')
          .select('full_name, email')
          .eq('id', conversation.user_id)
          .single()
        userName = convUser?.full_name || convUser?.email || 'User'
      }

      const formattedMessages = messages?.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: msg.created_at,
        senderName: msg.role === 'assistant' ? 'Maya (AI)' : msg.role === 'system' ? 'System' : userName,
        metadata: msg.metadata,
        attachments: msg.attachments,
        toolCalls: msg.tool_calls
      })) || []

      // If conversation is linked to a gig posting, fetch posting details
      let postingDetails = null
      if (conversation.gig_id) {
        const { data: gig } = await supabase
          .from('gig_postings')
          .select('*')
          .eq('id', conversation.gig_id)
          .single()
        if (gig) {
          postingDetails = {
            id: gig.id,
            title: gig.title,
            description: gig.description || null,
            jdStructured: gig.jd_structured || null,
            mayaSummary: gig.maya_summary || null,
            idealCandidate: gig.ideal_candidate_description || null,
            skillsRequired: gig.skills_required || [],
            skillsPreferred: gig.skills_preferred || [],
            gigType: gig.gig_type || null,
            workType: gig.work_type || null,
            location: gig.location || null,
            remoteOk: gig.remote_ok,
            budgetMin: gig.budget_min,
            budgetMax: gig.budget_max,
            budgetType: gig.budget_type,
            currency: gig.currency,
            experienceMin: gig.experience_min,
            experienceMax: gig.experience_max,
            seniority: gig.seniority,
            urgency: gig.urgency,
            duration: gig.duration,
            candidatesMatched: gig.candidates_matched || 0,
            candidatesReached: gig.candidates_reached || 0,
            candidatesInterested: gig.candidates_interested || 0,
            status: gig.status,
          }
        }
      }

      const response = {
        id: conversation.id,
        title: conversation.title || `${(conversation.conversation_type || 'conversation').replace(/_/g, ' ')} ${conversation.id.slice(0, 8)}`,
        status: conversation.status,
        stage: conversation.stage,
        messageCount: formattedMessages.length,
        lastMessageAt: conversation.last_message_at,
        createdAt: conversation.created_at,
        type: 'query',
        conversationType: conversation.conversation_type,
        category: conversation.category,
        messages: formattedMessages,
        postingDetails,
      }

      return NextResponse.json(response)
    }

    // If none worked, return error
    return NextResponse.json(
      { error: 'Item not found' },
      { status: 404 }
    )
  } catch (error) {
    console.error('Conversation detail error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conversation details' },
      { status: 500 }
    )
  }
}
