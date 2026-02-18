import { Skeleton } from '@/components/ui/skeleton'

export default function ExpenseEntryLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-8 w-64" />
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-center gap-4">
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-9 w-9" />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Grid */}
      <div className="rounded-md border">
        <div className="p-4 space-y-4">
          {/* Header Row */}
          <div className="grid grid-cols-7 gap-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-6" />
            ))}
          </div>

          {/* Entry Rows */}
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="grid grid-cols-7 gap-4">
              {Array.from({ length: 7 }).map((_, j) => (
                <Skeleton key={j} className="h-10" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
