import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { showToast } from '../components/Toast'
import { Skeleton } from '../components/Skeleton'

interface Author { id: string; name: string; role: string }
interface Announcement {
  id: string; title: string; body: string
  target: string; isPinned: boolean
  createdAt: string; updatedAt: string
  createdBy: Author
}

const TARGET_LABELS: Record<string, string> = {
  ALL: 'All Users', STUDENTS: 'All Students', LECTURERS: 'Lecturers',
  ADMINS: 'Admins', ND1: 'ND1', ND2: 'ND2', ND3: 'ND3', HND1: 'HND1', HND2: 'HND2',
}

const TARGET_OPTIONS = Object.entries(TARGET_LABELS).map(([v, l]) => ({ value: v, label: l }))

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function canManage(user: { role: string; id: string } | null, ann: Announcement): boolean {
  if (!user) return false
  return ann.createdBy.id === user.id ||
    user.role === 'SUPER_ADMIN' || user.role === 'SCHOOL_ADMIN'
}

function canPost(role?: string): boolean {
  return ['LECTURER', 'REGISTRAR', 'SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(role ?? '')
}

// ── Announcement card ─────────────────────────────────────────
function AnnCard({
  ann, canEdit, onEdit, onDelete
}: {
  ann: Announcement
  canEdit: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isLong = ann.body.length > 180

  return (
    <div className={`bg-white rounded-2xl p-5 transition-shadow hover:shadow-md ${ann.isPinned ? 'border-l-4' : ''}`}
      style={{
        boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
        borderLeftColor: ann.isPinned ? '#122400' : undefined,
      }}>
      <div className="flex items-start gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {ann.isPinned && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: '#E3EFE7', color: '#122400' }}>📌 Pinned</span>
            )}
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: '#F5F7FA', color: '#8A9BB0' }}>
              {TARGET_LABELS[ann.target] ?? ann.target}
            </span>
          </div>
          <h3 className="font-black text-base leading-tight" style={{ color: '#1B4332' }}>
            {ann.title}
          </h3>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-xs" style={{ color: '#8A9BB0' }}>{relTime(ann.createdAt)}</span>
          {canEdit && (
            <>
              <button onClick={onEdit}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-purple-600 hover:bg-purple-50 border-0 bg-transparent cursor-pointer text-sm">
                ✏️
              </button>
              <button onClick={onDelete}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 border-0 bg-transparent cursor-pointer text-sm">
                🗑️
              </button>
            </>
          )}
        </div>
      </div>

      <p className={`text-sm leading-relaxed ${!expanded && isLong ? 'line-clamp-2' : ''}`}
        style={{ color: '#64748b' }}>
        {ann.body}
      </p>

      {isLong && (
        <button onClick={() => setExpanded(p => !p)}
          className="mt-2 text-xs font-semibold border-0 bg-transparent cursor-pointer"
          style={{ color: '#122400' }}>
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}

      <div className="mt-3 text-xs" style={{ color: '#8A9BB0' }}>
        — {ann.createdBy.name}
      </div>
    </div>
  )
}

