import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

const openai = new OpenAI({
  apiKey: process.env.BEDROCK_API_KEY,
  baseURL: process.env.BEDROCK_BASE_URL || 'https://bedrock-runtime.us-west-2.amazonaws.com/openai/v1',
})

const JUDGE_SYSTEM_PROMPT = `You are a requirements checker. You will be given a conversation history between a hirer and Maya (an AI assistant). Determine whether the hirer has provided enough information to start matching them with candidates.

The core required fields are:
1. Title / Role — What they're hiring for
2. Skills — At least 1-2 specific skills or technologies
3. Gig Type — project, ongoing, part-time, full-time, contract, or internship
4. Work Type — remote, hybrid, or in-office
5. Budget — Any indication of pay/budget

Rules:
- Be very lenient. The nature of the query often implies many fields — not everything needs to be explicitly stated.
- "I need a React developer for my startup" implies: role (React developer), skills (React), and likely gig type & work type from context.
- Infer freely from natural language. "WFH fine" = remote. "Looking for a freelancer" = contract/project.
- Skills can be inferred from the role itself (e.g. "backend developer" implies backend skills).
- If the hirer's intent is clear enough to start a reasonable candidate search, mark as true.
- Only mark false if critical info like the role/skills or budget is genuinely missing and cannot be inferred.

Respond with ONLY: true or false

true = enough info is present or inferable to start matching
false = core fields are missing and cannot be inferred

Here is the conversation history:`

const LOOP_JUDGE_SYSTEM_PROMPT = `You are a conversation quality checker. You will be given a conversation history between a hirer and Maya (an AI assistant). Determine whether the conversation is stuck in a repeated loop.

Signs of a loop:
- Maya keeps asking the same or very similar questions repeatedly
- The hirer keeps giving the same answers or keeps getting the same responses
- The conversation is going in circles without making progress
- Maya is re-asking for information the hirer already provided
- The same topic is revisited 3+ times without resolution

Rules:
- A conversation that naturally asks follow-up questions is NOT a loop
- Short conversations (< 4 messages) are NOT loops
- If the hirer changes topic or provides new info each time, it's NOT a loop

Respond with ONLY: true or false

true = the conversation is stuck in a repeated loop
false = the conversation is progressing normally

Here is the conversation history:`

const MODEL = process.env.BEDROCK_MODEL || 'openai.gpt-oss-120b-1:0'

// Verify cron secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET

