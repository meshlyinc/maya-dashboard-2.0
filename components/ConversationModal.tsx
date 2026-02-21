'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { X, User, Bot, AlertCircle, UserCheck, MessageSquare, ChevronRight, Clock, Briefcase, CheckCircle, AlertTriangle, Star, MapPin, DollarSign, Zap, Paperclip, Wrench, ExternalLink, Award, Calendar, MessageCircle } from 'lucide-react'
import { format } from 'date-fns'

interface ConvMessage {
  id: string
  role: string
  content: string
  createdAt: string
  senderName?: string
  metadata?: any
  attachments?: any[]
  toolCalls?: any[]
}

interface ReachoutSummary {
  matchId: string
  candidateName: string
  candidateHeadline: string | null
  status: string
  outreachPreview: string | null
  hasResponse: boolean
  messageCount: number
  outreachSentAt: string
  respondedAt: string | null
  matchScore: number | null
  matchReasons?: string[]
  potentialConcerns?: string[]
  fitSummary?: string | null
}

interface PostingDetails {
  id?: string
  title?: string
  description?: string | null
  jdStructured?: {
    title?: string
    deliverables?: string[]
    projectScope?: string
    skillsRequired?: string[]
    [key: string]: any
  } | null
  mayaSummary?: string | null
  idealCandidate?: string | null
  skillsRequired?: string[]
  skillsPreferred?: string[]
  gigType?: string | null
  workType?: string | null
  location?: string | null
  remoteOk?: boolean
  budgetMin?: number | null
  budgetMax?: number | null
  budgetType?: string | null
  currency?: string | null
  experienceMin?: number | null
  experienceMax?: number | null
  seniority?: string | null
  urgency?: string | null
  duration?: string | null
  candidatesMatched?: number
  candidatesReached?: number
  candidatesInterested?: number
  status?: string
}

interface ConvData {
  id: string
  title: string
  status: string
  stage: string
  messageCount: number
  lastMessageAt: string
  createdAt: string
  type: string
  conversationType?: string
  category?: string
  messages: ConvMessage[]
  reachouts?: ReachoutSummary[]
  metadata?: {
    candidatesMatched?: number
    candidatesReached?: number
    totalReachouts?: number
    connectedCount?: number
    matchScore?: number
    matchReasons?: string[]
    potentialConcerns?: string[]
    fitSummary?: string
  }
  postingDetails?: PostingDetails | null
}

interface ConversationModalProps {
  conversationId: string
  onClose: () => void
  onSelectMatch?: (matchId: string) => void
}

// Module-level caches — persist across component mounts so re-opening a conversation is instant
const dataCache: Record<string, ConvData> = {}
const scrollCache: Record<string, number> = {}

