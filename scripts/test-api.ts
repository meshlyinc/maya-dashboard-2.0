import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://sgzfkddbnopaczlnosgo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnemZrZGRibm9wYWN6bG5vc2dvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQ2NTEyOSwiZXhwIjoyMDg2MDQxMTI5fQ.kY0dEL5G6Lfw8d2BsHpNoH5D0tVFrzQyEe22DXsZMz8'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testAPI() {
  console.log('=== TESTING API DATA ===\n')

  // Get a gig posting with reachouts
  const { data: gigs } = await supabase
    .from('gig_postings')
    .select('id, title')
    .limit(1)

  if (gigs && gigs.length > 0) {
    const gigId = gigs[0].id
    console.log(`Testing gig: ${gigs[0].title}`)
    console.log(`Gig ID: ${gigId}\n`)

    // Fetch matches like the API does
    const { data: matches } = await supabase
      .from('matches')
      .select('*, candidate_profiles!inner(user_id, headline), users!candidate_profiles(full_name)')
      .eq('gig_id', gigId)
      .not('outreach_message', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5)

    console.log(`Found ${matches?.length || 0} matches with outreach\n`)

    if (matches && matches.length > 0) {
      matches.forEach((match, i) => {
        console.log(`\nMatch ${i + 1}:`)
        console.log(`  Candidate: ${match.users?.full_name || match.candidate_profiles?.headline || 'Unknown'}`)
        console.log(`  Status: ${match.status}`)
        console.log(`  Outreach sent: ${match.outreach_sent_at}`)
        console.log(`  Message preview: ${match.outreach_message?.slice(0, 100)}...`)
        console.log(`  Has response: ${match.candidate_response ? 'Yes' : 'No'}`)
      })

      // Format like the API
      console.log('\n\n=== FORMATTED MESSAGES (like API returns) ===\n')
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

      console.log(`Total formatted messages: ${formattedMessages.length}`)
      formattedMessages.forEach((msg, i) => {
        console.log(`\n${i + 1}. ${msg.role} (${msg.senderName}):`)
        console.log(`   ${msg.content.slice(0, 150)}...`)
      })
    }
  }
}

testAPI().catch(console.error)
