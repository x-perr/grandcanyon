import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  Pencil,
  FolderOpen,
  Receipt,
  DollarSign,
  FileText,
  Clock,
  AlertCircle,
  CheckCircle2,
  CircleDashed,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/ui/status-badge'
import { ContactList } from '@/components/clients/contact-list'
import { getClient360, type ClientInvoice, type ClientExpense } from '../actions'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { provinces } from '@/lib/validations/client'
import type { Enums } from '@/types/database'
import { formatCurrency } from '@/lib/utils'

type ProjectStatus = Enums<'project_status'>
type InvoiceStatus = Enums<'invoice_status'>

interface ClientProject {
  id: string
  code: string
  name: string
  status: ProjectStatus
  is_active: boolean | null
}

interface ClientDetailPageProps {
  params: Promise<{ id: string }>
}

function InvoiceStatusBadge({ status, dueDate }: { status: InvoiceStatus; dueDate: string | null }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (status === 'paid') {
    return (
      <Badge variant="default" className="bg-green-500">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Paid
      </Badge>
    )
  }

  if (status === 'void') {
    return <Badge variant="secondary">Void</Badge>
  }

  if (status === 'draft') {
    return (
      <Badge variant="outline">
        <CircleDashed className="mr-1 h-3 w-3" />
        Draft
      </Badge>
    )
  }

  // Status is 'sent' - check if overdue
  if (dueDate) {
    const due = new Date(dueDate)
    due.setHours(0, 0, 0, 0)
    const diffDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return (
        <Badge variant="destructive">
          <AlertCircle className="mr-1 h-3 w-3" />
          {Math.abs(diffDays)}d overdue
        </Badge>
      )
    }

    if (diffDays <= 7) {
      return (
        <Badge variant="default" className="bg-amber-500">
          <Clock className="mr-1 h-3 w-3" />
          Due in {diffDays}d
        </Badge>
      )
    }
  }

  return (
    <Badge variant="default" className="bg-blue-500">
      <Clock className="mr-1 h-3 w-3" />
      Sent
    </Badge>
  )
}

