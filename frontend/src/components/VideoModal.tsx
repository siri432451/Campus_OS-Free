import { useEffect, useRef } from 'react'
import { LibraryItem } from '../lib/libraryConstants'

interface VideoModalProps {
  item: LibraryItem
  onClose: () => void
}

export default function VideoModal({ item, onClose }: VideoModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const streamUrl = `/api/library/${item.id}/stream`

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}>

      <div className="relative w-full max-w-3xl bg-black rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3"
          style={{ background: 'rgba(0,0,0,0.6)' }}>
          <p className="font-bold text-sm text-white truncate flex-1 pr-4">{item.title}</p>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors text-lg font-bold border-0 bg-transparent cursor-pointer">
            ×
          </button>
        </div>

        {/* Video player */}
        <div className="relative bg-black" style={{ aspectRatio: '16/9' }}>
          <video
            className="w-full h-full"
            controls
            preload="metadata"
            style={{ display: 'block' }}>
            <source src={streamUrl} type={item.mimeType ?? 'video/mp4'} />
            Your browser does not support the video tag.
          </video>
        </div>

        {/* Footer */}
        {(item.author || item.description) && (
          <div className="px-5 py-4" style={{ background: '#111' }}>
            {item.author && (
              <p className="text-sm text-white/60 mb-1">Source: {item.author}</p>
            )}
            {item.description && (
              <p className="text-sm text-white/50 leading-relaxed line-clamp-2">{item.description}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
