import { Resend } from 'resend'

// Render's free plan blocks normal mail ports (SMTP), so mail goes out through Resend's web API.
// Sender addresses must belong to a domain verified in Resend (campusos.space).
export const MAIL_FROM = process.env.MAIL_FROM || 'CampusOS Registry <registry@campusos.space>'
const REPLY_TO = process.env.MAIL_REPLY_TO || ''

let client: Resend | null = null
function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key || key === 'not-set-yet') return null
  if (!client) client = new Resend(key)
  return client
}

export function emailConfigured(): boolean {
  return getClient() !== null
}

export interface MailInput {
  to: string
  subject: string
  html: string
  text: string
  attachments?: Array<{ filename: string; content: Buffer }>
}

export interface MailResult {
  ok: boolean
  error?: string
}

export async function sendMail(input: MailInput): Promise<MailResult> {
  const resend = getClient()
  if (!resend) return { ok: false, error: 'Email is not set up yet (no email service key on the server).' }
  try {
    const payload = {
      from: MAIL_FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: REPLY_TO || undefined,
      attachments: input.attachments,
    }
    // The cast keeps this compiling across Resend SDK versions
    const result = await resend.emails.send(payload as unknown as Parameters<typeof resend.emails.send>[0])
    if (result.error) {
      const msg = (result.error as { message?: string }).message
      return { ok: false, error: msg || 'The email service refused the message.' }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown email error' }
  }
}
