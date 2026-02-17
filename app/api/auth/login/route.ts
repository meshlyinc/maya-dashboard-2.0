import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import crypto from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

const SESSION_SECRET = process.env.SESSION_SECRET || 'maya-dashboard-default-secret-change-me'

function createSessionToken(adminId: string, username: string): string {
  const payload = JSON.stringify({ adminId, username, exp: Date.now() + 24 * 60 * 60 * 1000 })
  const hmac = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex')
  return Buffer.from(payload).toString('base64') + '.' + hmac
}

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
    }

    // Check credentials against dashboard_admin table
    const { data: admin, error } = await supabase
      .from('dashboard_admin')
      .select('id, username, password_hash')
      .eq('username', username)
      .single()

    if (error || !admin) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Compare password - support both plain text and hashed
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex')
    const isValid = admin.password_hash === password || admin.password_hash === passwordHash

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Create session token
    const token = createSessionToken(admin.id, admin.username)

    // Set HTTP-only cookie
    const cookieStore = await cookies()
    cookieStore.set('dashboard_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/',
    })

    return NextResponse.json({ success: true, username: admin.username })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
