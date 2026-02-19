import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

const PAGE_SIZE = 20
const BATCH_SIZE = 1000

// Broad category classifier based on specialty + skills + headline text
const CATEGORIES = [
  {
    name: 'Web Dev',
    keywords: ['web dev', 'frontend', 'front-end', 'front end', 'backend', 'back-end', 'back end', 'full-stack', 'full stack', 'fullstack', 'mern', 'mean', 'react', 'next.js', 'nextjs', 'angular', 'vue', 'node.js', 'nodejs', 'express', 'django', 'flask', 'laravel', 'php', 'ruby on rails', 'wordpress', 'shopify', 'wix', 'webflow', 'html', 'css', 'javascript', 'typescript', 'tailwind', 'bootstrap', 'website'],
  },
  {
    name: 'Mobile Dev',
    keywords: ['mobile', 'ios', 'android', 'flutter', 'react native', 'swift', 'kotlin', 'xamarin', 'ionic', 'cordova', 'app dev'],
  },
  {
    name: 'UI/UX Design',
    keywords: ['ui/ux', 'ui ux', 'ux design', 'ui design', 'user experience', 'user interface', 'figma', 'sketch', 'adobe xd', 'wireframe', 'prototype', 'interaction design', 'product design'],
  },
  {
    name: 'Graphic Design',
    keywords: ['graphic design', 'logo', 'branding', 'illustration', 'photoshop', 'illustrator', 'canva', 'visual design', 'print design', 'brand identity'],
  },
  {
    name: 'Video & Content',
    keywords: ['video edit', 'video prod', 'motion graphic', 'after effects', 'premiere', 'davinci', 'animation', 'content creat', 'copywriting', 'copy writing', 'content writ', 'blog', 'seo', 'social media', 'short-form', 'reels', 'tiktok', 'youtube'],
  },
  {
    name: 'Data & AI',
    keywords: ['data analy', 'data scien', 'machine learning', 'deep learning', 'ai ', 'artificial intelligence', 'nlp', 'computer vision', 'data engineer', 'big data', 'tensorflow', 'pytorch', 'pandas', 'power bi', 'tableau', 'genai', 'gen ai', 'llm', 'chatgpt', 'ml '],
  },
  {
    name: 'DevOps & Cloud',
    keywords: ['devops', 'ci/cd', 'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'cloud', 'terraform', 'ansible', 'jenkins', 'infrastructure', 'sre', 'site reliability', 'linux admin', 'system admin'],
  },
  {
    name: 'Marketing',
    keywords: ['marketing', 'lead gen', 'email market', 'growth', 'ads', 'ppc', 'google ads', 'facebook ads', 'performance market', 'digital market', 'affiliate'],
  },
  {
    name: 'SWE',
    keywords: ['software engineer', 'software develop', 'java ', 'python', 'golang', 'rust', 'c++', 'c#', '.net', 'spring boot', 'microservice', 'api develop', 'system design', 'distributed system', 'blockchain', 'smart contract', 'solidity', 'web3'],
  },
]

function classifyProfile(specialty?: string | null, headline?: string | null, skills?: string[] | null): string {
  const text = [
    specialty || '',
    headline || '',
    ...(skills || []),
  ].join(' ').toLowerCase()

  if (text.trim() === '') return 'Other'

  let bestCategory = 'Other'
  let bestScore = 0

  for (const cat of CATEGORIES) {
    let score = 0
    for (const kw of cat.keywords) {
      if (text.includes(kw)) score++
    }
    if (score > bestScore) {
      bestScore = score
      bestCategory = cat.name
    }
  }

  return bestCategory
}

// Fetch all rows using batched pagination to bypass 1000-row limit
async function fetchAllNonMigrated(columns: string, search: string) {
  const allRows: any[] = []
  let offset = 0
  while (true) {
    let q = supabase
      .from('candidate_profiles')
      .select(columns)
      .neq('source', 'whatsapp_migration')
      .order('created_at', { ascending: false })
      .range(offset, offset + BATCH_SIZE - 1)
    if (search) q = q.or(`headline.ilike.%${search}%,current_title.ilike.%${search}%`)
    const { data: batch } = await q
    if (!batch || batch.length === 0) break
    allRows.push(...batch)
    if (batch.length < BATCH_SIZE) break
    offset += BATCH_SIZE
  }
  return allRows
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const category = searchParams.get('category')?.trim() || ''
  const search = searchParams.get('search')?.trim() || ''
  const availability = searchParams.get('availability')?.trim() || ''
  const experience = searchParams.get('experience')?.trim() || ''
  const budgetMin = searchParams.get('budgetMin')?.trim() || ''
  const budgetMax = searchParams.get('budgetMax')?.trim() || ''
  const rateType = searchParams.get('rateType')?.trim() || ''

  try {
    // Fetch all non-migrated profiles (for classification)
    const allProfiles = await fetchAllNonMigrated(
      'id, user_id, headline, bio, specialty, skills, experience_years, current_title, rate_type, rate_min, rate_max, rate_currency, availability, portfolio_url, portfolio_links, created_at',
      search
    )

    // Classify all profiles
    const classified = allProfiles.map(p => ({
      ...p,
      broadCategory: classifyProfile(p.specialty, p.headline, p.skills),
    }))

    // Compute category counts (unfiltered by any filter so chips show totals)
    const categoryCounts: Record<string, number> = {}
    classified.forEach(p => {
      categoryCounts[p.broadCategory] = (categoryCounts[p.broadCategory] || 0) + 1
    })

    // Apply all filters
    let filtered = classified

    if (category) filtered = filtered.filter(p => p.broadCategory === category)

    if (availability) filtered = filtered.filter(p => p.availability === availability)

    if (rateType) filtered = filtered.filter(p => p.rate_type === rateType)

    if (experience) {
      filtered = filtered.filter(p => {
        const e = p.experience_years
        if (e == null) return experience === 'unknown'
        switch (experience) {
          case '0-1': return e <= 1
          case '1-3': return e >= 1 && e <= 3
          case '4-6': return e >= 4 && e <= 6
          case '7-10': return e >= 7 && e <= 10
          case '10+': return e > 10
          default: return true
        }
      })
    }

    if (budgetMin || budgetMax) {
      const min = budgetMin ? parseFloat(budgetMin) : null
      const max = budgetMax ? parseFloat(budgetMax) : null
      filtered = filtered.filter(p => {
        const r = p.rate_min
        if (r == null) return false
        if (min != null && r < min) return false
        if (max != null && r > max) return false
        return true
      })
    }

    // Compute filter counts (after category filter, before other filters, so counts reflect category scope)
    const categoryFiltered = category ? classified.filter(p => p.broadCategory === category) : classified

    const availabilityCounts: Record<string, number> = {}
    const experienceCounts: Record<string, number> = {}
    const rateTypeCounts: Record<string, number> = {}
    let budgetRangeMin: number | null = null
    let budgetRangeMax: number | null = null
    let budgetCount = 0

    categoryFiltered.forEach(p => {
      // Availability
      if (p.availability) availabilityCounts[p.availability] = (availabilityCounts[p.availability] || 0) + 1

      // Rate type
      if (p.rate_type) rateTypeCounts[p.rate_type] = (rateTypeCounts[p.rate_type] || 0) + 1

      // Experience
      const e = p.experience_years
      if (e != null) {
        if (e <= 1) experienceCounts['0-1'] = (experienceCounts['0-1'] || 0) + 1
        if (e >= 1 && e <= 3) experienceCounts['1-3'] = (experienceCounts['1-3'] || 0) + 1
        if (e >= 4 && e <= 6) experienceCounts['4-6'] = (experienceCounts['4-6'] || 0) + 1
        if (e >= 7 && e <= 10) experienceCounts['7-10'] = (experienceCounts['7-10'] || 0) + 1
        if (e > 10) experienceCounts['10+'] = (experienceCounts['10+'] || 0) + 1
      }

      // Budget range
      const r = p.rate_min
      if (r != null) {
        budgetCount++
        if (budgetRangeMin == null || r < budgetRangeMin) budgetRangeMin = r
        if (budgetRangeMax == null || r > budgetRangeMax) budgetRangeMax = r
      }
    })

    const totalCount = filtered.length
    const totalPages = Math.ceil(totalCount / PAGE_SIZE)

    // Paginate
    const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

    // Fetch user names for this page
    const userIds = [...new Set(pageItems.map(p => p.user_id).filter(Boolean))]
    const userNameMap: Record<string, { name: string; phone: string | null }> = {}
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, full_name, phone')
        .in('id', userIds)
      users?.forEach((u: any) => {
        userNameMap[u.id] = {
          name: u.full_name || u.phone || 'Unknown',
          phone: u.phone || null,
        }
      })
    }

    const items = pageItems.map(p => ({
      id: p.id,
      userId: p.user_id,
      userName: p.user_id ? (userNameMap[p.user_id]?.name || null) : null,
      userPhone: p.user_id ? (userNameMap[p.user_id]?.phone || null) : null,
      headline: p.headline,
      bio: p.bio,
      specialty: p.specialty,
      broadCategory: p.broadCategory,
      skills: p.skills || [],
      experienceYears: p.experience_years,
      currentTitle: p.current_title,
      rateType: p.rate_type,
      rateMin: p.rate_min,
      rateMax: p.rate_max,
      rateCurrency: p.rate_currency,
      availability: p.availability,
      portfolioUrl: p.portfolio_url,
      portfolioLinks: p.portfolio_links || [],
      createdAt: p.created_at,
    }))

    return NextResponse.json({
      items,
      page,
      totalPages,
      totalItems: totalCount,
      categoryCounts,
      availabilityCounts,
      experienceCounts,
      budgetRange: { min: budgetRangeMin, max: budgetRangeMax, count: budgetCount },
      rateTypeCounts,
    })
  } catch (error) {
    console.error('Portfolios error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch portfolios' },
      { status: 500 }
    )
  }
}
