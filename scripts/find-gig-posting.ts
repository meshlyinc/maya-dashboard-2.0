import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://sgzfkddbnopaczlnosgo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnemZrZGRibm9wYWN6bG5vc2dvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQ2NTEyOSwiZXhwIjoyMDg2MDQxMTI5fQ.kY0dEL5G6Lfw8d2BsHpNoH5D0tVFrzQyEe22DXsZMz8'

const supabase = createClient(supabaseUrl, supabaseKey)

async function findGigPosting() {
  // Check for gig_posting table
  console.log('Checking gig_posting table...\n')

  const { data, error, count } = await supabase
    .from('gig_posting')
    .select('*', { count: 'exact', head: true })
    .limit(1)

  if (error) {
    console.log('Error accessing gig_posting:', error.message)
  } else {
    console.log(`✓ gig_posting table found: ${count} rows`)

    // Get a sample row
    const { data: sample } = await supabase
      .from('gig_posting')
      .select('*')
      .limit(1)

    if (sample && sample.length > 0) {
      console.log('\nSample columns:', Object.keys(sample[0]).join(', '))
      console.log('\nSample data:', JSON.stringify(sample[0], null, 2))
    }
  }

  // Also check other gig-related tables
  console.log('\n\nChecking other gig-related tables...\n')
  const tablesToCheck = ['gigs', 'gig', 'job_gigs', 'gig_postings']

  for (const tableName of tablesToCheck) {
    const { data, error, count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true })
      .limit(1)

    if (!error) {
      console.log(`✓ ${tableName}: ${count} rows`)

      const { data: sample } = await supabase
        .from(tableName)
        .select('*')
        .limit(1)

      if (sample && sample.length > 0) {
        console.log(`  Columns:`, Object.keys(sample[0]).join(', '))
      }
    }
  }
}

findGigPosting().catch(console.error)