export async function GET(request: NextRequest) {
  // Optional: verify cron secret
  if (CRON_SECRET) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    // 1. Get all collecting_requirements postings
    const { data: postings, error: postErr } = await supabase
      .from('gig_postings')
      .select('id, hirer_id, title, status, created_at, updated_at')
      .eq('status', 'collecting_requirements')

    if (postErr) throw postErr
    if (!postings || postings.length === 0) {
      return NextResponse.json({ message: 'No postings to judge', judged: 0 })
    }

    // 2. Find which ones already have judge_results
    const gigIds = postings.map(p => p.id)
    const { data: existingResults } = await supabase
      .from('judge_results')
      .select('gig_id')
      .in('gig_id', gigIds)

    const alreadyJudged = new Set((existingResults || []).map((r: any) => r.gig_id))
    const unjudgedPostings = postings.filter(p => !alreadyJudged.has(p.id))

    if (unjudgedPostings.length === 0) {
      return NextResponse.json({ message: 'All postings already judged', judged: 0, total: postings.length })
    }

    // 3. Find conversations for unjudged postings
    const unjudgedGigIds = unjudgedPostings.map(p => p.id)
    const hirerIds = [...new Set(unjudgedPostings.map(p => p.hirer_id).filter(Boolean))]

    const { data: conversations } = await supabase
      .from('conversations')
      .select('id, user_id, gig_id, message_count, last_message_at')
      .in('gig_id', unjudgedGigIds)
      .in('user_id', hirerIds.length > 0 ? hirerIds : ['__none__'])

    const convByGig: Record<string, { id: string; messageCount: number; lastMessageAt: string }> = {}
    conversations?.forEach((conv: any) => {
      if (conv.gig_id) {
        if (!convByGig[conv.gig_id] || (conv.message_count || 0) > convByGig[conv.gig_id].messageCount) {
          convByGig[conv.gig_id] = { id: conv.id, messageCount: conv.message_count || 0, lastMessageAt: conv.last_message_at }
        }
      }
    })

    // 4. Fetch messages per conversation
    const convEntries = Object.entries(convByGig)
    const messagesByConv: Record<string, { role: string; content: string }[]> = {}

    const chunkSize = 20
    for (let i = 0; i < convEntries.length; i += chunkSize) {
      const chunk = convEntries.slice(i, i + chunkSize)
      const fetchResults = await Promise.allSettled(
        chunk.map(async ([, conv]) => {
          const { data: msgs, error: msgError } = await supabase
            .from('messages')
            .select('conversation_id, role, content, created_at')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: true })
            .limit(500)
          if (msgError) throw msgError
          return { convId: conv.id, msgs: msgs || [] }
        })
      )
      fetchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          const { convId, msgs } = result.value
          if (msgs.length > 0) {
            messagesByConv[convId] = msgs.map(msg => ({ role: msg.role, content: msg.content || '' }))
          }
        }
      })
    }

    // 5. Filter to postings that have messages, then run judges
    const judgeable = unjudgedPostings.filter(p => {
      const conv = convByGig[p.id]
      return conv && (messagesByConv[conv.id]?.length || 0) > 0
    })

    let judgedCount = 0
    const judgeChunkSize = 10 // process 10 at a time for cron

    for (let i = 0; i < judgeable.length; i += judgeChunkSize) {
      const chunk = judgeable.slice(i, i + judgeChunkSize)
      const results = await Promise.allSettled(
        chunk.map(async (posting) => {
          const conv = convByGig[posting.id]
          const messages = messagesByConv[conv.id]
          const historyText = messages
            .filter(m => m.role !== 'system')
            .map(m => `${m.role === 'assistant' ? 'Maya' : 'Hirer'}: ${m.content}`)
            .join('\n\n')

          const [readyResult, loopResult] = await Promise.allSettled([
            openai.chat.completions.create({
              model: MODEL,
              messages: [
                { role: 'system', content: JUDGE_SYSTEM_PROMPT },
                { role: 'user', content: historyText },
              ],
            }),
            openai.chat.completions.create({
              model: MODEL,
              messages: [
                { role: 'system', content: LOOP_JUDGE_SYSTEM_PROMPT },
                { role: 'user', content: historyText },
              ],
            }),
          ])

          let isReady = false, readyRaw: string | null = null, readyError: string | null = null
          if (readyResult.status === 'fulfilled') {
            readyRaw = readyResult.value.choices?.[0]?.message?.content || ''
            const stripped = readyRaw.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '').trim().toLowerCase()
            isReady = stripped === 'true'
          } else {
            readyError = readyResult.reason?.message || 'Unknown error'
          }

          let isLooping = false, loopRaw: string | null = null, loopError: string | null = null
          if (loopResult.status === 'fulfilled') {
            loopRaw = loopResult.value.choices?.[0]?.message?.content || ''
            const stripped = loopRaw.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '').trim().toLowerCase()
            isLooping = stripped === 'true'
          } else {
            loopError = loopResult.reason?.message || 'Unknown error'
          }

          await supabase.from('judge_results').upsert({
            gig_id: posting.id,
            conversation_id: conv.id,
            completion_judge: {
              ready: isReady,
              llmRawResponse: readyRaw,
              historyPassedToLLM: historyText,
              error: readyError,
            },
            loop_detection_judge: {
              looping: isLooping,
              llmRawResponse: loopRaw,
              error: loopError,
            },
            judged_at: new Date().toISOString(),
          }, { onConflict: 'gig_id' })

          judgedCount++
          return { gigId: posting.id, ready: isReady, looping: isLooping }
        })
      )

      // Log any failures
      results.forEach((r, idx) => {
        if (r.status === 'rejected') {
          console.error(`[Cron Judge] Failed for posting ${chunk[idx].id}:`, r.reason?.message)
        }
      })
    }

    return NextResponse.json({
      message: `Cron judge complete`,
      judged: judgedCount,
      skippedAlreadyJudged: alreadyJudged.size,
      skippedNoMessages: unjudgedPostings.length - judgeable.length,
      total: postings.length,
    })
  } catch (error: any) {
    console.error('Cron judge error:', error)
    return NextResponse.json(
      { error: 'Cron judge failed', details: error.message },
      { status: 500 }
    )
  }
}
