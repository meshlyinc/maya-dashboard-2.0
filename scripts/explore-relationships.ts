import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://sgzfkddbnopaczlnosgo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnemZrZGRibm9wYWN6bG5vc2dvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQ2NTEyOSwiZXhwIjoyMDg2MDQxMTI5fQ.kY0dEL5G6Lfw8d2BsHpNoH5D0tVFrzQyEe22DXsZMz8'

const supabase = createClient(supabaseUrl, supabaseKey)

async function exploreRelationships() {
  console.log('=== EXPLORING DATABASE RELATIONSHIPS ===\n')

  // 1. Get gig_postings sample
  console.log('1. GIG POSTINGS:')
  const { data: gigPostings } = await supabase
    .from('gig_postings')
    .select('*')
    .limit(2)

  if (gigPostings && gigPostings.length > 0) {
    console.log(`Total: ${gigPostings.length} samples`)
    console.log('Columns:', Object.keys(gigPostings[0]).join(', '))
    console.log('Sample gig_posting ID:', gigPostings[0].id)
    console.log('')
  }

  // 2. Check conversations with gig_id
  console.log('2. CONVERSATIONS WITH GIG_ID:')
  const { data: convWithGig, count: convGigCount } = await supabase
    .from('conversations')
    .select('id, gig_id, conversation_type, status, stage, message_count', { count: 'exact' })
    .not('gig_id', 'is', null)
    .limit(5)

  console.log(`Total conversations with gig_id: ${convGigCount}`)
  if (convWithGig && convWithGig.length > 0) {
    console.log('Sample conversations:')
    convWithGig.forEach(conv => {
      console.log(`  - ID: ${conv.id.slice(0, 8)}, Type: ${conv.conversation_type}, Gig: ${conv.gig_id?.slice(0, 8)}`)
    })
  }
  console.log('')

  // 3. Check conversation types and their counts
  console.log('3. CONVERSATION TYPE BREAKDOWN:')
  const { data: allConvs } = await supabase
    .from('conversations')
    .select('conversation_type, gig_id')
    .limit(1000)

  if (allConvs) {
    const typeCounts: any = {}
    const typeWithGig: any = {}

    allConvs.forEach(conv => {
      const type = conv.conversation_type || 'null'
      typeCounts[type] = (typeCounts[type] || 0) + 1
      if (conv.gig_id) {
        typeWithGig[type] = (typeWithGig[type] || 0) + 1
      }
    })

    Object.entries(typeCounts).forEach(([type, count]) => {
      const withGig = typeWithGig[type] || 0
      console.log(`  ${type}: ${count} total, ${withGig} with gig_id`)
    })
  }
  console.log('')

  // 4. Check for reachout-related tables
  console.log('4. CHECKING REACHOUT TABLES:')
  const reachoutTables = ['reachouts', 'candidate_reachouts', 'gig_reachouts', 'reach_outs']

  for (const tableName of reachoutTables) {
    const { data, error, count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true })
      .limit(1)

    if (!error) {
      console.log(`  ✓ ${tableName}: ${count} rows`)

      const { data: sample } = await supabase
        .from(tableName)
        .select('*')
        .limit(1)

      if (sample && sample.length > 0) {
        console.log(`    Columns:`, Object.keys(sample[0]).join(', '))
      }
    }
  }

  console.log('')

  // 5. Check matches table for gig relationships
  console.log('5. MATCHES TABLE:')
  const { data: matches, count: matchCount } = await supabase
    .from('matches')
    .select('*', { count: 'exact' })
    .limit(3)

  console.log(`Total matches: ${matchCount}`)
  if (matches && matches.length > 0) {
    console.log('Sample match:')
    console.log(JSON.stringify(matches[0], null, 2))
  }
}

exploreRelationships().catch(console.error)
