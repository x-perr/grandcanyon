'use client'

import { Mail, CheckCircle, XCircle, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { InvoiceEmail } from '@/app/(protected)/invoices/actions'
import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'

interface EmailHistoryProps {
  emails: InvoiceEmail[]
}

export function EmailHistory({ emails }: EmailHistoryProps) {
  const t = useTranslations('invoices.email_history')
  const locale = useLocale()

  if (emails.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" />
            {t('title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">{t('no_emails')}</p>
        </CardContent>
      </Card>
    )
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'opened':
        return <CheckCircle className="h-4 w-4 text-emerald-600" />
      case 'clicked':
        return <CheckCircle className="h-4 w-4 text-teal-600" />
      case 'failed':
      case 'bounced':
      case 'complained':
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <Clock className="h-4 w-4 text-blue-600" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return (
          <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
            {t('status_delivered')}
          </Badge>
        )
      case 'opened':
        return (
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
            {t('status_opened')}
          </Badge>
        )
      case 'clicked':
        return (
          <Badge variant="outline" className="border-teal-200 bg-teal-50 text-teal-700">
            {t('status_clicked')}
          </Badge>
        )
      case 'failed':
        return (
          <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
            {t('status_failed')}
          </Badge>
        )
      case 'bounced':
        return (
          <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">
            {t('status_bounced')}
          </Badge>
        )
      case 'complained':
        return (
          <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
            {t('status_complained')}
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
            {t('status_sent')}
          </Badge>
        )
    }
  }

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4" />
          {t('title')} ({emails.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {emails.map((email) => (
            <div
              key={email.id}
              className="flex items-start justify-between border-b pb-3 last:border-0 last:pb-0"
            >
              <div className="flex items-start gap-3">
                {getStatusIcon(email.status)}
                <div>
                  <p className="text-sm font-medium">{email.sent_to}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(email.sent_at)} {t('sent_by').toLowerCase()} {email.sent_by_name}
                  </p>
                  {email.error_message && (
                    <p className="text-xs text-red-600 mt-1">{email.error_message}</p>
                  )}
                </div>
              </div>
              {getStatusBadge(email.status)}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
