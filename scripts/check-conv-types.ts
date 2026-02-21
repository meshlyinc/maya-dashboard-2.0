// Check the group conversation with sender_id and introduction type
// Run: npx tsx scripts/check-conv-types.ts

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  // 1. Find ALL conversations where messages have sender_id (group convos)
  console.log('=== Conversations with sender_id messages (group convos) ===')
  const { data: senderMsgs } = await supabase
    .from('messages')
    .select('conversation_id, sender_id')
    .not('sender_id', 'is', null)
  const groupConvIds = [...new Set(senderMsgs?.map((m: any) => m.conversation_id) || [])]
  console.log(`Found ${groupConvIds.length} conversations with sender_id messages`)

  if (groupConvIds.length > 0) {
    const { data: groupConvs } = await supabase
      .from('conversations')
      .select('*')
      .in('id', groupConvIds)
    groupConvs?.forEach((c: any) => {
      console.log(`\n  FULL RECORD:`)
      console.log(JSON.stringify(c, null, 2))
    })

    // Get all messages from these conversations
    for (const convId of groupConvIds) {
      console.log(`\n=== Messages in conv ${convId} ===`)
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true })
      msgs?.forEach((m: any) => {
        console.log(`  [${m.role}] sender=${m.sender_id || 'null'} content="${(m.content || '').slice(0, 100)}" meta=${JSON.stringify(m.metadata || null)}`)
      })
    }
  }

  // 2. Look for "introduction" type conversation
  console.log('\n=== Introduction type conversation ===')
  const { data: introConvs } = await supabase
    .from('conversations')
    .select('*')
    .eq('conversation_type', 'introduction')
    .limit(5)
  introConvs?.forEach((c: any) => {
    console.log(JSON.stringify(c, null, 2))
  })

  // 3. Get messages from introduction conversations
  if (introConvs && introConvs.length > 0) {
    for (const conv of introConvs) {
      console.log(`\n=== Messages in introduction conv ${conv.id} ===`)
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: true })
      msgs?.forEach((m: any) => {
        console.log(`  [${m.role}] sender=${m.sender_id || 'null'} content="${(m.content || '').slice(0, 100)}"`)
      })
    }
  }
}

main().catch(console.error)
