import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../api/client'
import { showToast } from '../components/Toast'
import { Skeleton } from '../components/Skeleton'

interface Card { id: string; front: string; back: string; sortOrder: number }
interface DeckDetail {
  id: string; title: string; description?: string
  category: string; level: string; isPublic: boolean
  cards: Card[]
  createdById: string
}

function CardRow({ card, onEdit, onDelete, onMoveUp, onMoveDown, isFirst, isLast }: {
  card: Card; onEdit: () => void; onDelete: () => void
  onMoveUp: () => void; onMoveDown: () => void
  isFirst: boolean; isLast: boolean
}) {
  return (
    <div className="bg-white rounded-2xl p-4 flex items-start gap-3"
      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
      <div className="flex flex-col gap-1 flex-shrink-0 mt-1">
        <button onClick={onMoveUp} disabled={isFirst}
          className="w-6 h-6 rounded flex items-center justify-center text-xs text-gray-300 hover:text-purple-500 border-0 bg-transparent cursor-pointer disabled:opacity-30">↑</button>
        <button onClick={onMoveDown} disabled={isLast}
          className="w-6 h-6 rounded flex items-center justify-center text-xs text-gray-300 hover:text-purple-500 border-0 bg-transparent cursor-pointer disabled:opacity-30">↓</button>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold mb-1 truncate" style={{ color: '#1B4332' }}>{card.front}</p>
        <p className="text-xs line-clamp-2" style={{ color: '#8A9BB0' }}>{card.back}</p>
      </div>
      <div className="flex gap-1 flex-shrink-0">
        <button onClick={onEdit} className="w-7 h-7 rounded-lg text-gray-300 hover:text-purple-500 hover:bg-purple-50 text-sm border-0 bg-transparent cursor-pointer">✏️</button>
        <button onClick={onDelete} className="w-7 h-7 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 text-sm border-0 bg-transparent cursor-pointer">🗑️</button>
      </div>
    </div>
  )
}

