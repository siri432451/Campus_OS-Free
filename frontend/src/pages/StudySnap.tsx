import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'

interface Question { question: string; options: string[]; correctIndex?: number; explanation?: string; isCorrect?: boolean; yourAnswer?: number }
interface SnapDetail {
  id: string; imageUrl: string; subject: string | null; review: string; status: string
  score: number | null; answeredCount: number | null; createdAt: string; questions: Question[]
}
interface HistoryRow { id: string; imageUrl: string; subject: string | null; status: string; score: number | null; answeredCount: number | null; createdAt: string }

export default function StudySnap() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [subject, setSubject] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [snap, setSnap] = useState<SnapDetail | null>(null)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [showHistory, setShowHistory] = useState(false)

  const loadHistory = () => {
    api.get<{ snaps: HistoryRow[] }>('/api/study-snap').then(r => setHistory(r.data.snaps || [])).catch(() => {})
  }
  useEffect(() => { loadHistory() }, [])

  const pickFile = (f: File | null) => {
    setFile(f); setError(''); setSnap(null); setAnswers({})
    if (f) setPreview(URL.createObjectURL(f))
    else setPreview(null)
  }

  const upload = async () => {
    if (!file) return
    setUploading(true); setError('')
    try {
      const form = new FormData()
      form.append('photo', file)
      if (subject.trim()) form.append('subject', subject.trim())
      const res = await api.post<SnapDetail>('/api/study-snap', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      setSnap(res.data)
      loadHistory()
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Could not process this photo. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const openSnap = async (id: string) => {
    setShowHistory(false); setError(''); setAnswers({})
    try {
      const res = await api.get<SnapDetail>(`/api/study-snap/${id}`)
      setSnap(res.data)
      setFile(null); setPreview(null)
    } catch { setError('Could not load that item.') }
  }

  const allAnswered = snap ? snap.questions.every((_, i) => answers[i] !== undefined) : false
  const alreadyGraded = snap?.score !== null && snap?.score !== undefined

  const submit = async () => {
    if (!snap) return
    setSubmitting(true); setError('')
    try {
      const ordered = snap.questions.map((_, i) => answers[i])
      const res = await api.post<{ score: number; total: number; results: Question[] }>(`/api/study-snap/${snap.id}/submit`, { answers: ordered })
      setSnap({ ...snap, score: res.data.score, answeredCount: res.data.total, questions: res.data.results })
      loadHistory()
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Could not submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => { setSnap(null); setFile(null); setPreview(null); setSubject(''); setAnswers({}); setError('') }

  return (
    <div style={{ background: '#F5F7FA', minHeight: '100%' }}>
      <div className="px-4 pt-4 pb-24 lg:p-8 lg:pb-8 max-w-3xl mx-auto">

        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-black text-2xl" style={{ color: '#1B4332' }}>Snap & Study</h1>
            <p className="text-sm" style={{ color: '#8A9BB0' }}>Photograph your notes — get a review and a practice quiz</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowHistory(true)} className="px-3 py-2 rounded-xl text-sm font-bold border-0 cursor-pointer" style={{ background: '#E3EFE7', color: '#1B4332' }}>History</button>
            <button onClick={() => navigate('/dashboard')} className="px-3 py-2 rounded-xl text-sm font-bold border-0 cursor-pointer" style={{ background: '#E3EFE7', color: '#1B4332' }}>← Home</button>
          </div>
        </div>

        {error && <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm">{error}</div>}

        {!snap && (
          <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => pickFile(e.target.files?.[0] || null)} />

            {!preview ? (
              <button onClick={() => fileRef.current?.click()}
                className="w-full py-12 rounded-2xl border-2 border-dashed flex flex-col items-center gap-2 cursor-pointer bg-transparent"
                style={{ borderColor: '#2D6A4F' }}>
                <span className="text-4xl">📸</span>
                <span className="text-sm font-bold" style={{ color: '#1B4332' }}>Tap to take or choose a photo</span>
                <span className="text-xs" style={{ color: '#8A9BB0' }}>Notes, textbook pages, or past questions</span>
              </button>
            ) : (
              <div>
                <img src={preview} alt="Selected" className="w-full rounded-2xl mb-3 max-h-72 object-contain bg-black/5" />
                <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject (optional) e.g. Pharmacology"
                  className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none mb-3" style={{ borderColor: '#E3EFE7', color: '#1B4332' }} />
                <div className="flex gap-2">
                  <button onClick={() => pickFile(null)} className="flex-1 py-2.5 rounded-xl text-sm font-bold border cursor-pointer" style={{ borderColor: '#E3EFE7', color: '#64748b', background: '#fff' }}>Choose another</button>
                  <button onClick={upload} disabled={uploading}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white border-0 cursor-pointer disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg,#2D6A4F,#122400)' }}>
                    {uploading ? 'Reading…' : 'Analyse & Generate Quiz'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {snap && (
          <div>
            <div className="bg-white rounded-2xl overflow-hidden mb-4" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
              <img src={snap.imageUrl} alt="Study snap" className="w-full max-h-56 object-cover" />
              <div className="p-4">
                {snap.subject && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#E3EFE7', color: '#1B4332' }}>{snap.subject}</span>}
                <div className="text-[11px] font-bold uppercase tracking-wide mt-2 mb-1" style={{ color: '#2D6A4F' }}>AI Review</div>
                <p className="text-sm" style={{ color: '#1B4332' }}>{snap.review}</p>
              </div>
            </div>

            {snap.questions.length === 0 ? (
              <div className="bg-white rounded-2xl p-5 text-sm text-center" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.05)', color: '#8A9BB0' }}>
                No quiz questions could be generated from this image. Try a clearer photo.
              </div>
            ) : (
              <>
                {alreadyGraded && (
                  <div className="rounded-2xl p-4 mb-4 text-center text-white" style={{ background: 'linear-gradient(135deg,#1B4332,#122400)' }}>
                    <div className="text-xs opacity-80">Your Score</div>
                    <div className="font-black text-3xl">{snap.score} / {snap.questions.length}</div>
                  </div>
                )}

                <div className="space-y-3 mb-4">
                  {snap.questions.map((q, i) => {
                    const chosen = alreadyGraded ? q.yourAnswer : answers[i]
                    return (
                      <div key={i} className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
                        <div className="text-sm font-bold mb-3" style={{ color: '#1B4332' }}>{i + 1}. {q.question}</div>
                        <div className="space-y-2">
                          {q.options.map((opt, oi) => {
                            let bg = '#F5F7FA', fg = '#1B4332', border = 'transparent'
                            if (alreadyGraded) {
                              if (oi === q.correctIndex) { bg = '#DCFCE7'; fg = '#166534'; border = '#166534' }
                              else if (oi === q.yourAnswer) { bg = '#FEE2E2'; fg = '#991B1B'; border = '#991B1B' }
                            } else if (chosen === oi) { bg = '#E3EFE7'; fg = '#122400'; border = '#2D6A4F' }
                            return (
                              <button key={oi} disabled={alreadyGraded}
                                onClick={() => setAnswers(prev => ({ ...prev, [i]: oi }))}
                                className="w-full text-left px-3 py-2.5 rounded-xl text-sm border cursor-pointer disabled:cursor-default"
                                style={{ background: bg, color: fg, borderColor: border }}>
                                {opt}
                              </button>
                            )
                          })}
                        </div>
                        {alreadyGraded && q.explanation && (
                          <div className="text-xs mt-2.5 p-2.5 rounded-lg" style={{ background: '#F5F7FA', color: '#64748b' }}>{q.explanation}</div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {!alreadyGraded && (
                  <button onClick={submit} disabled={!allAnswered || submitting}
                    className="w-full py-3 rounded-xl text-sm font-bold text-white border-0 cursor-pointer disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg,#2D6A4F,#122400)' }}>
                    {submitting ? 'Grading…' : allAnswered ? 'Submit Answers' : `Answer all ${snap.questions.length} questions`}
                  </button>
                )}
              </>
            )}

            <button onClick={reset} className="w-full mt-3 py-2.5 rounded-xl text-sm font-bold border cursor-pointer" style={{ borderColor: '#E3EFE7', color: '#64748b', background: '#fff' }}>
              ＋ Snap another
            </button>
          </div>
        )}
      </div>

      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(18,36,0,0.45)' }} onClick={() => setShowHistory(false)}>
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-black text-lg" style={{ color: '#1B4332' }}>Your Study Snaps</h2>
              <button onClick={() => setShowHistory(false)} className="text-xl border-0 bg-transparent cursor-pointer" style={{ color: '#8A9BB0' }}>✕</button>
            </div>
            {history.length === 0 && <div className="text-center py-8 text-sm" style={{ color: '#8A9BB0' }}>No snaps yet.</div>}
            <div className="space-y-2">
              {history.map(h => (
                <button key={h.id} onClick={() => openSnap(h.id)} className="w-full flex items-center gap-3 p-2.5 rounded-xl border-0 cursor-pointer text-left" style={{ background: '#F5F7FA' }}>
                  <img src={h.imageUrl} alt="" className="w-11 h-11 rounded-lg object-cover flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold truncate" style={{ color: '#1B4332' }}>{h.subject || 'Untitled snap'}</div>
                    <div className="text-[11px]" style={{ color: '#8A9BB0' }}>{new Date(h.createdAt).toLocaleDateString()}</div>
                  </div>
                  {h.score !== null ? (
                    <span className="text-xs font-bold px-2 py-1 rounded-full flex-shrink-0" style={{ background: '#DCFCE7', color: '#166534' }}>{h.score}/{h.answeredCount}</span>
                  ) : (
                    <span className="text-xs font-bold px-2 py-1 rounded-full flex-shrink-0" style={{ background: '#FEF3C7', color: '#92400E' }}>Unanswered</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
