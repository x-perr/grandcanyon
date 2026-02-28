'use client'

import { useTransition } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updatePreferredLocale } from '@/app/(protected)/profile/actions'
import { setLocale } from '@/lib/locale'
import { toast } from 'sonner'

interface ProfilePreferencesFormProps {
  currentLocale: 'en' | 'fr' | null
}

export function ProfilePreferencesForm({ currentLocale }: ProfilePreferencesFormProps) {
  const t = useTranslations('profile.preferences')
  const [isPending, startTransition] = useTransition()
  const activeLocale = useLocale()

  const handleLocaleChange = async (value: string) => {
    const locale = value as 'en' | 'fr'
    startTransition(async () => {
      // Update in database
      const result = await updatePreferredLocale(locale)
      if (result.error) {
        toast.error(result.error)
        return
      }

      // Update cookie for immediate effect
      await setLocale(locale)
      toast.success(t('updated'))
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="language">{t('language')}</Label>
        <Select
          value={currentLocale || activeLocale}
          onValueChange={handleLocaleChange}
          disabled={isPending}
        >
          <SelectTrigger id="language">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="fr">Français</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{t('language_note')}</p>
      </div>
    </div>
  )
}
