import api from '../api/client'

interface Book {
  id: string
  title: string
  author?: string
  description?: string
  department?: string
  level?: string
  category?: string
  fileSize?: number
  coverUrl?: string
  downloadCount?: number
  isFeatured?: boolean
  createdAt?: string
  uploadedBy?: { name: string }
}

interface BookCardProps {
  book: Book
  onClick?: () => void
}

const LEVEL_LABEL: Record<string, string> = {
  L100: '100L', L200: '200L', L300: '300L', L400: '400L', L500: '500L'
}

const CATEGORY_EMOJI: Record<string, string> = {
  Anatomy: '🫀', Pharmacology: '💊', Clinical: '🩺',
  Science: '🔬', Nursing: '📋', default: '📖'
}

function formatSize(bytes?: number): string {
  if (!bytes) return ''
  const mb = bytes / 1_000_000
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1000).toFixed(0)} KB`
}

export default function BookCard({ book, onClick }: BookCardProps) {
  const emoji = CATEGORY_EMOJI[book.category ?? ''] ?? CATEGORY_EMOJI.default

  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-2xl p-4 text-left transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 group"
      style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>

      {/* Cover / icon */}
      <div className="h-28 rounded-xl mb-3 flex items-center justify-center text-4xl relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#1B4332,#122400)' }}>
        {book.coverUrl
          ? <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
          : <span>{emoji}</span>
        }
        {book.isFeatured && (
          <div className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: '#F59E0B', color: '#fff' }}>★ Featured</div>
        )}
      </div>

      {/* Meta */}
      <div className="font-bold text-sm leading-snug mb-1 line-clamp-2"
        style={{ color: '#1B4332' }}>
        {book.title}
      </div>
      {book.author && (
        <div className="text-xs mb-2 truncate" style={{ color: '#8A9BB0' }}>{book.author}</div>
      )}

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5">
        {book.level && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: '#E3EFE7', color: '#122400' }}>
            {LEVEL_LABEL[book.level] ?? book.level}
          </span>
        )}
        {book.category && (
          <span className="text-[10px] px-2 py-0.5 rounded-full"
            style={{ background: '#F5F7FA', color: '#8A9BB0' }}>
            {book.category}
          </span>
        )}
        {formatSize(book.fileSize) && (
          <span className="text-[10px] px-2 py-0.5 rounded-full"
            style={{ background: '#F5F7FA', color: '#8A9BB0' }}>
            {formatSize(book.fileSize)}
          </span>
        )}
      </div>

      {/* Download count */}
      {(book.downloadCount ?? 0) > 0 && (
        <div className="mt-2 text-[10px] font-medium" style={{ color: '#8A9BB0' }}>
          ⬇️ {book.downloadCount?.toLocaleString()} downloads
        </div>
      )}
    </button>
  )
}

// ── Book detail modal ─────────────────────────────────────────
interface BookModalProps {
  book: Book
  onClose: () => void
}

export function BookModal({ book, onClose }: BookModalProps) {
  const emoji = CATEGORY_EMOJI[book.category ?? ''] ?? CATEGORY_EMOJI.default

  const handleDownload = async () => {
    try {
      const res = await api.get(`/api/books/${book.id}/download`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${book.title}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Download failed. Please try again.')
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end lg:items-center justify-center p-4"
      onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-white rounded-3xl overflow-hidden"
        style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}
        onClick={e => e.stopPropagation()}>

        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1 lg:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Cover */}
        <div className="h-36 flex items-center justify-center text-5xl"
          style={{ background: 'linear-gradient(135deg,#1B4332,#122400)' }}>
          {book.coverUrl
            ? <img src={book.coverUrl} alt={book.title} className="h-full w-full object-cover" />
            : <span>{emoji}</span>
          }
        </div>

        <div className="p-6">
          <h2 className="font-black text-lg leading-tight mb-1" style={{ color: '#1B4332' }}>
            {book.title}
          </h2>
          {book.author && (
            <p className="text-sm mb-3" style={{ color: '#8A9BB0' }}>by {book.author}</p>
          )}
          {book.description && (
            <p className="text-sm leading-relaxed mb-4" style={{ color: '#64748b' }}>
              {book.description}
            </p>
          )}

          <div className="flex flex-wrap gap-2 mb-5">
            {book.level && (
              <span className="text-xs font-bold px-3 py-1 rounded-full"
                style={{ background: '#E3EFE7', color: '#122400' }}>
                {LEVEL_LABEL[book.level] ?? book.level}
              </span>
            )}
            {book.department && (
              <span className="text-xs px-3 py-1 rounded-full"
                style={{ background: '#F5F7FA', color: '#8A9BB0' }}>
                {book.department}
              </span>
            )}
            {book.category && (
              <span className="text-xs px-3 py-1 rounded-full"
                style={{ background: '#F5F7FA', color: '#8A9BB0' }}>
                {book.category}
              </span>
            )}
          </div>

          <button onClick={handleDownload}
            className="w-full py-4 rounded-2xl font-bold text-white text-base transition-all hover:opacity-90 active:scale-95"
            style={{ background: 'linear-gradient(135deg,#2D6A4F,#122400)', boxShadow: '0 8px 24px rgba(27,67,50,0.4)' }}>
            ⬇️ Download PDF
          </button>

          <button onClick={onClose}
            className="w-full mt-3 py-3 rounded-2xl font-semibold text-sm transition-colors hover:bg-gray-100"
            style={{ color: '#8A9BB0' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
