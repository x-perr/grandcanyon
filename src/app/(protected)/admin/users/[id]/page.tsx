import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  MapPin,
  Pencil,
  UserX,
  UserCheck,
  Clock,
  Receipt,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock4,
  XCircle,
  Lock,
  CircleDashed,
} from 'lucide-react'
import { getTranslations, getLocale } from 'next-intl/server'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { getEmployee360 } from '../../actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import type { Enums } from '@/types/database'

type TimesheetStatus = Enums<'timesheet_status'>
type ExpenseStatus = Enums<'expense_status'>

interface PageProps {
  params: Promise<{ id: string }>
}

function TimesheetStatusBadge({ status }: { status: TimesheetStatus }) {
  switch (status) {
    case 'approved':
      return (
        <Badge variant="default" className="bg-green-500">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Approved
        </Badge>
      )
    case 'submitted':
      return (
        <Badge variant="default" className="bg-blue-500">
          <Clock4 className="mr-1 h-3 w-3" />
          Submitted
        </Badge>
      )
    case 'rejected':
      return (
        <Badge variant="destructive">
          <XCircle className="mr-1 h-3 w-3" />
          Rejected
        </Badge>
      )
    case 'locked':
      return (
        <Badge variant="secondary">
          <Lock className="mr-1 h-3 w-3" />
          Locked
        </Badge>
      )
    case 'draft':
    default:
      return (
        <Badge variant="outline">
          <CircleDashed className="mr-1 h-3 w-3" />
          Draft
        </Badge>
      )
  }
}

function ExpenseStatusBadge({ status }: { status: ExpenseStatus }) {
  switch (status) {
    case 'approved':
      return (
        <Badge variant="default" className="bg-green-500">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Approved
        </Badge>
      )
    case 'submitted':
      return (
        <Badge variant="default" className="bg-blue-500">
          <Clock4 className="mr-1 h-3 w-3" />
          Pending
        </Badge>
      )
    case 'rejected':
      return (
        <Badge variant="destructive">
          <XCircle className="mr-1 h-3 w-3" />
          Rejected
        </Badge>
      )
    case 'draft':
    default:
      return (
        <Badge variant="outline">
          <CircleDashed className="mr-1 h-3 w-3" />
          Draft
        </Badge>
      )
  }
}

function formatWeekDate(weekStart: string): string {
  const date = new Date(weekStart)
  return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
}

export default async function EmployeeDetailPage({ params }: PageProps) {
  const { id } = await params
  const [locale, permissions, t, tCommon] = await Promise.all([
    getLocale(),
    getUserPermissions(),
    getTranslations('admin.users'),
    getTranslations('common'),
  ])

  // Check admin permission
  if (!hasPermission(permissions, 'admin.manage')) {
    redirect('/dashboard')
  }

  const data = await getEmployee360(id)

  if (!data) {
    notFound()
  }

  const { profile, timesheets, expenses, summary } = data

  // Get skill level name based on locale
  const skillLevelName = profile.person?.skill_level
    ? locale === 'fr'
      ? profile.person.skill_level.name_fr
      : profile.person.skill_level.name_en
    : null

  const fullName = `${profile.first_name} ${profile.last_name}`

  // Format address
  const formatAddress = () => {
    const parts = [
      profile.person?.address,
      profile.person?.city,
      profile.person?.postal_code,
    ].filter(Boolean)
    return parts.length > 0 ? parts.join(', ') : null
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/users">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('back_to_list')}
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10">
            <User className="h-7 w-7 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{fullName}</h1>
              {profile.is_active === false && (
                <Badge variant="secondary">{tCommon('status.inactive')}</Badge>
              )}
            </div>
            {skillLevelName && (
              <p className="text-muted-foreground">
                {skillLevelName}
                {profile.person?.skill_level?.hourly_rate && (
                  <span className="ml-2 font-medium">
                    - {formatCurrency(profile.person.skill_level.hourly_rate)}/hr
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href={`/admin/users/${id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              {tCommon('actions.edit')}
            </Link>
          </Button>
          {profile.is_active ? (
            <Button variant="outline">
              <UserX className="mr-2 h-4 w-4" />
              {t('deactivate')}
            </Button>
          ) : (
            <Button variant="outline">
              <UserCheck className="mr-2 h-4 w-4" />
              {t('activate')}
            </Button>
          )}
        </div>
      </div>

      {/* Info Cards Row */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Contact Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('detail.contact')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {profile.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${profile.email}`} className="text-primary hover:underline truncate">
                  {profile.email}
                </a>
              </div>
            )}
            {profile.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${profile.phone}`} className="hover:underline">
                  {profile.phone}
                </a>
              </div>
            )}
            {formatAddress() && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{formatAddress()}</span>
              </div>
            )}
            {!profile.email && !profile.phone && !formatAddress() && (
              <p className="text-sm text-muted-foreground">{t('detail.no_contact')}</p>
            )}
          </CardContent>
        </Card>

        {/* Employment Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('detail.employment')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {profile.role && (
              <div className="flex items-center gap-2 text-sm">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span>{profile.role.name}</span>
              </div>
            )}
            {profile.manager && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {t('manager')}: {profile.manager.first_name} {profile.manager.last_name}
                </span>
              </div>
            )}
            {profile.created_at && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {t('detail.hired')}: {new Date(profile.created_at).toLocaleDateString()}
                </span>
              </div>
            )}
            {skillLevelName && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{t('detail.skill_level')}: {skillLevelName}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* This Period Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('detail.this_period')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{t('detail.hours_this_month')}</span>
              </div>
              <span className="font-semibold">{summary.hoursThisMonth.toFixed(1)}h</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                <span>{t('detail.expenses_this_month')}</span>
              </div>
              <span className="font-semibold">{formatCurrency(summary.expensesThisMonth)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Timesheets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            <span>{t('detail.recent_timesheets')}</span>
            <Badge variant="secondary">{timesheets.length}</Badge>
          </CardTitle>
          <CardDescription>{t('detail.timesheets_description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {timesheets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Clock className="h-10 w-10 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">{t('detail.no_timesheets')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {timesheets.map((timesheet) => (
                <div
                  key={timesheet.id}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Week {formatWeekDate(timesheet.week_start)}</span>
                        <TimesheetStatusBadge status={timesheet.status} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold">{timesheet.total_hours.toFixed(1)}h</span>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/timesheets/${timesheet.id}`}>{tCommon('actions.view')}</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Expenses */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            <span>{t('detail.recent_expenses')}</span>
            <Badge variant="secondary">{expenses.length}</Badge>
          </CardTitle>
          <CardDescription>{t('detail.expenses_description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Receipt className="h-10 w-10 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">{t('detail.no_expenses')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {expenses.map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Week {formatWeekDate(expense.week_start)}</span>
                        <ExpenseStatusBadge status={expense.status} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {expense.entry_count} {expense.entry_count === 1 ? 'item' : 'items'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold">{formatCurrency(expense.total_amount)}</span>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/expenses/${expense.id}`}>{tCommon('actions.view')}</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
