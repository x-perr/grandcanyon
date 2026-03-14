import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Settings, Users, Shield, Building2, ClipboardList, HardHat, Contact, Layers, DollarSign, GraduationCap } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { getCompanySettings, getUsers, getRoles, getEmployees, getContacts } from './actions'
import { getAdvancementAlerts } from '@/lib/billing/progression'
import { CompanySettingsForm } from '@/components/admin/company-settings-form'
import { AdvancementAlerts } from '@/components/admin/advancement-alerts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default async function AdminPage() {
  const t = await getTranslations('admin')
  const permissions = await getUserPermissions()

  // Check admin permission
  if (!hasPermission(permissions, 'admin.manage')) {
    redirect('/dashboard')
  }

  const [settings, { count: userCount }, { count: employeeCount }, { count: contactCount }, roles] = await Promise.all([
    getCompanySettings(),
    getUsers({ limit: 1 }),
    getEmployees({ limit: 1 }),
    getContacts({ limit: 1 }),
    getRoles(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-8 w-8" />
          {t('title')}
        </h1>
        <p className="text-muted-foreground">
          {t('subtitle')}
        </p>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/admin/users">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t('nav.users')}
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userCount}</div>
              <p className="text-xs text-muted-foreground">
                {t('nav.users_description')}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/employees">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t('nav.employees')}
              </CardTitle>
              <HardHat className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{employeeCount}</div>
              <p className="text-xs text-muted-foreground">
                {t('nav.employees_description')}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/contacts">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t('nav.contacts')}
              </CardTitle>
              <Contact className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{contactCount}</div>
              <p className="text-xs text-muted-foreground">
                {t('nav.contacts_description')}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/roles">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t('nav.roles')}
              </CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{roles.length}</div>
              <p className="text-xs text-muted-foreground">
                {t('nav.roles_description')}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/rate-tiers">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t('nav.rate_tiers')}
              </CardTitle>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
              <p className="text-xs text-muted-foreground">
                {t('nav.rate_tiers_description')}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/ccq-rates">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t('nav.ccq_rates')}
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
              <p className="text-xs text-muted-foreground">
                {t('nav.ccq_rates_description')}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/logs">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t('nav.logs')}
              </CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
              <p className="text-xs text-muted-foreground">
                {t('nav.logs_description')}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('nav.company')}
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate">{settings.name}</div>
            <p className="text-xs text-muted-foreground">
              {t('nav.company_description')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Company Settings Form */}
      <CompanySettingsForm settings={settings} />

      {/* Apprentice Advancement Section */}
      <Suspense fallback={<AdvancementSkeleton />}>
        <AdvancementSection />
      </Suspense>
    </div>
  )
}

function AdvancementSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-96" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
        <Skeleton className="h-32 w-full" />
      </CardContent>
    </Card>
  )
}

async function AdvancementSection() {
  const [alerts, t] = await Promise.all([
    getAdvancementAlerts(),
    getTranslations('admin'),
  ])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <GraduationCap className="h-6 w-6" />
        <h2 className="text-xl font-semibold">{t('billing.advancement')}</h2>
      </div>
      <AdvancementAlerts alerts={alerts} />
    </div>
  )
}
