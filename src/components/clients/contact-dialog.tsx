'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { Tables } from '@/types/database'
import {
  createContactAction,
  updateContactAction,
} from '@/app/(protected)/clients/[id]/contacts/actions'

type Contact = Tables<'client_contacts'>

interface ContactDialogProps {
  clientId: string
  contact?: Contact | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function ContactDialog({
  clientId,
  contact,
  open,
  onOpenChange,
  onSuccess,
}: ContactDialogProps) {
  const t = useTranslations('clients')
  const tCommon = useTranslations('common')
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEdit = !!contact

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setIsPending(true)

    const formData = new FormData(e.currentTarget)

    try {
      const result = isEdit
        ? await updateContactAction(clientId, contact.id, formData)
        : await createContactAction(clientId, formData)

      if (result?.error) {
        setError(result.error)
      } else {
        onOpenChange(false)
        onSuccess?.()
      }
    } catch {
      setError(tCommon('errors.generic'))
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? t('contacts.edit_contact') : t('contacts.add_contact')}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? t('contacts.edit_desc')
                : t('contacts.add_desc')}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">{t('contacts.first_name')} *</Label>
                <Input
                  id="first_name"
                  name="first_name"
                  defaultValue={contact?.first_name ?? ''}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">{t('contacts.last_name')} *</Label>
                <Input
                  id="last_name"
                  name="last_name"
                  defaultValue={contact?.last_name ?? ''}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">{t('contacts.title_field')}</Label>
              <Input
                id="title"
                name="title"
                placeholder={t('contacts.title_placeholder')}
                defaultValue={contact?.title ?? ''}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t('contacts.email')}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder={t('contacts.email_placeholder')}
                defaultValue={contact?.email ?? ''}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{t('contacts.phone')}</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder={t('contacts.phone_placeholder')}
                defaultValue={contact?.phone ?? ''}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_primary"
                name="is_primary"
                defaultChecked={contact?.is_primary ?? false}
              />
              <Label htmlFor="is_primary" className="cursor-pointer">
                {t('contacts.is_primary')}
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {tCommon('actions.cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? tCommon('actions.save') : t('contacts.add_contact')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
