import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://sgzfkddbnopaczlnosgo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnemZrZGRibm9wYWN6bG5vc2dvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQ2NTEyOSwiZXhwIjoyMDg2MDQxMTI5fQ.kY0dEL5G6Lfw8d2BsHpNoH5D0tVFrzQyEe22DXsZMz8'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testMessages() {
  console.log('=== TESTING MESSAGE STRUCTURE ===\n')

  // 1. Get a sample conversation
  const { data: conversations } = await supabase
    .from('conversations')
    .select('id, user_id, gig_id, conversation_type, message_count')
    .gt('message_count', 0)
    .limit(3)

  if (conversations && conversations.length > 0) {
    console.log('Sample conversations with messages:')
    conversations.forEach(conv => {
      console.log(`  ID: ${conv.id.slice(0, 8)}, Type: ${conv.conversation_type}, Messages: ${conv.message_count}`)
    })
    console.log('')

    // Get messages for first conversation
    const convId = conversations[0].id
    console.log(`\nFetching messages for conversation ${convId.slice(0, 8)}...`)

    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
      .limit(5)

    if (messages && messages.length > 0) {
      console.log(`\nFound ${messages.length} messages:`)
      messages.forEach((msg, i) => {
        console.log(`\n  Message ${i + 1}:`)
        console.log(`    Role: ${msg.role}`)
        console.log(`    Content preview: ${msg.content?.slice(0, 100)}...`)
        console.log(`    Created: ${msg.created_at}`)
      })
    }
  }

  // 2. Check gig_postings and their related data
  console.log('\n\n=== TESTING GIG POSTINGS ===\n')

  const { data: gigs } = await supabase
    .from('gig_postings')
    .select('id, title, candidates_matched, candidates_reached')
    .limit(3)

  if (gigs && gigs.length > 0) {
    console.log('Sample gig postings:')
    for (const gig of gigs) {
      console.log(`\n  Gig: ${gig.title}`)
      console.log(`    Matched: ${gig.candidates_matched || 0}`)
      console.log(`    Reached: ${gig.candidates_reached || 0}`)

      // Get matches for this gig
      const { data: matches, count } = await supabase
        .from('matches')
        .select('id, status, outreach_message', { count: 'exact' })
        .eq('gig_id', gig.id)

      console.log(`    Total matches in DB: ${count}`)

      const withOutreach = matches?.filter(m => m.outreach_message).length || 0
      console.log(`    Matches with outreach: ${withOutreach}`)
    }
  }
}

testMessages().catch(console.error)
