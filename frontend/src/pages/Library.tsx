import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import LibraryCard from '../components/LibraryCard'
import VideoModal from '../components/VideoModal'
import EditModal from '../components/EditModal'
import { BookModal } from '../components/BookCard'
import { BookCardSkeleton } from '../components/Skeleton'
import { showToast } from '../components/Toast'
import {
  LibraryItem, CATEGORY_LABELS, LEVEL_LABELS, ALL_LEVELS,
  canUpload, formatDuration
} from '../lib/libraryConstants'

// ── Open Library types ────────────────────────────────────
interface OLBook {
  key: string
  title: string
  author_name?: string[]
  first_publish_year?: number
  cover_i?: number
  number_of_pages_median?: number
  has_fulltext?: boolean
  ia?: string[]
}

// Re-use existing BookModal but adapt it for library items
function makeLegacyBook(item: LibraryItem) {
  return {
    id: item.id,
    title: item.title,
    author: item.author ?? undefined,
    description: item.description ?? undefined,
    department: item.department ?? undefined,
    level: item.level ?? undefined,
    category: item.category ?? undefined,
    fileSize: item.fileSize ? parseInt(item.fileSize as unknown as string, 10) : undefined,
    coverUrl: item.thumbnailUrl ?? item.coverUrl ?? undefined,
    downloadCount: item.downloadCount,
    isFeatured: item.isFeatured,
  }
}

type TypeFilter = 'ALL' | 'PDF' | 'VIDEO'

