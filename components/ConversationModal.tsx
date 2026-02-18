'use client'

import { useEffect, useState } from 'react'
import { X, User, Bot, AlertCircle, UserCheck, MessageSquare, ChevronRight, Clock, Briefcase, CheckCircle, AlertTriangle, Star, MapPin, DollarSign, Zap, Paperclip, Tag, Wrench } from 'lucide-react'
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

export default function ConversationModal({ conversationId, onClose, onSelectMatch }: ConversationModalProps) {
  const [conversation, setConversation] = useState<ConvData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchConversation()
  }, [conversationId])

  const fetchConversation = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/conversations/${conversationId}`)
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || `Failed to load (${res.status})`)
        return
      }
      setConversation(data)
    } catch (err) {
      setError('Network error - failed to fetch conversation')
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
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-500">
              <div className="animate-pulse">Loading messages...</div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
              <div className="text-red-500 mb-3">{error}</div>
              <button
                onClick={fetchConversation}
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
            <div>
              {/* Posting details card */}
              {conversation.postingDetails && renderPostingDetailsCard(conversation.postingDetails)}

              {conversation.reachouts.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No reachouts for this posting yet
                </div>
              ) : (
              <div className="space-y-3">
                {conversation.reachouts.map((reachout) => {
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
              {/* Metadata cards above messages */}
              {conversation.postingDetails && renderPostingDetailsCard(conversation.postingDetails)}
              {conversation.metadata && renderMatchInfoCard(conversation.metadata)}

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
                        {meta?.original_type && meta.original_type !== 'new' && (
                          <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-medium">
                            {meta.original_type.replace(/_/g, ' ')}
                          </span>
                        )}
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
                          {message.toolCalls!.map((tc: any, i: number) => (
                            <div key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 rounded-md text-xs text-amber-700">
                              <Wrench className="w-3 h-3" />
                              {tc.name || tc.function?.name || 'tool call'}
                              {tc.function?.arguments && (
                                <span className="text-amber-500 ml-1 truncate max-w-[200px]">
                                  {typeof tc.function.arguments === 'string' ? tc.function.arguments.slice(0, 80) : JSON.stringify(tc.function.arguments).slice(0, 80)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Metadata row */}
                      {meta && Object.keys(meta).length > 0 && (
                        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                          {meta.source && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-50 border border-gray-200 rounded text-[10px] text-gray-500">
                              <Tag className="w-2.5 h-2.5" />
                              {meta.source.replace(/_/g, ' ')}
                            </span>
                          )}
                          {Object.entries(meta).filter(([k]) => k !== 'source' && k !== 'original_type').map(([key, value]) => (
                            <span key={key} className="px-1.5 py-0.5 bg-gray-50 border border-gray-200 rounded text-[10px] text-gray-500">
                              {key}: {typeof value === 'string' ? value : JSON.stringify(value)}
                            </span>
                          ))}
                        </div>
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
