'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { provinces } from '@/lib/validations/client'
import { createClientAction, updateClientAction } from '@/app/(protected)/clients/actions'
import type { Tables } from '@/types/database'

type Client = Tables<'clients'>

interface ClientFormProps {
  client?: Client | null
  mode: 'create' | 'edit'
}

type FormState = { error?: string } | void

export function ClientForm({ client, mode }: ClientFormProps) {
  const t = useTranslations('clients')
  const tCommon = useTranslations('common')

  const action = mode === 'create'
    ? createClientAction
    : updateClientAction.bind(null, client?.id ?? '')

  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    async (_, formData) => {
      const result = await action(formData)
      return result
    },
    undefined
  )

  return (
    <form action={formAction} className="space-y-6">
      {/* Back link */}
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={client ? `/clients/${client.id}` : '/clients'}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {tCommon('actions.back')}
          </Link>
        </Button>
      </div>

      {/* Error display */}
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>{t('form.basic_info')}</CardTitle>
          <CardDescription>{t('form.basic_info_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="code">{t('form.client_code')} *</Label>
            <Input
              id="code"
              name="code"
              placeholder={t('form.client_code_placeholder')}
              defaultValue={client?.code ?? ''}
              className="uppercase"
              required
              maxLength={10}
            />
            <p className="text-xs text-muted-foreground">{t('form.client_code_help')}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="short_name">{t('form.short_name')} *</Label>
            <Input
              id="short_name"
              name="short_name"
              placeholder={t('form.short_name_placeholder')}
              defaultValue={client?.short_name ?? ''}
              required
              maxLength={50}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">{t('form.full_name')} *</Label>
            <Input
              id="name"
              name="name"
              placeholder={t('form.full_name_placeholder')}
              defaultValue={client?.name ?? ''}
              required
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="general_email">{t('form.email')}</Label>
            <Input
              id="general_email"
              name="general_email"
              type="email"
              placeholder={t('form.email_placeholder')}
              defaultValue={client?.general_email ?? ''}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">{t('form.phone')}</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              placeholder={t('form.phone_placeholder')}
              defaultValue={client?.phone ?? ''}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="website">{t('form.website')}</Label>
            <Input
              id="website"
              name="website"
              type="url"
              placeholder={t('form.website_placeholder')}
              defaultValue={client?.website ?? ''}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tax Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t('form.tax_settings')}</CardTitle>
          <CardDescription>{t('form.tax_settings_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="charges_gst"
              name="charges_gst"
              defaultChecked={client?.charges_gst ?? true}
            />
            <Label htmlFor="charges_gst" className="cursor-pointer">
              {t('form.charge_gst')}
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="charges_qst"
              name="charges_qst"
              defaultChecked={client?.charges_qst ?? true}
            />
            <Label htmlFor="charges_qst" className="cursor-pointer">
              {t('form.charge_qst')}
            </Label>
          </div>
          <div className="space-y-2 max-w-xs">
            <Label htmlFor="next_project_number">{t('detail.next_project_number')}</Label>
            <Input
              id="next_project_number"
              name="next_project_number"
              type="number"
              min={1}
              defaultValue={client?.next_project_number ?? 1}
            />
          </div>
        </CardContent>
      </Card>

      {/* Postal Address */}
      <Card>
        <CardHeader>
          <CardTitle>{t('form.postal_address')}</CardTitle>
          <CardDescription>{t('form.postal_address_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="postal_address_line1">{t('form.address_line1')}</Label>
            <Input
              id="postal_address_line1"
              name="postal_address_line1"
              placeholder={t('form.address_line1_placeholder')}
              defaultValue={client?.postal_address_line1 ?? ''}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="postal_address_line2">{t('form.address_line2')}</Label>
            <Input
              id="postal_address_line2"
              name="postal_address_line2"
              placeholder={t('form.address_line2_placeholder')}
              defaultValue={client?.postal_address_line2 ?? ''}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="postal_city">{t('form.city')}</Label>
            <Input
              id="postal_city"
              name="postal_city"
              placeholder={t('form.city_placeholder')}
              defaultValue={client?.postal_city ?? ''}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="postal_province">{t('form.province')}</Label>
            <Select name="postal_province" defaultValue={client?.postal_province ?? ''}>
              <SelectTrigger>
                <SelectValue placeholder={t('form.select_province')} />
              </SelectTrigger>
              <SelectContent>
                {provinces.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="postal_code">{t('form.postal_code')}</Label>
            <Input
              id="postal_code"
              name="postal_code"
              placeholder={t('form.postal_code_placeholder')}
              defaultValue={client?.postal_code ?? ''}
              className="uppercase"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="postal_country">{tCommon('labels.country')}</Label>
            <Input
              id="postal_country"
              name="postal_country"
              defaultValue={client?.postal_country ?? 'Canada'}
            />
          </div>
        </CardContent>
      </Card>

      {/* Billing Address */}
      <Card>
        <CardHeader>
          <CardTitle>{t('form.billing_address')}</CardTitle>
          <CardDescription>{t('form.billing_address_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="billing_address_line1">{t('form.address_line1')}</Label>
            <Input
              id="billing_address_line1"
              name="billing_address_line1"
              placeholder={t('form.same_as_postal')}
              defaultValue={client?.billing_address_line1 ?? ''}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="billing_address_line2">{t('form.address_line2')}</Label>
            <Input
              id="billing_address_line2"
              name="billing_address_line2"
              defaultValue={client?.billing_address_line2 ?? ''}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="billing_city">{t('form.city')}</Label>
            <Input
              id="billing_city"
              name="billing_city"
              defaultValue={client?.billing_city ?? ''}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="billing_province">{t('form.province')}</Label>
            <Select name="billing_province" defaultValue={client?.billing_province ?? ''}>
              <SelectTrigger>
                <SelectValue placeholder={t('form.select_province')} />
              </SelectTrigger>
              <SelectContent>
                {provinces.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="billing_postal_code">{t('form.postal_code')}</Label>
            <Input
              id="billing_postal_code"
              name="billing_postal_code"
              className="uppercase"
              defaultValue={client?.billing_postal_code ?? ''}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="billing_email">{t('form.billing_email')}</Label>
            <Input
              id="billing_email"
              name="billing_email"
              type="email"
              placeholder={t('form.billing_email_placeholder')}
              defaultValue={client?.billing_email ?? ''}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>{tCommon('labels.notes')}</CardTitle>
          <CardDescription>{t('form.notes_desc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            id="notes"
            name="notes"
            rows={4}
            placeholder={t('form.notes_placeholder')}
            defaultValue={client?.notes ?? ''}
          />
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" asChild>
          <Link href={client ? `/clients/${client.id}` : '/clients'}>{tCommon('actions.cancel')}</Link>
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === 'create' ? tCommon('actions.create') : tCommon('actions.save')}
        </Button>
      </div>
    </form>
  )
}
