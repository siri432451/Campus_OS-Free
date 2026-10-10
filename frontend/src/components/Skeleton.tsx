// Reusable skeleton shimmer for loading states
interface SkeletonProps {
  className?: string
  style?: React.CSSProperties
}

export function Skeleton({ className = '', style }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-gray-200 ${className}`}
      style={style}
    />
  )
}

export function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <Skeleton className="h-3 w-16 mb-3" />
      <Skeleton className="h-8 w-12" />
    </div>
  )
}

export function BookCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <Skeleton className="h-32 w-full mb-3 rounded-xl" />
      <Skeleton className="h-4 w-3/4 mb-2" />
      <Skeleton className="h-3 w-1/2 mb-3" />
      <div className="flex gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
    </div>
  )
}

export function ResultRowSkeleton() {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-3">
      <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
      <div className="flex-1">
        <Skeleton className="h-4 w-40 mb-2" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-6 w-12 rounded-lg" />
    </div>
  )
}