export default function ConversationModal({ conversationId, onClose, onSelectMatch }: ConversationModalProps) {
  const [conversation, setConversation] = useState<ConvData | null>(dataCache[conversationId] || null)
  const [loading, setLoading] = useState(!dataCache[conversationId])
  const [error, setError] = useState<string | null>(null)
  const [selectedReachoutStatus, setSelectedReachoutStatus] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSelectedReachoutStatus('')
    // If cached, show it immediately but still refresh in background
    if (dataCache[conversationId]) {
      setConversation(dataCache[conversationId])
      setLoading(false)
      fetchConversation(true) // silent background refresh
    } else {
      setConversation(null)
      setLoading(true)
      fetchConversation(false)
    }
  }, [conversationId])

  // Restore scroll position after render
  useEffect(() => {
    if (!loading && scrollRef.current && scrollCache[conversationId] != null) {
      scrollRef.current.scrollTop = scrollCache[conversationId]
    }
  }, [loading, conversationId])

  // Save scroll position on unmount
  useEffect(() => {
    return () => {
      if (scrollRef.current) {
        scrollCache[conversationId] = scrollRef.current.scrollTop
      }
    }
  }, [conversationId])

  const fetchConversation = async (silent = false) => {
    if (!silent) {
      setLoading(true)
    }
    setError(null)
    try {
      const res = await fetch(`/api/conversations/${conversationId}`)
      const data = await res.json()
      if (!res.ok || data.error) {
        if (!silent) setError(data.error || `Failed to load (${res.status})`)
        return
      }
      dataCache[conversationId] = data
      setConversation(data)
    } catch (err) {
      if (!silent) setError('Network error - failed to fetch conversation')
    } finally {
      setLoading(false)
    }
  }

  const safeFormatDate = (dateStr: string | null | undefined, fmt: string) => {
    if (!dateStr) return ''
    try {
      return format(new Date(dateStr), fmt)
    } catch {
      return ''
    }
  }

  const getSenderName = (message: { senderName?: string; role: string }) => {
    if (message.senderName && message.senderName !== message.role) return message.senderName
    if (message.role === 'assistant') return 'Maya (AI)'
    if (message.role === 'system') return 'System'
    return 'User'
  }

  const getReachoutStatusColor = (status: string) => {
    const s = status?.toLowerCase() || ''
    if (s.includes('interested') || s.includes('responded')) return 'bg-green-100 text-green-700'
    if (s.includes('sent') || s.includes('active')) return 'bg-blue-100 text-blue-700'
    if (s.includes('pending') || s.includes('matching')) return 'bg-yellow-100 text-yellow-700'
    if (s.includes('hired') || s.includes('completed')) return 'bg-purple-100 text-purple-700'
    if (s.includes('declined') || s.includes('rejected')) return 'bg-red-100 text-red-700'
    return 'bg-gray-100 text-gray-700'
  }

  const renderPostingDetailsCard = (details: PostingDetails) => {
    const jd = details.jdStructured
    return (
      <div className="border border-blue-200 bg-blue-50/50 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Briefcase className="w-4 h-4 text-blue-600" />
          <h4 className="text-sm font-semibold text-blue-900">Job Posting Details</h4>
        </div>

        {details.mayaSummary && (
          <p className="text-sm text-gray-700 mb-3 italic">{details.mayaSummary}</p>
        )}

        {jd?.projectScope && (
          <div className="mb-3">
            <p className="text-xs font-medium text-gray-500 mb-1">Scope</p>
            <p className="text-sm text-gray-700">{jd.projectScope}</p>
          </div>
        )}

        {jd?.deliverables && jd.deliverables.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-medium text-gray-500 mb-1">Deliverables</p>
            <ul className="list-disc list-inside space-y-0.5">
              {jd.deliverables.map((d: string, i: number) => (
                <li key={i} className="text-sm text-gray-700">{d}</li>
              ))}
            </ul>
          </div>
        )}

        {(details.skillsRequired?.length || 0) > 0 && (
          <div className="mb-3">
            <p className="text-xs font-medium text-gray-500 mb-1">Required Skills</p>
            <div className="flex flex-wrap gap-1.5">
              {details.skillsRequired!.map((skill, i) => (
                <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium">{skill}</span>
              ))}
            </div>
          </div>
        )}

        {(details.skillsPreferred?.length || 0) > 0 && (
          <div className="mb-3">
            <p className="text-xs font-medium text-gray-500 mb-1">Preferred Skills</p>
            <div className="flex flex-wrap gap-1.5">
              {details.skillsPreferred!.map((skill, i) => (
                <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">{skill}</span>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
          {details.budgetMin != null && (
            <span className="flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              {details.currency || '$'}{details.budgetMin.toLocaleString()}
              {details.budgetMax != null && details.budgetMax !== details.budgetMin && ` - ${details.currency || '$'}${details.budgetMax.toLocaleString()}`}
              {details.budgetType && ` /${details.budgetType}`}
            </span>
          )}
          {details.workType && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {details.workType}{details.remoteOk && ' (Remote OK)'}
            </span>
          )}
          {details.seniority && (
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3" />
              {details.seniority}
            </span>
          )}
          {details.urgency && (
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3" />
              {details.urgency}
            </span>
          )}
          {details.gigType && <span>{details.gigType}</span>}
        </div>

        {(details.candidatesMatched != null || details.candidatesReached != null) && (
          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-blue-100 text-xs text-gray-500">
            {details.candidatesMatched != null && <span>{details.candidatesMatched} matched</span>}
            {details.candidatesReached != null && <span>{details.candidatesReached} reached</span>}
            {details.candidatesInterested != null && details.candidatesInterested > 0 && (
              <span className="text-green-600 font-medium">{details.candidatesInterested} interested</span>
            )}
          </div>
        )}
      </div>
    )
  }

  const renderMessageMatchCard = (data: any) => {
    return (
      <div className="ml-11 mt-2 border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white rounded-xl p-4 shadow-sm">
        {/* Header: candidate name + score */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
              <UserCheck className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900">{data.candidateName}</h4>
              {data.candidateSummary && (
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{data.candidateSummary}</p>
              )}
            </div>
          </div>
          {data.quotation && (
            <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-semibold flex-shrink-0">
              {data.quotation}
            </span>
          )}
        </div>

        {/* Skills */}
        {data.skills && data.skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {data.skills.map((skill: string, i: number) => (
              <span key={i} className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md text-xs font-medium">
                {skill}
              </span>
            ))}
          </div>
        )}

        {/* Info grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {data.experienceYears != null && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <Award className="w-3.5 h-3.5 text-gray-400" />
              <span>{data.experienceYears} yrs exp</span>
            </div>
          )}
          {data.availability && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <span className="capitalize">{data.availability.replace(/_/g, ' ')}</span>
            </div>
          )}
          {data.estTime && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <span>{data.estTime}</span>
            </div>
          )}
          {data.gigTitle && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <Briefcase className="w-3.5 h-3.5 text-gray-400" />
              <span className="truncate">{data.gigTitle}</span>
            </div>
          )}
        </div>

        {/* Maya's note */}
        {data.mayasNote && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Bot className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-xs font-medium text-blue-700">Maya&apos;s Note</span>
            </div>
            <p className="text-xs text-gray-700 leading-relaxed">{data.mayasNote}</p>
          </div>
        )}

        {/* Candidate's note */}
        {data.candidateNote && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3">
            <div className="flex items-center gap-1.5 mb-1">
              <MessageCircle className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-xs font-medium text-gray-600">Candidate&apos;s Response</span>
            </div>
            <p className="text-xs text-gray-700 leading-relaxed">{data.candidateNote}</p>
          </div>
        )}

        {/* Action links */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-indigo-100">
          {data.workLinks && data.workLinks.length > 0 && data.workLinks.map((link: string, i: number) => (
            <a
              key={i}
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 rounded-md text-xs text-indigo-600 font-medium transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              {(() => {
                try { return new URL(link).hostname.replace('www.', '') } catch { return 'Portfolio' }
              })()}
            </a>
          ))}
          {data.whatsappUrl && (
            <a
              href={data.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 border border-green-200 hover:bg-green-100 rounded-md text-xs text-green-700 font-medium transition-colors"
            >
              <MessageSquare className="w-3 h-3" />
              Connect on WhatsApp
            </a>
          )}
        </div>
      </div>
    )
  }

  const renderMatchInfoCard = (meta: NonNullable<ConvData['metadata']>) => {
    const hasContent = (meta.matchReasons?.length || 0) > 0 || (meta.potentialConcerns?.length || 0) > 0 || meta.fitSummary
    if (!hasContent) return null

    return (
      <div className="border border-purple-200 bg-purple-50/50 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Star className="w-4 h-4 text-purple-600" />
          <h4 className="text-sm font-semibold text-purple-900">Match Analysis</h4>
          {meta.matchScore != null && (
            <span className="ml-auto px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
              {Math.round(meta.matchScore * 100)}% match
            </span>
          )}
        </div>

        {meta.fitSummary && (
          <p className="text-sm text-gray-700 mb-3 italic">{meta.fitSummary}</p>
        )}

        {(meta.matchReasons?.length || 0) > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-1 mb-1">
              <CheckCircle className="w-3 h-3 text-green-500" />
              <p className="text-xs font-medium text-green-700">Strengths</p>
            </div>
            <ul className="space-y-1 ml-4">
              {meta.matchReasons!.map((reason, i) => (
                <li key={i} className="text-sm text-gray-700 list-disc">{reason}</li>
              ))}
            </ul>
          </div>
        )}

        {(meta.potentialConcerns?.length || 0) > 0 && (
          <div>
            <div className="flex items-center gap-1 mb-1">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              <p className="text-xs font-medium text-amber-700">Concerns</p>
            </div>
            <ul className="space-y-1 ml-4">
              {meta.potentialConcerns!.map((concern, i) => (
                <li key={i} className="text-sm text-gray-600 list-disc">{concern}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900">
              {conversation?.title || 'Conversation'}
            </h2>
            {conversation && (
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 flex-wrap">
                <span>Stage: {conversation.stage || 'N/A'}</span>
                <span>•</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  conversation.status === 'active' ? 'bg-green-100 text-green-700' :
                  conversation.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {conversation.status || 'Unknown'}
                </span>
                {conversation.conversationType && (
                  <>
                    <span>•</span>
                    <span className="text-xs text-gray-400 uppercase">
                      {conversation.conversationType.replace(/_/g, ' ')}
                    </span>
                  </>
                )}
                {conversation.metadata && (
                  <>
                    {conversation.metadata.totalReachouts != null && (
                      <>
                        <span>•</span>
                        <span className="text-blue-600 font-medium">
                          {conversation.metadata.totalReachouts} reachouts
                        </span>
                      </>
                    )}
                    {conversation.metadata.candidatesMatched != null && (
                      <>
                        <span>•</span>
                        <span>{conversation.metadata.candidatesMatched} matched</span>
                      </>
                    )}
                    {(conversation.metadata.connectedCount || 0) > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-green-600 font-medium">
                          {conversation.metadata.connectedCount} connected
                        </span>
                      </>
                    )}
                    {conversation.metadata.matchScore != null && (
                      <>
                        <span>•</span>
                        <span className="text-blue-600">
                          Score: {Math.round(conversation.metadata.matchScore * 100)}%
                        </span>
                      </>
                    )}
                  </>
                )}
                <span>•</span>
                <span>{conversation.messageCount} messages</span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-500">
              <div className="animate-pulse">Loading messages...</div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
              <div className="text-red-500 mb-3">{error}</div>
              <button
                onClick={() => fetchConversation(false)}
                className="text-sm text-blue-600 hover:underline"
              >
                Retry
              </button>
            </div>
          ) : !conversation ? (
            <div className="text-center py-12">
              <div className="text-gray-500 mb-2">No data found</div>
            </div>
          ) : conversation.type === 'posting' && conversation.reachouts ? (
            /* Posting view: show reachout summary cards */
            (() => {
              // Predefined reachout statuses in order
              const REACHOUT_STATUSES = [
                { value: 'identified', label: 'Identified', color: 'bg-gray-100 text-gray-700 border-gray-300' },
                { value: 'outreach_sent', label: 'Outreach Sent', color: 'bg-blue-100 text-blue-800 border-blue-300' },
                { value: 'candidate_interested', label: 'Interested', color: 'bg-green-100 text-green-800 border-green-300' },
                { value: 'negotiating', label: 'Negotiating', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
                { value: 'connected', label: 'Connected', color: 'bg-purple-100 text-purple-800 border-purple-300' },
                { value: 'candidate_declined', label: 'Declined', color: 'bg-orange-100 text-orange-800 border-orange-300' },
                { value: 'passed', label: 'Passed', color: 'bg-red-100 text-red-700 border-red-300' },
              ]

              // Compute status counts
              const statusCounts: Record<string, number> = {}
              conversation.reachouts!.forEach(r => {
                const s = r.status || 'unknown'
                statusCounts[s] = (statusCounts[s] || 0) + 1
              })
              // Only show chips that have at least one reachout
              const visibleStatuses = REACHOUT_STATUSES.filter(s => statusCounts[s.value] > 0)
              const filteredReachouts = selectedReachoutStatus
                ? conversation.reachouts!.filter(r => r.status === selectedReachoutStatus)
                : conversation.reachouts!

              return (
            <div>
              {/* Posting details card */}
              {conversation.postingDetails && renderPostingDetailsCard(conversation.postingDetails)}

              {/* Reachout status filter chips */}
              {visibleStatuses.length > 1 && (
                <div className="flex items-center gap-2 flex-wrap mb-4 pb-3 border-b border-gray-100">
                  <span className="text-xs font-medium text-gray-500 mr-1">Status:</span>
                  {visibleStatuses.map(s => (
                    <button
                      key={s.value}
                      onClick={() => setSelectedReachoutStatus(prev => prev === s.value ? '' : s.value)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                        selectedReachoutStatus === s.value
                          ? `${s.color} ring-2 ring-offset-1 ring-current`
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {s.label}
                      <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        selectedReachoutStatus === s.value ? 'bg-white/50' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {statusCounts[s.value]}
                      </span>
                    </button>
                  ))}
                  {selectedReachoutStatus && (
                    <button
                      onClick={() => setSelectedReachoutStatus('')}
                      className="px-2 py-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}

              {filteredReachouts.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  {selectedReachoutStatus ? 'No reachouts with this status' : 'No reachouts for this posting yet'}
                </div>
              ) : (
              <div className="space-y-3">
                {filteredReachouts.map((reachout) => {
                  const statusColor = getReachoutStatusColor(reachout.status)
                  return (
                    <div
                      key={reachout.matchId}
                      onClick={() => onSelectMatch?.(reachout.matchId)}
                      className="border border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-sm cursor-pointer transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <UserCheck className="w-5 h-5 text-green-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-gray-900">{reachout.candidateName}</span>
                              {reachout.matchScore != null && (
                                <span className="text-xs text-blue-600 font-medium">
                                  {Math.round(reachout.matchScore * 100)}% match
                                </span>
                              )}
                            </div>
                            {reachout.candidateHeadline && (
                              <p className="text-xs text-gray-500 mb-2">{reachout.candidateHeadline}</p>
                            )}
                            {reachout.outreachPreview && (
                              <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                                {reachout.outreachPreview}
                              </p>
                            )}
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {safeFormatDate(reachout.outreachSentAt, 'MMM d, yyyy')}
                              </span>
                              <span className="flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" />
                                {reachout.messageCount} messages
                              </span>
                              {reachout.hasResponse && (
                                <span className="text-green-600 font-medium">Responded</span>
                              )}
                            </div>
                            {reachout.fitSummary && (
                              <p className="text-xs text-gray-500 italic mt-2">{reachout.fitSummary}</p>
                            )}
                            {(reachout.matchReasons?.length || 0) > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {reachout.matchReasons!.slice(0, 2).map((r, i) => (
                                  <span key={i} className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-[10px]">{r.length > 60 ? r.slice(0, 60) + '...' : r}</span>
                                ))}
                                {(reachout.potentialConcerns?.length || 0) > 0 && (
                                  <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px]">
                                    {reachout.potentialConcerns![0].length > 60 ? reachout.potentialConcerns![0].slice(0, 60) + '...' : reachout.potentialConcerns![0]}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor}`}>
                            {reachout.status}
                          </span>
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              )}
            </div>
              )
            })()
          ) : conversation.messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-500 mb-2">No messages found</div>
              {conversation.id && (
                <div className="text-sm text-gray-400">
                  Type: {conversation.type} | ID: {conversation.id.slice(0, 8)}
                </div>
              )}
            </div>
          ) : (
            /* Regular chat view for reachout/query types */
            <div className="space-y-4">
              {/* Metadata cards above messages (hide in group/introduction conversations) */}
              {conversation.conversationType !== 'introduction' && conversation.postingDetails && renderPostingDetailsCard(conversation.postingDetails)}
              {conversation.conversationType !== 'introduction' && conversation.metadata && renderMatchInfoCard(conversation.metadata)}

              {conversation.messages.map(message => {
                const isAssistant = message.role === 'assistant'
                const isSystem = message.role === 'system'
                const meta = message.metadata && typeof message.metadata === 'object' ? message.metadata : null
                const hasAttachments = message.attachments && Array.isArray(message.attachments) && message.attachments.length > 0
                const hasToolCalls = message.toolCalls && Array.isArray(message.toolCalls) && message.toolCalls.length > 0

                return (
                  <div key={message.id} className="flex gap-3">
                    {/* Avatar */}
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      isSystem ? 'bg-yellow-100' :
                      isAssistant ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      {isSystem ? (
                        <span className="text-xs font-bold text-yellow-700">S</span>
                      ) : isAssistant ? (
                        <Bot className="w-4 h-4 text-blue-600" />
                      ) : (
                        <User className="w-4 h-4 text-gray-600" />
                      )}
                    </div>

                    {/* Message Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-sm font-medium ${isSystem ? 'text-yellow-700' : 'text-gray-900'}`}>
                          {getSenderName(message)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {safeFormatDate(message.createdAt, 'MMM d, h:mm a')}
                        </span>
                      </div>
                      <div className={`text-sm whitespace-pre-wrap break-words ${
                        isSystem ? 'text-gray-500 italic' : 'text-gray-700'
                      }`}>
                        {message.content.split('\n').map((line, idx) => {
                          // Handle bold markdown **text**
                          if (line.startsWith('**') && line.endsWith('**')) {
                            return (
                              <div key={idx} className="font-semibold text-gray-900 mb-2">
                                {line.replace(/\*\*/g, '')}
                              </div>
                            )
                          }
                          return line ? <div key={idx}>{line}</div> : <br key={idx} />
                        })}
                      </div>

                      {/* Attachments */}
                      {hasAttachments && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {message.attachments!.map((att: any, i: number) => (
                            <a
                              key={i}
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded-md text-xs text-gray-700 transition-colors"
                            >
                              <Paperclip className="w-3 h-3" />
                              {att.type || 'attachment'}{att.name ? `: ${att.name}` : ''}
                            </a>
                          ))}
                        </div>
                      )}

                      {/* Tool Calls */}
                      {hasToolCalls && (
                        <div className="mt-2 space-y-1">
                          {message.toolCalls!.map((tc: any, i: number) => {
                            const toolName = tc.name || tc.function?.name || 'tool call'
                            const args = tc.function?.arguments
                              ? (typeof tc.function.arguments === 'string' ? (() => { try { return JSON.parse(tc.function.arguments) } catch { return null } })() : tc.function.arguments)
                              : (tc.arguments ? (typeof tc.arguments === 'string' ? (() => { try { return JSON.parse(tc.arguments) } catch { return null } })() : tc.arguments) : null)

                            return (
                              <div key={i} className="border border-amber-200 bg-amber-50/50 rounded-lg p-3">
                                <div className="flex items-center gap-1.5 mb-2">
                                  <Wrench className="w-3.5 h-3.5 text-amber-600" />
                                  <span className="text-xs font-semibold text-amber-800">{toolName}</span>
                                </div>
                                {args && typeof args === 'object' && (
                                  <div className="space-y-1.5">
                                    {Object.entries(args).map(([k, v]) => (
                                      <div key={k} className="text-xs">
                                        <span className="font-medium text-gray-600">{k.replace(/_/g, ' ')}: </span>
                                        <span className="text-gray-700">
                                          {typeof v === 'string' ? v : Array.isArray(v) ? v.join(', ') : JSON.stringify(v)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Match Card from metadata (hide in group/introduction conversations) */}
                      {conversation.conversationType !== 'introduction' && meta?.component?.type === 'match_card' && meta.component.data && (
                        renderMessageMatchCard(meta.component.data)
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
