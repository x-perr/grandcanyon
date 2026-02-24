'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Send, CheckCircle, XCircle, Trash2, MoreHorizontal, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { markInvoicePaid, cancelInvoice, deleteInvoice } from '@/app/(protected)/invoices/actions'
import { SendInvoiceDialog } from './send-invoice-dialog'
import { useTranslations } from 'next-intl'

interface InvoiceActionsProps {
  invoiceId: string
  status: string
  // Props for send dialog
  invoiceNumber?: string
  clientName?: string
  clientEmail?: string | null
  total?: string
  dueDate?: string
}

type ActionType = 'pay' | 'cancel' | 'delete' | null

export function InvoiceActions({
  invoiceId,
  status,
  invoiceNumber = '',
  clientName = '',
  clientEmail = null,
  total = '',
  dueDate = '',
}: InvoiceActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [dialogAction, setDialogAction] = useState<ActionType>(null)
  const [sendDialogOpen, setSendDialogOpen] = useState(false)
  const t = useTranslations('invoices')
  const tc = useTranslations('common')

  const isDraft = status === 'draft'
  const isSent = status === 'sent'

  const handleAction = async (action: ActionType) => {
    if (!action) return

    startTransition(async () => {
      let result: { error?: string; success?: boolean } | undefined

      try {
        switch (action) {
          case 'pay':
            result = await markInvoicePaid(invoiceId)
            if (result?.success) {
              toast.success(t('toast.marked_paid'))
            }
            break
          case 'cancel':
            result = await cancelInvoice(invoiceId)
            // cancelInvoice redirects, so no toast needed
            break
          case 'delete':
            result = await deleteInvoice(invoiceId)
            // deleteInvoice redirects, so no toast needed
            break
        }

        if (result?.error) {
          toast.error(result.error)
        }
      } catch (error) {
        toast.error(t('actions.error_occurred'))
        console.error('Invoice action error:', error)
      }

      setDialogAction(null)
      router.refresh()
    })
  }

  const getDialogConfig = () => {
    switch (dialogAction) {
      case 'pay':
        return {
          title: t('actions.mark_paid_title'),
          description: t('actions.mark_paid_description'),
          actionLabel: t('actions.mark_paid'),
          variant: 'default' as const,
        }
      case 'cancel':
        return {
          title: t('actions.cancel_title'),
          description: t('actions.cancel_description'),
          actionLabel: t('actions.cancel_invoice'),
          variant: 'destructive' as const,
        }
      case 'delete':
        return {
          title: t('actions.delete_title'),
          description: t('actions.delete_description'),
          actionLabel: t('actions.delete_invoice'),
          variant: 'destructive' as const,
        }
      default:
        return null
    }
  }

  const dialogConfig = getDialogConfig()

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" disabled={isPending}>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreHorizontal className="h-4 w-4" />
            )}
            <span className="sr-only">{t('actions.more_actions')}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* Send - Draft only */}
          {isDraft && (
            <DropdownMenuItem onClick={() => setSendDialogOpen(true)}>
              <Send className="mr-2 h-4 w-4" />
              {t('actions.send_invoice')}
            </DropdownMenuItem>
          )}

          {/* Mark as Paid - Sent only */}
          {isSent && (
            <DropdownMenuItem onClick={() => setDialogAction('pay')}>
              <CheckCircle className="mr-2 h-4 w-4" />
              {t('actions.mark_paid')}
            </DropdownMenuItem>
          )}

          {/* Cancel - Draft or Sent */}
          {(isDraft || isSent) && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDialogAction('cancel')}
                className="text-destructive focus:text-destructive"
              >
                <XCircle className="mr-2 h-4 w-4" />
                {t('actions.cancel_invoice')}
              </DropdownMenuItem>
            </>
          )}

          {/* Delete - Draft only */}
          {isDraft && (
            <DropdownMenuItem
              onClick={() => setDialogAction('delete')}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t('actions.delete_invoice')}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Send Invoice Dialog */}
      <SendInvoiceDialog
        open={sendDialogOpen}
        onOpenChange={setSendDialogOpen}
        invoiceId={invoiceId}
        invoiceNumber={invoiceNumber}
        clientName={clientName}
        clientEmail={clientEmail}
        total={total}
        dueDate={dueDate}
      />

      {/* Confirmation Dialog */}
      <AlertDialog
        open={dialogAction !== null}
        onOpenChange={(open) => !open && setDialogAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogConfig?.title}</AlertDialogTitle>
            <AlertDialogDescription>{dialogConfig?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>{tc('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleAction(dialogAction)}
              disabled={isPending}
              className={
                dialogConfig?.variant === 'destructive'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : ''
              }
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dialogConfig?.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
