'use client'

import { useEffect, useState } from 'react'
import { X, User, Bot, AlertCircle, UserCheck, MessageSquare, ChevronRight, Clock } from 'lucide-react'
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
    fitSummary?: string
  }
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
            conversation.reachouts.length === 0 ? (
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
            )
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
              {conversation.messages.map(message => {
                const isAssistant = message.role === 'assistant'
                const isSystem = message.role === 'system'

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
