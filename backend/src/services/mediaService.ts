import path from 'path'
import fs from 'fs'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const THUMB_DIR = process.env.UPLOAD_DIR
  ? path.join(process.env.UPLOAD_DIR, 'library', 'thumbs')
  : path.join(__dirname, '../../../uploads/library/thumbs')

export function ensureThumbDir(): void {
  if (!fs.existsSync(THUMB_DIR)) {
    fs.mkdirSync(THUMB_DIR, { recursive: true })
  }
}

// ── PDF processing via pdf-poppler (pdftoppm) ─────────────────
export async function processPdf(filePath: string, itemId: string): Promise<{
  pageCount: number
  thumbnailPath: string | null
}> {
  ensureThumbDir()

  let pageCount = 0
  let thumbnailPath: string | null = null

  try {
    // Count pages using pdfinfo
    const { stdout: infoOut } = await execAsync(`pdfinfo "${filePath}" 2>/dev/null || echo "Pages: 0"`)
    const pageMatch = infoOut.match(/Pages:\s+(\d+)/)
    pageCount = pageMatch ? parseInt(pageMatch[1], 10) : 0
  } catch {
    pageCount = 0
  }

  try {
    // Render first page to PNG using pdftoppm (from poppler-utils)
    const thumbBase = path.join(THUMB_DIR, itemId)
    await execAsync(`pdftoppm -r 72 -f 1 -l 1 -png -scale-to-x 400 -scale-to-y -1 "${filePath}" "${thumbBase}"`)

    // pdftoppm outputs {thumbBase}-1.png or {thumbBase}-01.png
    const candidates = [
      `${thumbBase}-1.png`,
      `${thumbBase}-01.png`,
      `${thumbBase}-001.png`,
    ]
    const found = candidates.find(c => fs.existsSync(c))
    if (found) {
      const finalPath = path.join(THUMB_DIR, `${itemId}.png`)
      fs.renameSync(found, finalPath)
      thumbnailPath = finalPath
    }
  } catch {
    thumbnailPath = null
  }

  return { pageCount, thumbnailPath }
}

// ── Video processing via ffmpeg ───────────────────────────────
export async function processVideo(filePath: string, itemId: string): Promise<{
  durationSeconds: number
  thumbnailPath: string | null
}> {
  ensureThumbDir()

  let durationSeconds = 0
  let thumbnailPath: string | null = null

  try {
    // Get duration using ffprobe
    const { stdout } = await execAsync(
      `ffprobe -v quiet -print_format json -show_streams "${filePath}"`
    )
    const probe = JSON.parse(stdout) as {
      streams?: Array<{ duration?: string; codec_type?: string }>
    }
    const videoStream = probe.streams?.find(s => s.codec_type === 'video')
    if (videoStream?.duration) {
      durationSeconds = Math.round(parseFloat(videoStream.duration))
    } else {
      // Try container-level duration
      const { stdout: fmtOut } = await execAsync(
        `ffprobe -v quiet -print_format json -show_format "${filePath}"`
      )
      const fmt = JSON.parse(fmtOut) as { format?: { duration?: string } }
      if (fmt.format?.duration) {
        durationSeconds = Math.round(parseFloat(fmt.format.duration))
      }
    }
  } catch {
    durationSeconds = 0
  }

  try {
    // Extract first frame as thumbnail at 1 second (or 0 if shorter)
    const thumbPath = path.join(THUMB_DIR, `${itemId}.png`)
    const seekTime = durationSeconds > 2 ? 1 : 0
    await execAsync(
      `ffmpeg -y -ss ${seekTime} -i "${filePath}" -vf "scale=400:-1" -vframes 1 "${thumbPath}"`
    )
    if (fs.existsSync(thumbPath)) {
      thumbnailPath = thumbPath
    }
  } catch {
    thumbnailPath = null
  }

  return { durationSeconds, thumbnailPath }
}

// ── Clean up files on error ───────────────────────────────────
export function cleanupFile(filePath: string | null): void {
  if (!filePath) return
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch {
    // ignore cleanup errors
  }
}

// ── Format duration for display ───────────────────────────────
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}
