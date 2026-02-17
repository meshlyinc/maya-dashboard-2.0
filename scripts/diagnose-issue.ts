import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://sgzfkddbnopaczlnosgo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnemZrZGRibm9wYWN6bG5vc2dvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQ2NTEyOSwiZXhwIjoyMDg2MDQxMTI5fQ.kY0dEL5G6Lfw8d2BsHpNoH5D0tVFrzQyEe22DXsZMz8'

const supabase = createClient(supabaseUrl, supabaseKey)

async function diagnose() {
  console.log('=== DIAGNOSING CONVERSATION DISPLAY ISSUE ===\n')

  // 1. Find a gig with reachouts
  console.log('1. Finding gigs with reachouts...')
  const { data: gigs } = await supabase
    .from('gig_postings')
    .select('id, title, candidates_reached')
    .gt('candidates_reached', 0)
    .limit(1)

  if (!gigs || gigs.length === 0) {
    console.log('❌ No gigs with reachouts found')
    return
  }

  const gig = gigs[0]
  console.log(`✓ Found: "${gig.title}"`)
  console.log(`  ID: ${gig.id}`)
  console.log(`  Candidates reached: ${gig.candidates_reached}\n`)

  // 2. Test the exact query the API uses
  console.log('2. Testing API query for matches...')
  const { data: matches, error } = await supabase
    .from('matches')
    .select('*, candidate_profiles!inner(user_id, headline), users!candidate_profiles(full_name)')
    .eq('gig_id', gig.id)
    .not('outreach_message', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.log('❌ Error fetching matches:', error)
    return
  }

  console.log(`✓ Found ${matches?.length || 0} matches with outreach\n`)

  if (!matches || matches.length === 0) {
    console.log('❌ No matches found even though candidates_reached > 0')
    console.log('   This might mean the data is inconsistent\n')

    // Check without the join
    const { data: simpleMatches } = await supabase
      .from('matches')
      .select('id, candidate_id, outreach_message')
      .eq('gig_id', gig.id)
      .not('outreach_message', 'is', null)

    console.log(`   Matches without join: ${simpleMatches?.length || 0}`)
    return
  }

  // 3. Format messages like the API does
  console.log('3. Formatting messages like the API...')
  const formattedMessages = matches.flatMap(match => {
    const messages = []

    if (match.outreach_message) {
      messages.push({
        id: `${match.id}-outreach`,
        role: 'assistant',
        content: `**Reachout to ${match.users?.full_name || match.candidate_profiles?.headline || 'Candidate'}**\n\n${match.outreach_message}`,
        createdAt: match.outreach_sent_at || match.created_at,
        senderName: 'Maya (AI Recruiter)'
      })
    }

    if (match.candidate_response) {
      messages.push({
        id: `${match.id}-response`,
        role: 'user',
        content: match.candidate_response,
        createdAt: match.candidate_responded_at,
        senderName: match.users?.full_name || 'Candidate'
      })
    }

    return messages
  })

  console.log(`✓ Formatted ${formattedMessages.length} messages\n`)

  // 4. Show what the API should return
  console.log('4. Sample API response structure:')
  const apiResponse = {
    id: gig.id,
    title: gig.title,
    status: 'active',
    type: 'posting',
    messages: formattedMessages,
    metadata: {
      totalReachouts: matches.length
    }
  }

  console.log(JSON.stringify(apiResponse, null, 2))

  console.log('\n\n5. First 2 messages preview:')
  formattedMessages.slice(0, 2).forEach((msg, i) => {
    console.log(`\nMessage ${i + 1}:`)
    console.log(`  Role: ${msg.role}`)
    console.log(`  Sender: ${msg.senderName}`)
    console.log(`  Content preview: ${msg.content.slice(0, 150)}...`)
  })

  console.log('\n\n=== DIAGNOSIS COMPLETE ===')
  console.log(`\nTo test in browser:`)
  console.log(`1. Open http://localhost:3001`)
  console.log(`2. Click "Postings / Queries"`)
  console.log(`3. Click "${gig.title}"`)
  console.log(`4. You should see ${formattedMessages.length} messages`)
  console.log(`5. Check browser console for logs`)
}

diagnose().catch(console.error)
