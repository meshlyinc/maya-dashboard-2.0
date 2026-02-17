import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')

  if (!query || query.length < 2) {
    return NextResponse.json({ error: 'Search query must be at least 2 characters' }, { status: 400 })
  }

  try {
    // Search users by name, email, or phone
    const { data: users, error } = await supabase
      .from('users')
      .select('id, full_name, email, phone, user_type, created_at, last_login_at')
      .or(`full_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
      .limit(20)
      .order('created_at', { ascending: false })

    if (error) throw error

    // For each user, get their candidate profile if it exists
    const userIds = users.map(u => u.id)
    const { data: profiles } = await supabase
      .from('candidate_profiles')
      .select('user_id, headline, specialty')
      .in('user_id', userIds)

    // Create a map of profiles
    const profileMap = profiles?.reduce((acc, profile) => {
      acc[profile.user_id] = profile
      return acc
    }, {} as Record<string, any>) || {}

    // Enrich users with profile data
    const enrichedUsers = users.map(user => ({
      ...user,
      headline: profileMap[user.id]?.headline,
      specialty: profileMap[user.id]?.specialty
    }))

    return NextResponse.json(enrichedUsers)
  } catch (error) {
    console.error('User search error:', error)
    return NextResponse.json(
      { error: 'Failed to search users' },
      { status: 500 }
    )
  }
}
