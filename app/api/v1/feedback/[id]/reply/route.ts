import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

const ADMIN_API_SECRET = process.env.ADMIN_API_SECRET!
const TOKEN_MAX_AGE_MS = 5 * 60 * 1000 // 5 minutes

function verifyAdminToken(header: string | null): boolean {
  if (!header || !ADMIN_API_SECRET) return false

  const [timestamp, signature] = header.split('.')
  if (!timestamp || !signature) return false

  // Check timestamp is within allowed window
  const ts = parseInt(timestamp, 10)
  if (isNaN(ts) || Math.abs(Date.now() - ts) > TOKEN_MAX_AGE_MS) return false

  // Compute expected signature
  const expected = crypto
    .createHmac('sha256', ADMIN_API_SECRET)
    .update(`maya-admin:${timestamp}`)
    .digest('hex')

  // Timing-safe comparison
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    return false
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Verify HMAC token
  const token = request.headers.get('x-admin-token')
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const { reply } = await request.json()

    if (!reply || typeof reply !== 'string' || !reply.trim()) {
      return NextResponse.json({ error: 'Reply text is required' }, { status: 400 })
    }

    // Verify feedback exists
    const { data: feedback, error: fetchError } = await supabase
      .from('user_feedback')
      .select('id')
      .eq('id', id)
      .single()

    if (fetchError || !feedback) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 })
    }

    // Update with reply
    const { error: updateError } = await supabase
      .from('user_feedback')
      .update({
        admin_reply: reply.trim(),
        admin_replied_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) throw updateError

    return NextResponse.json({ success: true, feedbackId: id })
  } catch (error) {
    console.error('Feedback reply error:', error)
    return NextResponse.json({ error: 'Failed to save reply' }, { status: 500 })
  }
}
