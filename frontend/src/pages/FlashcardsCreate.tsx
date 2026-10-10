// FlashcardsCreate.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { showToast } from '../components/Toast'
import { CATEGORY_OPTIONS, LEVEL_LABELS, ALL_LEVELS } from '../lib/libraryConstants'

export default function FlashcardsCreate() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('OTHER')
  const [level, setLevel] = useState('ND1')
  const [isPublic, setIsPublic] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!title.trim()) { setError('Title is required'); return }
    setSaving(true); setError('')
    try {
      const r = await api.post<{ id: string }>('/api/decks', {
        title: title.trim(), description: description.trim() || null,
        category, level, isPublic,
      })
      showToast('Deck created!', 'success')
      navigate(`/flashcards/${r.data.id}/edit`)
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to create')
    } finally { setSaving(false) }
  }

  return (
    <>
      <div className="lg:hidden h-full overflow-y-auto pb-8" style={{ background: '#F5F7FA' }}>
        <div style={{ background: 'linear-gradient(135deg,#1B4332,#122400)', padding: '52px 24px 24px', borderRadius: '0 0 28px 28px' }}>
          <button onClick={() => navigate('/flashcards')} className="border-0 bg-transparent cursor-pointer mb-3 text-sm font-medium" style={{ color: 'rgba(255,255,255,0.7)', padding: 0 }}>← Flashcards</button>
          <h1 className="font-black text-2xl text-white">New Deck</h1>
        </div>
        <div className="px-6 pt-6"><DeckForm title={title} setTitle={setTitle} description={description} setDescription={setDescription} category={category} setCategory={setCategory} level={level} setLevel={setLevel} isPublic={isPublic} setIsPublic={setIsPublic} saving={saving} error={error} onSubmit={handleCreate} submitLabel="Create Deck" /></div>
      </div>
      <div className="hidden lg:block min-h-screen" style={{ background: '#F5F7FA' }}>
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-8 py-4" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div className="max-w-2xl mx-auto flex items-center gap-4">
            <button onClick={() => navigate('/flashcards')} className="text-sm font-medium border-0 bg-transparent cursor-pointer" style={{ color: '#8A9BB0' }}>← Flashcards</button>
            <div className="h-4 w-px bg-gray-200" />
            <h1 className="font-black text-xl" style={{ color: '#1B4332' }}>New Deck</h1>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-8 py-8"><DeckForm title={title} setTitle={setTitle} description={description} setDescription={setDescription} category={category} setCategory={setCategory} level={level} setLevel={setLevel} isPublic={isPublic} setIsPublic={setIsPublic} saving={saving} error={error} onSubmit={handleCreate} submitLabel="Create Deck & Add Cards" /></div>
      </div>
    </>
  )
}

// Shared form component
interface DeckFormProps {
  title: string; setTitle: (v: string) => void
  description: string; setDescription: (v: string) => void
  category: string; setCategory: (v: string) => void
  level: string; setLevel: (v: string) => void
  isPublic: boolean; setIsPublic: (v: boolean) => void
  saving: boolean; error: string
  onSubmit: () => void; submitLabel: string
}

export function DeckForm({ title, setTitle, description, setDescription, category, setCategory, level, setLevel, isPublic, setIsPublic, saving, error, onSubmit, submitLabel }: DeckFormProps) {
  return (
    <div className="space-y-5">
      {error && <div className="px-4 py-3 rounded-xl text-sm font-medium" style={{ background: '#FEE2E2', color: '#DC2626' }}>{error}</div>}

      <div>
        <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: '#8A9BB0' }}>Title *</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Pharmacology — Drug Classifications" maxLength={200}
          className="w-full px-4 py-3 rounded-xl border text-sm outline-none" style={{ border: '1.5px solid #E8EDF2', background: '#F5F7FA', color: '#1B4332' }} />
      </div>

      <div>
        <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: '#8A9BB0' }}>Description</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Brief description of what this deck covers…"
          className="w-full px-4 py-3 rounded-xl border text-sm outline-none resize-none" style={{ border: '1.5px solid #E8EDF2', background: '#F5F7FA', color: '#1B4332' }} />
      </div>

      <div>
        <label className="block mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: '#8A9BB0' }}>Level *</label>
        <div className="flex flex-wrap gap-2">
          {ALL_LEVELS.map(l => (
            <button key={l} type="button" onClick={() => setLevel(l)}
              className="px-4 py-2 rounded-full text-sm font-bold border-0 cursor-pointer transition-all"
              style={{ background: level === l ? '#122400' : '#F5F7FA', color: level === l ? '#fff' : '#8A9BB0' }}>
              {LEVEL_LABELS[l]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: '#8A9BB0' }}>Category *</label>
        <select value={category} onChange={e => setCategory(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border text-sm outline-none cursor-pointer"
          style={{ border: '1.5px solid #E8EDF2', background: '#F5F7FA', color: '#1B4332' }}>
          {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="w-4 h-4" style={{ accentColor: '#122400' }} />
        <div>
          <p className="text-sm font-bold" style={{ color: '#1B4332' }}>Public deck</p>
          <p className="text-xs" style={{ color: '#8A9BB0' }}>Other students can find and study this deck</p>
        </div>
      </label>

      <button onClick={onSubmit} disabled={saving || !title.trim()}
        className="w-full py-4 rounded-2xl text-white font-black text-base border-0 cursor-pointer disabled:opacity-50"
        style={{ background: 'linear-gradient(135deg,#2D6A4F,#122400)', boxShadow: '0 8px 28px rgba(27,67,50,0.35)' }}>
        {saving ? 'Creating…' : submitLabel}
      </button>
    </div>
  )
}
