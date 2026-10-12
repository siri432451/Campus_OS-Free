import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, XCircle } from 'lucide-react'
import api from '../api/client'
import PublicShell from '../components/PublicShell'

interface Verified {
  valid: boolean
  institution?: string
  name?: string
  transcriptNo?: string
  issuedAt?: string
}

export default function VerifyTranscriptPage() {
  const { code } = useParams()
  const [data, setData] = useState<Verified | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    api.get(`/api/public/transcripts/verify/${encodeURIComponent(code || '')}`)
      .then(r => setData(r.data))
      .catch(() => setFailed(true))
  }, [code])

  return (
    <PublicShell title="Verify a transcript" subtitle="Confirm that a transcript was issued by the college">
      <div className="bg-white rounded-2xl border border-mossline p-6 text-center">
        {!data && !failed && <div className="text-sm text-text2">Checking…</div>}
        {failed && <div className="text-sm text-red-600">We could not check this transcript right now. Please try again.</div>}

        {data && data.valid && (
          <div>
            <CheckCircle2 size={44} color="#1B4332" strokeWidth={1.6} />
            <div className="font-display font-semibold text-ink text-xl mt-2">This transcript is genuine</div>
            <div className="text-sm text-ink mt-4">
              Issued by <b>{data.institution}</b> to
            </div>
            <div className="font-display font-semibold text-ink mt-1" style={{ fontSize: 22 }}>{data.name}</div>
            <div className="text-xs text-text2 mt-3 font-plexmono">{data.transcriptNo}</div>
            {data.issuedAt && (
              <div className="text-xs text-text2 mt-1">
                Issued {new Date(data.issuedAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            )}
          </div>
        )}

        {data && !data.valid && (
          <div>
            <XCircle size={44} color="#B42318" strokeWidth={1.6} />
            <div className="font-display font-semibold text-ink text-xl mt-2">We could not verify this transcript</div>
            <p className="text-sm text-text2 mt-2">
              The code is not recognised. Check that the address was copied completely, or contact the college Registrar.
            </p>
          </div>
        )}
      </div>
    </PublicShell>
  )
}
