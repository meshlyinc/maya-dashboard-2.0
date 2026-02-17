import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://sgzfkddbnopaczlnosgo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnemZrZGRibm9wYWN6bG5vc2dvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQ2NTEyOSwiZXhwIjoyMDg2MDQxMTI5fQ.kY0dEL5G6Lfw8d2BsHpNoH5D0tVFrzQyEe22DXsZMz8'

const supabase = createClient(supabaseUrl, supabaseKey)

async function exploreMore() {
  // Try more table variations
  const tablesToCheck = [
    'candidate_profiles',
    'gigs',
    'matches',
    'roles',
    'organizations',
    'job_postings',
    'job_queries',
    'reach_outs',
    'freelancer_profiles',
    'candidate_portfolios'
  ]

  console.log('Checking additional tables...\n')

  for (const tableName of tablesToCheck) {
    const { data, error, count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true })
      .limit(1)

    if (!error) {
      console.log(`✓ ${tableName}: ${count} rows`)

      // Get sample to see structure
      const { data: sample } = await supabase
        .from(tableName)
        .select('*')
        .limit(1)

      if (sample && sample.length > 0) {
        console.log(`  Sample columns:`, Object.keys(sample[0]).slice(0, 10).join(', '))
      }
      console.log('')
    }
  }

  // Check conversation types
  console.log('\nChecking conversation types...')
  const { data: convTypes } = await supabase
    .from('conversations')
    .select('conversation_type')
    .limit(100)

  if (convTypes) {
    const types = [...new Set(convTypes.map(c => c.conversation_type))]
    console.log('Conversation types:', types)
  }
}

exploreMore().catch(console.error)
