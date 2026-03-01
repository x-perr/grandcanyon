import { Suspense } from 'react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Clock, FileText, Receipt, FolderKanban } from 'lucide-react'
import { getProfile } from '@/lib/auth'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { RecentActivity } from '@/components/dashboard/recent-activity'
import { MontrealMap } from '@/components/dashboard/montreal-map'
import { getDashboardStats, getRecentActivity, getMapData } from './actions'

export default async function DashboardPage() {
  const [profile, stats, activities, mapData, t] = await Promise.all([
    getProfile(),
    getDashboardStats(),
    getRecentActivity(10),
    getMapData(),
    getTranslations('dashboard'),
  ])

  const firstName = profile?.first_name || 'User'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {t('welcome', { name: firstName })}
        </h1>
        <p className="text-muted-foreground">
          {t('subtitle')}
        </p>
      </div>

      {/* Stats Cards */}
      <Suspense fallback={<StatsSkeleton />}>
        <StatsCards stats={stats} />
      </Suspense>

      {/* Quick Actions */}
      <QuickActions />

      {/* Montreal Map */}
      <Suspense fallback={<MapSkeleton />}>
        <MontrealMap projects={mapData.projects} employees={mapData.employees} />
      </Suspense>

      {/* Recent Activity */}
      <Suspense fallback={<ActivitySkeleton />}>
        <RecentActivity activities={activities} />
      </Suspense>
    </div>
  )
}

async function QuickActions() {
  const t = await getTranslations('dashboard.quick_actions')

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/timesheets/new">
            <Clock className="mr-2 h-4 w-4" />
            {t('new_timesheet')}
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/projects/new">
            <FolderKanban className="mr-2 h-4 w-4" />
            {t('new_project')}
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/expenses/new">
            <Receipt className="mr-2 h-4 w-4" />
            {t('new_expense')}
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/reports">
            <FileText className="mr-2 h-4 w-4" />
            {t('view_reports')}
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function StatsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-3 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function MapSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-4" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[400px] w-full rounded-lg" />
      </CardContent>
    </Card>
  )
}

function ActivitySkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48" />
      </CardHeader>
      <CardContent className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
