import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://sgzfkddbnopaczlnosgo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnemZrZGRibm9wYWN6bG5vc2dvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQ2NTEyOSwiZXhwIjoyMDg2MDQxMTI5fQ.kY0dEL5G6Lfw8d2BsHpNoH5D0tVFrzQyEe22DXsZMz8'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testFinal() {
  console.log('=== TESTING FINAL FIX ===\n')

  // Find Website Developer gig (we know it has reachouts)
  const { data: gigs } = await supabase
    .from('gig_postings')
    .select('id, title, candidates_reached')
    .ilike('title', '%Website Developer%')
    .limit(1)

  if (!gigs || gigs.length === 0) {
    console.log('Gig not found')
    return
  }

  const gig = gigs[0]
  console.log(`Testing: ${gig.title}`)
  console.log(`Expected reachouts: ${gig.candidates_reached}\n`)

  // Test with the CORRECT foreign key
  const { data: matches, error } = await supabase
    .from('matches')
    .select(`
      *,
      candidate_profiles!inner(
        user_id,
        headline,
        users!candidate_profiles_user_id_fkey(full_name, email)
      )
    `)
    .eq('gig_id', gig.id)
    .not('outreach_message', 'is', null)
    .limit(10)

  if (error) {
    console.log('❌ Error:', error.message)
    return
  }

  console.log(`✅ SUCCESS! Found ${matches?.length || 0} reachouts\n`)

  if (matches && matches.length > 0) {
    console.log('Reachout messages:')
    matches.forEach((match, i) => {
      const candidateName = match.candidate_profiles?.users?.full_name ||
                          match.candidate_profiles?.users?.email ||
                          match.candidate_profiles?.headline ||
                          'Unknown'

      console.log(`\n${i + 1}. **Reachout to ${candidateName}**`)
      console.log(`   Message: ${match.outreach_message?.slice(0, 120)}...`)
      console.log(`   Response: ${match.candidate_response ? 'Yes ✓' : 'No'}`)
    })

    console.log('\n\n🎉 THE FIX IS WORKING!')
    console.log('\nNow refresh your browser at localhost:3001 and:')
    console.log('1. Click "Postings / Queries"')
    console.log(`2. Click "${gig.title}"`)
    console.log(`3. You should see ${matches.length} reachout messages!`)
  }
}

testFinal().catch(console.error)
