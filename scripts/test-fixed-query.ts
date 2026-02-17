import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://sgzfkddbnopaczlnosgo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnemZrZGRibm9wYWN6bG5vc2dvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQ2NTEyOSwiZXhwIjoyMDg2MDQxMTI5fQ.kY0dEL5G6Lfw8d2BsHpNoH5D0tVFrzQyEe22DXsZMz8'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testFixed() {
  console.log('=== TESTING FIXED QUERY ===\n')

  // Find a gig with reachouts
  const { data: gigs } = await supabase
    .from('gig_postings')
    .select('id, title')
    .limit(1)

  if (!gigs || gigs.length === 0) {
    console.log('No gigs found')
    return
  }

  const gigId = gigs[0].id
  console.log(`Testing with gig: ${gigs[0].title}`)
  console.log(`ID: ${gigId}\n`)

  // Test the FIXED query
  console.log('Testing fixed query with nested select...')
  const { data: matches, error } = await supabase
    .from('matches')
    .select(`
      *,
      candidate_profiles!inner(
        user_id,
        headline,
        users(full_name, email)
      )
    `)
    .eq('gig_id', gigId)
    .not('outreach_message', 'is', null)
    .limit(5)

  if (error) {
    console.log('❌ Error:', error)
    return
  }

  console.log(`✅ Success! Found ${matches?.length || 0} matches\n`)

  if (matches && matches.length > 0) {
    console.log('Sample reachouts:')
    matches.forEach((match, i) => {
      const candidateName = match.candidate_profiles?.users?.full_name ||
                          match.candidate_profiles?.users?.email ||
                          match.candidate_profiles?.headline ||
                          'Candidate'

      console.log(`\n${i + 1}. To: ${candidateName}`)
      console.log(`   Message: ${match.outreach_message?.slice(0, 100)}...`)
      console.log(`   Has response: ${match.candidate_response ? 'Yes' : 'No'}`)
    })

    console.log('\n\n✅ Query is working correctly!')
    console.log('The messages should now display in the dashboard.')
  } else {
    console.log('This gig has no reachouts. Try another one.')
  }
}

testFixed().catch(console.error)
