import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://sgzfkddbnopaczlnosgo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnemZrZGRibm9wYWN6bG5vc2dvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQ2NTEyOSwiZXhwIjoyMDg2MDQxMTI5fQ.kY0dEL5G6Lfw8d2BsHpNoH5D0tVFrzQyEe22DXsZMz8'

const supabase = createClient(supabaseUrl, supabaseKey)

async function findGigWithReachouts() {
  // Find gigs that have reachouts
  const { data: allGigs } = await supabase
    .from('gig_postings')
    .select('id, title, candidates_reached')
    .gt('candidates_reached', 0)
    .limit(5)

  console.log('Gigs with candidates_reached > 0:\n')

  if (allGigs) {
    for (const gig of allGigs) {
      const { data: matches, count } = await supabase
        .from('matches')
        .select('id, outreach_message', { count: 'exact' })
        .eq('gig_id', gig.id)
        .not('outreach_message', 'is', null)

      console.log(`\n${gig.title}`)
      console.log(`  candidates_reached field: ${gig.candidates_reached}`)
      console.log(`  actual matches with outreach: ${count}`)

      if (count && count > 0) {
        console.log(`  ✓ Using this gig for testing`)

        // Test the full query
        const { data: fullMatches } = await supabase
          .from('matches')
          .select('*, candidate_profiles!inner(user_id, headline), users!candidate_profiles(full_name, email)')
          .eq('gig_id', gig.id)
          .not('outreach_message', 'is', null)
          .limit(3)

        console.log(`\n  Sample reachouts:`)
        fullMatches?.forEach((match, i) => {
          console.log(`\n  ${i + 1}. To: ${match.users?.full_name || match.candidate_profiles?.headline || 'Unknown'}`)
          console.log(`     Message: ${match.outreach_message?.slice(0, 80)}...`)
          console.log(`     Response: ${match.candidate_response ? 'Yes' : 'No'}`)
        })

        break
      }
    }
  }
}

findGigWithReachouts().catch(console.error)
