import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import api from '../api/client'
import { showToast } from '../components/Toast'

interface StudyCard {
  id: string; front: string; back: string
  predictions: { again: string; hard: string; good: string; easy: string }
}

interface StudySession {
  deckTitle: string; totalDue: number; totalCards: number; cards: StudyCard[]
}

const RATING_BUTTONS = [
  { label: 'Again', quality: 1, color: '#E74C3C', bg: '#FEE2E2', key: 'again' as const },
  { label: 'Hard',  quality: 3, color: '#E67E22', bg: '#FEF3C7', key: 'hard' as const },
  { label: 'Good',  quality: 4, color: '#2E86DE', bg: '#DBEAFE', key: 'good' as const },
  { label: 'Easy',  quality: 5, color: '#27AE60', bg: '#DCFCE7', key: 'easy' as const },
]

export default function FlashcardsStudy() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [session, setSession] = useState<StudySession | null>(null)
  const [loading, setLoading] = useState(true)
  const [cardIndex, setCardIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [rating, setRating] = useState(false)
  const [reviewed, setReviewed] = useState(0)
  const [done, setDone] = useState(false)
  const [sessionStats, setSessionStats] = useState({ again: 0, hard: 0, good: 0, easy: 0 })

  useEffect(() => {
    if (!id) return
    api.get<StudySession>(`/api/decks/${id}/study`)
      .then(r => {
        setSession(r.data)
        setLoading(false)
        if (r.data.cards.length === 0) setDone(true)
      })
      .catch(() => { showToast('Failed to load study session', 'error'); setLoading(false) })
  }, [id])

  const currentCard = session?.cards[cardIndex]

  const handleRate = async (quality: number, ratingKey: keyof typeof sessionStats) => {
    if (!currentCard || rating) return
    setRating(true)
    try {
      await api.post(`/api/cards/${currentCard.id}/review`, { quality })
      setSessionStats(prev => ({ ...prev, [ratingKey]: prev[ratingKey] + 1 }))
      setReviewed(r => r + 1)
      const next = cardIndex + 1
      if (next >= (session?.cards.length ?? 0)) {
        setDone(true)
      } else {
        setCardIndex(next)
        setRevealed(false)
      }
    } catch { showToast('Failed to save review', 'error') }
    finally { setRating(false) }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: 'linear-gradient(160deg,#1B4332,#122400)' }}>
        <div className="text-center text-white">
          <div className="text-4xl mb-4 animate-pulse">🃏</div>
          <p className="font-bold">Loading cards…</p>
        </div>
      </div>
    )
  }

  // ── Done screen ───────────────────────────────────────────
  if (done) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6 text-center"
        style={{ background: 'linear-gradient(160deg,#1B4332,#122400)' }}>
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="font-black text-2xl text-white mb-2">Session Complete!</h2>
        <p className="text-base mb-6" style={{ color: 'rgba(255,255,255,0.7)' }}>
          {session?.deckTitle}
        </p>
        <div className="bg-white/10 rounded-2xl p-5 w-full max-w-xs mb-8">
          <p className="text-sm font-bold text-white mb-3">Session Summary</p>
          {RATING_BUTTONS.map(b => (
            <div key={b.key} className="flex justify-between text-sm mb-1">
              <span style={{ color: 'rgba(255,255,255,0.7)' }}>{b.label}</span>
              <span className="font-bold text-white">{sessionStats[b.key]}</span>
            </div>
          ))}
          <div className="border-t border-white/20 pt-2 mt-2 flex justify-between text-sm">
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>Total</span>
            <span className="font-bold text-white">{reviewed}</span>
          </div>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button onClick={() => navigate(`/flashcards/${id}/study`)}
            className="w-full py-4 rounded-2xl font-bold text-white border-0 cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)' }}>
            Study Again
          </button>
          <button onClick={() => navigate('/flashcards')}
            className="w-full py-4 rounded-2xl font-bold text-white border-0 cursor-pointer"
            style={{ background: 'linear-gradient(135deg,#2D6A4F,#122400)' }}>
            Back to Flashcards
          </button>
        </div>
      </div>
    )
  }

  if (!currentCard || !session) return null

  const progress = session.cards.length > 0
    ? Math.round((cardIndex / session.cards.length) * 100)
    : 0

  return (
    <div className="h-full flex flex-col" style={{ background: '#F5F7FA' }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 bg-white border-b border-gray-100 flex-shrink-0"
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <button onClick={() => navigate(`/flashcards/${id}/edit`)}
          className="text-gray-400 hover:text-gray-600 border-0 bg-transparent cursor-pointer text-xl">←</button>
        <div className="flex-1">
          <p className="font-bold text-sm truncate" style={{ color: '#1B4332' }}>{session.deckTitle}</p>
          <p className="text-xs" style={{ color: '#8A9BB0' }}>{cardIndex + 1} / {session.cards.length}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 flex-shrink-0" style={{ background: '#E8EDF2' }}>
        <div className="h-full transition-all duration-300" style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#2D6A4F,#122400)' }} />
      </div>

      {/* Card */}
      <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col items-center justify-start lg:justify-center lg:max-w-2xl lg:mx-auto lg:w-full">
        <div
          onClick={() => !revealed && setRevealed(true)}
          className="w-full bg-white rounded-3xl p-7 cursor-pointer transition-all hover:shadow-lg mb-4"
          style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.08)', minHeight: 200 }}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold px-3 py-1 rounded-full"
              style={{ background: revealed ? '#E3EFE7' : '#F5F7FA', color: revealed ? '#122400' : '#8A9BB0' }}>
              {revealed ? 'Answer' : 'Question'}
            </span>
            {!revealed && <span className="text-xs" style={{ color: '#8A9BB0' }}>Tap to reveal</span>}
          </div>

          <div className="prose prose-sm max-w-none" style={{ color: '#1B4332' }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {revealed ? currentCard.back : currentCard.front}
            </ReactMarkdown>
          </div>
        </div>

        {!revealed ? (
          <button
            onClick={() => setRevealed(true)}
            className="w-full py-4 rounded-2xl font-bold text-white border-0 cursor-pointer"
            style={{ background: 'linear-gradient(135deg,#2D6A4F,#122400)', boxShadow: '0 8px 24px rgba(27,67,50,0.3)' }}>
            Show Answer
          </button>
        ) : (
          <div className="w-full space-y-3">
            <p className="text-xs text-center font-semibold mb-2" style={{ color: '#8A9BB0' }}>
              How well did you know this?
            </p>
            <div className="grid grid-cols-2 gap-3">
              {RATING_BUTTONS.map(b => (
                <button key={b.key}
                  onClick={() => handleRate(b.quality, b.key)}
                  disabled={rating}
                  className="py-4 rounded-2xl font-bold text-sm border-0 cursor-pointer disabled:opacity-50 transition-transform active:scale-95"
                  style={{ background: b.bg, color: b.color }}>
                  <div className="font-black text-base">{b.label}</div>
                  <div className="text-xs font-medium mt-0.5 opacity-70">
                    {currentCard.predictions[b.key]}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
