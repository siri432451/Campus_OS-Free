// ── Category display labels ───────────────────────────────────
export const CATEGORY_LABELS: Record<string, string> = {
  ANATOMY_PHYSIOLOGY:          'Anatomy & Physiology',
  MICROBIOLOGY:                'Microbiology',
  PHARMACOLOGY:                'Pharmacology',
  MATERNAL_NEWBORN_HEALTH:     'Maternal & Newborn Health',
  MIDWIFERY_PRACTICE:          'Midwifery Practice',
  COMMUNITY_HEALTH:            'Community Health',
  NUTRITION:                   'Nutrition',
  INFECTION_PREVENTION_CONTROL:'Infection Prevention & Control',
  NURSING_ETHICS_PROFESSIONALISM: 'Nursing Ethics & Professionalism',
  RESEARCH_STATISTICS:         'Research & Statistics',
  CLINICAL_SKILLS:             'Clinical Skills',
  FIRST_AID_EMERGENCY:         'First Aid & Emergency',
  PUBLIC_HEALTH_EPIDEMIOLOGY:  'Public Health & Epidemiology',
  REPRODUCTIVE_FAMILY_PLANNING:'Reproductive & Family Planning',
  LECTURE_NOTES:               'Lecture Notes',
  PAST_QUESTIONS:              'Past Questions',
  OTHER:                       'Other',
}

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
  value,
  label,
}))

// ── Level labels ──────────────────────────────────────────────
export const LEVEL_LABELS: Record<string, string> = {
  ND1:  'ND1',
  ND2:  'ND2',
  ND3:  'ND3',
  HND1: 'HND1',
  HND2: 'HND2',
}

export const ALL_LEVELS = Object.keys(LEVEL_LABELS)

// ── Role guards ───────────────────────────────────────────────
export const CAN_UPLOAD_ROLES = ['LECTURER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']

export function canUpload(role?: string): boolean {
  return CAN_UPLOAD_ROLES.includes(role ?? '')
}

export function isAdmin(role?: string): boolean {
  return role === 'SUPER_ADMIN' || role === 'SCHOOL_ADMIN'
}

// ── Format helpers ────────────────────────────────────────────
export function formatDuration(seconds?: number | null): string {
  if (!seconds) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

export function formatFileSize(bytes?: string | number | null): string {
  if (!bytes) return ''
  const n = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MB`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} KB`
  return `${n} B`
}

// ── Library item type ─────────────────────────────────────────
export interface LibraryItem {
  id: string
  title: string
  author?: string | null
  description?: string | null
  department?: string | null
  level?: string | null
  category?: string | null
  fileSize?: string | null
  downloadCount?: number
  isFeatured?: boolean
  type: 'PDF' | 'VIDEO'
  mimeType?: string
  durationSeconds?: number | null
  pageCount?: number | null
  thumbnailUrl?: string | null
  coverUrl?: string | null
  createdAt?: string
  uploadedById?: string
  uploadedBy?: { id?: string; name: string }
}
