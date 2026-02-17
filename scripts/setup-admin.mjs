import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const USERNAME = 'mayaIsNotAdmin@123'
const PASSWORD = 'it-is-@911'
const passwordHash = crypto.createHash('sha256').update(PASSWORD).digest('hex')

async function setup() {
  console.log('Setting up dashboard_admin...')

  // Try to insert admin user
  const { data, error } = await supabase
    .from('dashboard_admin')
    .upsert(
      { username: USERNAME, password_hash: passwordHash },
      { onConflict: 'username' }
    )
    .select()

  if (error) {
    if (error.message.includes('does not exist') || error.code === '42P01') {
      console.error('\nTable "dashboard_admin" does not exist yet.')
      console.log('\nRun this SQL in Supabase SQL Editor:\n')
      console.log(`CREATE TABLE dashboard_admin (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now()
);

INSERT INTO dashboard_admin (username, password_hash)
VALUES ('${USERNAME}', '${passwordHash}');`)
      console.log('\nThen run this script again to verify.')
    } else {
      console.error('Error:', error.message)
    }
    process.exit(1)
  }

  console.log('Admin user created/updated:', data)
  console.log('\nCredentials:')
  console.log('  Username:', USERNAME)
  console.log('  Password:', PASSWORD)
  console.log('\nDone!')
}

setup()
