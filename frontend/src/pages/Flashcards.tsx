import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { showToast } from '../components/Toast'
import { Skeleton } from '../components/Skeleton'
import { CATEGORY_LABELS, LEVEL_LABELS } from '../lib/libraryConstants'

interface Deck {
  id: string; title: string; description?: string
  category: string; level: string; isPublic: boolean
  createdById: string; createdAt: string
  createdBy: { name: string }
  _count: { cards: number }
  dueCount: number
}

type Filter = 'ALL' | 'MINE' | 'DUE'

function DeckCard({ deck, onDelete }: { deck: Deck; onDelete: () => void }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isOwner = (user as unknown as { id: string })?.id === deck.createdById
  const canManage = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'LECTURER'].includes(user?.role ?? '')

  return (
    <div className="bg-white rounded-2xl p-5 transition-all hover:shadow-lg hover:-translate-y-0.5 relative group"
      style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-black text-base leading-tight flex-1" style={{ color: '#1B4332' }}>
          {deck.title}
        </h3>
        {(isOwner || canManage) && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button onClick={() => navigate(`/flashcards/${deck.id}/edit`)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-purple-500 hover:bg-purple-50 border-0 bg-transparent cursor-pointer text-sm">
              ✏️
            </button>
            <button onClick={onDelete}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 border-0 bg-transparent cursor-pointer text-sm">
              🗑️
            </button>
          </div>
        )}
      </div>

      {deck.description && (
        <p className="text-xs mb-3 line-clamp-2" style={{ color: '#8A9BB0' }}>{deck.description}</p>
      )}

      <div className="flex flex-wrap gap-1.5 mb-4">
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#E3EFE7', color: '#122400' }}>
          {LEVEL_LABELS[deck.level] ?? deck.level}
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#F5F7FA', color: '#8A9BB0' }}>
          {CATEGORY_LABELS[deck.category] ?? deck.category}
        </span>
        {!deck.isPublic && (
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#FEF3C7', color: '#B45309' }}>
            🔒 Private
          </span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs" style={{ color: '#8A9BB0' }}>
          {deck._count.cards} cards
          {deck.dueCount > 0 && (
            <span className="ml-2 font-bold" style={{ color: '#E67E22' }}>
              · {deck.dueCount} due
            </span>
          )}
        </div>
        <button onClick={() => navigate(`/flashcards/${deck.id}/study`)}
          className="px-4 py-2 rounded-xl text-xs font-bold text-white border-0 cursor-pointer transition-colors"
          style={{
            background: deck.dueCount > 0
              ? 'linear-gradient(135deg,#E67E22,#f39c12)'
              : 'linear-gradient(135deg,#2D6A4F,#122400)',
          }}>
          {deck.dueCount > 0 ? `Study (${deck.dueCount})` : 'Study'}
        </button>
      </div>

      <div className="mt-2 text-[10px]" style={{ color: '#8A9BB0' }}>by {deck.createdBy.name}</div>
    </div>
  )
}

export default function Flashcards() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const canManage = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'LECTURER'].includes(user?.role ?? '')
  const [decks, setDecks] = useState<Deck[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState<Filter>('ALL')
  const [search, setSearch] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<Deck | null>(null)

  const load = async () => {
    try {
      const r = await api.get<Deck[]>('/api/decks')
      setDecks(r.data)
    } catch { setError(true) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const handleDelete = async (deck: Deck) => {
    try {
      await api.delete(`/api/decks/${deck.id}`)
      setDecks(prev => prev.filter(d => d.id !== deck.id))
      showToast('Deck deleted', 'success')
    } catch { showToast('Failed to delete deck', 'error') }
    finally { setDeleteConfirm(null) }
  }

  const filtered = useMemo(() => {
    return decks.filter(d => {
      if (filter === 'MINE' && !d.isPublic) return true
      if (filter === 'DUE' && d.dueCount === 0) return false
      const q = search.toLowerCase()
      return !q || d.title.toLowerCase().includes(q) ||
        (CATEGORY_LABELS[d.category] ?? d.category).toLowerCase().includes(q)
    })
  }, [decks, filter, search])

  const Header = (
    <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 lg:px-8 py-4"
      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="font-black text-xl lg:text-2xl" style={{ color: '#1B4332' }}>Flashcards</h1>
            <p className="text-xs" style={{ color: '#8A9BB0' }}>{decks.length} decks available</p>
          </div>
          {canManage && (
            <button onClick={() => navigate('/flashcards/new')}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-sm font-bold border-0 cursor-pointer"
              style={{ background: 'linear-gradient(135deg,#2D6A4F,#122400)' }}>
              + Create Deck
            </button>
          )}
        </div>
        <div className="relative mb-3">
          <span className="absolute left-3 top-1/2 -translate-y-1/2">🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search decks…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: '#F5F7FA', border: '1.5px solid #E8EDF2', color: '#1B4332' }} />
        </div>
        <div className="flex gap-2">
          {(['ALL', 'MINE', 'DUE'] as Filter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-full text-xs font-bold border-0 cursor-pointer"
              style={{
                background: filter === f ? '#122400' : '#F5F7FA',
                color: filter === f ? '#fff' : '#8A9BB0',
              }}>
              {f === 'ALL' ? 'All Decks' : f === 'MINE' ? 'My Decks' : '🔥 Due Today'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  const Grid = (
    <div className="px-4 lg:px-8 py-6 max-w-5xl mx-auto">
      {loading && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[0,1,2,3,4,5].map(i => <div key={i} className="bg-white rounded-2xl h-44 animate-pulse" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }} />)}
        </div>
      )}
      {!loading && error && (
        <div className="text-center py-20">
          <p className="text-5xl mb-4">⚠️</p>
          <p className="font-black text-xl mb-4" style={{ color: '#1B4332' }}>Failed to load decks</p>
          <button onClick={load} className="px-6 py-3 rounded-xl text-white font-bold border-0 cursor-pointer"
            style={{ background: '#122400' }}>Retry</button>
        </div>
      )}
      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-20">
          <p className="text-5xl mb-4">🃏</p>
          <p className="font-black text-xl mb-2" style={{ color: '#1B4332' }}>
            {search ? 'No decks found' : 'No flashcard decks yet'}
          </p>
          <p className="text-sm mb-6" style={{ color: '#8A9BB0' }}>
            {search
              ? 'Try a different search term'
              : canManage
                ? 'Create your first study deck to get started.'
                : 'Decks will appear here once your lecturers create them.'}
          </p>
          {canManage && (
            <button onClick={() => navigate('/flashcards/new')}
              className="px-6 py-3 rounded-xl text-white font-bold text-sm border-0 cursor-pointer"
              style={{ background: 'linear-gradient(135deg,#2D6A4F,#122400)' }}>
              + Create First Deck
            </button>
          )}
        </div>
      )}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(d => (
            <DeckCard key={d.id} deck={d} onDelete={() => setDeleteConfirm(d)} />
          ))}
        </div>
      )}
    </div>
  )

  return (
    <>
      <div className="lg:hidden h-full flex flex-col overflow-hidden" style={{ background: '#F5F7FA' }}>
        {Header}
        <div className="flex-1 overflow-y-auto pb-20">{Grid}</div>
      </div>
      <div className="hidden lg:flex flex-col min-h-screen" style={{ background: '#F5F7FA' }}>
        {Header}
        {Grid}
      </div>

      {deleteConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm"
            style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <p className="font-black text-lg mb-2" style={{ color: '#1B4332' }}>Delete Deck?</p>
            <p className="text-sm mb-5" style={{ color: '#8A9BB0' }}>
              "{deleteConfirm.title}" and all its cards will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-3 rounded-xl text-sm font-semibold border-0 cursor-pointer" style={{ background: '#F5F7FA', color: '#8A9BB0' }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 py-3 rounded-xl text-sm font-bold text-white border-0 cursor-pointer" style={{ background: '#E74C3C' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
