'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { sendInvoiceWithEmail } from '@/app/(protected)/invoices/actions'
import { useTranslations } from 'next-intl'

interface SendInvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceId: string
  invoiceNumber: string
  clientName: string
  clientEmail: string | null
  total: string
  dueDate: string
}

export function SendInvoiceDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  clientName,
  clientEmail,
  total,
  dueDate,
}: SendInvoiceDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [email, setEmail] = useState(clientEmail ?? '')
  const [customMessage, setCustomMessage] = useState('')
  const t = useTranslations('invoices')
  const tc = useTranslations('common')

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setEmail(clientEmail ?? '')
      setCustomMessage('')
    }
  }, [open, clientEmail])

  const handleSend = () => {
    if (!email) {
      toast.error(t('send.validation_email_required'))
      return
    }

    // Basic email validation
    if (!email.includes('@') || !email.includes('.')) {
      toast.error(t('send.validation_email_invalid'))
      return
    }

    startTransition(async () => {
      const result = await sendInvoiceWithEmail(invoiceId, email, customMessage || undefined)

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(t('send.success', { email }))
        onOpenChange(false)
        router.refresh()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {t('send.send_title', { number: invoiceNumber })}
          </DialogTitle>
          <DialogDescription>{t('send.send_description', { client: clientName })}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!clientEmail && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t('send.no_email_warning')}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">{t('send.recipient_email')}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('send.email_placeholder')}
              disabled={isPending}
            />
          </div>

          <div className="rounded-md border p-3 bg-muted/50 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('detail.client')}:</span>
              <span className="font-medium">{clientName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tc('labels.total')}:</span>
              <span className="font-medium">{total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('detail.due_date')}:</span>
              <span>{dueDate}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customMessage">{t('send.custom_message')}</Label>
            <Textarea
              id="customMessage"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder={t('send.message_placeholder')}
              rows={3}
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              {t('send.message_help')}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {tc('actions.cancel')}
          </Button>
          <Button onClick={handleSend} disabled={isPending || !email}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('send.sending')}
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                {t('send.send_invoice')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
