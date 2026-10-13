// Email wording for transcript requests. Every value that came from a visitor is HTML-escaped.

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export const naira = (n: number): string => `\u20A6${n.toLocaleString('en-NG')}`

export function baseUrl(): string {
  return (process.env.FRONTEND_URL || '').replace(/\/+$/, '')
}

export interface Rendered {
  subject: string
  html: string
  text: string
}

function shell(heading: string, bodyHtml: string): string {
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1B2A22">
  <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#1B4332;font-weight:700">Osun State College of Nursing Sciences</div>
  <h1 style="margin:8px 0 16px;font-size:22px;color:#1B4332">${esc(heading)}</h1>
  ${bodyHtml}
  <hr style="margin:24px 0;border:none;border-top:1px solid #E5E7EB">
  <p style="margin:0;font-size:12px;color:#6B7280">Registrar's Office \u00B7 CampusOS</p>
</div>`
}

const para = (s: string): string => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55">${s}</p>`
const box = (s: string): string =>
  `<div style="background:#F3F6F4;border-radius:12px;padding:16px;margin:0 0 16px;font-size:15px">${s}</div>`
const button = (href: string, label: string): string =>
  `<p style="margin:0 0 16px"><a href="${esc(href)}" style="display:inline-block;background:#1B4332;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:10px;font-weight:600;font-size:14px">${esc(label)}</a></p>`

export function receivedEmail(r: {
  applicantName: string; trackingCode: string; delivery: string; institutionName: string | null; feeAmount: number
}): Rendered {
  const track = `${baseUrl()}/track-transcript?code=${encodeURIComponent(r.trackingCode)}`
  const where = r.delivery === 'INSTITUTION' ? `to ${r.institutionName || 'the receiving institution'}` : 'to you by email'
  return {
    subject: `We received your transcript request (${r.trackingCode})`,
    html: shell('Request received', [
      para(`Dear ${esc(r.applicantName)},`),
      para(`We have received your transcript request and payment receipt (${esc(naira(r.feeAmount))}). The transcript will be sent ${esc(where)} once the Registrar has approved it.`),
      box(`Your tracking code<br><strong style="font-size:24px;letter-spacing:.08em">${esc(r.trackingCode)}</strong>`),
      para('Use this code and the phone number you gave us to follow your request.'),
      button(track, 'Track my request'),
    ].join('')),
    text: `Dear ${r.applicantName},\n\nWe have received your transcript request and payment receipt (${naira(r.feeAmount)}). The transcript will be sent ${where} once the Registrar has approved it.\n\nTracking code: ${r.trackingCode}\nTrack it here: ${track}\n\nRegistrar's Office, Osun State College of Nursing Sciences`,
  }
}

export function applicantTranscriptEmail(r: { applicantName: string; transcriptNo: string }, verifyUrl: string): Rendered {
  return {
    subject: `Your official transcript (${r.transcriptNo})`,
    html: shell('Your transcript is attached', [
      para(`Dear ${esc(r.applicantName)},`),
      para('Your official transcript from the Osun State College of Nursing Sciences is attached to this email as a PDF.'),
      box(`Transcript number<br><strong>${esc(r.transcriptNo)}</strong>`),
      para('Anyone you share it with can confirm that it is genuine by scanning the QR code on the last page, or by visiting:'),
      button(verifyUrl, 'Verify this transcript'),
    ].join('')),
    text: `Dear ${r.applicantName},\n\nYour official transcript from the Osun State College of Nursing Sciences is attached as a PDF.\n\nTranscript number: ${r.transcriptNo}\nVerify it at: ${verifyUrl}\n\nRegistrar's Office`,
  }
}

export function institutionTranscriptEmail(
  r: { applicantName: string; transcriptNo: string; institutionName: string | null }, verifyUrl: string,
): Rendered {
  return {
    subject: `Official transcript of ${r.applicantName} (${r.transcriptNo})`,
    html: shell('Official transcript', [
      para(`To the Registrar / Admissions Officer${r.institutionName ? `, ${esc(r.institutionName)}` : ''},`),
      para(`At the request of the graduate, ${esc(r.applicantName)}, the Osun State College of Nursing Sciences is sending the attached official transcript (PDF).`),
      box(`Transcript number<br><strong>${esc(r.transcriptNo)}</strong>`),
      para('To confirm that this transcript is genuine, scan the QR code on its last page or visit:'),
      button(verifyUrl, 'Verify this transcript'),
      para('Please reply to this email if you need any further information.'),
    ].join('')),
    text: `To the Registrar / Admissions Officer${r.institutionName ? `, ${r.institutionName}` : ''},\n\nAt the request of the graduate, ${r.applicantName}, the Osun State College of Nursing Sciences is sending the attached official transcript (PDF).\n\nTranscript number: ${r.transcriptNo}\nVerify it at: ${verifyUrl}\n\nRegistrar's Office`,
  }
}

export function sentNoticeEmail(r: { applicantName: string; transcriptNo: string; institutionName: string | null; institutionEmail: string | null }): Rendered {
  const to = r.institutionName || 'the receiving institution'
  return {
    subject: `Your transcript has been sent to ${to}`,
    html: shell('Transcript sent', [
      para(`Dear ${esc(r.applicantName)},`),
      para(`Your official transcript (${esc(r.transcriptNo)}) has been emailed to ${esc(to)}${r.institutionEmail ? ` at ${esc(r.institutionEmail)}` : ''}.`),
      para('You do not need to do anything else.'),
    ].join('')),
    text: `Dear ${r.applicantName},\n\nYour official transcript (${r.transcriptNo}) has been emailed to ${to}${r.institutionEmail ? ` at ${r.institutionEmail}` : ''}.\n\nRegistrar's Office`,
  }
}

export function rejectedEmail(r: { applicantName: string; trackingCode: string }, reason: string): Rendered {
  return {
    subject: `Update on your transcript request (${r.trackingCode})`,
    html: shell('We could not approve your request', [
      para(`Dear ${esc(r.applicantName)},`),
      para('Unfortunately we could not approve your transcript request.'),
      box(`Reason<br><strong>${esc(reason)}</strong>`),
      para('If you think this is a mistake, please contact the Registrar\u2019s Office and quote your tracking code.'),
    ].join('')),
    text: `Dear ${r.applicantName},\n\nUnfortunately we could not approve your transcript request (${r.trackingCode}).\n\nReason: ${reason}\n\nPlease contact the Registrar's Office and quote your tracking code if you think this is a mistake.`,
  }
}
