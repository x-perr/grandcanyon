import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

export default function InvoicesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="mt-1 h-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <Skeleton className="h-10 flex-1 min-w-[200px]" />
        <Skeleton className="h-10 w-[180px]" />
        <Skeleton className="h-10 w-[140px]" />
        <Skeleton className="h-10 w-[120px]" />
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <div className="p-4 space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32 hidden md:block" />
              <Skeleton className="h-4 w-20 hidden lg:block" />
              <Skeleton className="h-4 w-24 hidden sm:block" />
              <Skeleton className="h-4 w-20 ml-auto" />
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-8 w-8" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
