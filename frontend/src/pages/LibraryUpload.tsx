import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import {
  CATEGORY_OPTIONS, ALL_LEVELS, LEVEL_LABELS, canUpload, isAdmin
} from '../lib/libraryConstants'
import { showToast } from '../components/Toast'

const MAX_PDF_MB  = 100
const MAX_VID_MB  = 500

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  return `${(bytes / 1000).toFixed(0)} KB`
}

function getFileMime(file: File): string {
  return file.type || 'application/octet-stream'
}

function guessType(mime: string): 'PDF' | 'VIDEO' | null {
  if (mime === 'application/pdf') return 'PDF'
  if (['video/mp4', 'video/webm', 'video/quicktime'].includes(mime)) return 'VIDEO'
  return null
}

export default function LibraryUpload() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // Redirect if not allowed
  useEffect(() => {
    if (user && !canUpload(user.role)) {
      showToast('Only lecturers and admins can upload resources', 'error')
      navigate('/library', { replace: true })
    }
  }, [user, navigate])

  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [description, setDescription] = useState('')
  const [level, setLevel] = useState('')
  const [category, setCategory] = useState('')
  const [featured, setFeatured] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const detectedType = file ? guessType(getFileMime(file)) : null
  const canSubmit = !!file && !!title.trim() && !!level && !!category && detectedType !== null && !uploading

  const onFileSelect = useCallback((f: File) => {
    setError('')
    const mime = getFileMime(f)
    const type = guessType(mime)
    if (!type) {
      setError('Unsupported file type. Please select a PDF, MP4, WebM, or MOV file.')
      return
    }
    const maxMb = type === 'PDF' ? MAX_PDF_MB : MAX_VID_MB
    if (f.size > maxMb * 1024 * 1024) {
      setError(`File too large. Max ${maxMb} MB for ${type === 'PDF' ? 'PDFs' : 'videos'}.`)
      return
    }
    setFile(f)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) onFileSelect(f)
  }, [onFileSelect])

  const handleSubmit = async () => {
    if (!canSubmit || !file) return
    setUploading(true)
    setProgress(0)
    setError('')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('title', title.trim())
    if (author.trim()) formData.append('author', author.trim())
    if (description.trim()) formData.append('description', description.trim())
    formData.append('level', level)
    formData.append('category', category)
    if (isAdmin(user?.role)) formData.append('isFeatured', String(featured))

    try {
      const res = await api.post('/api/library/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: e => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100))
        },
      })
      const newId = res.data.id as string
      showToast('Resource uploaded successfully!', 'success')
      navigate(`/library?highlight=${newId}`)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })
        ?.response?.data?.error ?? 'Upload failed. Please try again.'
      setError(msg)
      setUploading(false)
      setProgress(0)
    }
  }

  // ── Drop zone ─────────────────────────────────────────────
  const DropZone = (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !file && inputRef.current?.click()}
      className="rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center p-8 text-center"
      style={{
        borderColor: dragOver ? '#122400' : file ? '#27AE60' : '#E8EDF2',
        background: dragOver ? '#E3EFE7' : file ? '#E8F8EF' : '#F5F7FA',
        minHeight: 160,
      }}>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.mp4,.webm,.mov,video/mp4,video/webm,video/quicktime,application/pdf"
        className="hidden"
        onChange={e => e.target.files?.[0] && onFileSelect(e.target.files[0])}
      />
      {file ? (
        <>
          <div className="text-4xl mb-3">{detectedType === 'VIDEO' ? '🎬' : '📄'}</div>
          <p className="font-bold text-sm mb-1" style={{ color: '#1B4332' }}>{file.name}</p>
          <p className="text-xs mb-3" style={{ color: '#8A9BB0' }}>{formatBytes(file.size)}</p>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-3 py-1 rounded-full"
              style={{
                background: detectedType === 'VIDEO' ? '#FEE2E2' : '#E3EFE7',
                color: detectedType === 'VIDEO' ? '#DC2626' : '#122400'
              }}>
              {detectedType === 'VIDEO' ? '▶ VIDEO' : '📄 PDF'}
            </span>
            <button
              onClick={e => { e.stopPropagation(); setFile(null); setError('') }}
              className="text-xs text-gray-400 hover:text-gray-600 border-0 bg-transparent cursor-pointer underline">
              Change
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="text-4xl mb-3">📂</div>
          <p className="font-bold text-sm mb-1" style={{ color: '#1B4332' }}>
            {dragOver ? 'Drop file here' : 'Drag & drop or click to browse'}
          </p>
          <p className="text-xs" style={{ color: '#8A9BB0' }}>
            PDF up to 100 MB · Video (MP4, WebM, MOV) up to 500 MB
          </p>
        </>
      )}
    </div>
  )

  // ── Upload progress ───────────────────────────────────────
  const ProgressBar = uploading && (
    <div className="mt-4">
      <div className="flex justify-between text-xs font-medium mb-1.5" style={{ color: '#8A9BB0' }}>
        <span>Uploading{progress < 100 ? '…' : ' — processing…'}</span>
        <span>{progress}%</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: '#E8EDF2' }}>
        <div className="h-full rounded-full transition-all duration-300"
          style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#2D6A4F,#122400)' }} />
      </div>
      {progress === 100 && (
        <p className="text-xs text-center mt-2 animate-pulse" style={{ color: '#122400' }}>
          Generating thumbnail and extracting metadata…
        </p>
      )}
    </div>
  )

  const Form = (
    <div className="space-y-5">
      {/* Drop zone */}
      {DropZone}
      {ProgressBar}

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-xl text-sm font-medium"
          style={{ background: '#FEE2E2', color: '#DC2626' }}>{error}</div>
      )}

      {/* Title */}
      <div>
        <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: '#8A9BB0' }}>
          Title <span style={{ color: '#E74C3C' }}>*</span>
        </label>
        <input value={title} onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Pharmacology Essentials — Unit 3"
          className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
          style={{ border: '1.5px solid #E8EDF2', background: '#F5F7FA', color: '#1B4332' }} />
      </div>

      {/* Author */}
      <div>
        <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: '#8A9BB0' }}>
          Author / Source
        </label>
        <input value={author} onChange={e => setAuthor(e.target.value)}
          placeholder="e.g. Dr. Okonkwo or WHO 2023"
          className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
          style={{ border: '1.5px solid #E8EDF2', background: '#F5F7FA', color: '#1B4332' }} />
      </div>

      {/* Description */}
      <div>
        <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: '#8A9BB0' }}>
          Description
        </label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
          placeholder="Brief description of what this resource covers…"
          className="w-full px-4 py-3 rounded-xl border text-sm outline-none resize-none"
          style={{ border: '1.5px solid #E8EDF2', background: '#F5F7FA', color: '#1B4332' }} />
      </div>

      {/* Level chips */}
      <div>
        <label className="block mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: '#8A9BB0' }}>
          Level <span style={{ color: '#E74C3C' }}>*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {ALL_LEVELS.map(l => (
            <button key={l} type="button" onClick={() => setLevel(level === l ? '' : l)}
              className="px-4 py-2 rounded-full text-sm font-bold border-0 cursor-pointer transition-all"
              style={{
                background: level === l ? '#122400' : '#F5F7FA',
                color: level === l ? '#fff' : '#8A9BB0',
                boxShadow: level === l ? '0 4px 12px rgba(27,67,50,0.3)' : 'none',
              }}>
              {LEVEL_LABELS[l]}
            </button>
          ))}
        </div>
      </div>

      {/* Category */}
      <div>
        <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: '#8A9BB0' }}>
          Category <span style={{ color: '#E74C3C' }}>*</span>
        </label>
        <select value={category} onChange={e => setCategory(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border text-sm outline-none cursor-pointer"
          style={{ border: '1.5px solid #E8EDF2', background: '#F5F7FA', color: category ? '#1B4332' : '#8A9BB0' }}>
          <option value="">Select a category…</option>
          {CATEGORY_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Featured (admin only) */}
      {isAdmin(user?.role) && (
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={featured} onChange={e => setFeatured(e.target.checked)}
            className="w-4 h-4" style={{ accentColor: '#122400' }} />
          <div>
            <p className="text-sm font-bold" style={{ color: '#1B4332' }}>Mark as featured resource</p>
            <p className="text-xs" style={{ color: '#8A9BB0' }}>Featured resources appear at the top of the library</p>
          </div>
        </label>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full py-4 rounded-2xl text-white font-black text-base border-0 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: canSubmit ? 'linear-gradient(135deg,#2D6A4F,#122400)' : '#E8EDF2',
          boxShadow: canSubmit ? '0 8px 28px rgba(27,67,50,0.4)' : 'none',
          color: canSubmit ? '#fff' : '#8A9BB0',
        }}>
        {uploading ? 'Uploading…' : '⬆️ Upload Resource'}
      </button>

      {!file && (
        <p className="text-xs text-center" style={{ color: '#8A9BB0' }}>
          Select a file, fill in the required fields, then click Upload
        </p>
      )}
    </div>
  )

  return (
    <>
      {/* Mobile */}
      <div className="lg:hidden h-full overflow-y-auto pb-8" style={{ background: '#F5F7FA' }}>
        <div style={{ background: 'linear-gradient(135deg,#1B4332,#122400)', padding: '52px 24px 24px', borderRadius: '0 0 28px 28px' }}>
          <button onClick={() => navigate('/library')}
            className="border-0 bg-transparent cursor-pointer mb-3 text-sm font-medium"
            style={{ color: 'rgba(255,255,255,0.7)', padding: 0 }}>← Library</button>
          <h1 className="font-black text-2xl text-white">Upload Resource</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.65)' }}>
            Add a PDF or video to the library
          </p>
        </div>
        <div className="px-6 pt-6">{Form}</div>
      </div>

      {/* Desktop */}
      <div className="hidden lg:block min-h-screen" style={{ background: '#F5F7FA' }}>
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-8 py-4"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div className="max-w-2xl mx-auto flex items-center gap-4">
            <button onClick={() => navigate('/library')}
              className="text-sm font-medium border-0 bg-transparent cursor-pointer"
              style={{ color: '#8A9BB0' }}>← Back to Library</button>
            <div className="h-4 w-px bg-gray-200" />
            <h1 className="font-black text-xl" style={{ color: '#1B4332' }}>Upload Resource</h1>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-8 py-8">{Form}</div>
      </div>
    </>
  )
}
