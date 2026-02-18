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

// ─── Shared helpers ───

async function getPostingsAndConversations() {
  const { data: postings, error: postErr } = await supabase
    .from('gig_postings')
    .select('id, hirer_id, title, status, created_at, updated_at')
    .eq('status', 'collecting_requirements')
    .order('updated_at', { ascending: false })

  if (postErr) throw postErr
  if (!postings || postings.length === 0) return { postings: [], convByGig: {}, userMap: {} }

  const gigIds = postings.map(p => p.id)
  const hirerIds = [...new Set(postings.map(p => p.hirer_id).filter(Boolean))]

  const { data: conversations, error: convErr } = await supabase
    .from('conversations')
    .select('id, user_id, gig_id, message_count, last_message_at')
    .in('gig_id', gigIds)
    .in('user_id', hirerIds.length > 0 ? hirerIds : ['__none__'])

  if (convErr) throw convErr

  const convByGig: Record<string, { id: string; messageCount: number; lastMessageAt: string }> = {}
  conversations?.forEach((conv: any) => {
    if (conv.gig_id) {
      if (!convByGig[conv.gig_id] || (conv.message_count || 0) > convByGig[conv.gig_id].messageCount) {
        convByGig[conv.gig_id] = { id: conv.id, messageCount: conv.message_count || 0, lastMessageAt: conv.last_message_at }
      }
    }
  })

  const userMap: Record<string, { name: string; phone: string | null }> = {}
  if (hirerIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, full_name, phone')
      .in('id', hirerIds)
    users?.forEach((u: any) => {
      userMap[u.id] = { name: u.full_name || u.phone || 'Unknown', phone: u.phone || null }
    })
  }

  return { postings, convByGig, userMap }
}

async function fetchMessagesForConversations(convByGig: Record<string, { id: string; messageCount: number; lastMessageAt: string }>) {
  const convEntries = Object.entries(convByGig)
  const messagesByConv: Record<string, { role: string; content: string }[]> = {}

  if (convEntries.length > 0) {
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
            messagesByConv[convId] = msgs.map(msg => ({
              role: msg.role,
              content: msg.content || '',
            }))
          }
        }
      })
    }
  }

  return messagesByConv
}

async function runJudgesForPostings(
  targetPostings: any[],
  convByGig: Record<string, any>,
  messagesByConv: Record<string, { role: string; content: string }[]>,
  userMap: Record<string, { name: string; phone: string | null }>
) {
  const results = await Promise.allSettled(
    targetPostings.map(async (posting) => {
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

      // Save to judge_results table
      const completionJudge = {
        ready: isReady,
        llmRawResponse: readyRaw,
        historyPassedToLLM: historyText,
        error: readyError,
      }
      const loopDetectionJudge = {
        looping: isLooping,
        llmRawResponse: loopRaw,
        error: loopError,
      }

      await supabase.from('judge_results').upsert({
        gig_id: posting.id,
        conversation_id: conv.id,
        completion_judge: completionJudge,
        loop_detection_judge: loopDetectionJudge,
        judged_at: new Date().toISOString(),
      }, { onConflict: 'gig_id' })

      return {
        posting, conv, ready: isReady, looping: isLooping,
        llmLog: { historyText, llmRawResponse: readyRaw, error: readyError },
        loopLlmLog: { llmRawResponse: loopRaw, error: loopError },
      }
    })
  )

  return results
}

function buildResponseItems(
  results: PromiseSettledResult<any>[],
  userMap: Record<string, { name: string; phone: string | null }>
) {
  const ready: any[] = []
  const notReady: any[] = []
  const looping: any[] = []

  results.forEach(result => {
    if (result.status === 'fulfilled') {
      const { posting, conv, ready: isReady, looping: isLooping, llmLog, loopLlmLog } = result.value
      const user = posting.hirer_id ? userMap[posting.hirer_id] : null
      const item = {
        conversationId: conv?.id || posting.id,
        gigId: posting.id,
        title: posting.title || `Posting ${posting.id.slice(0, 8)}`,
        status: posting.status,
        userName: user?.name || 'Unknown',
        userPhone: user?.phone || null,
        userId: posting.hirer_id,
        messageCount: conv?.messageCount || 0,
        lastMessageAt: conv?.lastMessageAt || posting.updated_at,
        createdAt: posting.created_at,
        loopDetected: isLooping,
        llmLog: {
          historyPassedToLLM: llmLog.historyText,
          llmRawResponse: llmLog.llmRawResponse,
          error: llmLog.error,
        },
        loopLlmLog: {
          llmRawResponse: loopLlmLog.llmRawResponse,
          error: loopLlmLog.error,
        },
      }
      if (isReady) ready.push(item)
      else notReady.push(item)
      if (isLooping) looping.push(item)
    }
  })

  return { ready, notReady, looping }
}

// ─── GET: Return cached judge results from DB ───

