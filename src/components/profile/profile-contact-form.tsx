'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateProfileContact } from '@/app/(protected)/profile/actions'
import { toast } from 'sonner'

interface ProfileContactFormProps {
  phone: string
  email: string
}

export function ProfileContactForm({ phone, email }: ProfileContactFormProps) {
  const t = useTranslations('profile.contact')
  const tc = useTranslations('common.actions')
  const [isPending, startTransition] = useTransition()
  const [formPhone, setFormPhone] = useState(phone)

  const handleSubmit = async (formData: FormData) => {
    startTransition(async () => {
      const result = await updateProfileContact(formData)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(t('updated'))
      }
    })
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{t('email')}</Label>
        <Input
          id="email"
          type="email"
          value={email}
          disabled
          className="bg-muted"
        />
        <p className="text-xs text-muted-foreground">{t('email_readonly')}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">{t('phone')}</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          value={formPhone}
          onChange={(e) => setFormPhone(e.target.value)}
          placeholder={t('phone_placeholder')}
          disabled={isPending}
        />
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? tc('saving') : tc('save')}
      </Button>
    </form>
  )
}
