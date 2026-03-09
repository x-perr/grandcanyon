import { redirect } from 'next/navigation'
import Link from 'next/link'
import { FileText, AlertCircle, Clock, CheckCircle, FileQuestion, ExternalLink } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { getEmployeeDocuments } from '../actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'

export default async function AdminDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>
}) {
  const t = await getTranslations('admin')
  const permissions = await getUserPermissions()
  const params = await searchParams

  // Check admin permission
  if (!hasPermission(permissions, 'admin.manage')) {
    redirect('/dashboard')
  }

  const statusFilter = params.status as 'valid' | 'expiring_soon' | 'expired' | 'missing' | undefined
  const { employees, summary } = await getEmployeeDocuments({
    status: statusFilter,
    search: params.search,
  })

  const getStatusBadge = (status: string, daysUntilExpiry: number | null) => {
    switch (status) {
      case 'valid':
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="mr-1 h-3 w-3" />
            {t('documents.status_valid')}
          </Badge>
        )
      case 'expiring_soon':
        return (
          <Badge variant="default" className="bg-yellow-500">
            <Clock className="mr-1 h-3 w-3" />
            {t('documents.status_expiring', { days: daysUntilExpiry ?? 0 })}
          </Badge>
        )
      case 'expired':
        return (
          <Badge variant="destructive">
            <AlertCircle className="mr-1 h-3 w-3" />
            {t('documents.status_expired')}
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary">
            <FileQuestion className="mr-1 h-3 w-3" />
            {t('documents.status_missing')}
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <FileText className="h-8 w-8" />
          {t('documents.title')}
        </h1>
        <p className="text-muted-foreground">{t('documents.subtitle')}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Link href="/admin/documents">
          <Card className={`hover:bg-muted/50 transition-colors cursor-pointer ${!statusFilter ? 'ring-2 ring-primary' : ''}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('documents.total')}</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total}</div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/documents?status=valid">
          <Card className={`hover:bg-muted/50 transition-colors cursor-pointer ${statusFilter === 'valid' ? 'ring-2 ring-green-500' : ''}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('documents.valid')}</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{summary.valid}</div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/documents?status=expiring_soon">
          <Card className={`hover:bg-muted/50 transition-colors cursor-pointer ${statusFilter === 'expiring_soon' ? 'ring-2 ring-yellow-500' : ''}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('documents.expiring_soon')}</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{summary.expiringSoon}</div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/documents?status=expired">
          <Card className={`hover:bg-muted/50 transition-colors cursor-pointer ${statusFilter === 'expired' ? 'ring-2 ring-red-500' : ''}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('documents.expired')}</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{summary.expired}</div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/documents?status=missing">
          <Card className={`hover:bg-muted/50 transition-colors cursor-pointer ${statusFilter === 'missing' ? 'ring-2 ring-gray-500' : ''}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('documents.missing')}</CardTitle>
              <FileQuestion className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">{summary.missing}</div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Employee Documents Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('documents.ccq_cards')}</CardTitle>
          <CardDescription>{t('documents.ccq_cards_description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('documents.employee')}</TableHead>
                <TableHead>{t('documents.card_number')}</TableHead>
                <TableHead>{t('documents.expiry_date')}</TableHead>
                <TableHead>{t('documents.status')}</TableHead>
                <TableHead className="text-right">{t('documents.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {t('documents.no_results')}
                  </TableCell>
                </TableRow>
              ) : (
                employees.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {emp.first_name} {emp.last_name}
                        </div>
                        <div className="text-sm text-muted-foreground">{emp.email}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">
                      {emp.ccq_card_number || '-'}
                    </TableCell>
                    <TableCell>
                      {emp.ccq_card_expiry
                        ? new Date(emp.ccq_card_expiry).toLocaleDateString('fr-CA')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(emp.ccq_card_status, emp.days_until_expiry)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {emp.ccq_card_url && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={emp.ccq_card_url} target="_blank" rel="noopener noreferrer">
                              <FileText className="h-4 w-4 mr-1" />
                              {t('documents.view')}
                            </a>
                          </Button>
                        )}
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/admin/users/${emp.id}`}>
                            <ExternalLink className="h-4 w-4 mr-1" />
                            {t('documents.edit')}
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