export async function GET(request: NextRequest) {
  try {
    const { postings, convByGig, userMap } = await getPostingsAndConversations()

    if (postings.length === 0) {
      return NextResponse.json({
        ready: [], notReady: [], noMessages: [], looping: [],
        total: 0, cached: true,
        systemPrompt: JUDGE_SYSTEM_PROMPT, loopSystemPrompt: LOOP_JUDGE_SYSTEM_PROMPT, model: MODEL,
      })
    }

    // Fetch cached judge results
    const gigIds = postings.map(p => p.id)
    const { data: cachedResults } = await supabase
      .from('judge_results')
      .select('*')
      .in('gig_id', gigIds)

    const cachedByGig: Record<string, any> = {}
    cachedResults?.forEach((r: any) => { cachedByGig[r.gig_id] = r })

    const ready: any[] = []
    const notReady: any[] = []
    const noMessages: any[] = []
    const looping: any[] = []
    let judgedCount = 0

    for (const posting of postings) {
      const conv = convByGig[posting.id]
      const cached = cachedByGig[posting.id]
      const user = posting.hirer_id ? userMap[posting.hirer_id] : null

      if (cached) {
        // Use cached result
        judgedCount++
        const cj = cached.completion_judge || {}
        const lj = cached.loop_detection_judge || {}
        const isReady = cj.ready === true
        const isLooping = lj.looping === true

        const item = {
          conversationId: conv?.id || posting.id,
          gigId: posting.id,
          title: posting.title || `Posting ${posting.id.slice(0, 8)}`,
          status: posting.status,
          userName: user?.name || 'Unknown',
          userPhone: user?.phone || null,
          userId: posting.hirer_id,
          messageCount: conv?.messageCount || 0,
          lastMessageAt: conv?.lastMessageAt || posting.updated_at,
          createdAt: posting.created_at,
          judgedAt: cached.judged_at,
          loopDetected: isLooping,
          llmLog: {
            historyPassedToLLM: cj.historyPassedToLLM || '',
            llmRawResponse: cj.llmRawResponse || null,
            error: cj.error || null,
          },
          loopLlmLog: {
            llmRawResponse: lj.llmRawResponse || null,
            error: lj.error || null,
          },
        }
        if (isReady) ready.push(item)
        else notReady.push(item)
        if (isLooping) looping.push(item)
      } else {
        // No cached result — show as not judged yet
        noMessages.push({
          conversationId: conv?.id || posting.id,
          gigId: posting.id,
          title: posting.title || `Posting ${posting.id.slice(0, 8)}`,
          status: posting.status,
          userName: user?.name || 'Unknown',
          userPhone: user?.phone || null,
          userId: posting.hirer_id,
          messageCount: conv?.messageCount || 0,
          lastMessageAt: conv?.lastMessageAt || posting.updated_at,
          createdAt: posting.created_at,
          llmLog: {
            historyPassedToLLM: conv
              ? `(not yet judged — ${conv.messageCount} messages in conversation)`
              : '(no linked conversation found)',
            llmRawResponse: null,
            error: conv ? 'not_yet_judged' : 'no_conversation',
          },
        })
      }
    }

    return NextResponse.json({
      ready, notReady, noMessages, looping,
      total: postings.length,
      readyCount: ready.length,
      notReadyCount: notReady.length,
      noMessagesCount: noMessages.length,
      loopingCount: looping.length,
      judgedCount,
      cached: true,
      systemPrompt: JUDGE_SYSTEM_PROMPT,
      loopSystemPrompt: LOOP_JUDGE_SYSTEM_PROMPT,
      model: MODEL,
    })
  } catch (error: any) {
    console.error('Judge GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch judge results', details: error.message },
      { status: 500 }
    )
  }
}

// ─── POST: Re-run all judges, save to DB, return fresh results ───

export async function POST(request: NextRequest) {
  try {
    const { postings, convByGig, userMap } = await getPostingsAndConversations()

    if (postings.length === 0) {
      return NextResponse.json({
        ready: [], notReady: [], noMessages: [], looping: [],
        total: 0, cached: false,
        systemPrompt: JUDGE_SYSTEM_PROMPT, loopSystemPrompt: LOOP_JUDGE_SYSTEM_PROMPT, model: MODEL,
      })
    }

    const messagesByConv = await fetchMessagesForConversations(convByGig)

    // Separate postings with/without messages
    const withMessages: typeof postings = []
    const withoutMessages: typeof postings = []

    for (const posting of postings) {
      const conv = convByGig[posting.id]
      const dbMessages = conv ? (messagesByConv[conv.id] || []) : []
      if (dbMessages.length > 0) {
        withMessages.push(posting)
      } else {
        withoutMessages.push(posting)
      }
    }

    // Run judges on all postings with messages
    const results = await runJudgesForPostings(withMessages, convByGig, messagesByConv, userMap)
    const { ready, notReady, looping } = buildResponseItems(results, userMap)

    // Build no-messages list
    const noMessages: any[] = []
    for (const posting of withoutMessages) {
      const conv = convByGig[posting.id]
      const user = posting.hirer_id ? userMap[posting.hirer_id] : null
      noMessages.push({
        conversationId: conv?.id || posting.id,
        gigId: posting.id,
        title: posting.title || `Posting ${posting.id.slice(0, 8)}`,
        status: posting.status,
        userName: user?.name || 'Unknown',
        userPhone: user?.phone || null,
        userId: posting.hirer_id,
        messageCount: conv?.messageCount || 0,
        lastMessageAt: conv?.lastMessageAt || posting.updated_at,
        createdAt: posting.created_at,
        llmLog: {
          historyPassedToLLM: conv
            ? `(conversation exists with ${conv.messageCount} messages but they are in external store — not in Supabase messages table)`
            : '(no linked conversation found)',
          llmRawResponse: null,
          error: conv ? 'messages_in_external_store' : 'no_conversation',
        },
      })
    }

    return NextResponse.json({
      ready, notReady, noMessages, looping,
      total: postings.length,
      readyCount: ready.length,
      notReadyCount: notReady.length,
      noMessagesCount: noMessages.length,
      loopingCount: looping.length,
      judgedCount: withMessages.length,
      cached: false,
      systemPrompt: JUDGE_SYSTEM_PROMPT,
      loopSystemPrompt: LOOP_JUDGE_SYSTEM_PROMPT,
      model: MODEL,
    })
  } catch (error: any) {
    console.error('Judge POST error:', error)
    return NextResponse.json(
      { error: 'Failed to run judges', details: error.message },
      { status: 500 }
    )
  }
}
