import { Skeleton } from '@/components/ui/skeleton'

export default function TimesheetEntryLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-[80px]" />
          <Skeleton className="h-8 w-[250px]" />
        </div>
        <Skeleton className="h-6 w-[80px]" />
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-center gap-4">
        <Skeleton className="h-9 w-[100px]" />
        <Skeleton className="h-9 w-[200px]" />
        <Skeleton className="h-9 w-[100px]" />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Skeleton className="h-9 w-[120px]" />
        <Skeleton className="h-9 w-[100px]" />
      </div>

      {/* Grid */}
      <div className="rounded-md border">
        <div className="space-y-4 p-4">
          {/* Header row */}
          <div className="flex gap-2">
            <Skeleton className="h-10 w-[200px]" />
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-[70px]" />
            ))}
            <Skeleton className="h-10 w-[70px]" />
          </div>
          {/* Entry rows */}
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-2">
              <Skeleton className="h-16 w-[200px]" />
              {Array.from({ length: 7 }).map((_, j) => (
                <Skeleton key={j} className="h-16 w-[70px]" />
              ))}
              <Skeleton className="h-16 w-[70px]" />
            </div>
          ))}
          {/* Totals row */}
          <div className="flex gap-2">
            <Skeleton className="h-10 w-[200px]" />
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-[70px]" />
            ))}
            <Skeleton className="h-10 w-[70px]" />
          </div>
        </div>
      </div>
    </div>
  )
}