export default function FlashcardsEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [deck, setDeck] = useState<DeckDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [cards, setCards] = useState<Card[]>([])
  const [addFront, setAddFront] = useState('')
  const [addBack, setAddBack] = useState('')
  const [adding, setAdding] = useState(false)
  const [editCard, setEditCard] = useState<Card | null>(null)
  const [editFront, setEditFront] = useState('')
  const [editBack, setEditBack] = useState('')
  const [bulkText, setBulkText] = useState('')
  const [showBulk, setShowBulk] = useState(false)
  const [importParsed, setImportParsed] = useState<Array<{ front: string; back: string }>>([])
  const { user } = useAuth()
  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'SCHOOL_ADMIN' || user?.role === 'LECTURER'

  useEffect(() => {
    if (user && !canManage) {
      navigate('/flashcards')
    }
  }, [user, canManage, navigate])
  useEffect(() => {
    if (!id) return
    api.get<DeckDetail>(`/api/decks/${id}`)
      .then(r => { setDeck(r.data); setCards(r.data.cards) })
      .catch(() => showToast('Failed to load deck', 'error'))
      .finally(() => setLoading(false))
  }, [id])

  const handleAddCard = async () => {
    if (!addFront.trim() || !addBack.trim() || !id) return
    setAdding(true)
    try {
      const r = await api.post<Card>(`/api/decks/${id}/cards`, {
        front: addFront.trim(), back: addBack.trim(),
      })
      setCards(prev => [...prev, r.data])
      setAddFront(''); setAddBack('')
      showToast('Card added', 'success')
    } catch { showToast('Failed to add card', 'error') }
    finally { setAdding(false) }
  }

  const handleEditCard = async () => {
    if (!editCard || !editFront.trim() || !editBack.trim()) return
    try {
      await api.patch(`/api/cards/${editCard.id}`, { front: editFront.trim(), back: editBack.trim() })
      setCards(prev => prev.map(c => c.id === editCard.id ? { ...c, front: editFront, back: editBack } : c))
      setEditCard(null)
      showToast('Card updated', 'success')
    } catch { showToast('Failed to update', 'error') }
  }

  const handleDeleteCard = async (cardId: string) => {
    try {
      await api.delete(`/api/cards/${cardId}`)
      setCards(prev => prev.filter(c => c.id !== cardId))
      showToast('Card deleted', 'success')
    } catch { showToast('Failed to delete', 'error') }
  }

  const handleMoveCard = async (index: number, dir: -1 | 1) => {
    const newCards = [...cards]
    const target = index + dir
    if (target < 0 || target >= newCards.length) return
    ;[newCards[index], newCards[target]] = [newCards[target], newCards[index]]
    const reordered = newCards.map((c, i) => ({ ...c, sortOrder: i }))
    setCards(reordered)
    // Persist new order
    try {
      await Promise.all(
        reordered.map(c => api.patch(`/api/cards/${c.id}`, { sortOrder: c.sortOrder }))
      )
    } catch { showToast('Failed to save order', 'error') }
  }

  const parseBulk = (text: string) => {
    const parsed = text.split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .map(l => {
        const parts = l.split('\t')
        if (parts.length >= 2) return { front: parts[0].trim(), back: parts.slice(1).join('\t').trim() }
        const csv = l.split(',')
        if (csv.length >= 2) return { front: csv[0].trim(), back: csv.slice(1).join(',').trim() }
        return null
      })
      .filter((p): p is { front: string; back: string } => !!p && !!p.front && !!p.back)
    setImportParsed(parsed)
  }

  const handleBulkImport = async () => {
    if (!id || importParsed.length === 0) return
    try {
      const r = await api.post<{ created: number }>(`/api/decks/${id}/cards/bulk`, { cards: importParsed })
      showToast(`Imported ${r.data.created} cards`, 'success')
      // Reload cards
      const deck2 = await api.get<DeckDetail>(`/api/decks/${id}`)
      setCards(deck2.data.cards)
      setBulkText(''); setImportParsed([]); setShowBulk(false)
    } catch { showToast('Import failed', 'error') }
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8" style={{ background: '#F5F7FA' }}>
        <Skeleton className="h-8 w-48 mb-6" />
        {[0,1,2,3].map(i => <div key={i} className="bg-white rounded-2xl h-20 mb-3 animate-pulse" />)}
      </div>
    )
  }

  return (
    <>
      <div className="lg:hidden h-full overflow-y-auto pb-8" style={{ background: '#F5F7FA' }}>
        <div style={{ background: 'linear-gradient(135deg,#1B4332,#122400)', padding: '52px 24px 24px', borderRadius: '0 0 28px 28px' }}>
          <button onClick={() => navigate('/flashcards')} className="border-0 bg-transparent cursor-pointer mb-3 text-sm font-medium" style={{ color: 'rgba(255,255,255,0.7)', padding: 0 }}>← Flashcards</button>
          <h1 className="font-black text-2xl text-white">{deck?.title ?? 'Edit Deck'}</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.65)' }}>{cards.length} cards</p>
        </div>
        <div className="px-6 pt-6"><EditorBody cards={cards} addFront={addFront} setAddFront={setAddFront} addBack={addBack} setAddBack={setAddBack} adding={adding} onAddCard={handleAddCard} onEdit={(c) => { setEditCard(c); setEditFront(c.front); setEditBack(c.back) }} onDelete={handleDeleteCard} onMove={handleMoveCard} showBulk={showBulk} setShowBulk={setShowBulk} bulkText={bulkText} setBulkText={text => { setBulkText(text); parseBulk(text) }} importParsed={importParsed} onBulkImport={handleBulkImport} deckId={id!} navigate={navigate} /></div>
      </div>
      <div className="hidden lg:block min-h-screen" style={{ background: '#F5F7FA' }}>
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-8 py-4" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate('/flashcards')} className="text-sm font-medium border-0 bg-transparent cursor-pointer" style={{ color: '#8A9BB0' }}>← Flashcards</button>
              <div className="h-4 w-px bg-gray-200" />
              <h1 className="font-black text-xl" style={{ color: '#1B4332' }}>{deck?.title ?? 'Edit Deck'}</h1>
            </div>
            <div className="flex gap-3">
              <button onClick={() => navigate(`/flashcards/${id}/study`)} className="px-4 py-2 rounded-xl text-sm font-bold text-white border-0 cursor-pointer" style={{ background: 'linear-gradient(135deg,#2D6A4F,#122400)' }}>
                Study Deck →
              </button>
            </div>
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-8 py-8"><EditorBody cards={cards} addFront={addFront} setAddFront={setAddFront} addBack={addBack} setAddBack={setAddBack} adding={adding} onAddCard={handleAddCard} onEdit={(c) => { setEditCard(c); setEditFront(c.front); setEditBack(c.back) }} onDelete={handleDeleteCard} onMove={handleMoveCard} showBulk={showBulk} setShowBulk={setShowBulk} bulkText={bulkText} setBulkText={text => { setBulkText(text); parseBulk(text) }} importParsed={importParsed} onBulkImport={handleBulkImport} deckId={id!} navigate={navigate} /></div>
      </div>

      {/* Edit card modal */}
      {editCard && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setEditCard(null)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-md" style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <h3 className="font-black text-lg mb-4" style={{ color: '#1B4332' }}>Edit Card</h3>
            <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: '#8A9BB0' }}>Front</label>
            <textarea value={editFront} onChange={e => setEditFront(e.target.value)} rows={3} className="w-full mb-4 px-4 py-3 rounded-xl border text-sm outline-none resize-none" style={{ border: '1.5px solid #E8EDF2', background: '#F5F7FA' }} />
            <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: '#8A9BB0' }}>Back</label>
            <textarea value={editBack} onChange={e => setEditBack(e.target.value)} rows={3} className="w-full mb-5 px-4 py-3 rounded-xl border text-sm outline-none resize-none" style={{ border: '1.5px solid #E8EDF2', background: '#F5F7FA' }} />
            <div className="flex gap-3">
              <button onClick={() => setEditCard(null)} className="flex-1 py-3 rounded-xl text-sm font-semibold border-0 cursor-pointer" style={{ background: '#F5F7FA', color: '#8A9BB0' }}>Cancel</button>
              <button onClick={handleEditCard} className="flex-1 py-3 rounded-xl text-sm font-bold text-white border-0 cursor-pointer" style={{ background: 'linear-gradient(135deg,#2D6A4F,#122400)' }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Editor body extracted to avoid duplication
function EditorBody({ cards, addFront, setAddFront, addBack, setAddBack, adding, onAddCard, onEdit, onDelete, onMove, showBulk, setShowBulk, bulkText, setBulkText, importParsed, onBulkImport, deckId, navigate }: {
  cards: Card[]; addFront: string; setAddFront: (v: string) => void
  addBack: string; setAddBack: (v: string) => void
  adding: boolean; onAddCard: () => void
  onEdit: (c: Card) => void; onDelete: (id: string) => void
  onMove: (i: number, d: -1 | 1) => void
  showBulk: boolean; setShowBulk: (v: boolean) => void
  bulkText: string; setBulkText: (v: string) => void
  importParsed: Array<{ front: string; back: string }>
  onBulkImport: () => void
  deckId: string; navigate: ReturnType<typeof useNavigate>
}) {
  return (
    <div className="space-y-5">
      {/* Add card form */}
      <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <h3 className="font-bold text-sm mb-3" style={{ color: '#1B4332' }}>+ Add Card</h3>
        <label className="block mb-1 text-xs font-bold uppercase tracking-wide" style={{ color: '#8A9BB0' }}>Front (Question/Term)</label>
        <textarea value={addFront} onChange={e => setAddFront(e.target.value)} rows={2} placeholder="e.g. What is the mechanism of action of penicillin?" className="w-full mb-3 px-4 py-3 rounded-xl border text-sm outline-none resize-none" style={{ border: '1.5px solid #E8EDF2', background: '#F5F7FA', color: '#1B4332' }} />
        <label className="block mb-1 text-xs font-bold uppercase tracking-wide" style={{ color: '#8A9BB0' }}>Back (Answer/Definition)</label>
        <textarea value={addBack} onChange={e => setAddBack(e.target.value)} rows={3} placeholder="e.g. Inhibits bacterial cell wall synthesis by binding to PBPs…" className="w-full mb-4 px-4 py-3 rounded-xl border text-sm outline-none resize-none" style={{ border: '1.5px solid #E8EDF2', background: '#F5F7FA', color: '#1B4332' }} />
        <button onClick={onAddCard} disabled={adding || !addFront.trim() || !addBack.trim()}
          className="w-full py-3 rounded-xl text-sm font-bold text-white border-0 cursor-pointer disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg,#2D6A4F,#122400)' }}>
          {adding ? 'Adding…' : '+ Add Card'}
        </button>
      </div>

      {/* Bulk import */}
      <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <button onClick={() => setShowBulk(!showBulk)} className="w-full px-5 py-4 text-left flex items-center justify-between border-0 bg-transparent cursor-pointer">
          <span className="text-sm font-bold" style={{ color: '#1B4332' }}>📋 Bulk Import</span>
          <span className="text-gray-400 text-sm">{showBulk ? '▲' : '▼'}</span>
        </button>
        {showBulk && (
          <div className="px-5 pb-5">
            <p className="text-xs mb-3" style={{ color: '#8A9BB0' }}>
              Paste lines as <code className="bg-gray-100 px-1 rounded">front{'\t'}back</code> (tab-separated) or <code className="bg-gray-100 px-1 rounded">front,back</code> (CSV). One card per line.
            </p>
            <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} rows={5}
              placeholder={'Anatomy\tStudy of body structures\nPhysiology\tStudy of body functions'}
              className="w-full mb-2 px-4 py-3 rounded-xl border text-sm outline-none resize-none font-mono"
              style={{ border: '1.5px solid #E8EDF2', background: '#F5F7FA', color: '#1B4332' }} />
            {importParsed.length > 0 && (
              <p className="text-xs mb-3 font-medium" style={{ color: '#27AE60' }}>
                ✓ {importParsed.length} cards ready to import
              </p>
            )}
            <button onClick={onBulkImport} disabled={importParsed.length === 0}
              className="w-full py-3 rounded-xl text-sm font-bold text-white border-0 cursor-pointer disabled:opacity-50"
              style={{ background: '#27AE60' }}>
              Import {importParsed.length > 0 ? `${importParsed.length} Cards` : 'Cards'}
            </button>
          </div>
        )}
      </div>

      {/* Card list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm" style={{ color: '#1B4332' }}>{cards.length} Cards</h3>
          {cards.length > 0 && (
            <button onClick={() => navigate(`/flashcards/${deckId}/study`)}
              className="text-xs font-bold px-3 py-1.5 rounded-full border-0 cursor-pointer"
              style={{ background: '#E3EFE7', color: '#122400' }}>
              Study →
            </button>
          )}
        </div>
        {cards.length === 0 && (
          <div className="text-center py-10 bg-white rounded-2xl" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <p className="text-3xl mb-2">🃏</p>
            <p className="text-sm" style={{ color: '#8A9BB0' }}>No cards yet — add some above</p>
          </div>
        )}
        <div className="space-y-3">
          {cards.map((card, i) => (
            <CardRow key={card.id} card={card}
              onEdit={() => onEdit(card)}
              onDelete={() => onDelete(card.id)}
              onMoveUp={() => onMove(i, -1)}
              onMoveDown={() => onMove(i, 1)}
              isFirst={i === 0} isLast={i === cards.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
