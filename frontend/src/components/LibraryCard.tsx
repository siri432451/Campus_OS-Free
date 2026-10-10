import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  LibraryItem, CATEGORY_LABELS, LEVEL_LABELS,
  formatDuration, formatFileSize, isAdmin as checkAdmin
} from '../lib/libraryConstants'

interface LibraryCardProps {
  item: LibraryItem
  highlighted?: boolean
  onClick: () => void
  onEdit: () => void
  onDelete: () => void
}

export default function LibraryCard({ item, highlighted, onClick, onEdit, onDelete }: LibraryCardProps) {
  const { user } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  const canManage =
    user?.id === item.uploadedBy?.id ||
    checkAdmin(user?.role)

  const isVideo = item.type === 'VIDEO'
  const duration = isVideo ? formatDuration(item.durationSeconds) : null
  const pages = !isVideo && item.pageCount ? `${item.pageCount} pages` : null

  return (
    <div
      className={`bg-white rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer group relative
        ${highlighted ? 'ring-2 ring-purple-500 ring-offset-2 animate-pulse-once' : ''}`}
      style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div className="h-36 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1B4332, #122400)' }}>
        {item.thumbnailUrl ? (
          <img
            src={item.thumbnailUrl}
            alt={item.title}
            className="w-full h-full object-cover"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">
            {isVideo ? '🎬' : '📄'}
          </div>
        )}

        {/* Type badge top-left */}
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
          style={{ background: isVideo ? 'rgba(231,76,60,0.85)' : 'rgba(27,67,50,0.85)' }}>
          {isVideo ? '▶ VIDEO' : '📄 PDF'}
        </div>

        {/* Video play overlay */}
        {isVideo && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: 'rgba(0,0,0,0.3)' }}>
            <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center text-xl">▶</div>
          </div>
        )}

        {/* Duration badge (video) */}
        {duration && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
            style={{ background: 'rgba(0,0,0,0.65)' }}>
            {duration}
          </div>
        )}

        {/* Page count badge (PDF) */}
        {pages && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
            style={{ background: 'rgba(0,0,0,0.65)' }}>
            {pages}
          </div>
        )}

        {/* Featured star */}
        {item.isFeatured && (
          <div className="absolute top-2 right-2 text-yellow-400 text-sm">★</div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <p className="font-bold text-sm leading-snug mb-1 line-clamp-2" style={{ color: '#1B4332' }}>
          {item.title}
        </p>
        {item.author && (
          <p className="text-xs mb-2 truncate" style={{ color: '#8A9BB0' }}>{item.author}</p>
        )}

        <div className="flex flex-wrap gap-1.5 mb-2">
          {item.level && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: '#E3EFE7', color: '#122400' }}>
              {LEVEL_LABELS[item.level] ?? item.level}
            </span>
          )}
          {item.category && (
            <span className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: '#F5F7FA', color: '#8A9BB0' }}>
              {CATEGORY_LABELS[item.category] ?? item.category}
            </span>
          )}
        </div>

        {formatFileSize(item.fileSize) && (
          <p className="text-[10px]" style={{ color: '#8A9BB0' }}>
            {formatFileSize(item.fileSize)}
            {(item.downloadCount ?? 0) > 0 && ` · ${item.downloadCount} downloads`}
          </p>
        )}
      </div>

      {/* Kebab menu (uploader / admin only) */}
      {canManage && (
        <div className="absolute top-2 right-2 z-10"
          onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen(p => !p)}
            className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center text-gray-500 hover:bg-white shadow-sm border border-gray-100 text-sm font-bold"
            title="Options">
            ⋮
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-8 z-30 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden w-32">
                <button
                  onClick={() => { setMenuOpen(false); onEdit() }}
                  className="w-full px-4 py-2.5 text-left text-sm font-medium hover:bg-gray-50 flex items-center gap-2"
                  style={{ color: '#1B4332' }}>
                  ✏️ Edit
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onDelete() }}
                  className="w-full px-4 py-2.5 text-left text-sm font-medium hover:bg-red-50 flex items-center gap-2"
                  style={{ color: '#E74C3C' }}>
                  🗑️ Delete
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
