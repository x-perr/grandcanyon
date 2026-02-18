import { Skeleton } from '@/components/ui/skeleton'

export default function TimesheetsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Skeleton className="h-9 w-[180px]" />
          <Skeleton className="mt-2 h-5 w-[280px]" />
        </div>
        <Skeleton className="h-10 w-[140px]" />
      </div>

      <div className="space-y-4">
        <Skeleton className="h-10 w-[300px]" />

        <div className="rounded-md border">
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