export default async function ClientDetailPage({ params }: ClientDetailPageProps) {
  const { id } = await params
  const [data, permissions, t, tCommon, tProjects, tInvoices] = await Promise.all([
    getClient360(id),
    getUserPermissions(),
    getTranslations('clients'),
    getTranslations('common'),
    getTranslations('projects'),
    getTranslations('invoices'),
  ])

  if (!data?.client) {
    notFound()
  }

  const { client, invoices, expenses, financials } = data
  const canEdit = hasPermission(permissions, 'clients.edit')

  const getProvinceName = (code: string | null) => {
    if (!code) return null
    return provinces.find((p) => p.value === code)?.label ?? code
  }

  const formatAddress = (prefix: 'postal' | 'billing') => {
    const line1 = prefix === 'postal' ? client.postal_address_line1 : client.billing_address_line1
    const line2 = prefix === 'postal' ? client.postal_address_line2 : client.billing_address_line2
    const city = prefix === 'postal' ? client.postal_city : client.billing_city
    const province = prefix === 'postal' ? client.postal_province : client.billing_province
    const postalCode = prefix === 'postal' ? client.postal_code : client.billing_postal_code

    if (!line1 && !city) return null

    const parts = [line1, line2, city && province ? `${city}, ${province}` : city || province, postalCode].filter(
      Boolean
    )

    return parts.join('\n')
  }

  const activeProjects = (client.projects as ClientProject[] | undefined)?.filter((p) => p.is_active) ?? []

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/clients">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {tCommon('actions.back')}
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg font-semibold text-muted-foreground">{client.code}</span>
              {client.is_active === false && (
                <Badge variant="secondary">{tCommon('status.inactive')}</Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold">{client.name}</h1>
            {client.short_name !== client.name && <p className="text-muted-foreground">{client.short_name}</p>}
          </div>
        </div>
        {canEdit && (
          <Button asChild>
            <Link href={`/clients/${client.id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              {t('edit_client')}
            </Link>
          </Button>
        )}
      </div>

      {/* Top Row: Info Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Company Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('detail.contact_info')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {client.general_email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${client.general_email}`} className="text-primary hover:underline truncate">
                  {client.general_email}
                </a>
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${client.phone}`} className="hover:underline">
                  {client.phone}
                </a>
              </div>
            )}
            {client.website && (
              <div className="flex items-center gap-2 text-sm">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <a
                  href={client.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline truncate"
                >
                  {client.website.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
            {formatAddress('postal') && (
              <div className="flex items-start gap-2 text-sm pt-1">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <address className="not-italic whitespace-pre-line text-muted-foreground">
                  {formatAddress('postal')}
                </address>
              </div>
            )}
            {!client.general_email && !client.phone && !client.website && !formatAddress('postal') && (
              <p className="text-sm text-muted-foreground">{t('detail.no_contact_info')}</p>
            )}
          </CardContent>
        </Card>

        {/* Financial Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('detail.financials')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('detail.total_billed')}</span>
              <span className="font-semibold">{formatCurrency(financials.totalBilled)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('detail.total_paid')}</span>
              <span className="font-semibold text-green-600">{formatCurrency(financials.totalPaid)}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-2">
              <span className="text-sm text-muted-foreground">{t('detail.total_outstanding')}</span>
              <span className={`font-semibold ${financials.totalOutstanding > 0 ? 'text-amber-600' : ''}`}>
                {formatCurrency(financials.totalOutstanding)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Activity Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('detail.activity')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('detail.active_projects_count')}</span>
              <span className="font-semibold">{activeProjects.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('detail.invoices_title')}</span>
              <span className="font-semibold">{financials.invoiceCount}</span>
            </div>
            {invoices[0] && (
              <div className="flex items-center justify-between border-t pt-2">
                <span className="text-sm text-muted-foreground">{t('detail.last_invoice')}</span>
                <span className="text-sm">
                  {new Date(invoices[0].invoice_date).toLocaleDateString()}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Contacts Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>{t('tabs.contacts')}</span>
            <Badge variant="secondary">{client.contacts?.length ?? 0}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ContactList clientId={client.id} contacts={client.contacts ?? []} canEdit={canEdit} />
        </CardContent>
      </Card>

      {/* Projects Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              <span>{t('tabs.projects')}</span>
              <Badge variant="secondary">{client.projects?.length ?? 0}</Badge>
            </CardTitle>
          </div>
          {canEdit && (
            <Button size="sm" asChild>
              <Link href={`/projects/new?client=${client.id}`}>
                <FolderOpen className="mr-2 h-4 w-4" />
                {tProjects('new_project')}
              </Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {client.projects?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <FolderOpen className="h-10 w-10 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">{t('detail.no_projects')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(client.projects as ClientProject[] | undefined)?.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium">{project.code}</span>
                        <StatusBadge status={project.status} />
                        {project.is_active === false && (
                          <Badge variant="outline" className="text-xs">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{project.name}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/projects/${project.id}`}>{tCommon('actions.view')}</Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoices Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              <span>{t('detail.invoices_title')}</span>
              <Badge variant="secondary">{financials.invoiceCount}</Badge>
            </CardTitle>
            <CardDescription>Recent invoices for this client</CardDescription>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/invoices?client=${client.id}`}>{t('detail.view_all_invoices')}</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Receipt className="h-10 w-10 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">{t('detail.no_invoices')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium">{invoice.invoice_number}</span>
                        <InvoiceStatusBadge status={invoice.status} dueDate={invoice.due_date} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {new Date(invoice.invoice_date).toLocaleDateString()}
                        {invoice.project && ` • ${invoice.project.code}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold">{formatCurrency(invoice.total)}</span>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/invoices/${invoice.id}`}>{tCommon('actions.view')}</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billable Expenses Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            <span>{t('detail.expenses_title')}</span>
          </CardTitle>
          <CardDescription>Recent billable expenses for this client&apos;s projects</CardDescription>
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <DollarSign className="h-10 w-10 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">{t('detail.no_expenses')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {expenses.map((expense) => {
                const isBilled = expense.invoice_line !== null
                return (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {expense.expense_type?.name ?? 'Expense'}
                          </span>
                          {isBilled ? (
                            <Badge variant="default" className="bg-green-500">
                              {t('detail.billed')}
                            </Badge>
                          ) : (
                            <Badge variant="outline">{t('detail.unbilled')}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {new Date(expense.expense_date).toLocaleDateString()}
                          {expense.project && ` • ${expense.project.code}`}
                          {expense.description && ` • ${expense.description}`}
                        </p>
                      </div>
                    </div>
                    <span className="font-semibold">{formatCurrency(expense.total)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tax Settings & Notes (collapsed details) */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Tax Settings */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('form.tax_settings')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>{t('detail.gst_label')}</span>
              <Badge variant={client.charges_gst ? 'default' : 'secondary'}>
                {client.charges_gst ? t('detail.charged') : t('detail.not_charged')}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>{t('detail.qst_label')}</span>
              <Badge variant={client.charges_qst ? 'default' : 'secondary'}>
                {client.charges_qst ? t('detail.charged') : t('detail.not_charged')}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        {client.notes && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{tCommon('labels.notes')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{client.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
