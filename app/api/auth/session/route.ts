import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'

const SESSION_SECRET = process.env.SESSION_SECRET || 'maya-dashboard-default-secret-change-me'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('dashboard_session')?.value

    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    const [payloadB64, hmac] = token.split('.')
    if (!payloadB64 || !hmac) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    // Verify HMAC
    const payload = Buffer.from(payloadB64, 'base64').toString()
    const expectedHmac = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex')
    if (hmac !== expectedHmac) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    const data = JSON.parse(payload)

    // Check expiry
    if (data.exp < Date.now()) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    return NextResponse.json({ authenticated: true, username: data.username })
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
}
