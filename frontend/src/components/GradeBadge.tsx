interface GradeBadgeProps {
  grade: string
  size?: 'sm' | 'md' | 'lg'
}

const GRADE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: '#DCFCE7', text: '#15803D', border: '#86EFAC' },
  B: { bg: '#DBEAFE', text: '#1D4ED8', border: '#93C5FD' },
  C: { bg: '#FEF3C7', text: '#B45309', border: '#FCD34D' },
  D: { bg: '#FED7AA', text: '#C2410C', border: '#FDBA74' },
  E: { bg: '#FED7AA', text: '#C2410C', border: '#FDBA74' },
  F: { bg: '#FEE2E2', text: '#DC2626', border: '#FCA5A5' },
}

export default function GradeBadge({ grade, size = 'md' }: GradeBadgeProps) {
  const colors = GRADE_COLORS[grade?.toUpperCase()] ?? GRADE_COLORS['F']
  const sizeClass = size === 'lg'
    ? 'w-12 h-12 text-lg font-black rounded-xl'
    : size === 'sm'
    ? 'w-7 h-7 text-xs font-bold rounded-lg'
    : 'w-10 h-10 text-base font-black rounded-xl'

  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 ${sizeClass}`}
      style={{ background: colors.bg, color: colors.text, border: `1.5px solid ${colors.border}` }}>
      {grade?.toUpperCase()}
    </div>
  )
}