// ── Announcement form modal ───────────────────────────────────
function AnnForm({
  initial, onSave, onClose
}: {
  initial?: Announcement
  onSave: (ann: Announcement) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [target, setTarget] = useState(initial?.target ?? 'ALL')
  const [isPinned, setIsPinned] = useState(initial?.isPinned ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!title.trim() || !body.trim()) { setError('Title and body are required'); return }
    if (title.length > 200) { setError('Title must be 200 characters or fewer'); return }
    setSaving(true); setError('')
    try {
      const res = initial
        ? await api.patch<Announcement>(`/api/announcements/${initial.id}`, { title, body, target, isPinned })
        : await api.post<Announcement>('/api/announcements', { title, body, target, isPinned })
      onSave(res.data)
      showToast(initial ? 'Announcement updated' : 'Announcement posted', 'success')
      onClose()
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to save')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end lg:items-center justify-center p-4"
      onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg bg-white rounded-3xl overflow-hidden max-h-[90vh] overflow-y-auto"
        style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1 lg:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>
        <div className="px-6 pt-4 pb-6">
          <h2 className="font-black text-lg mb-5" style={{ color: '#1B4332' }}>
            {initial ? 'Edit Announcement' : 'New Announcement'}
          </h2>
          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: '#FEE2E2', color: '#DC2626' }}>{error}</div>
          )}
          <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: '#8A9BB0' }}>Title *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} maxLength={200}
            className="w-full mb-4 px-4 py-3 rounded-xl border text-sm outline-none"
            style={{ border: '1.5px solid #E8EDF2', background: '#F5F7FA' }} />

          <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: '#8A9BB0' }}>Body *</label>
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={5}
            className="w-full mb-4 px-4 py-3 rounded-xl border text-sm outline-none resize-none"
            style={{ border: '1.5px solid #E8EDF2', background: '#F5F7FA' }} />

          <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: '#8A9BB0' }}>Target Audience</label>
          <select value={target} onChange={e => setTarget(e.target.value)}
            className="w-full mb-4 px-4 py-3 rounded-xl border text-sm outline-none cursor-pointer"
            style={{ border: '1.5px solid #E8EDF2', background: '#F5F7FA', color: '#1B4332' }}>
            {TARGET_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <label className="flex items-center gap-3 mb-6 cursor-pointer">
            <input type="checkbox" checked={isPinned} onChange={e => setIsPinned(e.target.checked)}
              className="w-4 h-4" style={{ accentColor: '#122400' }} />
            <span className="text-sm font-medium" style={{ color: '#1B4332' }}>Pin to top</span>
          </label>

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-semibold border-0 cursor-pointer"
              style={{ background: '#F5F7FA', color: '#8A9BB0' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white border-0 cursor-pointer disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#2D6A4F,#122400)' }}>
              {saving ? 'Saving…' : initial ? 'Save Changes' : 'Post'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────
export default function Announcements() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Announcement | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Announcement | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await api.get<{ items: Announcement[] }>('/api/announcements?limit=50')
      setItems(r.data.items)
    } catch { setError(true) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = (ann: Announcement) => {
    setItems(prev => {
      const idx = prev.findIndex(a => a.id === ann.id)
      if (idx >= 0) { const n = [...prev]; n[idx] = ann; return n }
      return [ann, ...prev]
    })
  }

  const handleDelete = async (ann: Announcement) => {
    try {
      await api.delete(`/api/announcements/${ann.id}`)
      setItems(prev => prev.filter(a => a.id !== ann.id))
      showToast('Announcement deleted', 'success')
    } catch { showToast('Failed to delete', 'error') }
    finally { setDeleteConfirm(null) }
  }

  const pinned = items.filter(a => a.isPinned)
  const rest = items.filter(a => !a.isPinned)

  const Content = (
    <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-5 pb-24 space-y-4 max-w-3xl lg:mx-auto w-full">
      {loading && [0,1,2,3].map(i => (
        <div key={i} className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <Skeleton className="h-4 w-24 mb-3" />
          <Skeleton className="h-5 w-3/4 mb-2" />
          <Skeleton className="h-3 w-full mb-1" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}

      {!loading && error && (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">⚠️</p>
          <p className="font-bold mb-2" style={{ color: '#1B4332' }}>Failed to load announcements</p>
          <button onClick={load} className="text-sm font-medium border-0 bg-transparent cursor-pointer" style={{ color: '#122400' }}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">📢</p>
          <p className="font-black text-xl mb-2" style={{ color: '#1B4332' }}>No announcements yet</p>
          <p className="text-sm mb-6" style={{ color: '#8A9BB0' }}>
            {canPost(user?.role) ? 'Post the first announcement for your students.' : 'Check back later for updates.'}
          </p>
          {canPost(user?.role) && (
            <button onClick={() => setShowForm(true)}
              className="px-6 py-3 rounded-xl text-white font-bold text-sm border-0 cursor-pointer"
              style={{ background: 'linear-gradient(135deg,#2D6A4F,#122400)' }}>
              + Post Announcement
            </button>
          )}
        </div>
      )}

      {pinned.length > 0 && (
        <>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#8A9BB0' }}>Pinned</p>
          {pinned.map(a => (
            <AnnCard key={a.id} ann={a}
              canEdit={canManage(user as { role: string; id: string } | null, a)}
              onEdit={() => { setEditTarget(a); setShowForm(true) }}
              onDelete={() => setDeleteConfirm(a)} />
          ))}
          {rest.length > 0 && <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#8A9BB0' }}>Recent</p>}
        </>
      )}

      {rest.map(a => (
        <AnnCard key={a.id} ann={a}
          canEdit={canManage(user as { role: string; id: string } | null, a)}
          onEdit={() => { setEditTarget(a); setShowForm(true) }}
          onDelete={() => setDeleteConfirm(a)} />
      ))}
    </div>
  )

  const Header = (
    <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 lg:px-8 py-4"
      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')}
            className="lg:hidden text-gray-400 border-0 bg-transparent cursor-pointer text-xl">←</button>
          <div>
            <h1 className="font-black text-xl" style={{ color: '#1B4332' }}>Announcements</h1>
            <p className="text-xs" style={{ color: '#8A9BB0' }}>{items.length} notices</p>
          </div>
        </div>
        {canPost(user?.role) && (
          <button onClick={() => { setEditTarget(null); setShowForm(true) }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold border-0 cursor-pointer"
            style={{ background: 'linear-gradient(135deg,#2D6A4F,#122400)' }}>
            + New
          </button>
        )}
      </div>
    </div>
  )

  return (
    <>
      <div className="lg:hidden h-full flex flex-col" style={{ background: '#F5F7FA' }}>
        {Header}
        {Content}
      </div>
      <div className="hidden lg:flex flex-col min-h-screen" style={{ background: '#F5F7FA' }}>
        {Header}
        {Content}
      </div>

      {showForm && (
        <AnnForm
          initial={editTarget ?? undefined}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditTarget(null) }}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm"
            style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <p className="font-black text-lg mb-2" style={{ color: '#1B4332' }}>Delete Announcement?</p>
            <p className="text-sm mb-5 line-clamp-2" style={{ color: '#8A9BB0' }}>"{deleteConfirm.title}"</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold border-0 cursor-pointer"
                style={{ background: '#F5F7FA', color: '#8A9BB0' }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white border-0 cursor-pointer"
                style={{ background: '#E74C3C' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