export default function Library() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()

  const [items, setItems] = useState<LibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('All')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL')
  const [selectedPdf, setSelectedPdf] = useState<LibraryItem | null>(null)
  const [selectedVideo, setSelectedVideo] = useState<LibraryItem | null>(null)
  const [editItem, setEditItem] = useState<LibraryItem | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<LibraryItem | null>(null)
  const highlightId = searchParams.get('highlight')
  const highlightRef = useRef<HTMLDivElement>(null)

  // ── Open Library state ──────────────────────────────────
  const [olResults, setOlResults] = useState<OLBook[]>([])
  const [olLoading, setOlLoading] = useState(false)
  const olAbortRef = useRef<AbortController | null>(null)
  const [selectedOLBook, setSelectedOLBook] = useState<OLBook | null>(null)

  const uploadAllowed = canUpload(user?.role)

  useEffect(() => {
    let cancelled = false
    api.get<LibraryItem[]>('/api/library')
      .then(r => { if (!cancelled) { setItems(r.data); setLoading(false) } })
      .catch(() => { if (!cancelled) { setError(true); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  // Scroll to highlighted item after load
  useEffect(() => {
    if (highlightId && !loading) {
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 300)
    }
  }, [highlightId, loading])

  // ── Open Library search ─────────────────────────────────
  const DEFAULT_OL_QUERY = 'nursing textbook'

  const searchOpenLibrary = useCallback(async (q: string) => {
    if (olAbortRef.current) olAbortRef.current.abort()
    const effectiveQ = q.trim() || DEFAULT_OL_QUERY
    if (!effectiveQ) { setOlResults([]); return }
    const ctrl = new AbortController()
    olAbortRef.current = ctrl
    setOlLoading(true)
    try {
      const biased = /nursing|health|medical|anatomy|pharma|midwif/i.test(effectiveQ)
        ? effectiveQ
        : `${effectiveQ} nursing`
      const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(biased)}&limit=8&fields=key,title,author_name,first_publish_year,cover_i,number_of_pages_median,has_fulltext,ia`
      const res = await fetch(url, { signal: ctrl.signal })
      const data = await res.json()
      setOlResults(data.docs ?? [])
    } catch (e: any) {
      if (e.name !== 'AbortError') setOlResults([])
    } finally {
      setOlLoading(false)
    }
  }, [])

  // Load default books on mount; debounce on search change
  useEffect(() => {
    const t = setTimeout(() => searchOpenLibrary(search), search.trim() ? 600 : 0)
    return () => clearTimeout(t)
  }, [search, searchOpenLibrary])

  const filtered = useMemo(() => {
    return items.filter(item => {
      const matchLevel = levelFilter === 'All' || item.level === levelFilter
      const matchType = typeFilter === 'ALL' || item.type === typeFilter
      const q = search.toLowerCase()
      const matchSearch = !q ||
        item.title.toLowerCase().includes(q) ||
        (item.author ?? '').toLowerCase().includes(q) ||
        (item.category ? CATEGORY_LABELS[item.category] ?? '' : '').toLowerCase().includes(q)
      return matchLevel && matchType && matchSearch
    })
  }, [items, levelFilter, typeFilter, search])

  const handleDelete = async (item: LibraryItem) => {
    try {
      await api.delete(`/api/library/${item.id}`)
      setItems(prev => prev.filter(i => i.id !== item.id))
      showToast('Resource deleted', 'success')
    } catch {
      showToast('Failed to delete resource', 'error')
    } finally {
      setConfirmDelete(null)
    }
  }

  const handleSaved = (updated: LibraryItem) => {
    setItems(prev => prev.map(i => i.id === updated.id ? { ...i, ...updated } : i))
  }

  const handleItemClick = (item: LibraryItem) => {
    if (item.type === 'VIDEO') setSelectedVideo(item)
    else setSelectedPdf(item)
  }

  // ── Open Library section ──────────────────────────────────
  const OLSection = (
    <div className="mt-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px" style={{ background: '#E8EDF2' }} />
        <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold"
          style={{ background: '#E3EFE7', color: '#122400' }}>
          📖 {search.trim() ? 'More from Open Library' : 'Nursing Books — Open Library'}
        </div>
        <div className="flex-1 h-px" style={{ background: '#E8EDF2' }} />
      </div>

      {olLoading && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4">
          {[0,1,2,3].map(i => (
            <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse"
              style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <div className="h-40 bg-gray-100" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-gray-100 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!olLoading && olResults.length === 0 && (
        <p className="text-center text-sm py-4" style={{ color: '#8A9BB0' }}>
          {search.trim() ? `No Open Library results for "${search}"` : 'Loading books…'}
        </p>
      )}

      {!olLoading && olResults.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4">
          {olResults.map(book => {
            const coverUrl = book.cover_i
              ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
              : null
            const readUrl = book.ia?.length
              ? `https://archive.org/details/${book.ia[0]}`
              : `https://openlibrary.org${book.key}`
            const isFree = book.has_fulltext || (book.ia && book.ia.length > 0)

            return (
              <div key={book.key} className="bg-white rounded-2xl overflow-hidden flex flex-col"
                style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #F0F4F8' }}>
                {/* Cover */}
                <div className="relative flex items-center justify-center overflow-hidden"
                  style={{ height: 160, background: 'linear-gradient(135deg,#1B4332,#122400)' }}>
                  {coverUrl
                    ? <img src={coverUrl} alt={book.title}
                        className="h-full w-full object-contain p-2"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    : <span className="text-4xl">📖</span>
                  }
                  {isFree && (
                    <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: '#10B981', color: '#fff' }}>
                      FREE
                    </span>
                  )}
                  <span className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}>
                    Open Library
                  </span>
                </div>

                {/* Info */}
                <div className="p-3 flex flex-col flex-1">
                  <p className="font-bold text-sm leading-tight line-clamp-2 mb-1" style={{ color: '#1B4332' }}>
                    {book.title}
                  </p>
                  {book.author_name && (
                    <p className="text-xs line-clamp-1 mb-1" style={{ color: '#8A9BB0' }}>
                      {book.author_name.slice(0, 2).join(', ')}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-auto pt-1">
                    {book.first_publish_year && (
                      <span className="text-[10px]" style={{ color: '#8A9BB0' }}>{book.first_publish_year}</span>
                    )}
                    {book.number_of_pages_median && (
                      <span className="text-[10px]" style={{ color: '#8A9BB0' }}>{book.number_of_pages_median}pp</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="px-3 pb-3 flex gap-2">
                  <button onClick={() => setSelectedOLBook(book)}
                    className="flex-1 text-center py-2 rounded-xl text-xs font-bold text-white border-0 cursor-pointer"
                    style={{ background: isFree ? '#10B981' : '#1B4332' }}>
                    {isFree ? '📖 Read Free' : '📋 Details'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-center text-xs mt-3" style={{ color: '#C0CAD4' }}>
        Results from Open Library (openlibrary.org) · 20M+ books · No account needed
      </p>
    </div>
  )

  // ── Mobile Open Library section (list style) ─────────────
  const OLSectionMobile = (
    <div className="mt-4">
      <div className="flex items-center gap-2 px-4 mb-3">
        <div className="flex-1 h-px" style={{ background: '#E8EDF2' }} />
        <span className="text-[10px] font-bold px-2 py-1 rounded-full"
          style={{ background: '#E3EFE7', color: '#122400' }}>
          📖 Open Library
        </span>
        <div className="flex-1 h-px" style={{ background: '#E8EDF2' }} />
      </div>

      {olLoading && [0,1,2].map(i => (
        <div key={i} className="mb-3 mx-4 bg-white rounded-2xl h-20 animate-pulse" />
      ))}

      {!olLoading && olResults.map(book => {
        const coverUrl = book.cover_i
          ? `https://covers.openlibrary.org/b/id/${book.cover_i}-S.jpg`
          : null
        const readUrl = book.ia?.length
          ? `https://archive.org/details/${book.ia[0]}`
          : `https://openlibrary.org${book.key}`
        const isFree = book.has_fulltext || (book.ia && book.ia.length > 0)

        return (
          <div key={book.key} className="mb-3 mx-4">
            <button onClick={() => setSelectedOLBook(book)}
              className="w-full bg-white rounded-2xl p-4 flex items-center gap-4 border-0 cursor-pointer text-left"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <div className="w-12 h-14 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                style={{ background: 'linear-gradient(135deg,#1B4332,#122400)' }}>
                {coverUrl
                  ? <img src={coverUrl} alt="" className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  : <span className="text-xl">📖</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate" style={{ color: '#1B4332' }}>{book.title}</p>
                {book.author_name && (
                  <p className="text-xs truncate mt-0.5" style={{ color: '#8A9BB0' }}>
                    {book.author_name[0]}
                  </p>
                )}
                <div className="flex gap-2 mt-1">
                  {isFree && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: '#D1FAE5', color: '#065F46' }}>
                      FREE
                    </span>
                  )}
                  <span className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{ background: '#E3EFE7', color: '#122400' }}>
                    Open Library
                  </span>
                </div>
              </div>
              <span className="text-gray-300 text-lg flex-shrink-0">›</span>
            </button>
          </div>
        )
      })}
    </div>
  )

  // ── Shared header ─────────────────────────────────────────
  const Header = (
    <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 lg:px-8 py-4"
      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <div className="max-w-7xl 2xl:max-w-[1700px] mx-auto">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="font-black text-xl lg:text-2xl" style={{ color: '#1B4332' }}>E-Library</h1>
            <p className="text-xs mt-0.5" style={{ color: '#8A9BB0' }}>
              {items.length} resources — College of Nursing Sciences, Osogbo
            </p>
          </div>
          {uploadAllowed && (
            <button
              onClick={() => navigate('/library/upload')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold border-0 cursor-pointer"
              style={{ background: 'linear-gradient(135deg,#2D6A4F,#122400)', boxShadow: '0 4px 16px rgba(27,67,50,0.35)' }}>
              <span>+</span> Upload Resource
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <span className="absolute left-3 top-1/2 -translate-y-1/2">🔍</span>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by title, author, category…"
            className="w-full pl-10 pr-10 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: '#F5F7FA', border: '1.5px solid #E8EDF2', color: '#1B4332' }}
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg border-0 bg-transparent cursor-pointer">×</button>
          )}
        </div>

        {/* Type filter + level filter */}
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {(['ALL', 'PDF', 'VIDEO'] as TypeFilter[]).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border-0 cursor-pointer"
              style={{ background: typeFilter === t ? '#1B4332' : '#F5F7FA', color: typeFilter === t ? '#fff' : '#8A9BB0' }}>
              {t === 'ALL' ? 'All Types' : t === 'PDF' ? '📄 PDFs' : '▶ Videos'}
            </button>
          ))}
          <div className="w-px bg-gray-200 mx-1 flex-shrink-0" />
          {['All', ...ALL_LEVELS].map(l => (
            <button key={l} onClick={() => setLevelFilter(l)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border-0 cursor-pointer"
              style={{ background: levelFilter === l ? '#122400' : '#F5F7FA', color: levelFilter === l ? '#fff' : '#8A9BB0' }}>
              {l === 'All' ? 'All Levels' : LEVEL_LABELS[l]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  // ── Empty state ───────────────────────────────────────────
  const EmptyState = (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div className="text-6xl mb-4">📚</div>
      <p className="font-black text-xl mb-2" style={{ color: '#1B4332' }}>
        {search || levelFilter !== 'All' || typeFilter !== 'ALL'
          ? 'No uploaded resources match your filters'
          : 'Library is empty'}
      </p>
      <p className="text-sm mb-6" style={{ color: '#8A9BB0' }}>
        {uploadAllowed
          ? 'Be the first to upload a resource for your students.'
          : 'Resources will appear here once uploaded by your lecturers.'}
      </p>
      {uploadAllowed && (
        <button onClick={() => navigate('/library/upload')}
          className="px-6 py-3 rounded-xl text-white font-bold text-sm border-0 cursor-pointer"
          style={{ background: 'linear-gradient(135deg,#2D6A4F,#122400)' }}>
          + Upload First Resource
        </button>
      )}
      {(search || levelFilter !== 'All' || typeFilter !== 'ALL') && (
        <button onClick={() => { setSearch(''); setLevelFilter('All'); setTypeFilter('ALL') }}
          className="mt-3 text-sm font-medium border-0 bg-transparent cursor-pointer"
          style={{ color: '#122400' }}>
          Clear filters
        </button>
      )}
    </div>
  )

  // ── Grid of cards ─────────────────────────────────────────
  const Grid = (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4">
      {loading && [0,1,2,3,4,5,6,7].map(i => <BookCardSkeleton key={i} />)}
      {!loading && filtered.map(item => (
        <div key={item.id} ref={item.id === highlightId ? highlightRef : undefined}>
          <LibraryCard
            item={item}
            highlighted={item.id === highlightId}
            onClick={() => handleItemClick(item)}
            onEdit={() => setEditItem(item)}
            onDelete={() => setConfirmDelete(item)}
          />
        </div>
      ))}
    </div>
  )

  // ── Mobile layout ─────────────────────────────────────────
  const MobileContent = (
    <div className="h-full flex flex-col" style={{ background: '#F5F7FA' }}>
      <div style={{ background: 'linear-gradient(135deg,#1B4332,#122400)', padding: '52px 24px 20px', borderRadius: '0 0 28px 28px' }}>
        <button onClick={() => navigate('/dashboard')}
          className="border-0 bg-transparent cursor-pointer mb-3 text-sm font-medium"
          style={{ color: 'rgba(255,255,255,0.7)', padding: 0 }}>← Back</button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-black text-2xl text-white">E-Library</h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.65)' }}>{items.length} resources</p>
          </div>
          {uploadAllowed && (
            <button onClick={() => navigate('/library/upload')}
              className="px-3 py-2 rounded-xl text-white text-xs font-bold border-0 cursor-pointer flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)' }}>
              + Upload
            </button>
          )}
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2.5"
          style={{ background: 'rgba(255,255,255,0.12)' }}>
          <span>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            className="bg-transparent border-0 outline-none text-sm flex-1"
            style={{ color: '#fff', fontFamily: 'Inter, sans-serif' }} />
          {search && (
            <button onClick={() => setSearch('')}
              className="border-0 bg-transparent cursor-pointer text-lg"
              style={{ color: 'rgba(255,255,255,0.6)' }}>×</button>
          )}
        </div>
      </div>

      <div className="flex gap-2 px-4 pt-3 pb-1 overflow-x-auto">
        {(['ALL', 'PDF', 'VIDEO'] as TypeFilter[]).map(t => (
          <button key={t} onClick={() => setTypeFilter(t)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold border-0 cursor-pointer"
            style={{ background: typeFilter === t ? '#1B4332' : '#fff', color: typeFilter === t ? '#fff' : '#8A9BB0' }}>
            {t === 'ALL' ? 'All' : t === 'PDF' ? '📄 PDF' : '▶ Video'}
          </button>
        ))}
        <div className="w-px bg-gray-200 mx-1" />
        {['All', ...ALL_LEVELS].map(l => (
          <button key={l} onClick={() => setLevelFilter(l)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold border-0 cursor-pointer"
            style={{ background: levelFilter === l ? '#122400' : '#fff', color: levelFilter === l ? '#fff' : '#8A9BB0' }}>
            {l === 'All' ? 'All' : LEVEL_LABELS[l]}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {loading && [0,1,2,3].map(i => (
          <div key={i} className="mb-3 bg-white rounded-2xl h-20 animate-pulse" />
        ))}
        {!loading && error && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">⚠️</p>
            <p className="font-bold" style={{ color: '#1B4332' }}>Failed to load</p>
          </div>
        )}
        {!loading && !error && filtered.length === 0 && !search && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">📭</p>
            <p className="font-bold mb-1" style={{ color: '#1B4332' }}>No resources found</p>
          </div>
        )}
        {!loading && filtered.map(item => (
          <div key={item.id} ref={item.id === highlightId ? highlightRef : undefined}
            className="mb-3">
            <button onClick={() => handleItemClick(item)}
              className="w-full bg-white rounded-2xl p-4 flex items-center gap-4 border-0 cursor-pointer text-left transition-all hover:shadow-md active:scale-95"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <div className="w-12 h-14 rounded-xl flex items-center justify-center flex-shrink-0 text-xl overflow-hidden relative"
                style={{ background: 'linear-gradient(135deg,#1B4332,#122400)' }}>
                {item.thumbnailUrl
                  ? <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                  : <span>{item.type === 'VIDEO' ? '🎬' : '📄'}</span>
                }
                {item.type === 'VIDEO' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <span className="text-white text-xs">▶</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate" style={{ color: '#1B4332' }}>{item.title}</p>
                {item.author && <p className="text-xs truncate mt-0.5" style={{ color: '#8A9BB0' }}>{item.author}</p>}
                <div className="flex gap-2 mt-1">
                  {item.level && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#E3EFE7', color: '#122400' }}>
                      {LEVEL_LABELS[item.level] ?? item.level}
                    </span>
                  )}
                  {item.type === 'VIDEO' && item.durationSeconds && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#FEE2E2', color: '#DC2626' }}>
                      {formatDuration(item.durationSeconds)}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-gray-300 text-lg flex-shrink-0">›</span>
            </button>
          </div>
        ))}

        {/* ── Open Library results (mobile) ── */}
        {!loading && OLSectionMobile}
      </div>
    </div>
  )

  // ── Desktop layout ────────────────────────────────────────
  const DesktopContent = (
    <div className="min-h-screen" style={{ background: '#F5F7FA' }}>
      {Header}
      <div className="px-6 xl:px-8 py-6 max-w-7xl 2xl:max-w-[1700px] mx-auto">
        {error && (
          <div className="text-center py-24">
            <p className="text-5xl mb-4">⚠️</p>
            <p className="font-black text-xl mb-4" style={{ color: '#1B4332' }}>Failed to load library</p>
            <button onClick={() => window.location.reload()}
              className="px-6 py-3 rounded-xl text-white font-bold border-0 cursor-pointer"
              style={{ background: '#122400' }}>Retry</button>
          </div>
        )}
        {!error && (
          <>
            {/* Local resources grid — show empty state only if no search active */}
            {filtered.length === 0 && !loading
              ? (!search ? EmptyState : (
                  <div className="text-center py-8">
                    <p className="text-4xl mb-3">📭</p>
                    <p className="font-bold text-lg mb-1" style={{ color: '#1B4332' }}>No uploaded resources match "{search}"</p>
                    <p className="text-sm" style={{ color: '#8A9BB0' }}>See Open Library results below</p>
                  </div>
                ))
              : Grid
            }

            {/* ── Open Library section (desktop) ── */}
            {OLSection}
          </>
        )}
      </div>
    </div>
  )

  return (
    <>
      <div className="lg:hidden h-full">{MobileContent}</div>
      <div className="hidden lg:block">{DesktopContent}</div>

      {/* PDF modal */}
      {selectedPdf && (
        <BookModal
          book={makeLegacyBook(selectedPdf)}
          onClose={() => setSelectedPdf(null)}
        />
      )}

      {/* Video modal */}
      {selectedVideo && (
        <VideoModal item={selectedVideo} onClose={() => setSelectedVideo(null)} />
      )}

      {/* Edit modal */}
      {editItem && (
        <EditModal item={editItem} onClose={() => setEditItem(null)} onSaved={handleSaved} />
      )}

      {/* Open Library Book Modal */}
      {selectedOLBook && (() => {
        const book = selectedOLBook
        const isFree = book.has_fulltext || (book.ia && book.ia.length > 0)
        const iaId = book.ia?.[0]
        const embedUrl = iaId ? `https://archive.org/embed/${iaId}?ui=embed#mode/1up` : null
        const coverUrl = book.cover_i
          ? `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg`
          : null

        return (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)' }}
            onClick={() => setSelectedOLBook(null)}>
            <div className="bg-white rounded-3xl w-full flex flex-col overflow-hidden"
              style={{ maxWidth: 900, maxHeight: '90vh', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}
              onClick={e => e.stopPropagation()}>

              {/* Modal header */}
              <div className="flex items-start justify-between p-5 border-b border-gray-100 flex-shrink-0">
                <div className="flex gap-4 flex-1 min-w-0">
                  {coverUrl && (
                    <img src={coverUrl} alt={book.title}
                      className="w-14 h-20 object-cover rounded-xl flex-shrink-0"
                      style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }} />
                  )}
                  <div className="min-w-0">
                    <p className="font-black text-base leading-tight mb-1" style={{ color: '#1B4332' }}>
                      {book.title}
                    </p>
                    {book.author_name && (
                      <p className="text-sm mb-2" style={{ color: '#8A9BB0' }}>
                        {book.author_name.slice(0, 2).join(', ')}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {book.first_publish_year && (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#F5F7FA', color: '#8A9BB0' }}>
                          {book.first_publish_year}
                        </span>
                      )}
                      {book.number_of_pages_median && (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#F5F7FA', color: '#8A9BB0' }}>
                          {book.number_of_pages_median} pages
                        </span>
                      )}
                      {isFree && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#D1FAE5', color: '#065F46' }}>
                          FREE
                        </span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#E3EFE7', color: '#122400' }}>
                        Open Library
                      </span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelectedOLBook(null)}
                  className="text-2xl border-0 bg-transparent cursor-pointer ml-4 flex-shrink-0"
                  style={{ color: '#8A9BB0', lineHeight: 1 }}>×</button>
              </div>

              {/* Embedded reader or fallback */}
              {embedUrl ? (
                <div className="flex-1 overflow-hidden" style={{ minHeight: 480 }}>
                  <iframe
                    src={embedUrl}
                    width="100%"
                    height="100%"
                    style={{ border: 'none', minHeight: 480 }}
                    allowFullScreen
                    title={book.title}
                  />
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center py-16 px-8 text-center">
                  {coverUrl && (
                    <img src={coverUrl} alt={book.title}
                      className="w-32 h-44 object-cover rounded-2xl mb-6"
                      style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }} />
                  )}
                  <p className="font-bold text-lg mb-2" style={{ color: '#1B4332' }}>
                    Full text not available for free
                  </p>
                  <p className="text-sm mb-6" style={{ color: '#8A9BB0', maxWidth: 360 }}>
                    This book is listed on Open Library but does not have a free readable copy. You can view its details or ask your lecturer to upload it.
                  </p>
                  <a href={`https://openlibrary.org${book.key}`} target="_blank" rel="noopener noreferrer"
                    className="px-6 py-3 rounded-xl text-sm font-bold text-white"
                    style={{ background: '#122400', textDecoration: 'none' }}>
                    View on Open Library →
                  </a>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm"
            style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}>
            <p className="font-black text-lg mb-2" style={{ color: '#1B4332' }}>Delete Resource?</p>
            <p className="text-sm mb-5" style={{ color: '#8A9BB0' }}>
              "{confirmDelete.title}" will be permanently removed. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold border-0 cursor-pointer"
                style={{ background: '#F5F7FA', color: '#8A9BB0' }}>Cancel</button>
              <button onClick={() => handleDelete(confirmDelete)}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white border-0 cursor-pointer"
                style={{ background: '#E74C3C' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
