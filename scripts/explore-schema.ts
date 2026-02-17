import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://sgzfkddbnopaczlnosgo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnemZrZGRibm9wYWN6bG5vc2dvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQ2NTEyOSwiZXhwIjoyMDg2MDQxMTI5fQ.kY0dEL5G6Lfw8d2BsHpNoH5D0tVFrzQyEe22DXsZMz8'

const supabase = createClient(supabaseUrl, supabaseKey)

async function exploreTables() {
  // Query to get all tables in the public schema
  const { data: tables, error } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .order('table_name')

  if (error) {
    console.log('Trying alternative method...')
    // Try to query common table names
    const commonTables = ['users', 'messages', 'conversations', 'reachouts', 'postings', 'queries', 'freelancers', 'portfolios', 'profiles']

    for (const tableName of commonTables) {
      const { data, error, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })
        .limit(1)

      if (!error) {
        console.log(`✓ Table found: ${tableName} (${count} rows)`)

        // Get a sample row to understand structure
        const { data: sample } = await supabase
          .from(tableName)
          .select('*')
          .limit(1)

        if (sample && sample.length > 0) {
          console.log(`  Columns:`, Object.keys(sample[0]).join(', '))
        }
      }
    }
  } else {
    console.log('Tables found:', tables)
  }
}

exploreTables().catch(console.error)
