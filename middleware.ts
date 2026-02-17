import { NextRequest, NextResponse } from 'next/server'

const SESSION_SECRET = process.env.SESSION_SECRET || 'maya-dashboard-default-secret-change-me'

function hexEncode(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function verifySession(token: string): Promise<boolean> {
  try {
    const [payloadB64, hmac] = token.split('.')
    if (!payloadB64 || !hmac) return false

    const payload = atob(payloadB64)

    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(SESSION_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
    const expectedHmac = hexEncode(signature)

    if (hmac !== expectedHmac) return false

    const data = JSON.parse(payload)
    if (data.exp < Date.now()) return false

    return true
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow login page and auth API routes
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.ico')
  ) {
    return NextResponse.next()
  }

  // Check for session cookie
  const token = request.cookies.get('dashboard_session')?.value

  if (!token || !(await verifySession(token))) {
    // Redirect to login for page requests, 401 for API requests
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
