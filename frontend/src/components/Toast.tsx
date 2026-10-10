import { useState, useEffect, useCallback } from 'react'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

// ── Simple global toast store ─────────────────────────────────
let toastListeners: Array<(t: Toast) => void> = []

export function showToast(message: string, type: Toast['type'] = 'info'): void {
  const t: Toast = { id: Math.random().toString(36).slice(2), message, type }
  toastListeners.forEach(fn => fn(t))
}

// ── ToastContainer — mount once in App ───────────────────────
export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((t: Toast) => {
    setToasts(prev => [...prev, t])
    setTimeout(() => {
      setToasts(prev => prev.filter(x => x.id !== t.id))
    }, 4000)
  }, [])

  useEffect(() => {
    toastListeners.push(addToast)
    return () => {
      toastListeners = toastListeners.filter(fn => fn !== addToast)
    }
  }, [addToast])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[500] flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map(t => (
        <div key={t.id}
          className="px-5 py-3 rounded-2xl text-sm font-semibold text-white shadow-xl pointer-events-auto animate-fade-in"
          style={{
            background: t.type === 'success' ? '#27AE60'
              : t.type === 'error' ? '#E74C3C'
              : '#1B4332',
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          }}>
          {t.type === 'success' ? '✓ ' : t.type === 'error' ? '✕ ' : 'ℹ '}{t.message}
        </div>
      ))}
    </div>
  )
}
