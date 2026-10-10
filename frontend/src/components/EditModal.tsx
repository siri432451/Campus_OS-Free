import { useState } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import {
  LibraryItem, CATEGORY_OPTIONS, ALL_LEVELS, LEVEL_LABELS, isAdmin
} from '../lib/libraryConstants'
import { showToast } from './Toast'

interface EditModalProps {
  item: LibraryItem
  onClose: () => void
  onSaved: (updated: LibraryItem) => void
}

export default function EditModal({ item, onClose, onSaved }: EditModalProps) {
  const { user } = useAuth()
  const [title, setTitle] = useState(item.title)
  const [author, setAuthor] = useState(item.author ?? '')
  const [description, setDescription] = useState(item.description ?? '')
  const [department, setDepartment] = useState(item.department ?? '')
  const [level, setLevel] = useState(item.level ?? '')
  const [category, setCategory] = useState(item.category ?? '')
  const [featured, setFeatured] = useState(item.isFeatured ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canSetFeatured = isAdmin(user?.role)

  const handleSave = async () => {
    if (!title.trim()) { setError('Title is required'); return }
    setSaving(true); setError('')
    try {
      const res = await api.patch(`/api/library/${item.id}`, {
        title: title.trim(),
        author: author.trim() || null,
        description: description.trim() || null,
        department: department.trim() || null,
        level: level || null,
        category: category || null,
        ...(canSetFeatured ? { isFeatured: featured } : {}),
      })
      onSaved({ ...item, ...res.data })
      showToast('Item updated successfully', 'success')
      onClose()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })
        ?.response?.data?.error ?? 'Update failed'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end lg:items-center justify-center p-4"
      onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg bg-white rounded-3xl overflow-hidden max-h-[90vh] overflow-y-auto"
        style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}
        onClick={e => e.stopPropagation()}>

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 lg:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        <div className="px-6 pt-4 pb-6">
          <h2 className="font-black text-lg mb-5" style={{ color: '#1B4332' }}>Edit Resource</h2>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium"
              style={{ background: '#FEE2E2', color: '#DC2626' }}>{error}</div>
          )}

          {/* Title */}
          <label className="block mb-1 text-xs font-bold uppercase tracking-wide" style={{ color: '#8A9BB0' }}>
            Title *
          </label>
          <input value={title} onChange={e => setTitle(e.target.value)}
            className="w-full mb-4 px-4 py-3 rounded-xl border text-sm outline-none"
            style={{ border: '1.5px solid #E8EDF2', background: '#F5F7FA' }} />

          {/* Author */}
          <label className="block mb-1 text-xs font-bold uppercase tracking-wide" style={{ color: '#8A9BB0' }}>
            Author / Source
          </label>
          <input value={author} onChange={e => setAuthor(e.target.value)}
            placeholder="e.g. Dr. Okonkwo or WHO 2023"
            className="w-full mb-4 px-4 py-3 rounded-xl border text-sm outline-none"
            style={{ border: '1.5px solid #E8EDF2', background: '#F5F7FA' }} />

          {/* Description */}
          <label className="block mb-1 text-xs font-bold uppercase tracking-wide" style={{ color: '#8A9BB0' }}>
            Description
          </label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
            className="w-full mb-4 px-4 py-3 rounded-xl border text-sm outline-none resize-none"
            style={{ border: '1.5px solid #E8EDF2', background: '#F5F7FA' }} />

          {/* Level chips */}
          <label className="block mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: '#8A9BB0' }}>
            Level
          </label>
          <div className="flex flex-wrap gap-2 mb-4">
            {ALL_LEVELS.map(l => (
              <button key={l} type="button" onClick={() => setLevel(level === l ? '' : l)}
                className="px-3 py-1.5 rounded-full text-xs font-bold border-0 cursor-pointer"
                style={{
                  background: level === l ? '#122400' : '#F5F7FA',
                  color: level === l ? '#fff' : '#8A9BB0',
                }}>
                {LEVEL_LABELS[l]}
              </button>
            ))}
          </div>

          {/* Category */}
          <label className="block mb-1 text-xs font-bold uppercase tracking-wide" style={{ color: '#8A9BB0' }}>
            Category *
          </label>
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="w-full mb-4 px-4 py-3 rounded-xl border text-sm outline-none cursor-pointer"
            style={{ border: '1.5px solid #E8EDF2', background: '#F5F7FA', color: '#1B4332' }}>
            <option value="">Select category…</option>
            {CATEGORY_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Featured (admin only) */}
          {canSetFeatured && (
            <label className="flex items-center gap-3 mb-6 cursor-pointer">
              <input type="checkbox" checked={featured} onChange={e => setFeatured(e.target.checked)}
                className="w-4 h-4 rounded" style={{ accentColor: '#122400' }} />
              <span className="text-sm font-medium" style={{ color: '#1B4332' }}>
                Mark as featured resource
              </span>
            </label>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-semibold border-0 cursor-pointer hover:bg-gray-100"
              style={{ background: '#F5F7FA', color: '#8A9BB0' }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white border-0 cursor-pointer disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#2D6A4F,#122400)' }}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
