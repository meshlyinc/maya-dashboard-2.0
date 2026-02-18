'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, CheckCircle, Clock, Phone, MessageSquare, User, Loader2, ChevronDown, ChevronUp, Terminal, Bot, AlertCircle, Database, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'

interface LLMLog {
  historyPassedToLLM: string
  llmRawResponse: string | null
  error: string | null
}

interface LoopLLMLog {
  llmRawResponse: string | null
  error: string | null
}

interface JudgedItem {
  conversationId: string
  title: string
  conversationType?: string
  status: string
  stage?: string
  userName: string
  userPhone: string | null
  userId: string
  gigId: string | null
  messageCount: number
  lastMessageAt: string
  createdAt: string
  loopDetected?: boolean
  llmLog: LLMLog
  loopLlmLog?: LoopLLMLog
}

type TabType = 'ready' | 'notReady' | 'noMessages' | 'looping'

interface ReadyForMatchingModalProps {
  onClose: () => void
  onSelectConversation: (id: string) => void
  onSelectUser: (userId: string) => void
}

export default function ReadyForMatchingModal({ onClose, onSelectConversation, onSelectUser }: ReadyForMatchingModalProps) {
  const [ready, setReady] = useState<JudgedItem[]>([])
  const [notReady, setNotReady] = useState<JudgedItem[]>([])
  const [noMessages, setNoMessages] = useState<JudgedItem[]>([])
  const [loopingItems, setLoopingItems] = useState<JudgedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [judgedCount, setJudgedCount] = useState(0)
  const [tab, setTab] = useState<TabType>('ready')
  const [systemPrompt, setSystemPrompt] = useState<string>('')
  const [loopSystemPrompt, setLoopSystemPrompt] = useState<string>('')
  const [model, setModel] = useState<string>('')
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({})
  const [showSystemPrompt, setShowSystemPrompt] = useState(false)
  const [isCached, setIsCached] = useState(false)
  const [rerunning, setRerunning] = useState(false)

  const applyData = (data: any) => {
    setReady(data.ready || [])
    setNotReady(data.notReady || [])
    setNoMessages(data.noMessages || [])
    setLoopingItems(data.looping || [])
    setTotal(data.total || 0)
    setJudgedCount(data.judgedCount || 0)
    setSystemPrompt(data.systemPrompt || '')
    setLoopSystemPrompt(data.loopSystemPrompt || '')
    setModel(data.model || '')
    setIsCached(data.cached ?? false)
  }

  const fetchJudged = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/conversations/judge')
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to fetch judge results')
      }
      const data = await res.json()
      applyData(data)
    } catch (err: any) {
      console.error('Failed to fetch judged conversations:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchJudged()
  }, [fetchJudged])

  const rerunJudges = async () => {
    setRerunning(true)
    setError(null)
    try {
      const res = await fetch('/api/conversations/judge', { method: 'POST' })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to re-run judges')
      }
      const data = await res.json()
      applyData(data)
    } catch (err: any) {
      console.error('Failed to re-run judges:', err)
      setError(err.message)
    } finally {
      setRerunning(false)
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

  const toggleLog = (id: string) => {
    setExpandedLogs(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const items = tab === 'ready' ? ready : tab === 'notReady' ? notReady : tab === 'looping' ? loopingItems : noMessages

  const badgeColor = (t: TabType) => {
    if (t === 'ready') return 'bg-green-100 text-green-700'
    if (t === 'notReady') return 'bg-orange-100 text-orange-700'
    if (t === 'looping') return 'bg-red-100 text-red-700'
    return 'bg-gray-100 text-gray-600'
  }

  const badgeLabel = (t: TabType) => {
    if (t === 'ready') return 'Ready'
    if (t === 'notReady') return 'Incomplete'
    if (t === 'looping') return 'Looping'
    return 'Not Judged'
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-3 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Conversation Judge</h2>
              <p className="text-sm text-gray-500">
                {total} postings in collecting_requirements &middot; {judgedCount} judged by AI
                {isCached && <span className="ml-1 text-xs text-blue-500">(cached)</span>}
                {model && <span className="ml-2 text-xs text-gray-400">Model: {model}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={rerunJudges}
              disabled={rerunning || loading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-blue-600 text-white hover:bg-blue-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {rerunning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {rerunning ? 'Re-running...' : 'Re-run Judges'}
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* System Prompt Toggle */}
        {systemPrompt && (
          <div className="px-6 py-2 border-b border-gray-100 bg-gray-50">
            <button
              onClick={() => setShowSystemPrompt(!showSystemPrompt)}
              className="flex items-center gap-2 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              <Bot className="w-3.5 h-3.5" />
              System Prompts sent to LLM
              {showSystemPrompt ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {showSystemPrompt && (
              <div className="mt-2 space-y-2">
                <div>
                  <span className="text-[10px] font-semibold text-gray-500 uppercase">Requirements Judge</span>
                  <pre className="mt-1 p-3 bg-gray-900 text-gray-100 rounded-lg text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto font-mono">
                    {systemPrompt}
                  </pre>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-gray-500 uppercase">Loop Detection Judge</span>
                  <pre className="mt-1 p-3 bg-gray-900 text-gray-100 rounded-lg text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto font-mono">
                    {loopSystemPrompt}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setTab('ready')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              tab === 'ready'
                ? 'text-green-700 border-b-2 border-green-600 bg-green-50/50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            Ready ({ready.length})
          </button>
          <button
            onClick={() => setTab('notReady')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              tab === 'notReady'
                ? 'text-orange-700 border-b-2 border-orange-600 bg-orange-50/50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            Incomplete ({notReady.length})
          </button>
          <button
            onClick={() => setTab('looping')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              tab === 'looping'
                ? 'text-red-700 border-b-2 border-red-600 bg-red-50/50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            Looping ({loopingItems.length})
          </button>
          <button
            onClick={() => setTab('noMessages')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              tab === 'noMessages'
                ? 'text-gray-700 border-b-2 border-gray-500 bg-gray-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            Not Judged ({noMessages.length})
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-blue-500" />
              <p>Judging conversations with AI...</p>
              <p className="text-xs text-gray-400 mt-1">This may take a moment</p>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-500">
              <p className="font-medium">Error</p>
              <p className="text-sm mt-1">{error}</p>
              <button
                onClick={fetchJudged}
                className="mt-3 px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {tab === 'ready' && 'No conversations are ready for matching yet'}
              {tab === 'notReady' && 'All judged conversations have complete requirements'}
              {tab === 'looping' && 'No conversations are stuck in loops'}
              {tab === 'noMessages' && 'All conversations have messages in the DB'}
            </div>
          ) : (
            <div>
              {/* Info banner for noMessages tab */}
              {tab === 'noMessages' && (
                <div className="flex items-start gap-2 p-3 mb-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  <Database className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Messages stored in external system</p>
                    <p className="mt-0.5 text-amber-700">
                      These conversations have messages (see message count) but they are stored in Redis/MongoDB (WhatsApp migration), not in Supabase&apos;s messages table. The AI judge cannot access them.
                    </p>
                  </div>
                </div>
              )}
              <div className="space-y-3">
                {items.map((item) => {
                  const isExpanded = expandedLogs[item.conversationId] || false
                  return (
                    <div
                      key={item.conversationId}
                      className={`border rounded-lg overflow-hidden transition-all ${
                        tab === 'ready'
                          ? 'border-green-200 hover:border-green-300'
                          : tab === 'notReady'
                          ? 'border-orange-200 hover:border-orange-300'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            {/* User info row */}
                            <div className="flex items-center gap-3 mb-2">
                              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <User className="w-4 h-4 text-gray-600" />
                              </div>
                              <div>
                                <button
                                  onClick={() => item.userId && onSelectUser(item.userId)}
                                  className="font-medium text-gray-900 hover:text-blue-600 hover:underline"
                                >
                                  {item.userName}
                                </button>
                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                  {item.userPhone && (
                                    <span className="flex items-center gap-1">
                                      <Phone className="w-3 h-3" />
                                      {item.userPhone}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Conversation info */}
                            <div
                              onClick={() => onSelectConversation(item.conversationId)}
                              className="ml-11 cursor-pointer hover:bg-gray-50 rounded p-2 -m-2 transition-colors"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                                <span className="text-sm font-medium text-gray-700">{item.title}</span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-gray-400">
                                <span className="flex items-center gap-1">
                                  <MessageSquare className="w-3 h-3" />
                                  {item.messageCount} messages
                                  {tab === 'noMessages' && <span className="text-amber-500 ml-1">(external store)</span>}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {safeFormatDate(item.lastMessageAt, 'MMM d, yyyy h:mm a')}
                                </span>
                                <span className="ml-2 text-blue-500">View conversation &rarr;</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${badgeColor(tab)}`}>
                              {badgeLabel(tab)}
                            </span>
                            {item.loopDetected && tab !== 'looping' && (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">
                                <RefreshCw className="w-3 h-3" />
                                Looping
                              </span>
                            )}
                          </div>
                        </div>

                        {/* LLM Log Toggle */}
                        <div className="ml-11 mt-3">
                          <button
                            onClick={() => toggleLog(item.conversationId)}
                            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                          >
                            <Terminal className="w-3.5 h-3.5" />
                            LLM Log
                            {item.llmLog.llmRawResponse && (
                              <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                item.llmLog.llmRawResponse.trim().toLowerCase() === 'true'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-orange-100 text-orange-700'
                              }`}>
                                LLM said: {item.llmLog.llmRawResponse.trim()}
                              </span>
                            )}
                            {item.llmLog.error && (
                              <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                                {item.llmLog.error === 'messages_in_external_store'
                                  ? 'Messages in Redis/Mongo'
                                  : item.llmLog.error === 'no_conversation'
                                  ? 'No conversation linked'
                                  : `Error: ${item.llmLog.error}`}
                              </span>
                            )}
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Expanded LLM Log */}
                      {isExpanded && (
                        <div className="border-t border-gray-100 bg-gray-50 p-4">
                          <div className="mb-3">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <span className="text-xs font-semibold text-gray-600">
                                {tab === 'noMessages' ? 'Status' : 'Conversation History Passed to LLM'}
                              </span>
                              {tab !== 'noMessages' && (
                                <span className="text-[10px] text-gray-400">
                                  ({item.llmLog.historyPassedToLLM.length} chars)
                                </span>
                              )}
                            </div>
                            <pre className="p-3 bg-gray-900 text-gray-100 rounded-lg text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto font-mono">
                              {item.llmLog.historyPassedToLLM}
                            </pre>
                          </div>

                          {tab !== 'noMessages' && (
                            <div className="space-y-3">
                              {/* Requirements Judge Response */}
                              <div>
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <span className="text-xs font-semibold text-gray-600">Requirements Judge Response</span>
                                </div>
                                {item.llmLog.llmRawResponse ? (
                                  <div className={`p-3 rounded-lg text-sm font-mono font-bold ${
                                    item.llmLog.llmRawResponse.trim().toLowerCase() === 'true'
                                      ? 'bg-green-100 text-green-800 border border-green-200'
                                      : 'bg-orange-100 text-orange-800 border border-orange-200'
                                  }`}>
                                    {item.llmLog.llmRawResponse}
                                  </div>
                                ) : item.llmLog.error ? (
                                  <div className="p-3 rounded-lg text-sm font-mono bg-red-50 text-red-700 border border-red-200 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    {item.llmLog.error}
                                  </div>
                                ) : (
                                  <div className="p-3 rounded-lg text-sm text-gray-400 bg-gray-100">No response</div>
                                )}
                              </div>

                              {/* Loop Detection Judge Response */}
                              {item.loopLlmLog && (
                                <div>
                                  <div className="flex items-center gap-1.5 mb-1.5">
                                    <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
                                    <span className="text-xs font-semibold text-gray-600">Loop Detection Response</span>
                                  </div>
                                  {item.loopLlmLog.llmRawResponse ? (
                                    <div className={`p-3 rounded-lg text-sm font-mono font-bold ${
                                      item.loopLlmLog.llmRawResponse.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '').trim().toLowerCase() === 'true'
                                        ? 'bg-red-100 text-red-800 border border-red-200'
                                        : 'bg-green-100 text-green-800 border border-green-200'
                                    }`}>
                                      {item.loopLlmLog.llmRawResponse}
                                    </div>
                                  ) : item.loopLlmLog.error ? (
                                    <div className="p-3 rounded-lg text-sm font-mono bg-red-50 text-red-700 border border-red-200 flex items-center gap-2">
                                      <AlertCircle className="w-4 h-4 shrink-0" />
                                      {item.loopLlmLog.error}
                                    </div>
                                  ) : (
                                    <div className="p-3 rounded-lg text-sm text-gray-400 bg-gray-100">No response</div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
