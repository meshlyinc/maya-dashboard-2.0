export interface AnalyticsMetrics {
  totalUsers: number
  totalMessages: number
  totalConversations: number
  usersPerMinute: number
  totalPostings: number // hirer_intake conversations
  totalReachouts: number // candidate_onboarding conversations
  totalFreelancerPortfolios: number // candidate_profiles
  totalConnections: number // matches where connected_at is not null
  recentActivity: ActivityData[]
}

export interface ActivityData {
  timestamp: string
  label?: string
  userCount: number
  messageCount: number
  conversationCount: number
  reachoutCount: number
  connectionCount: number
}

export interface TimeFilter {
  startDate: string
  endDate: string
}

export interface ConversationDetail {
  id: string
  title: string
  status: string
  stage: string
  messageCount: number
  lastMessageAt: string
  createdAt: string
  type: 'posting' | 'reachout'
}

export interface Message {
  id: string
  role: string
  content: string
  createdAt: string
  senderName?: string
}

export interface ConversationWithMessages extends ConversationDetail {
  messages: Message[]
}
