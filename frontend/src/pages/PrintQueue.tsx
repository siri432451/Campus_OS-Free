import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

type Job = {
  id: string
  serialNo: number
  fileName: string
  pages: number
  copies: number
  isColor: boolean
  creditCost: number
  status: 'QUEUED' | 'PRINTING' | 'DONE' | 'CANCELLED'
  createdAt: string
  student: { name: string; matricNo: string | null }
}

const API = (import.meta.env.VITE_API_URL as string | undefined) || ''

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('campusos_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function PrintQueue() {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/print/queue`, { headers: { ...authHeaders() } })
      if (res.status === 401) { navigate('/login'); return }
      if (res.status === 403) {
        setError('You are not authorised to view the print queue.')
        setLoading(false); return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setJobs(await res.json())
      setError(null)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setError(`Failed to load queue: ${msg}`)
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    fetchQueue()
    const t = setInterval(fetchQueue, 20000)
    return () => clearInterval(t)
  }, [fetchQueue])

  async function updateStatus(id: string, status: 'PRINTING' | 'DONE' | 'CANCELLED') {
    setActingId(id)
    try {
      const res = await fetch(`${API}/api/print/jobs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await fetchQueue()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      alert(`Failed to update job: ${msg}`)
    } finally {
      setActingId(null)
    }
  }

  function downloadFile(id: string, fileName: string) {
    fetch(`${API}/api/print/jobs/${id}/file`, { headers: { ...authHeaders() } })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.blob()
      })
      .then(blob => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      })
      .catch(e => alert(`Failed to download: ${e.message}`))
  }

  return (
    <div className="min-h-screen p-4 lg:p-8" style={{ background: '#F5F7FA' }}>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl lg:text-3xl font-black tracking-tight" style={{ color: '#1B4332' }}>
            Print Queue
          </h1>
          <div className="mt-1 h-px w-12" style={{ background: '#D4A24C' }} />
          <p className="mt-2 text-sm" style={{ color: '#1B4332', opacity: 0.65 }}>
            {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'} waiting \u00b7 auto-refreshes every 20s
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-xl text-sm" style={{ background: '#FEE2E2', color: '#991B1B' }}>
            {error}
          </div>
        )}

        {loading && (
          <div className="text-sm" style={{ color: '#1B4332', opacity: 0.6 }}>Loading queue\u2026</div>
        )}

        {!loading && !error && jobs.length === 0 && (
          <div className="bg-white rounded-2xl p-12 text-center" style={{ boxShadow: '0 2px 12px rgba(27,67,50,0.06)' }}>
            <div className="text-5xl mb-4">🖨️</div>
            <div className="font-bold text-lg" style={{ color: '#1B4332' }}>Queue is empty</div>
            <p className="mt-1 text-sm" style={{ color: '#1B4332', opacity: 0.6 }}>
              New jobs will appear here automatically.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {jobs.map(job => (
            <div
              key={job.id}
              className="bg-white rounded-2xl p-4 lg:p-5"
              style={{ boxShadow: '0 2px 12px rgba(27,67,50,0.06)' }}
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-sm" style={{ background: '#122400' }}>
                      #{job.serialNo}
                    </div>
                    <div className="font-bold truncate" style={{ color: '#1B4332' }}>
                      {job.fileName}
                    </div>
                  </div>
                  <div className="mt-2 ml-13 text-xs flex flex-wrap gap-x-3 gap-y-1" style={{ color: '#1B4332', opacity: 0.7 }}>
                    <span className="font-semibold">{job.student.name}</span>
                    {job.student.matricNo && <span>\u00b7 {job.student.matricNo}</span>}
                    <span>\u00b7 {job.pages} {job.pages === 1 ? 'page' : 'pages'}</span>
                    {job.copies > 1 && <span>\u00b7 \u00d7{job.copies} copies</span>}
                    <span style={{ color: job.isColor ? '#122400' : '#2D5F3F', fontWeight: 600 }}>
                      \u00b7 {job.isColor ? 'Color' : 'B&W'}
                    </span>
                    <span>\u00b7 {job.creditCost} credits</span>
                    <span className="font-semibold" style={{ color: '#1B4332', opacity: 0.9 }}>\u00b7 Uploaded {formatTime(job.createdAt)} on {formatDate(job.createdAt)}</span>
                    <span style={{ color: '#8A9BB0' }}>({timeAgo(job.createdAt)})</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 lg:flex-shrink-0">
                  <button
                    onClick={() => downloadFile(job.id, job.fileName)}
                    disabled={actingId === job.id}
                    className="px-3 py-2 rounded-lg text-sm font-semibold border-0 cursor-pointer disabled:opacity-50"
                    style={{ background: '#1B4332', color: '#fff' }}
                  >
                    \u2193 Download
                  </button>
                  <button
                    onClick={() => updateStatus(job.id, 'DONE')}
                    disabled={actingId === job.id}
                    className="px-3 py-2 rounded-lg text-sm font-semibold border-0 cursor-pointer disabled:opacity-50"
                    style={{ background: '#2D5F3F', color: '#fff' }}
                  >
                    \u2713 Mark Printed
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Cancel this job?')) {
                        updateStatus(job.id, 'CANCELLED')
                      }
                    }}
                    disabled={actingId === job.id}
                    className="px-3 py-2 rounded-lg text-sm font-semibold border cursor-pointer disabled:opacity-50"
                    style={{ background: '#fff', color: '#991B1B', borderColor: '#FCA5A5' }}
                  >
                    \u2715 Cancel
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {jobs.length > 0 && (
          <p className="mt-6 text-xs text-center" style={{ color: '#1B4332', opacity: 0.5 }}>
            Tip: Download the file, print it on your printer, then click "Mark Printed."
          </p>
        )}
      </div>
    </div>
  )
}
