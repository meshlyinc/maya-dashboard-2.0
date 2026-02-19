'use client'

import { useEffect, useState } from 'react'
import { X, UserCheck, ExternalLink, Bot, MessageSquare, Clock, Award, Calendar, Briefcase, CreditCard } from 'lucide-react'
import { format } from 'date-fns'

const STATUS_COLORS: Record<string, string> = {
  connected: 'bg-green-100 text-green-700 border-green-300',
  candidate_interested: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  negotiating: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  outreach_sent: 'bg-blue-100 text-blue-700 border-blue-300',
  identified: 'bg-gray-100 text-gray-600 border-gray-300',
  candidate_declined: 'bg-red-100 text-red-700 border-red-300',
  passed: 'bg-gray-100 text-gray-500 border-gray-300',
}

const STATUS_LABELS: Record<string, string> = {
  connected: 'Connected',
  candidate_interested: 'Interested',
  negotiating: 'Negotiating',
  outreach_sent: 'Outreach Sent',
  identified: 'Identified',
  candidate_declined: 'Declined',
  passed: 'Passed',
}

interface CardItem {
  messageId: string
  createdAt: string
  matchId: string | null
  candidateUserId: string | null
  matchStatus: string | null
  cardData: {
    candidateName?: string
    candidateSummary?: string
    skills?: string[]
    quotation?: string
    availability?: string
    experienceYears?: number | null
    estTime?: string | null
    gigTitle?: string
    mayasNote?: string
    candidateNote?: string
    workLinks?: string[]
    whatsappUrl?: string
    matchId?: string
  }
}

interface PostingCardsModalProps {
  gigId: string
  onClose: () => void
  onSelectUser?: (userId: string) => void
  onSelectConversation?: (matchId: string) => void
}

export default function PostingCardsModal({ gigId, onClose, onSelectUser, onSelectConversation }: PostingCardsModalProps) {
  const [cards, setCards] = useState<CardItem[]>([])
  const [gigTitle, setGigTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    fetchCards()
  }, [gigId])

  const fetchCards = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/postings/${gigId}/cards`)
      const data = await res.json()
      setCards(data.cards || [])
      setGigTitle(data.gigTitle || '')
      setStatusCounts(data.statusCounts || {})
    } catch (err) {
      console.error('Failed to fetch cards:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-3 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-orange-500" />
              <h2 className="text-xl font-semibold text-gray-900">Cards Sent</h2>
            </div>
            {gigTitle && (
              <p className="text-sm text-gray-500 mt-1">{gigTitle}</p>
            )}
            {cards.length > 0 && (
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-gray-400">{cards.length} cards sent</span>
                {Object.entries(statusCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([status, count]) => (
                    <span
                      key={status}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-600 border-gray-300'}`}
                    >
                      {count} {STATUS_LABELS[status] || status.replace(/_/g, ' ')}
                    </span>
                  ))}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading cards...</div>
          ) : cards.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No cards found</div>
          ) : (
            <div className="space-y-4">
              {cards.map((card) => {
                const d = card.cardData
                return (
                  <div key={card.messageId} className="border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white rounded-xl p-4 shadow-sm">
                    {/* Header: candidate name + quotation */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <UserCheck className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900">{d.candidateName || 'Candidate'}</h4>
                          {d.candidateSummary && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{d.candidateSummary}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {card.matchStatus && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_COLORS[card.matchStatus] || 'bg-gray-100 text-gray-600 border-gray-300'}`}>
                            {STATUS_LABELS[card.matchStatus] || card.matchStatus.replace(/_/g, ' ')}
                          </span>
                        )}
                        {d.quotation && (
                          <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-semibold">
                            {d.quotation}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Skills */}
                    {d.skills && d.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {d.skills.map((skill, i) => (
                          <span key={i} className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md text-xs font-medium">
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Info grid */}
                    <div className="flex flex-wrap items-center gap-4 mb-3 text-xs text-gray-600">
                      {d.experienceYears != null && (
                        <span className="flex items-center gap-1">
                          <Award className="w-3.5 h-3.5 text-gray-400" />
                          {d.experienceYears} yrs exp
                        </span>
                      )}
                      {d.availability && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <span className="capitalize">{d.availability.replace(/_/g, ' ')}</span>
                        </span>
                      )}
                      {d.estTime && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          {d.estTime}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-gray-400">
                        <Briefcase className="w-3.5 h-3.5" />
                        {format(new Date(card.createdAt), 'MMM d, yyyy h:mm a')}
                      </span>
                    </div>

                    {/* Maya's note */}
                    {d.mayasNote && (
                      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Bot className="w-3.5 h-3.5 text-blue-500" />
                          <span className="text-xs font-medium text-blue-700">Maya&apos;s Note</span>
                        </div>
                        <p className="text-xs text-gray-700 leading-relaxed">{d.mayasNote}</p>
                      </div>
                    )}

                    {/* Portfolio links */}
                    {d.workLinks && d.workLinks.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        {d.workLinks.map((link, i) => (
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
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 pt-3 border-t border-indigo-100">
                      {card.candidateUserId && onSelectUser && (
                        <button
                          onClick={() => onSelectUser(card.candidateUserId!)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          View Profile
                        </button>
                      )}
                      {card.matchId && onSelectConversation && (
                        <button
                          onClick={() => onSelectConversation(card.matchId!)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          View Reachout
                        </button>
                      )}
                      {d.whatsappUrl && (
                        <a
                          href={d.whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          WhatsApp
                        </a>
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
