'use client'

import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { updateBillingSettings } from '@/app/(protected)/admin/actions'
import type { BillingSettings } from '@/types/billing'

interface BillingSettingsFormProps {
  settings: BillingSettings
}

type FormState = { error?: string } | void

export function BillingSettingsForm({ settings }: BillingSettingsFormProps) {
  const t = useTranslations('admin')
  const tCommon = useTranslations('common')

  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    async (_, formData) => {
      const result = await updateBillingSettings(formData)
      if (result.error) {
        return result
      }
      toast.success(t('billing.settingsSaved'))
      return undefined
    },
    undefined
  )

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {/* Overtime Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            {t('billing.otSettings')}
          </CardTitle>
          <CardDescription>{t('billing.otSettingsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="ot_default_mode">{t('billing.otDefaultMode')}</Label>
            <Select name="ot_default_mode" defaultValue={settings.ot_default_mode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flat">{t('billing.otModeFlat')}</SelectItem>
                <SelectItem value="standard">{t('billing.otModeStandard')}</SelectItem>
                <SelectItem value="custom">{t('billing.otModeCustom')}</SelectItem>
                <SelectItem value="off">{t('billing.otModeOff')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ot_standard_multiplier_1_5x">
              {t('billing.otMultiplier15x')}
            </Label>
            <Input
              id="ot_standard_multiplier_1_5x"
              name="ot_standard_multiplier_1_5x"
              type="number"
              step="0.01"
              min="1"
              max="5"
              defaultValue={settings.ot_standard_multiplier_1_5x}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ot_standard_multiplier_2x">
              {t('billing.otMultiplier2x')}
            </Label>
            <Input
              id="ot_standard_multiplier_2x"
              name="ot_standard_multiplier_2x"
              type="number"
              step="0.01"
              min="1"
              max="5"
              defaultValue={settings.ot_standard_multiplier_2x}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ot_custom_multiplier_1_5x">
              {t('billing.otCustomMultiplier15x')}
            </Label>
            <Input
              id="ot_custom_multiplier_1_5x"
              name="ot_custom_multiplier_1_5x"
              type="number"
              step="0.01"
              min="1"
              max="5"
              defaultValue={settings.ot_custom_multiplier_1_5x ?? ''}
              placeholder={t('billing.optionalPlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ot_custom_multiplier_2x">
              {t('billing.otCustomMultiplier2x')}
            </Label>
            <Input
              id="ot_custom_multiplier_2x"
              name="ot_custom_multiplier_2x"
              type="number"
              step="0.01"
              min="1"
              max="5"
              defaultValue={settings.ot_custom_multiplier_2x ?? ''}
              placeholder={t('billing.optionalPlaceholder')}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="ot_approval_default">{t('billing.otApprovalDefault')}</Label>
            <Select name="ot_approval_default" defaultValue={settings.ot_approval_default}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pre_approved">{t('billing.otPreApproved')}</SelectItem>
                <SelectItem value="per_instance">{t('billing.otPerInstance')}</SelectItem>
                <SelectItem value="never">{t('billing.otNever')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Retainage */}
      <Card>
        <CardHeader>
          <CardTitle>{t('billing.retainageSettings')}</CardTitle>
          <CardDescription>{t('billing.retainageSettingsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="retainage_default_percent">
              {t('billing.retainagePercent')}
            </Label>
            <Input
              id="retainage_default_percent"
              name="retainage_default_percent"
              type="number"
              step="0.5"
              min="0"
              max="100"
              defaultValue={settings.retainage_default_percent}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="retainage_hold_days">
              {t('billing.retainageHoldDays')}
            </Label>
            <Input
              id="retainage_hold_days"
              name="retainage_hold_days"
              type="number"
              min="0"
              max="365"
              defaultValue={settings.retainage_hold_days}
            />
          </div>

          <div className="flex items-center gap-2 sm:col-span-2">
            <Checkbox
              id="retainage_on_subtotal"
              name="retainage_on_subtotal"
              defaultChecked={settings.retainage_on_subtotal}
              value="true"
            />
            <Label htmlFor="retainage_on_subtotal" className="text-sm font-normal">
              {t('billing.retainageOnSubtotal')}
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Learning Phase */}
      <Card>
        <CardHeader>
          <CardTitle>{t('billing.learningPhaseSettings')}</CardTitle>
          <CardDescription>{t('billing.learningPhaseDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="learning_phase_default_weeks">
              {t('billing.learningPhaseWeeks')}
            </Label>
            <Input
              id="learning_phase_default_weeks"
              name="learning_phase_default_weeks"
              type="number"
              min="0"
              max="52"
              defaultValue={settings.learning_phase_default_weeks}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="learning_phase_alert_days">
              {t('billing.learningPhaseAlertDays')}
            </Label>
            <Input
              id="learning_phase_alert_days"
              name="learning_phase_alert_days"
              type="number"
              min="0"
              max="30"
              defaultValue={settings.learning_phase_alert_days}
            />
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {tCommon('actions.save_changes')}
        </Button>
      </div>
    </form>
  )
}
